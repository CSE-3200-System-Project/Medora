from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx


def _run_optional_command(command: str | None) -> bool:
    if not command:
        return False
    completed = subprocess.run(command, shell=True, check=False, capture_output=True, text=True)
    return completed.returncode == 0


def _probe_health(base_url: str) -> tuple[int, float]:
    started = time.perf_counter()
    response = httpx.get(f"{base_url}/health", timeout=10.0)
    return response.status_code, (time.perf_counter() - started) * 1000


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Medora chaos recovery scenarios.")
    parser.add_argument(
        "--report",
        type=str,
        default="tests/benchmarks/reports/current/chaos_recovery_report.json",
    )
    args = parser.parse_args()

    base_url = os.getenv("MEDORA_BASE_URL", "http://localhost:8000").rstrip("/")
    token = os.getenv("MEDORA_PATIENT_TOKEN", "patient-token")

    scenarios = [
        {
            "name": "ai_service_outage",
            "down_cmd": os.getenv("CHAOS_AI_DOWN_CMD"),
            "up_cmd": os.getenv("CHAOS_AI_UP_CMD"),
        },
        {
            "name": "db_latency_injection",
            "down_cmd": os.getenv("CHAOS_DB_SLOW_CMD"),
            "up_cmd": os.getenv("CHAOS_DB_NORMAL_CMD"),
        },
    ]

    output: list[dict] = []
    for scenario in scenarios:
        before_status, before_latency = _probe_health(base_url)
        activated = _run_optional_command(scenario["down_cmd"])
        time.sleep(2)

        during_status, during_latency = _probe_health(base_url)

        # Probe OCR path as a dependency-sensitive endpoint.
        ocr_status = None
        try:
            fake_png = (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02"
                b"\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
            )
            response = httpx.post(
                f"{base_url}/upload/prescription/extract",
                headers={"Authorization": f"Bearer {token}"},
                data={"save_file": "false"},
                files={"file": ("chaos.png", fake_png, "image/png")},
                timeout=20.0,
            )
            ocr_status = response.status_code
        except Exception:
            ocr_status = -1

        recovered = _run_optional_command(scenario["up_cmd"])
        time.sleep(2)
        after_status, after_latency = _probe_health(base_url)

        output.append(
            {
                "scenario": scenario["name"],
                "fault_injected": activated,
                "recovery_command_applied": recovered,
                "before": {"status": before_status, "latency_ms": before_latency},
                "during_fault": {
                    "status": during_status,
                    "latency_ms": during_latency,
                    "ocr_status": ocr_status,
                },
                "after_recovery": {"status": after_status, "latency_ms": after_latency},
                "recovery_successful": after_status == 200,
            }
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "results": output,
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
