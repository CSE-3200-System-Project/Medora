#!/usr/bin/env python3
"""Generate case-level privacy/navigation/summary safety evidence.

Result semantics. Every row carries two independent booleans:

  passed            hard assertion. False only for an *undisclosed* failure. This
                    drives `deterministic_passed` and therefore the exit code and
                    the release gate.
  matched_expected  the measurement. Reported at every level, gates nothing.

That split is what lets measured precision and recall sit below 1.00 — which is
the honest outcome for a redactor with documented blind spots — without a known,
disclosed limitation turning the release gate red. A case flagged as a limitation
that starts passing is recorded as `stale_limitation` so the disclosure can be
retired rather than silently misleading a reader.
"""

from __future__ import annotations

import argparse
import asyncio
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
# Hard assignment, not setdefault: an exported AI_PROVIDER would otherwise send
# these fixtures to a live paid provider and pool live output into a report whose
# own limitations field states that mock and live results are never pooled.
os.environ["AI_PROVIDER"] = "mock"

from app.core.ai_privacy import redact_pii_text  # noqa: E402
from app.routes.ai_doctor import (  # noqa: E402
    classify_navigation_outcome,
    detect_emergency_red_flags,
)
from app.services.ai_orchestrator import (  # noqa: E402
    AIOrchestrator,
    AIOrchestratorError,
    AIProviderError,
    AIValidationError,
)

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
    # Every miss counts against recall, disclosed or not. Disclosure changes whether
    # the gate goes red, never whether the number is reported honestly.
    false_negatives = sum(len(row["missed_identifiers"]) for row in rows)
    true_positives = expected_identifiers - false_negatives
    benign_spans = sum(row["benign_spans"] for row in rows)
    false_positives = sum(len(row["lost_benign_text"]) for row in rows)
    return {
        "cases": len(rows),
        "passed": sum(row["passed"] for row in rows),
        "matched_expected": sum(row["matched_expected"] for row in rows),
        "expected_identifier_spans": expected_identifiers,
        "benign_spans": benign_spans,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        # Precision is undefined when a group annotates no identifier spans at all;
        # reporting 0.0 there would read as a detection failure rather than "not applicable".
        "precision": (
            safe_ratio(true_positives, true_positives + false_positives)
            if expected_identifiers
            else None
        ),
        "recall": safe_ratio(true_positives, true_positives + false_negatives),
        "false_redaction_rate": safe_ratio(false_positives, benign_spans),
        "residual_known_identifier_rate": safe_ratio(false_negatives, expected_identifiers),
        "expected_residual_risk_cases": sum(row["expected_residual_risk"] for row in rows),
        "documented_limitations": sum(bool(row["limitation_class"]) for row in rows),
        "undisclosed_misses": sum(len(row["undisclosed_misses"]) for row in rows),
        "undisclosed_over_redactions": sum(len(row["undisclosed_losses"]) for row in rows),
        "stale_limitations": sum(row["stale_limitation"] for row in rows),
    }


