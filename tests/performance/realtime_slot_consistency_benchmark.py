from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx


def _target_datetime(days: int = 3) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Validate slot consistency under 100+ concurrent booking attempts.")
    parser.add_argument("--users", type=int, default=120)
    parser.add_argument("--report", type=str, default="tests/benchmarks/reports/current/realtime_consistency.json")
    args = parser.parse_args()

    base_url = os.getenv("MEDORA_BASE_URL", "http://localhost:8000").rstrip("/")
    doctor_id = os.getenv("MEDORA_DOCTOR_ID", "doctor-id")
    slot_note = os.getenv("MEDORA_BOOKING_SLOT", "Slot: 8:00 PM")
    tokens_env = [token.strip() for token in os.getenv("MEDORA_PATIENT_TOKENS", "").split(",") if token.strip()]
    if not tokens_env:
        tokens_env = [os.getenv("MEDORA_PATIENT_TOKEN", "patient-token")]

    successes = 0
    conflicts = 0
    failures = 0
    appointment_ids: list[str] = []

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        semaphore = asyncio.Semaphore(min(args.users, 150))

        async def _attempt(idx: int) -> None:
            nonlocal successes, conflicts, failures
            token = tokens_env[idx % len(tokens_env)]
            payload = {
                "doctor_id": doctor_id,
                "appointment_date": _target_datetime(),
                "reason": "Realtime slot race test",
                "notes": slot_note,
            }
            async with semaphore:
                response = await client.post(
                    "/appointment/",
                    headers={"Authorization": f"Bearer {token}"},
                    json=payload,
                )
            if response.status_code in {200, 201}:
                successes += 1
                try:
                    appointment_ids.append(str(response.json().get("id")))
                except Exception:
                    pass
            elif response.status_code in {400, 409}:
                conflicts += 1
            else:
                failures += 1

        await asyncio.gather(*[_attempt(i) for i in range(args.users)])

    unique_success_ids = len({item for item in appointment_ids if item})
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "users": args.users,
        "slot": slot_note,
        "doctor_id": doctor_id,
        "successes": successes,
        "conflicts": conflicts,
        "failures": failures,
        "unique_success_ids": unique_success_ids,
        "consistency_passed": unique_success_ids <= 1,
        "notes": "For strict slot-lock correctness, unique_success_ids should be <= 1 for a single slot race.",
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
