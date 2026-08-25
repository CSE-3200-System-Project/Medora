"""Shared privacy-case scoring used by Lokkhon and the PHI model admission gate."""

from __future__ import annotations

from app.core.ai_privacy import redact_pii_text


def safe_ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def privacy_span_metrics(rows: list[dict]) -> dict:
    expected_identifiers = sum(row["expected_identifier_spans"] for row in rows)
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
        "precision": (
            safe_ratio(true_positives, true_positives + false_positives)
            if expected_identifiers else None
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


def score_privacy_case(case: dict, *, redactor=None) -> dict:
    """Score one privacy fixture through an optionally supplied redactor."""
    redact = redactor or redact_pii_text
    known = case.get("known_identifiers", []) if case.get("uses_known_identifier_api") else []
    result = redact(case["text"], known_identifiers=known)

    missed = [
        value for value in case.get("must_not_contain", [])
        if value.casefold() in result.text.casefold()
    ]
    lost = [value for value in case.get("must_preserve", []) if value not in result.text]
    residual_expected = bool(case.get("expected_residual_risk"))
    over_expected = bool(case.get("expected_over_redaction"))
    undisclosed_misses = [] if residual_expected else missed
    undisclosed_losses = [] if over_expected else lost
    stale = (residual_expected and bool(case.get("must_not_contain")) and not missed) or (
        over_expected and bool(case.get("must_preserve")) and not lost
    )
    consent_ok = case.get("category") != "consent_state" or case.get(
        "external_processing_allowed"
    ) is (case.get("consent_state") == "active")
    idempotent = redact(result.text, known_identifiers=known).text == result.text
    passed = not undisclosed_misses and not undisclosed_losses and consent_ok and idempotent
    return {
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
