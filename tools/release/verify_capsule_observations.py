"""Recompute archived safety counts and booking statistics from recorded observations.

This verifies an analysis, not a replay of the historical model or timing environment.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path


def percentile(values: list[float], q: float) -> float:
    return sorted(values)[math.ceil(len(values) * q) - 1]


def verify(safety: dict, booking: dict) -> dict:
    rows = [r for r in safety["privacy"]["raw"] if not r["uses_known_identifier_api"]]
    tp = sum(r["expected_identifier_spans"] - len(r["missed_identifiers"]) for r in rows)
    fp = sum(len(r["lost_benign_text"]) for r in rows)
    fn = sum(len(r["missed_identifiers"]) for r in rows)
    benign = sum(r["benign_spans"] for r in rows)
    measured = {"true_positives": tp, "false_positives": fp, "false_negatives": fn,
                "expected_identifier_spans": tp + fn, "benign_spans": benign,
                "precision": tp / (tp + fp), "recall": tp / (tp + fn),
                "false_redaction_rate": fp / benign, "cases": len(rows)}
    for key, value in measured.items():
        assert math.isclose(safety["privacy"][key], value, abs_tol=1e-10), key
    nav = safety["navigation"]
    assert nav["cases"] == len(nav["raw"])
    assert nav["emergency_false_positives"] == sum(r["emergency_rule_fired"] and not r["expected_emergency"] for r in nav["raw"])
    assert nav["emergency_false_negatives"] == sum(not r["emergency_rule_fired"] and r["expected_emergency"] for r in nav["raw"])
    summary = safety["summaries"]
    assert summary["cases"] == len(summary["raw"])
    assert summary["passed"] == sum(r["passed"] for r in summary["raw"])
    booking_checks = []
    for level in booking["results"]:
        assert level["repetitions"] == len(level["raw"]) == 30
        assert level["passed_repetitions"] == sum(r["passed"] for r in level["raw"])
        assert all(r["successes"] == 1 and r["conflicts"] == level["concurrency"] - 1
                   and r["database_rows"] == 1 for r in level["raw"])
        latency = [x for r in level["raw"] for x in r["request_latencies_ms"]]
        reported = level["transaction_latency_ms"]
        assert len(latency) == reported["n"]
        assert math.isclose(reported["mean"], statistics.mean(latency), abs_tol=1e-8)
        for key, q in (("p50", .5), ("p95", .95), ("p99", .99)):
            assert math.isclose(reported[key], percentile(latency, q), abs_tol=1e-8)
        booking_checks.append({"concurrency": level["concurrency"], "trials": 30, "requests": len(latency)})
    return {"passed": True, "privacy_recomputed": measured, "navigation_cases": nav["cases"],
            "summary_cases": summary["cases"], "booking_recomputed": booking_checks,
            "scope": "Analysis of archived recorded observations; no historical inference or timing replay",
            "consent_scope": "Aggregate-only historical provider report; raw paired outputs unavailable; no inference replay claimed"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("docs/softwarex/generated"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    paths = [args.source / f"{name}_results.json" for name in ("safety", "booking")]
    report = verify(*(json.loads(p.read_text(encoding="utf-8")) for p in paths))
    report["input_sha256"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
