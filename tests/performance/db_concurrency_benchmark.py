from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import asyncpg

from tests.scripts.metrics import summarize_latencies


async def _table_exists(conn: asyncpg.Connection, table_name: str) -> bool:
    value = await conn.fetchval("SELECT to_regclass($1)", f"public.{table_name}")
    return value is not None


async def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Medora PostgreSQL behavior under concurrency.")
    parser.add_argument("--iterations", type=int, default=500)
    parser.add_argument("--concurrency", type=int, default=80)
    parser.add_argument("--report", type=str, default="tests/benchmarks/reports/current/db_benchmark.json")
    args = parser.parse_args()

    db_url = os.getenv("MEDORA_DB_URL") or os.getenv("SUPABASE_DATABASE_URL")
    if not db_url:
        raise RuntimeError("MEDORA_DB_URL or SUPABASE_DATABASE_URL must be provided.")
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    pool = await asyncpg.create_pool(
        dsn=db_url,
        min_size=2,
        max_size=min(max(10, args.concurrency), 100),
        command_timeout=15,
    )

    query_latencies: list[float] = []
    acquire_latencies: list[float] = []
    failures = 0

    async with pool.acquire() as conn:
        has_appointments = await _table_exists(conn, "appointments")

    semaphore = asyncio.Semaphore(args.concurrency)

    async def _run_once() -> None:
        nonlocal failures
        async with semaphore:
            acquire_started = time.perf_counter()
            try:
                async with pool.acquire() as conn:
                    acquire_latencies.append((time.perf_counter() - acquire_started) * 1000)
                    query_started = time.perf_counter()
                    await conn.fetchval("SELECT 1")
                    if has_appointments:
                        await conn.fetchval("SELECT COUNT(*) FROM appointments")
                    query_latencies.append((time.perf_counter() - query_started) * 1000)
            except Exception:
                failures += 1

    started = time.perf_counter()
    await asyncio.gather(*[_run_once() for _ in range(args.iterations)])
    elapsed = max(0.001, time.perf_counter() - started)

    await pool.close()

    query_summary = summarize_latencies(query_latencies)
    acquire_summary = summarize_latencies(acquire_latencies)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "iterations": args.iterations,
        "concurrency": args.concurrency,
        "failures": failures,
        "error_rate": failures / max(1, args.iterations),
        "throughput_rps": args.iterations / elapsed,
        "query_latency_ms": query_summary.__dict__,
        "pool_acquire_latency_ms": acquire_summary.__dict__,
        "appointments_table_detected": has_appointments,
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
