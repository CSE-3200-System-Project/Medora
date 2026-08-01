import json
import inspect
from pathlib import Path

from app.routes.ai_doctor import detect_emergency_red_flags
from app.services.medical_knowledge import get_fallback_chain, get_related_specialties


ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "tests" / "benchmarks" / "datasets" / "symptom_navigation_cases.jsonl"


def test_deterministic_emergency_rules_cover_all_emergency_fixtures():
    cases = [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines()]
    emergency = [case for case in cases if case["expected"] == "emergency"]
    assert emergency
    for case in emergency:
        assert detect_emergency_red_flags(case["text"]), case["id"]


def test_navigation_examples_do_not_trigger_emergency_rules():
    cases = [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines()]
    ordinary = [case for case in cases if case["expected"] != "emergency"]
    for case in ordinary:
        assert not detect_emergency_red_flags(case["text"]), case["id"]


def test_specialty_navigation_has_no_severity_or_urgency_parameter():
    for function in (get_related_specialties, get_fallback_chain):
        parameters = inspect.signature(function).parameters
        assert "severity" not in parameters
        assert "urgency" not in parameters


def test_emergency_is_not_a_ranked_specialty_fallback():
    candidates = get_related_specialties(["emergency"], max_results=5)
    assert "Emergency Medicine" not in candidates
