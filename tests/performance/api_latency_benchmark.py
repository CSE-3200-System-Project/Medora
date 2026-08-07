from __future__ import annotations

import argparse
import asyncio
import itertools
import json
import os
import struct
import time
import zlib
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from tests.scripts.metrics import summarize_latencies


@dataclass
class EndpointResult:
    endpoint: str
    method: str
    requests: int
    failures: int
    error_rate: float
    throughput_rps: float
    latency: dict


def _future_iso(days: int = 2) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()


# Every booking used to target the same date and slot, so at most one request in a run
# could ever be created and the endpoint's measured latency was the rejection path. Each
# request now claims its own day.
_booking_days = itertools.count(2)

# /ai/search is limited to 20 requests per 60 s (core/rate_limit.py). Sending more
# measures the limiter rather than the endpoint, so the caller's iteration count is
# clamped to the documented budget and the clamp is recorded in the report.
AI_SEARCH_RULE = ("POST", "/ai/search", 20, 60.0)


def _grey_png(width: int, height: int) -> bytes:
    """Build a valid greyscale PNG without pulling in an image library.

    The previous fixture was a 1x1 PNG that Pillow rejects as truncated, so the OCR
    endpoint answered 502 on every request and the timing described the rejection
    rather than the pipeline.
    """

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload))

    raw = b"".join(b"\x00" + bytes((index * 4) % 256 for index in range(width)) for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


async def _run_endpoint(
    *,
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    payload_builder,
    headers: dict[str, str] | None,
    iterations: int,
    concurrency: int,
) -> EndpointResult:
    semaphore = asyncio.Semaphore(concurrency)
    latencies: list[float] = []
    failures = 0

    async def _once() -> None:
        nonlocal failures
        async with semaphore:
            request_payload = payload_builder()
            request_headers = {**(headers or {}), **request_payload.get("headers", {})}
            started = time.perf_counter()
            try:
                if method == "GET":
                    response = await client.get(endpoint, headers=request_headers)
                else:
                    if request_payload.get("files"):
                        response = await client.post(
                            endpoint,
                            headers=request_headers,
                            data=request_payload.get("data"),
                            files=request_payload.get("files"),
                        )
                    else:
                        response = await client.post(
                            endpoint,
                            headers=request_headers,
                            json=request_payload.get("json"),
                        )
                elapsed_ms = (time.perf_counter() - started) * 1000
                latencies.append(elapsed_ms)
                if response.status_code >= 400:
                    failures += 1
            except Exception:
                failures += 1

    started_all = time.perf_counter()
    await asyncio.gather(*[_once() for _ in range(iterations)])
    total_elapsed = max(0.001, time.perf_counter() - started_all)

    summary = summarize_latencies(latencies)
    return EndpointResult(
        endpoint=endpoint,
        method=method,
        requests=iterations,
        failures=failures,
        error_rate=failures / iterations,
        throughput_rps=iterations / total_elapsed,
        latency=asdict(summary),
    )


async def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Medora critical API endpoints.")
    parser.add_argument("--iterations", type=int, default=120)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument(
        "--report",
        type=str,
        default="tests/benchmarks/reports/current/api_benchmark.json",
    )
    args = parser.parse_args()

    base_url = os.getenv("MEDORA_BASE_URL", "http://localhost:8000").rstrip("/")
    patient_token = os.getenv("MEDORA_PATIENT_TOKEN", "patient-token")
    doctor_token = os.getenv("MEDORA_DOCTOR_TOKEN", "doctor-token")
    doctor_id = os.getenv("MEDORA_DOCTOR_ID", "doctor-id")

    png = _grey_png(64, 64)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        results = [
            await _run_endpoint(
                client=client,
                endpoint="/appointment/",
                method="POST",
                headers={"Authorization": f"Bearer {patient_token}"},
                payload_builder=lambda: {
                    "headers": {"Idempotency-Key": f"api-benchmark-{time.time_ns()}"},
                    "json": {
                        "doctor_id": doctor_id,
                        "appointment_date": _future_iso(next(_booking_days)),
                        "reason": "Benchmark booking",
                        "notes": "Slot: 8:00 PM",
                    }
                },
                iterations=args.iterations,
                concurrency=args.concurrency,
            ),
            await _run_endpoint(
                client=client,
                endpoint="/ai/search",
                method="POST",
                headers={"Authorization": f"Bearer {patient_token}"},
                payload_builder=lambda: {
                    "json": {
                        "user_text": "Need cardiology consult for chest pain",
                        "consultation_mode": "online",
                    }
                },
                iterations=min(args.iterations, AI_SEARCH_RULE[2]),
                concurrency=args.concurrency,
            ),
            await _run_endpoint(
                client=client,
                endpoint="/upload/prescription/extract",
                method="POST",
                headers={"Authorization": f"Bearer {patient_token}"},
                payload_builder=lambda: {
                    "data": {"save_file": "false"},
                    "files": {"file": ("rx.png", png, "image/png")},
                },
                iterations=max(10, args.iterations // 4),
                concurrency=max(2, args.concurrency // 2),
            ),
            await _run_endpoint(
                client=client,
                endpoint="/health",
                method="GET",
                headers=None,
                payload_builder=lambda: {},
                iterations=args.iterations,
                concurrency=args.concurrency,
            ),
        ]

    aggregate_failures = sum(item.failures for item in results)
    aggregate_requests = sum(item.requests for item in results)
    aggregate_error_rate = aggregate_failures / max(1, aggregate_requests)
    aggregate_p95 = max(item.latency["p95_ms"] for item in results)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "iterations": args.iterations,
        "concurrency": args.concurrency,
        "protocol_notes": [
            "Each /appointment/ request books a distinct future day so the endpoint is "
            "measured on the create path rather than on slot-conflict rejection.",
            f"/ai/search is clamped to {AI_SEARCH_RULE[2]} requests, its documented "
            f"limit per {AI_SEARCH_RULE[3]:.0f} s window, so the measurement is of the "
            "endpoint and not of the rate limiter.",
            "/upload/prescription/extract requires AI_OCR_SERVICE_URL to resolve; a "
            "502 here means the OCR service was unreachable, not that it was slow.",
        ],
        "results": [asdict(item) for item in results],
        "summary": {
            "total_requests": aggregate_requests,
            "total_failures": aggregate_failures,
            "aggregate_error_rate": aggregate_error_rate,
            "worst_p95_ms": aggregate_p95,
        },
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
