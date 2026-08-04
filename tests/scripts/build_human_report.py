from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def _try_read(path: str) -> dict | None:
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    api = _try_read("tests/benchmarks/reports/current/api_benchmark.json")
    db = _try_read("tests/benchmarks/reports/current/db_benchmark.json")
    ocr = _try_read("tests/benchmarks/reports/current/ocr_pipeline_benchmark.json")
    realtime = _try_read("tests/benchmarks/reports/current/realtime_consistency.json")
    regression = _try_read("tests/benchmarks/reports/current/regression_guard_report.json")

    lines = [
        "# Medora Benchmark Summary",
        "",
        f"Generated at: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]

    if api:
        lines.extend(
            [
                "## API Benchmark",
                f"- Total requests: {api['summary']['total_requests']}",
                f"- Failures: {api['summary']['total_failures']}",
                f"- Aggregate error rate: {api['summary']['aggregate_error_rate']:.4f}",
                f"- Worst p95 latency: {api['summary']['worst_p95_ms']:.2f} ms",
                "",
            ]
        )

    if db:
        lines.extend(
            [
                "## Database Benchmark",
                f"- Throughput: {db['throughput_rps']:.2f} req/s",
                f"- Query p95 latency: {db['query_latency_ms']['p95_ms']:.2f} ms",
                f"- Pool acquire p95 latency: {db['pool_acquire_latency_ms']['p95_ms']:.2f} ms",
                "",
            ]
        )

    if ocr:
        lines.extend(
            [
                "## OCR Pipeline Benchmark",
                f"- Error rate: {ocr['error_rate']:.4f}",
                f"- Total latency p95: {ocr['total_processing_latency_ms']['p95_ms']:.2f} ms",
                f"- OCR stage latency p95: {ocr['reported_ocr_stage_latency_ms']['p95_ms']:.2f} ms",
                f"- Average confidence: {ocr['confidence']['average']:.4f}",
                "",
            ]
        )

    if realtime:
        lines.extend(
            [
                "## Realtime Consistency",
                f"- Concurrent attempts: {realtime['users']}",
                f"- Successful bookings: {realtime['successes']}",
                f"- Conflicts handled: {realtime['conflicts']}",
                f"- Unique success IDs: {realtime['unique_success_ids']}",
                f"- Consistency passed: {realtime['consistency_passed']}",
                "",
            ]
        )

    if regression:
        lines.extend(["## Regression Guard", f"- Violations: {len(regression['violations'])}", ""])
        for violation in regression["violations"]:
            lines.append(f"- {violation}")
        lines.append("")

    # Silently omitting a section made a summary with no data at all look like a clean
    # run. Absent inputs are now named in the document itself.
    missing = [
        name
        for name, payload in (
            ("api_benchmark.json", api),
            ("db_benchmark.json", db),
            ("ocr_pipeline_benchmark.json", ocr),
            ("realtime_consistency.json", realtime),
            ("regression_guard_report.json", regression),
        )
        if payload is None
    ]
    if missing:
        lines.extend(
            [
                "## Sections not reported",
                "",
                "These benchmarks produced no output file, so no result is claimed for them:",
                "",
                *[f"- `{name}` — not executed" for name in missing],
                "",
            ]
        )

    out_path = Path("tests/benchmarks/reports/current/benchmark_summary.md")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_path}")
    if missing:
        print(f"Missing benchmark inputs, reported in the summary: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
