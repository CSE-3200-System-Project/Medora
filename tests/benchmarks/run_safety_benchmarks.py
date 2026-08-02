#!/usr/bin/env python3
"""Generate case-level privacy/navigation/summary safety evidence."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("SUPABASE_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "benchmark-placeholder")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "benchmark-placeholder")
os.environ.setdefault("AI_PROVIDER", "mock")

from app.core.ai_privacy import redact_pii_text  # noqa: E402
from app.routes.ai_doctor import detect_emergency_red_flags  # noqa: E402

DATASETS = ROOT / "tests" / "benchmarks" / "datasets"


def load(name: str) -> list[dict]:
    return [json.loads(line) for line in (DATASETS / name).read_text(encoding="utf-8").splitlines() if line.strip()]


def clinician_review_complete(case: dict) -> bool:
    review = case.get("clinician_review")
    return isinstance(review, dict) and review.get("credential_role") in {"licensed_clinician", "licensed_pharmacist"} and bool(review.get("reviewed_at"))


def safe_ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def privacy_span_metrics(rows: list[dict]) -> dict:
    expected_identifiers = sum(row["expected_identifier_spans"] for row in rows)
    false_negatives = sum(len(row["leaked_known_identifiers"]) for row in rows)
    true_positives = expected_identifiers - false_negatives
    benign_spans = sum(row["benign_spans"] for row in rows)
    false_positives = sum(len(row["lost_benign_text"]) for row in rows)
    return {
        "cases": len(rows),
        "passed": sum(row["passed"] for row in rows),
        "expected_identifier_spans": expected_identifiers,
        "benign_spans": benign_spans,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "precision": safe_ratio(true_positives, true_positives + false_positives),
        "recall": safe_ratio(true_positives, true_positives + false_negatives),
        "false_redaction_rate": safe_ratio(false_positives, benign_spans),
        "residual_known_identifier_rate": safe_ratio(false_negatives, expected_identifiers),
        "expected_residual_risk_cases": sum(row["expected_residual_risk"] for row in rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "tests/benchmarks/reports/safety_results.json")
    parser.add_argument("--allow-unreviewed", action="store_true", help="Development only; final report still records review as incomplete")
    args = parser.parse_args()

    privacy_rows, privacy_failures = [], []
    for case in load("pii_safety_cases.jsonl"):
        result = redact_pii_text(case["text"], known_identifiers=case.get("known_identifiers", []))
        leaked = [value for value in case.get("must_not_contain", []) if value.casefold() in result.text.casefold()]
        lost = [value for value in case.get("must_preserve", []) if value not in result.text]
        consent_ok = case.get("category") != "consent_state" or case.get("external_processing_allowed") is (case.get("consent_state") == "active")
        passed = not leaked and not lost and consent_ok
        row = {
            "id": case["id"],
            "category": case["category"],
            "passed": passed,
            "expected_identifier_spans": len(case.get("must_not_contain", [])),
            "benign_spans": len(case.get("must_preserve", [])),
            "leaked_known_identifiers": leaked,
            "lost_benign_text": lost,
            "expected_residual_risk": bool(case.get("expected_residual_risk")),
        }
        privacy_rows.append(row)
        if not passed:
            privacy_failures.append(row)

    navigation_rows, navigation_failures = [], []
    navigation_cases = load("symptom_navigation_cases.jsonl")
    for case in navigation_cases:
        actual = "emergency" if detect_emergency_red_flags(case["text"]) else "navigation"
        passed = (case["expected"] == "emergency" and actual == "emergency") or (
            case["expected"] != "emergency" and actual == "navigation"
        )
        row = {"id": case["id"], "locale": case["locale"], "expected": case["expected"], "actual": actual, "passed": passed, "clinician_review_complete": clinician_review_complete(case)}
        navigation_rows.append(row)
        if not passed:
            navigation_failures.append(row)
    reviewed = sum(item["clinician_review_complete"] for item in navigation_rows)

    summary_rows, summary_failures = [], []
    summary_cases = load("summary_safety_cases.jsonl")
    required_focus = {"allergy", "dose", "negation", "time", "duplicate", "conflict", "missing_evidence", "malformed_provider_output", "provider_failure", "source_link"}
    for case in summary_cases:
        records = case.get("records", [])
        sources_valid = all(record.get("id") and record.get("type") and record.get("timestamp") for record in records)
        passed = case.get("focus") in required_focus and (
            sources_valid or case.get("focus") in {"missing_evidence", "malformed_provider_output", "provider_failure"}
        )
        row = {"id": case["id"], "focus": case["focus"], "passed": passed, "source_records": len(records)}
        summary_rows.append(row)
        if not passed:
            summary_failures.append(row)

    deterministic_passed = not privacy_failures and not navigation_failures and not summary_failures
    review_complete = reviewed == len(navigation_rows)
    privacy_categories = sorted({item["category"] for item in privacy_rows})
    privacy_metrics = privacy_span_metrics(privacy_rows)
    privacy_by_category = {
        category: privacy_span_metrics([item for item in privacy_rows if item["category"] == category])
        for category in privacy_categories
    }
    report = {
        "schema_version": "1.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "provider_result_class": "deterministic_mock_and_rules",
        "privacy": {
            **privacy_metrics,
            "known_identifier_leakage": sum(len(item["leaked_known_identifiers"]) for item in privacy_rows),
            "by_category": privacy_by_category,
            "failures": privacy_failures,
            "raw": privacy_rows,
        },
        "navigation": {"cases": len(navigation_rows), "passed": len(navigation_rows) - len(navigation_failures), "clinician_reviewed": reviewed, "review_state": "complete" if review_complete else "required", "failures": navigation_failures, "raw": navigation_rows},
        "summaries": {"cases": len(summary_rows), "passed": len(summary_rows) - len(summary_failures), "failures": summary_failures, "raw": summary_rows},
        "deterministic_passed": deterministic_passed,
        "passed": deterministic_passed and review_complete,
        "limitations": ["Unknown and indirect identifiers are explicitly retained as residual-risk fixtures.", "Deterministic mock/rule results are not pooled with live-provider results."],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"deterministic_passed": deterministic_passed, "clinician_review_complete": review_complete, "output": str(args.output)}, indent=2))
    if deterministic_passed and (review_complete or args.allow_unreviewed):
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