def score_privacy() -> tuple[list[dict], list[dict]]:
    rows: list[dict] = []
    failures: list[dict] = []
    for case in load("pii_safety_cases.jsonl"):
        # Production parity: no call site supplies known identifiers, so the metric
        # path must not either. The documented API group opts in explicitly.
        known = case.get("known_identifiers", []) if case.get("uses_known_identifier_api") else []
        result = redact_pii_text(case["text"], known_identifiers=known)

        missed = [value for value in case.get("must_not_contain", []) if value.casefold() in result.text.casefold()]
        lost = [value for value in case.get("must_preserve", []) if value not in result.text]
        residual_expected = bool(case.get("expected_residual_risk"))
        over_expected = bool(case.get("expected_over_redaction"))

        undisclosed_misses = [] if residual_expected else missed
        undisclosed_losses = [] if over_expected else lost
        # A flag is only stale if the case actually declares the kind of span the flag
        # is about. Cases that document a limitation purely through `must_preserve`
        # (an identifier the redactor is not expected to find at all) declare no
        # `must_not_contain` span and can never go stale on the residual-risk axis.
        stale = (residual_expected and bool(case.get("must_not_contain")) and not missed) or (
            over_expected and bool(case.get("must_preserve")) and not lost
        )

        consent_ok = case.get("category") != "consent_state" or case.get("external_processing_allowed") is (
            case.get("consent_state") == "active"
        )
        # A redactor that re-redacts its own placeholders is broken; nothing else checks this.
        idempotent = redact_pii_text(result.text, known_identifiers=known).text == result.text

        passed = not undisclosed_misses and not undisclosed_losses and consent_ok and idempotent
        row = {
            "id": case["id"],
            "category": case["category"],
            "report_group": case["report_group"],
            "passed": passed,
            "matched_expected": not missed and not lost and consent_ok,
            "expected_identifier_spans": len(case.get("must_not_contain", [])),
            "benign_spans": len(case.get("must_preserve", [])),
            "missed_identifiers": missed,
            "lost_benign_text": lost,
            "undisclosed_misses": undisclosed_misses,
            "undisclosed_losses": undisclosed_losses,
            "expected_residual_risk": residual_expected,
            "expected_over_redaction": over_expected,
            "limitation_class": case.get("limitation_class"),
            "limitation_note": case.get("limitation_note"),
            "stale_limitation": stale,
            "idempotent": idempotent,
            "uses_known_identifier_api": bool(case.get("uses_known_identifier_api")),
        }
        rows.append(row)
        if not passed:
            failures.append(row)
    return rows, failures


def _mock_intent(orchestrator: AIOrchestrator, text: str, specialties: list[str]) -> dict | None:
    try:
        return asyncio.run(
            orchestrator.extract_navigation_intent(
                user_text=text,
                available_specialties=specialties,
            )
        )
    except AIOrchestratorError:
        return None


def score_navigation() -> tuple[list[dict], list[dict], int]:
    catalog = json.loads((DATASETS / "navigation_specialty_catalog.json").read_text(encoding="utf-8"))
    available = catalog["available_specialties"]
    with_doctors = catalog["specialties_with_doctors"]
    allowed = set(with_doctors)
    orchestrator = AIOrchestrator()

    rows: list[dict] = []
    failures: list[dict] = []
    for case in load("symptom_navigation_cases.jsonl"):
        text = case["text"]
        rule_fires = detect_emergency_red_flags(text)
        expected_rule_fires = bool(case.get("expected_emergency_rule_fires"))
        disclosed = bool(case.get("limitation_class"))

        # Path A: the real end-to-end mock provider path (exercises fail-soft).
        mock_intent = None if case.get("provider_behavior") == "error" else _mock_intent(orchestrator, text, available)
        mock_outcome = classify_navigation_outcome(
            user_text=text,
            intent=mock_intent,
            available_specialties=available,
            specialties_with_doctors=with_doctors,
        )
        # Path B: a recorded provider intent (exercises real specialty matching).
        recorded_intent = case.get("provider_intent")
        recorded_outcome = classify_navigation_outcome(
            user_text=text,
            intent=recorded_intent,
            available_specialties=available,
            specialties_with_doctors=with_doctors,
        )

        # --- hard assertions ---
        emergency_ok = rule_fires == expected_rule_fires or disclosed
        browse_ok = mock_outcome["manual_browse_available"] and recorded_outcome["manual_browse_available"]
        failure_ok = True
        if case.get("provider_behavior") == "error":
            failure_ok = mock_outcome["uncertain"] and not mock_outcome["extracted_specialties"]
        catalog_ok = all(
            name in allowed
            for outcome in (mock_outcome, recorded_outcome)
            for name in outcome["extracted_specialties"]
        )
        passed = emergency_ok and browse_ok and failure_ok and catalog_ok

        # --- measurement ---
        matched_expected = (
            rule_fires == bool(case["expected_emergency"])
            and recorded_outcome["uncertain"] == bool(case["expected_uncertain"])
            and recorded_outcome["candidate_source"] == case["expected_candidate_source"]
        )
        row = {
            "id": case["id"],
            "locale": case["locale"],
            "expected": case["expected"],
            "expected_emergency": bool(case["expected_emergency"]),
            "emergency_rule_fired": rule_fires,
            "expected_emergency_rule_fires": expected_rule_fires,
            "expected_uncertain": bool(case["expected_uncertain"]),
            "recorded_uncertain": recorded_outcome["uncertain"],
            "expected_candidate_source": case["expected_candidate_source"],
            "recorded_candidate_source": recorded_outcome["candidate_source"],
            "mock_candidate_source": mock_outcome["candidate_source"],
            "mock_uncertain": mock_outcome["uncertain"],
            "manual_browse_available": browse_ok,
            "out_of_catalog_specialty": not catalog_ok,
            "passed": passed,
            "matched_expected": matched_expected,
            "limitation_class": case.get("limitation_class"),
            "limitation_note": case.get("limitation_note"),
            "clinician_review_complete": clinician_review_complete(case),
        }
        rows.append(row)
        if not passed:
            failures.append(row)

    reviewed = sum(row["clinician_review_complete"] for row in rows)
    return rows, failures, reviewed


