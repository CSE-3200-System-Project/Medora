from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Estimate Azure scale-to-zero cost/performance tradeoff.")
    parser.add_argument("--monthly-api-requests", type=int, default=2_500_000)
    parser.add_argument("--monthly-ocr-requests", type=int, default=250_000)
    parser.add_argument("--avg-api-latency-ms", type=float, default=320.0)
    parser.add_argument("--avg-ocr-latency-ms", type=float, default=2400.0)
    parser.add_argument("--api-vcpu-seconds-per-request", type=float, default=0.08)
    parser.add_argument("--ocr-vcpu-seconds-per-request", type=float, default=0.85)
    parser.add_argument("--vcpu-cost-per-second", type=float, default=0.000024)
    parser.add_argument("--gb-second-cost", type=float, default=0.0000027)
    parser.add_argument("--api-memory-gb", type=float, default=1.0)
    parser.add_argument("--ocr-memory-gb", type=float, default=2.0)
    parser.add_argument(
        "--report",
        type=str,
        default="tests/benchmarks/reports/current/cost_performance_report.json",
    )
    args = parser.parse_args()

    api_vcpu_cost = args.monthly_api_requests * args.api_vcpu_seconds_per_request * args.vcpu_cost_per_second
    ocr_vcpu_cost = args.monthly_ocr_requests * args.ocr_vcpu_seconds_per_request * args.vcpu_cost_per_second

    api_mem_cost = args.monthly_api_requests * args.api_vcpu_seconds_per_request * args.api_memory_gb * args.gb_second_cost
    ocr_mem_cost = args.monthly_ocr_requests * args.ocr_vcpu_seconds_per_request * args.ocr_memory_gb * args.gb_second_cost

    total_monthly_cost = api_vcpu_cost + ocr_vcpu_cost + api_mem_cost + ocr_mem_cost

    api_cost_per_request = (api_vcpu_cost + api_mem_cost) / max(1, args.monthly_api_requests)
    ocr_cost_per_request = (ocr_vcpu_cost + ocr_mem_cost) / max(1, args.monthly_ocr_requests)

    efficiency = {
        "api_requests_per_dollar": args.monthly_api_requests / max(0.01, api_vcpu_cost + api_mem_cost),
        "ocr_requests_per_dollar": args.monthly_ocr_requests / max(0.01, ocr_vcpu_cost + ocr_mem_cost),
    }

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assumptions": vars(args),
        "latency": {
            "api_avg_ms": args.avg_api_latency_ms,
            "ocr_avg_ms": args.avg_ocr_latency_ms,
        },
        "estimated_monthly_cost_usd": round(total_monthly_cost, 2),
        "api_cost_per_request_usd": api_cost_per_request,
        "ocr_cost_per_request_usd": ocr_cost_per_request,
        "efficiency": efficiency,
        "recommendations": [
            "Keep OCR service min replicas at 0 with aggressive scale-out only for burst windows.",
            "Prioritize OCR queue batching during peak upload bursts to improve requests-per-dollar.",
            "Apply stricter caching and prefiltering on /ai/search prompts to reduce LLM invocation volume.",
        ],
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
