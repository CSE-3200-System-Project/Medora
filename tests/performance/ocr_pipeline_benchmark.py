from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from tests.scripts.metrics import summarize_latencies


ONE_PIXEL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02"
    b"\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _run_once(
    client: httpx.Client,
    *,
    endpoint: str,
    token: str,
    retries: int,
) -> tuple[float, dict | None, bool, int]:
    attempts = 0
    while attempts <= retries:
        attempts += 1
        started = time.perf_counter()
        response = client.post(
            endpoint,
            headers={"Authorization": f"Bearer {token}"},
            data={"save_file": "false"},
            files={"file": ("ocr-benchmark.png", ONE_PIXEL_PNG, "image/png")},
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        if response.status_code < 500:
            try:
                return elapsed_ms, response.json(), response.status_code < 400, attempts
            except Exception:
                return elapsed_ms, None, False, attempts
    return elapsed_ms, None, False, attempts


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Medora OCR pipeline latency and quality signals.")
    parser.add_argument("--iterations", type=int, default=60)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument(
        "--report",
        type=str,
        default="tests/benchmarks/reports/current/ocr_pipeline_benchmark.json",
    )
    args = parser.parse_args()

    base_url = os.getenv("MEDORA_BASE_URL", "http://localhost:8000").rstrip("/")
    endpoint = f"{base_url}/upload/prescription/extract"
    token = os.getenv("MEDORA_PATIENT_TOKEN", "patient-token")

    latencies: list[float] = []
    azure_stage_latencies: list[float] = []
    confidences: list[float] = []
    retries_used: list[int] = []
    failures = 0

    with httpx.Client(timeout=45.0) as client:
        for _ in range(args.iterations):
            elapsed_ms, payload, success, attempts = _run_once(
                client,
                endpoint=endpoint,
                token=token,
                retries=args.retries,
            )
            latencies.append(elapsed_ms)
            retries_used.append(attempts)

            if not success or not payload:
                failures += 1
                continue

            confidence = float(payload.get("confidence") or 0.0)
            confidences.append(confidence)

            meta = payload.get("meta")
            if isinstance(meta, dict):
                stage_time = meta.get("processing_time_ms")
                if isinstance(stage_time, (int, float)):
                    azure_stage_latencies.append(float(stage_time))

    latency_summary = summarize_latencies(latencies)
    stage_summary = summarize_latencies(azure_stage_latencies)
    retries_avg = statistics.mean(retries_used) if retries_used else 0.0
    confidence_avg = statistics.mean(confidences) if confidences else 0.0

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "iterations": args.iterations,
        "failures": failures,
        "error_rate": failures / max(1, args.iterations),
        "total_processing_latency_ms": latency_summary.__dict__,
        "reported_ocr_stage_latency_ms": stage_summary.__dict__,
        "confidence": {
            "samples": len(confidences),
            "average": round(confidence_avg, 4),
            "minimum": round(min(confidences), 4) if confidences else 0.0,
        },
        "retry_performance": {
            "configured_retries": args.retries,
            "average_attempts": round(retries_avg, 3),
            "max_attempts": max(retries_used) if retries_used else 0,
        },
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
