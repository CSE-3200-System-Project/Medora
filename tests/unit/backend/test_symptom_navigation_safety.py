import json
import inspect
from pathlib import Path

from app.routes.ai_doctor import classify_navigation_outcome, detect_emergency_red_flags
from app.services.medical_knowledge import get_fallback_chain, get_related_specialties


ROOT = Path(__file__).resolve().parents[3]
DATASETS = ROOT / "tests" / "benchmarks" / "datasets"
FIXTURES = DATASETS / "symptom_navigation_cases.jsonl"
CATALOG = DATASETS / "navigation_specialty_catalog.json"


def _cases():
    return [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines() if line.strip()]


def _catalog():
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def test_deterministic_emergency_rules_cover_all_emergency_fixtures():
    emergency = [case for case in _cases() if case["expected_emergency"]]
    assert emergency
    for case in emergency:
        assert detect_emergency_red_flags(case["text"]), case["id"]


def test_emergency_rule_firing_matches_the_declared_expectation():
    """Over-triage is tolerated only where the fixture declares and explains it."""
    for case in _cases():
        expected = bool(case["expected_emergency_rule_fires"])
        actual = detect_emergency_red_flags(case["text"])
        if expected != actual:
            assert case["limitation_class"], f"{case['id']} deviates without disclosure"
            assert case["limitation_note"], case["id"]
        if expected and not case["expected_emergency"]:
            # A declared over-trigger must actually still over-trigger, or the
            # published limitation is stale.
            assert actual, f"{case['id']} no longer over-triggers; retire the limitation"


def test_manual_browse_is_always_available_and_no_specialty_escapes_the_catalog():
    catalog = _catalog()
    allowed = set(catalog["specialties_with_doctors"])
    for case in _cases():
        for intent in (case.get("provider_intent"), None):
            outcome = classify_navigation_outcome(
                user_text=case["text"],
                intent=intent,
                available_specialties=catalog["available_specialties"],
                specialties_with_doctors=catalog["specialties_with_doctors"],
            )
            assert outcome["manual_browse_available"] is True, case["id"]
            assert set(outcome["extracted_specialties"]) <= allowed, case["id"]


def test_provider_failure_yields_uncertainty_and_no_model_derived_candidates():
    catalog = _catalog()
    outcome = classify_navigation_outcome(
        user_text="stomach pain after meals",
        intent=None,
        available_specialties=catalog["available_specialties"],
        specialties_with_doctors=catalog["specialties_with_doctors"],
    )
    assert outcome["uncertain"] is True
    assert outcome["extracted_specialties"] == []
    assert outcome["manual_browse_available"] is True


def test_emergency_bypasses_the_model_entirely():
    catalog = _catalog()
    outcome = classify_navigation_outcome(
        user_text="I cannot breathe and have severe chest pain",
        intent={"specialties": [{"name": "Cardiologist", "confidence": 0.99}], "ambiguity": "low"},
        available_specialties=catalog["available_specialties"],
        specialties_with_doctors=catalog["specialties_with_doctors"],
    )
    assert outcome["outcome"] == "emergency"
    assert outcome["requires_immediate_care"] is True
    assert outcome["extracted_specialties"] == []
    assert outcome["manual_browse_available"] is True


def test_classifier_never_emits_severity_urgency_or_triage():
    catalog = _catalog()
    outcome = classify_navigation_outcome(
        user_text="itchy rash for three days",
        intent={
            "specialties": [{"name": "Dermatologist", "confidence": 0.9}],
            "ambiguity": "low",
            "severity": "high",
            "urgency": "immediate",
            "triage": "red",
        },
        available_specialties=catalog["available_specialties"],
        specialties_with_doctors=catalog["specialties_with_doctors"],
    )
    assert not {"severity", "urgency", "triage", "triage_priority"} & set(outcome["medical_intent"])


def test_specialty_navigation_has_no_severity_or_urgency_parameter():
    for function in (get_related_specialties, get_fallback_chain):
        parameters = inspect.signature(function).parameters
        assert "severity" not in parameters
        assert "urgency" not in parameters


def test_emergency_is_not_a_ranked_specialty_fallback():
    candidates = get_related_specialties(["emergency"], max_results=5)
    assert "Emergency Medicine" not in candidates
