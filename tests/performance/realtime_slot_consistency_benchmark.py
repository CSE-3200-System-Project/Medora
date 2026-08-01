#!/usr/bin/env python3
"""Frozen appointment contention and post-commit outbox benchmark.

Required environment variables:
  MEDORA_BASE_URL, MEDORA_PATIENT_TOKENS, DATABASE_URL

The slot fixture is deliberately supplied by the operator. The script will not use
placeholder identities or silently reuse a previously occupied slot.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import httpx


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * fraction)]


def database_dsn(raw: str) -> str:
    return raw.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres+asyncpg://", "postgresql://", 1)


async def post_booking(client: httpx.AsyncClient, token: str, key: str, payload: dict) -> dict:
    started = time.perf_counter()
    response = await client.post(
        "/appointment/",
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
        json=payload,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text[:500]}
    return {"status": response.status_code, "body": body, "latency_ms": elapsed_ms, "key": key, "token_index": None}


async def wait_for_outbox(connection: asyncpg.Connection, appointment_id: str, timeout: float) -> dict:
    deadline = time.perf_counter() + timeout
    while time.perf_counter() < deadline:
        row = await connection.fetchrow(
            "SELECT created_at, processed_at, attempts, last_error FROM appointment_outbox_events WHERE aggregate_id=$1 ORDER BY created_at LIMIT 1",
            appointment_id,
        )
        if row and row["processed_at"]:
            return {
                "processed": True,
                "attempts": row["attempts"],
                "last_error": row["last_error"],
                "provider_propagation_ms": (row["processed_at"] - row["created_at"]).total_seconds() * 1000,
            }
        await asyncio.sleep(0.1)
    return {"processed": False, "attempts": row["attempts"] if row else None, "last_error": row["last_error"] if row else "missing event", "provider_propagation_ms": None}


async def run_level(
    *,
    client: httpx.AsyncClient,
    connection: asyncpg.Connection,
    tokens: list[str],
    concurrency: int,
    slots: list[dict],
    repetitions: int,
    outbox_timeout: float,
) -> dict:
    repetitions_output = []
    transaction_latencies: list[float] = []
    propagation_latencies: list[float] = []
    for repetition, slot in enumerate(slots[:repetitions]):
        payload = {
            "doctor_id": slot["doctor_id"],
            "doctor_location_id": slot.get("doctor_location_id"),
            "location_name": slot.get("location_name"),
            "appointment_date": slot["appointment_date"],
            "reason": "SoftwareX booking contention fixture",
            "notes": f"Slot: {slot['slot_label']}",
        }
        keys = [f"swx-{concurrency}-{repetition}-{uuid.uuid4()}" for _ in range(concurrency)]
        attempts = []
        for index in range(concurrency):
            attempt = post_booking(client, tokens[index % len(tokens)], keys[index], payload)
            attempts.append(attempt)
        results = await asyncio.gather(*attempts)
        for index, result in enumerate(results):
            result["token_index"] = index % len(tokens)
        successes = [item for item in results if item["status"] == 201]
        conflicts = [item for item in results if item["status"] in {400, 409}]
        unexpected = [item for item in results if item["status"] not in {201, 400, 409}]
        transaction_latencies.extend(item["latency_ms"] for item in results)

        appointment_ids = {str(item["body"].get("id")) for item in successes if item["body"].get("id")}
        database_rows = 0
        replay_ok = mismatch_rejected = outbox = False
        outbox_detail: dict = {}
        if len(appointment_ids) == 1:
            appointment_id = next(iter(appointment_ids))
            database_rows = await connection.fetchval("SELECT count(*) FROM appointments WHERE id=$1", appointment_id)
            winner = successes[0]
            replay = await post_booking(client, tokens[winner["token_index"]], winner["key"], payload)
            replay_ok = replay["status"] == 201 and str(replay["body"].get("id")) == appointment_id
            mismatch_payload = dict(payload)
            mismatch_payload["reason"] = "different request using the same idempotency key"
            mismatch = await post_booking(client, tokens[winner["token_index"]], winner["key"], mismatch_payload)
            mismatch_rejected = mismatch["status"] == 400
            outbox_detail = await wait_for_outbox(connection, appointment_id, outbox_timeout)
            outbox = bool(outbox_detail["processed"])
            if outbox_detail.get("provider_propagation_ms") is not None:
                propagation_latencies.append(outbox_detail["provider_propagation_ms"])

        passed = (
            len(successes) == 1
            and len(conflicts) == concurrency - 1
            and not unexpected
            and len(appointment_ids) == 1
            and database_rows == 1
            and replay_ok
            and mismatch_rejected
            and outbox
        )
        repetitions_output.append(
            {
                "repetition": repetition + 1,
                "slot_id": slot.get("id"),
                "successes": len(successes),
                "conflicts": len(conflicts),
                "unexpected": [{"status": item["status"], "body": item["body"]} for item in unexpected],
                "unique_appointment_ids": len(appointment_ids),
                "database_rows": database_rows,
                "idempotent_replay": replay_ok,
                "idempotency_mismatch_rejected": mismatch_rejected,
                "outbox": outbox_detail,
                "passed": passed,
            }
        )

    return {
        "concurrency": concurrency,
        "repetitions": repetitions,
        "passed_repetitions": sum(item["passed"] for item in repetitions_output),
        "passed": all(item["passed"] for item in repetitions_output),
        "transaction_latency_ms": {
            "scope": "HTTP request through committed transaction",
            "n": len(transaction_latencies),
            "mean": statistics.mean(transaction_latencies),
            "p50": percentile(transaction_latencies, 0.50),
            "p95": percentile(transaction_latencies, 0.95),
            "p99": percentile(transaction_latencies, 0.99),
        },
        "notification_propagation_latency_ms": {
            "scope": "outbox creation to processed_at; not database consistency",
            "n": len(propagation_latencies),
            "mean": statistics.mean(propagation_latencies) if propagation_latencies else None,
            "p50": percentile(propagation_latencies, 0.50),
            "p95": percentile(propagation_latencies, 0.95),
            "p99": percentile(propagation_latencies, 0.99),
        },
        "raw": repetitions_output,
    }


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slots", type=Path, required=True, help="JSON with fresh slots grouped under 2, 10, and 50")
    parser.add_argument("--repetitions", type=int, default=30)
    parser.add_argument("--outbox-timeout", type=float, default=30.0)
    parser.add_argument("--report", type=Path, default=Path("tests/benchmarks/reports/booking_contention.json"))
    args = parser.parse_args()
    if args.repetitions != 30:
        raise SystemExit("the frozen release protocol requires exactly 30 repetitions")

    base_url = os.environ.get("MEDORA_BASE_URL", "").rstrip("/")
    tokens = [item.strip() for item in os.environ.get("MEDORA_PATIENT_TOKENS", "").split(",") if item.strip()]
    dsn = os.environ.get("DATABASE_URL", "")
    if not base_url or not tokens or not dsn:
        raise SystemExit("MEDORA_BASE_URL, MEDORA_PATIENT_TOKENS, and DATABASE_URL are required; no placeholder run is allowed")
    fixture = json.loads(args.slots.read_text(encoding="utf-8"))
    for level in (2, 10, 50):
        if len(fixture.get(str(level), [])) < 31:
            raise SystemExit(f"concurrency {level} needs 31 fresh slots (one warm-up plus 30 measured)")

    connection = await asyncpg.connect(database_dsn(dsn))
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=60.0) as client:
            # Warm-up is excluded and uses one dedicated slot per level.
            warmup = {}
            for level in (2, 10, 50):
                warmup[level] = await run_level(
                    client=client, connection=connection, tokens=tokens, concurrency=level,
                    slots=fixture[str(level)][:1], repetitions=1, outbox_timeout=args.outbox_timeout,
                )
            results = []
            for level in (2, 10, 50):
                results.append(
                    await run_level(
                        client=client, connection=connection, tokens=tokens, concurrency=level,
                        slots=fixture[str(level)][1:31], repetitions=30, outbox_timeout=args.outbox_timeout,
                    )
                )
    finally:
        await connection.close()

    report = {
        "schema_version": "1.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "protocol": {"concurrency": [2, 10, 50], "repetitions_per_level": 30, "warmup_per_level": 1},
        "warmup_excluded": warmup,
        "results": results,
        "passed": all(result["passed"] for result in results),
        "limitations": [
            "Outbox processed_at measures application delivery processing, not a user's network rendering time.",
            "Reconnect and reordered/duplicated client events are covered by deterministic integration fixtures.",
        ],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "report": str(args.report)}, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
