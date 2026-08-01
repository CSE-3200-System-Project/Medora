import json
from pathlib import Path

from app.core.ai_privacy import redact_pii_text


ROOT = Path(__file__).resolve().parents[3]
DATASET = ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl"


def _cases():
    return [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_curated_pii_suite_has_required_coverage():
    cases = _cases()
    assert len(cases) >= 120
    categories = {case["category"] for case in cases}
    assert {"email", "phone", "national_id", "passport", "account_id", "known_name", "bengali_phone", "bengali_nid", "over_redaction", "consent_state", "prompt_injection", "unknown_identifier_limitation"} <= categories


def test_known_identifiers_never_leak_and_benign_text_is_preserved():
    for case in _cases():
        result = redact_pii_text(case["text"], known_identifiers=case.get("known_identifiers", []))
        for forbidden in case.get("must_not_contain", []):
            assert forbidden.casefold() not in result.text.casefold(), case["id"]
        for preserved in case.get("must_preserve", []):
            assert preserved in result.text, case["id"]


def test_consent_state_fixture_is_deny_by_default():
    consent_cases = [case for case in _cases() if case["category"] == "consent_state"]
    assert consent_cases
    for case in consent_cases:
        assert case["external_processing_allowed"] is (case["consent_state"] == "active")


def test_unknown_identifier_limitations_are_explicit_not_hidden():
    limitations = [case for case in _cases() if case.get("expected_residual_risk")]
    assert limitations
    for case in limitations:
        result = redact_pii_text(case["text"])
        assert all(value in result.text for value in case["must_preserve"])
