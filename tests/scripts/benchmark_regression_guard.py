from __future__ import annotations

import argparse
import json
from pathlib import Path


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing JSON input: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Fail build on benchmark regression.")
    parser.add_argument(
        "--baseline",
        type=str,
        default="tests/benchmarks/baselines/locust_baseline.json",
    )
    parser.add_argument(
        "--current",
        type=str,
        default="tests/benchmarks/reports/current/locust_summary.json",
    )
    parser.add_argument("--latency-regression-threshold", type=float, default=0.20)
    parser.add_argument("--error-rate-increase-threshold", type=float, default=0.01)
    args = parser.parse_args()

    baseline = _load_json(Path(args.baseline))
    current = _load_json(Path(args.current))

    baseline_p95 = float(baseline.get("p95_ms", 0.0))
    current_p95 = float(current.get("p95_ms", 0.0))
    baseline_error_rate = float(baseline.get("error_rate", 0.0))
    current_error_rate = float(current.get("error_rate", 0.0))

    violations: list[str] = []
    if baseline_p95 > 0:
        delta = (current_p95 - baseline_p95) / baseline_p95
        if delta > args.latency_regression_threshold:
            violations.append(
                f"Latency regression detected: baseline p95={baseline_p95:.2f}ms vs current p95={current_p95:.2f}ms ({delta*100:.2f}%)"
            )

    if current_error_rate > baseline_error_rate + args.error_rate_increase_threshold:
        violations.append(
            "Error rate increased: "
            f"baseline={baseline_error_rate:.4f}, current={current_error_rate:.4f}"
        )

    report = {
        "baseline": baseline,
        "current": current,
        "violations": violations,
    }
    out_path = Path("tests/benchmarks/reports/current/regression_guard_report.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if violations:
        for line in violations:
            print(f"[REGRESSION] {line}")
        return 2

    print("Benchmark regression guard passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
