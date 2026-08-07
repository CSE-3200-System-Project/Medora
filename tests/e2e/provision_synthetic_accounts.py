"""Provision non-production synthetic accounts for the authenticated Playwright journeys.

The release gate's "Authenticated production-browser journeys" entry is blocked because
`E2E_EMAIL` / `E2E_PASSWORD` have never existed, so six credentialed specs skip and
`E2E_ALLOW_SKIPS=1` has to be set for the run to finish at all.

This creates one account per role through the GoTrue admin API and gives each a matching
`profiles` row, then writes the credentials to `tests/e2e/.env.e2e.local`, which
`.gitignore` already excludes via `.env.*`.

    backend/venv/Scripts/python.exe tests/e2e/provision_synthetic_accounts.py
    backend/venv/Scripts/python.exe tests/e2e/provision_synthetic_accounts.py --delete

Addresses use the reserved `example.com` domain and every account is marked in
`first_name`/`last_name`, so a synthetic row is never mistaken for a real patient. Run
`--delete` when the accounts are no longer needed; the rows are real rows in a real
project and should not outlive the verification run that needs them.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / "backend" / ".env"
CREDENTIALS_FILE = ROOT / "tests" / "e2e" / ".env.e2e.local"

ROLES = ("patient", "doctor", "admin")
EMAIL_TEMPLATE = "medora.e2e.{role}@example.com"
# GoTrue's admin API refuses to send mail for these, which is what we want: the accounts
# are confirmed at creation and never receive a message.
USER_AGENT = "Medora-e2e-provisioner/1.0"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if match:
            values[match.group(1)] = match.group(2).strip().strip('"').strip("'")
    return values


def gotrue(method: str, path: str, base_url: str, service_key: str, payload: dict | None = None):
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/auth/v1{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()[:300]


def find_user(email: str, base_url: str, service_key: str) -> dict | None:
    status, body = gotrue("GET", f"/admin/users?page=1&per_page=200", base_url, service_key)
    if status != 200 or not isinstance(body, dict):
        return None
    for user in body.get("users", []):
        if user.get("email") == email:
            return user
    return None


async def upsert_profiles(database_url: str, accounts: list[dict]) -> None:
    import asyncpg

    # asyncpg speaks the wire protocol directly, so the SQLAlchemy-style prefix has to go.
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://")
    connection = await asyncpg.connect(dsn, statement_cache_size=0)
    try:
        for account in accounts:
            await connection.execute(
                """
                INSERT INTO profiles (id, role, status, verification_status, first_name,
                                      last_name, email, onboarding_completed,
                                      created_at, updated_at)
                VALUES ($1, $2, 'active', $3, 'Synthetic', $4, $5, $6, now(), now())
                ON CONFLICT (id) DO UPDATE
                    SET role = EXCLUDED.role,
                        status = 'active',
                        email = EXCLUDED.email,
                        onboarding_completed = EXCLUDED.onboarding_completed,
                        updated_at = now()
                """,
                account["id"],
                # SQLAlchemy stores Enum members by name, so the Postgres type holds
                # ADMIN/DOCTOR/PATIENT rather than the lower-case values.
                account["role"].upper(),
                "verified" if account["role"] == "doctor" else "unverified",
                f"E2E {account['role'].title()}",
                account["email"],
                # Onboarding must read as complete or the wizard overlays every patient
                # page and the find-doctor and find-medicine journeys cannot reach their
                # own controls. The onboarding spec opens ?mode=edit explicitly, so it is
                # unaffected.
                True,
            )
            if account["role"] == "patient":
                await connection.execute(
                    "INSERT INTO patient_profiles (profile_id) VALUES ($1) ON CONFLICT (profile_id) DO NOTHING",
                    account["id"],
                )
            elif account["role"] == "doctor":
                await connection.execute(
                    """
                    INSERT INTO doctor_profiles (profile_id, bmdc_number, bmdc_verified, created_at)
                    VALUES ($1, $2, false, now())
                    ON CONFLICT (profile_id) DO NOTHING
                    """,
                    account["id"],
                    f"E2E-{account['id'][:8]}",
                )
    finally:
        await connection.close()


async def delete_profiles(database_url: str, user_ids: list[str]) -> None:
    import asyncpg

    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://")
    connection = await asyncpg.connect(dsn, statement_cache_size=0)
    try:
        await connection.execute("DELETE FROM profiles WHERE id = ANY($1::text[])", user_ids)
    finally:
        await connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delete", action="store_true", help="remove the synthetic accounts and exit")
    args = parser.parse_args()

    env = load_env(ENV_FILE)
    base_url = env.get("SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    database_url = env.get("SUPABASE_DATABASE_URL")
    if not (base_url and service_key and database_url):
        print("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DATABASE_URL are required", file=sys.stderr)
        return 2

    if args.delete:
        removed = []
        for role in ROLES:
            user = find_user(EMAIL_TEMPLATE.format(role=role), base_url, service_key)
            if not user:
                continue
            status, _ = gotrue("DELETE", f"/admin/users/{user['id']}", base_url, service_key)
            print(f"delete {role}: HTTP {status}")
            removed.append(user["id"])
        if removed:
            asyncio.run(delete_profiles(database_url, removed))
        CREDENTIALS_FILE.unlink(missing_ok=True)
        return 0

    accounts = []
    for role in ROLES:
        email = EMAIL_TEMPLATE.format(role=role)
        password = f"E2e!{secrets.token_urlsafe(18)}"
        status, body = gotrue(
            "POST",
            "/admin/users",
            base_url,
            service_key,
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"synthetic": True, "purpose": "medora-release-verification", "role": role},
            },
        )
        if status in (200, 201) and isinstance(body, dict):
            user_id = body["id"]
        else:
            existing = find_user(email, base_url, service_key)
            if not existing:
                print(f"could not create or find {email}: HTTP {status} {body}", file=sys.stderr)
                return 2
            user_id = existing["id"]
            status, body = gotrue(
                "PUT", f"/admin/users/{user_id}", base_url, service_key, {"password": password, "email_confirm": True}
            )
            if status != 200:
                print(f"could not reset password for {email}: HTTP {status} {body}", file=sys.stderr)
                return 2
        accounts.append({"id": user_id, "email": email, "password": password, "role": role})
        print(f"{role}: {email} ({user_id})")

    asyncio.run(upsert_profiles(database_url, accounts))

    patient = next(account for account in accounts if account["role"] == "patient")
    lines = [
        "# Generated by tests/e2e/provision_synthetic_accounts.py. Not for production use.",
        "# Ignored by .gitignore's `.env.*` rule. Delete with --delete when finished.",
        f"E2E_EMAIL={patient['email']}",
        f"E2E_PASSWORD={patient['password']}",
    ]
    for account in accounts:
        role = account["role"].upper()
        lines.append(f"E2E_{role}_EMAIL={account['email']}")
        lines.append(f"E2E_{role}_PASSWORD={account['password']}")
        lines.append(f"E2E_{role}_ID={account['id']}")
    CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {CREDENTIALS_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
