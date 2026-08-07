#!/usr/bin/env python3
"""Fail if the Python enums and the database enum types disagree.

Eleven members across five enums were usable in code and rejected by Postgres, and two
labels existed in Postgres with no member to read them into. Neither showed up in the
test suite, because the integration database is built with `Base.metadata.create_all`,
which generates the enum types from the same models it is checking. Only a real database
can catch this.

    backend/venv/Scripts/python.exe tools/release/check_enum_sync.py

Reads SUPABASE_DATABASE_URL (or MEDORA_DB_URL) from backend/.env or the environment.
Exits 2 on any mismatch.
"""

from __future__ import annotations

import asyncio
import enum
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def database_url() -> str | None:
    for key in ("MEDORA_DB_URL", "SUPABASE_DATABASE_URL"):
        if os.environ.get(key):
            return os.environ[key]
    env_file = ROOT / "backend" / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^SUPABASE_DATABASE_URL=(.*)$", line.strip())
            if match:
                return match.group(1).strip().strip('"').strip("'")
    return None


async def main() -> int:
    import asyncpg

    from app.db.models import enums as model_enums

    url = database_url()
    if not url:
        print("SUPABASE_DATABASE_URL or MEDORA_DB_URL is required", file=sys.stderr)
        return 2

    classes = {
        name: value
        for name, value in vars(model_enums).items()
        if isinstance(value, type) and issubclass(value, enum.Enum) and value is not enum.Enum
    }

    connection = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"), statement_cache_size=0)
    try:
        rows = await connection.fetch(
            """
            SELECT t.typname, array_agg(e.enumlabel) AS labels
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            GROUP BY 1
            """
        )
    finally:
        await connection.close()

    database = {row["typname"]: list(row["labels"]) for row in rows}
    errors: list[str] = []

    for name, cls in sorted(classes.items()):
        matches = [key for key in database if key.lower() == name.lower()]
        if not matches:
            continue
        labels = database[matches[0]]
        lowered = {label.lower() for label in labels}

        # A member is usable if the type carries either its name or its value: this
        # schema stores some enums by name (userrole) and others by value (medicinetype).
        unwritable = [m.name for m in cls if m.name.lower() not in lowered and str(m.value).lower() not in lowered]
        if unwritable:
            errors.append(f"{name}: code can produce {unwritable}, which {matches[0]} would reject")

        known = {m.name.lower() for m in cls} | {str(m.value).lower() for m in cls}
        unreadable = [label for label in labels if label.lower() not in known]
        if unreadable:
            errors.append(f"{name}: {matches[0]} holds {unreadable}, which no member can read")

    if errors:
        print("Enum synchronisation FAILED:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        return 2
    print(f"Enum synchronisation passed ({len(classes)} enums checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
