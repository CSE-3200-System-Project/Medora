import json
from pathlib import Path

from app.core.ai_privacy import redact_pii_text


ROOT = Path(__file__).resolve().parents[3]
DATASET = ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl"

REQUIRED_GROUPS = {
    "email",
    "phone",
    "national_id",
    "passport",
    "account_id",
    "name_labeled",
    "name_unlabeled",
    "clinician",
    "address",
    "date",
    "opaque_id",
    "mixed_script",
    "benign",
    "consent",
    "injection",
    "limitation",
}


def _cases():
    return [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]


def _redact(case):
    """Redact exactly the way production does unless the case opts into the API."""
    known = case.get("known_identifiers", []) if case.get("uses_known_identifier_api") else []
    return redact_pii_text(case["text"], known_identifiers=known)


def test_curated_pii_suite_has_required_coverage():
    cases = _cases()
    assert len(cases) >= 120
    assert REQUIRED_GROUPS <= {case["report_group"] for case in cases}


def test_undisclosed_identifier_leaks_and_benign_losses_are_absent():
    """Disclosed limitations are allowed; undisclosed ones are regressions."""
    for case in _cases():
        result = _redact(case)
        if not case["expected_residual_risk"]:
            for forbidden in case.get("must_not_contain", []):
                assert forbidden.casefold() not in result.text.casefold(), case["id"]
        if not case["expected_over_redaction"]:
            for preserved in case.get("must_preserve", []):
                assert preserved in result.text, case["id"]


def test_redaction_is_idempotent():
    """Re-redacting output must be a no-op, or placeholders eat surrounding text."""
    for case in _cases():
        once = _redact(case).text
        twice = redact_pii_text(once).text
        assert once == twice, case["id"]


def test_no_stale_limitation_flags():
    """A limitation that no longer reproduces must be retired, not left in the paper."""
    for case in _cases():
        result = _redact(case)
        if case["expected_residual_risk"] and case.get("must_not_contain"):
            assert any(
                value.casefold() in result.text.casefold() for value in case["must_not_contain"]
            ), f"{case['id']} is flagged as residual risk but is now fully redacted"
        if case["expected_over_redaction"] and case.get("must_preserve"):
            assert any(
                value not in result.text for value in case["must_preserve"]
            ), f"{case['id']} is flagged as over-redacting but now preserves its benign span"


def test_every_flagged_case_has_a_written_limitation():
    for case in _cases():
        if case["expected_residual_risk"] or case["expected_over_redaction"]:
            assert case["limitation_note"], case["id"]


def test_every_detection_case_carries_a_benign_span():
    """Without a benign span in the same text, precision is structurally pinned at 1.00."""
    for case in _cases():
        if case.get("must_not_contain"):
            assert case.get("must_preserve"), case["id"]


def test_consent_state_fixture_is_deny_by_default():
    consent_cases = [case for case in _cases() if case["category"] == "consent_state"]
    assert consent_cases
    for case in consent_cases:
        assert case["external_processing_allowed"] is (case["consent_state"] == "active")


def test_unknown_identifier_limitations_are_explicit_not_hidden():
    limitations = [
        case
        for case in _cases()
        if case.get("expected_residual_risk") and case["category"] == "unknown_identifier_limitation"
    ]
    assert limitations
    for case in limitations:
        result = redact_pii_text(case["text"])
        assert all(value in result.text for value in case["must_preserve"])


def test_privacy_dataset_supports_span_level_precision_recall_and_false_redaction_rates():
    cases = _cases()
    assert sum(len(case.get("must_not_contain", [])) for case in cases) > 0
    assert sum(len(case.get("must_preserve", [])) for case in cases) > 0
    for case in cases:
        assert "expected_residual_risk" in case
        assert "expected_over_redaction" in case
        assert "report_group" in case