def _patched_orchestrator(case: dict) -> AIOrchestrator:
    """Return an orchestrator whose provider call is replaced for this case only.

    The patch is bound to the instance, never to the module singleton and never to
    production code, so nothing outside this benchmark observes it.
    """
    orchestrator = AIOrchestrator()
    behavior = case.get("provider_behavior", "mock")
    if behavior == "mock":
        return orchestrator

    payload = case.get("provider_output")

    async def _call(**_kwargs):
        if behavior == "provider_error":
            raise AIProviderError("benchmark-induced provider failure")
        if behavior == "malformed_json":
            return orchestrator._extract_json_object(str(payload)), "mock"
        return payload, "mock"

    orchestrator._call_llm_json = _call  # type: ignore[method-assign]
    return orchestrator


def score_summaries() -> tuple[list[dict], list[dict]]:
    rows: list[dict] = []
    failures: list[dict] = []
    for case in load("summary_safety_cases.jsonl"):
        expected = case["expected"]
        expected_raises = expected.get("raises")
        orchestrator = _patched_orchestrator(case)

        raised: str | None = None
        result = None
        try:
            result = asyncio.run(
                orchestrator.generate_patient_summary(case["payload"], include_meta=True)
            )
        except AIValidationError:
            raised = "AIValidationError"
        except AIProviderError:
            raised = "AIProviderError"
        except AIOrchestratorError:
            raised = "AIOrchestratorError"

        detail: dict = {
            "id": case["id"],
            "focus": case["focus"],
            "expected_raises": expected_raises,
            "raised": raised,
            "known_limitations": case.get("known_limitations", []),
        }

        if expected_raises:
            passed = raised == expected_raises and result is None
            detail.update({"items": 0, "source_ids": [], "statuses": []})
        elif raised is not None:
            passed = False
            detail.update({"items": 0, "source_ids": [], "statuses": []})
        else:
            output = result.validated_output
            items = output.get("items", [])
            source_ids = sorted(
                {str(ref.get("source_id")) for item in items for ref in item.get("sources", [])}
            )
            statuses = sorted({item.get("status") for item in items})
            allowed = set(expected["allowed_source_ids"])
            every_item_sourced = all(item.get("sources") for item in items)
            no_invented_source = set(source_ids).issubset(allowed)
            status_ok = expected.get("required_status") in {None, *statuses}
            # The prompt is sanitized before it reaches a provider; record whether
            # record timestamps survive into it rather than assuming they do.
            dates_redacted = "[redacted-date]" in json.dumps(
                result.sanitized_input, ensure_ascii=False
            )
            passed = (
                len(items) >= expected.get("min_items", 1)
                and every_item_sourced
                and no_invented_source
                and status_ok
                and output.get("clinician_verification_required") is True
                and output.get("writeback_allowed") is False
            )
            detail.update(
                {
                    "items": len(items),
                    "source_ids": source_ids,
                    "statuses": statuses,
                    "no_invented_source": no_invented_source,
                    "every_item_sourced": every_item_sourced,
                    "required_status": expected.get("required_status"),
                    "status_ok": status_ok,
                    "clinician_verification_required": output.get("clinician_verification_required"),
                    "writeback_allowed": output.get("writeback_allowed"),
                    "prompt_dates_redacted": dates_redacted,
                    "sources_not_per_item": len(case["payload"]["records"]) > 1,
                }
            )

        detail["passed"] = passed
        detail["matched_expected"] = passed
        rows.append(detail)
        if not passed:
            failures.append(detail)
    return rows, failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "tests/benchmarks/reports/safety_results.json")
    parser.add_argument("--allow-unreviewed", action="store_true", help="Development only; final report still records review as incomplete")
    args = parser.parse_args()

    probe = AIOrchestrator()
    if probe.provider != "mock":
        print(f"Refusing to run: resolved AI provider is {probe.provider!r}, expected 'mock'.")
        return 2

    privacy_rows, privacy_failures = score_privacy()
    navigation_rows, navigation_failures, reviewed = score_navigation()
    summary_rows, summary_failures = score_summaries()

    deterministic_passed = not privacy_failures and not navigation_failures and not summary_failures
    review_complete = reviewed == len(navigation_rows)

    privacy_categories = sorted({row["category"] for row in privacy_rows})
    privacy_groups = sorted({row["report_group"] for row in privacy_rows})
    # The documented known-identifier group is excluded from headline metrics: no
    # production call site supplies known identifiers, so including it would inflate
    # recall with a path users never exercise.
    production_rows = [row for row in privacy_rows if not row["uses_known_identifier_api"]]

    documented = sorted(
        {row["limitation_note"] for row in privacy_rows + navigation_rows if row.get("limitation_note")}
    )

    report = {
        "schema_version": "2.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "provider": probe.provider,
        "provider_result_class": "deterministic_mock_and_rules",
        "privacy": {
            **privacy_span_metrics(production_rows),
            "total_cases_including_api_group": len(privacy_rows),
            "known_identifier_leakage": sum(len(row["missed_identifiers"]) for row in production_rows),
            "by_report_group": {
                group: privacy_span_metrics([row for row in production_rows if row["report_group"] == group])
                for group in privacy_groups
            },
            "by_category": {
                category: privacy_span_metrics([row for row in production_rows if row["category"] == category])
                for category in privacy_categories
            },
            "failures": privacy_failures,
            "raw": privacy_rows,
        },
        "navigation": {
            "cases": len(navigation_rows),
            "passed": len(navigation_rows) - len(navigation_failures),
            "matched_expected": sum(row["matched_expected"] for row in navigation_rows),
            "emergency_false_positives": sum(
                row["emergency_rule_fired"] and not row["expected_emergency"] for row in navigation_rows
            ),
            "emergency_false_negatives": sum(
                not row["emergency_rule_fired"] and row["expected_emergency"] for row in navigation_rows
            ),
            "documented_limitations": sum(bool(row["limitation_class"]) for row in navigation_rows),
            "clinician_reviewed": reviewed,
            "review_state": "complete" if review_complete else "required",
            "failures": navigation_failures,
            "raw": navigation_rows,
        },
        "summaries": {
            "cases": len(summary_rows),
            "passed": len(summary_rows) - len(summary_failures),
            "failures": summary_failures,
            "raw": summary_rows,
        },
        "deterministic_passed": deterministic_passed,
        "passed": deterministic_passed and review_complete,
        "limitations": [
            "Unknown and indirect identifiers are explicitly retained as residual-risk fixtures.",
            "Deterministic mock/rule results are not pooled with live-provider results.",
            "Precision and recall are measured on the production call path, which supplies no known identifiers.",
            *documented,
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "deterministic_passed": deterministic_passed,
                "clinician_review_complete": review_complete,
                "privacy_precision": report["privacy"]["precision"],
                "privacy_recall": report["privacy"]["recall"],
                "output": str(args.output),
            },
            indent=2,
        )
    )
    if deterministic_passed and (review_complete or args.allow_unreviewed):
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
