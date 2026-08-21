"""Arohon: the ceiling has to hold, and the split must not move the published baseline.

Two things are being defended here.

The first is the specification itself — that authority is bounded by risk class, that
policy can only ever lower a tier, and that self-harm cannot reach L4 no matter what is
passed in. Those are the claims the whitepaper makes, so they are asserted directly
rather than exercised incidentally through a route.

The second is a regression guard. Splitting one emergency boolean into risk classes is
the kind of change that silently shifts a measured result. The archived navigation
baseline (30 clinician-reviewed fixtures, seven emergency labels retained on both scored
paths) was produced by the old detector, so the new one is required to answer identically
on every fixture and on the raw pattern set.
"""

import json
import re
from pathlib import Path

import pytest

from app.core.arohon import (
    EMERGENCY_RISK_CLASSES,
    L4_ELIGIBLE_RISK_CLASSES,
    RISK_CEILINGS,
    TIER_ORDER,
    ceiling_for,
    min_tier,
    resolve_tier,
    tier_rank,
)
from app.db.models.enums import AutonomyTier, RiskClass
from app.routes.ai_doctor import detect_emergency_red_flags
from app.services.risk_classifier import (
    CLASS_PRECEDENCE,
    RISK_PATTERNS,
    classify_risk,
    is_emergency_text,
)

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "tests" / "benchmarks" / "datasets" / "symptom_navigation_cases.jsonl"


def _cases():
    return [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines() if line.strip()]


# The detector as it stood before the risk-class split, copied verbatim. If the new
# classifier ever disagrees with this, the published navigation numbers are stale.
_LEGACY_PATTERNS = (
    re.compile(r"\b(?:cannot|can't|unable to)\s+breathe\b", re.IGNORECASE),
    re.compile(r"\b(?:severe\s+)?chest\s+pain\b", re.IGNORECASE),
    re.compile(
        r"\b(?:unconscious|not\s+breathing|(?:severe|heavy)\s+bleeding|seizure|stroke|fainting)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:suicid(?:e|al)|kill\s+myself|(?:hurt|harm)\s+myself)\b", re.IGNORECASE),
    re.compile(
        r"(?:শ্বাস\s*নিতে\s*পারছি\s*না|বুকে\s*তীব্র\s*ব্যথা|অজ্ঞান|খিঁচুনি|প্রচুর\s*রক্তপাত|আত্মহত্যা|নিজেকে\s*আঘাত)"
    ),
    re.compile(r"(?:শ্বাসকষ্ট|ধড়ফড়)"),
)


def _legacy_detect(text: str) -> bool:
    normalized = str(text or "").strip()
    return any(pattern.search(normalized) for pattern in _LEGACY_PATTERNS)


# ---------------------------------------------------------------------------
# Regression: the split changed nothing measurable
# ---------------------------------------------------------------------------

def test_classifier_matches_the_legacy_detector_on_every_navigation_fixture():
    for case in _cases():
        assert is_emergency_text(case["text"]) == _legacy_detect(case["text"]), case["id"]


def test_route_level_detector_still_matches_the_declared_fixture_expectation():
    for case in _cases():
        assert detect_emergency_red_flags(case["text"]) == bool(case["expected_emergency_rule_fires"]), case["id"]


@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "I would like a routine dermatology appointment",
        "আমার ত্বকের সমস্যা হচ্ছে",
        "I cannot breathe and have severe chest pain",
        "মাথা ঘোরা",
        "chest pain",
        "he had a stroke last year",
        "heavy bleeding after the fall",
        "শ্বাসকষ্ট হচ্ছে",
        "বুক ধড়ফড় করছে",
    ],
)
def test_classifier_and_legacy_detector_agree_case_by_case(text):
    assert is_emergency_text(text) == _legacy_detect(text)


#: Every surface form the deployed rules were written to catch, plus near-misses that
#: must not fire. Both detectors are run over each one; disagreement means the partition
#: changed coverage.
_DIFFERENTIAL_PROBES = (
    "cannot breathe", "can't breathe", "unable to breathe", "not breathing",
    "chest pain", "severe chest pain", "unconscious", "seizure", "stroke", "fainting",
    "severe bleeding", "heavy bleeding", "suicide", "suicidal", "kill myself",
    "hurt myself", "harm myself",
    "শ্বাস নিতে পারছি না", "বুকে তীব্র ব্যথা", "অজ্ঞান", "খিঁচুনি", "প্রচুর রক্তপাত",
    "আত্মহত্যা", "নিজেকে আঘাত", "শ্বাসকষ্ট", "ধড়ফড়",
    # Near-misses. None of these fired before and none may start firing now.
    "breathe", "pain", "bleeding", "myself", "light bleeding", "back pain",
    "মাথা ঘোরা", "জ্বর", "কাশি", "chest", "strokes of luck",
)


@pytest.mark.parametrize("probe", _DIFFERENTIAL_PROBES)
def test_partition_preserves_coverage_exactly(probe):
    """No rule was dropped, loosened, or tightened by the partition."""
    for text in (probe, f"Patient reports {probe} since this morning.", f"{probe} হচ্ছে"):
        assert is_emergency_text(text) == _legacy_detect(text), text


def test_every_declared_risk_class_has_a_pattern_entry():
    """A class with no entry would silently be unreachable rather than deliberately empty."""
    for risk_class in CLASS_PRECEDENCE:
        assert risk_class in RISK_PATTERNS, risk_class


# ---------------------------------------------------------------------------
# Risk classification
# ---------------------------------------------------------------------------

def test_self_harm_wins_when_it_co_occurs_with_a_physical_red_flag():
    """The whole reason the boolean had to be split.

    Classifying this as cardiac would make it L4-eligible and permit an autonomous
    notification, which is precisely what the self-harm ceiling exists to prevent.
    """
    assessment = classify_risk("I want to kill myself and I have severe chest pain")
    assert assessment.risk_class is RiskClass.SELF_HARM
    assert RiskClass.CARDIAC in assessment.matched_classes  # not discarded, just not governing
    assert assessment.is_emergency


def test_self_harm_precedes_every_other_class():
    assert CLASS_PRECEDENCE[0] is RiskClass.SELF_HARM


def test_bengali_self_harm_is_classified_as_self_harm_not_as_an_emergency_takeover():
    assert classify_risk("আমি আত্মহত্যা করতে চাই").risk_class is RiskClass.SELF_HARM


@pytest.mark.parametrize(
    "text,expected",
    [
        ("I cannot breathe", RiskClass.RESPIRATORY),
        ("severe chest pain", RiskClass.CARDIAC),
        ("he is having a seizure", RiskClass.NEUROLOGIC),
        ("stroke symptoms", RiskClass.STROKE),
        ("severe bleeding", RiskClass.HEMORRHAGE),
        ("শ্বাসকষ্ট", RiskClass.RESPIRATORY),
        ("বুকে তীব্র ব্যথা", RiskClass.CARDIAC),
        ("অজ্ঞান হয়ে গেছে", RiskClass.NEUROLOGIC),
        ("প্রচুর রক্তপাত হচ্ছে", RiskClass.HEMORRHAGE),
    ],
)
def test_red_flags_land_in_the_clinically_correct_class(text, expected):
    assert classify_risk(text).risk_class is expected


def test_text_with_no_red_flag_is_routine_by_default():
    assessment = classify_risk("I need a follow-up appointment for my skin rash")
    assert assessment.risk_class is RiskClass.ROUTINE
    assert not assessment.is_emergency
    assert assessment.matched_classes == ()


def test_caller_can_declare_an_out_of_scope_default():
    assessment = classify_risk("what is the weather", default=RiskClass.OUT_OF_SCOPE)
    assert assessment.risk_class is RiskClass.OUT_OF_SCOPE


# ---------------------------------------------------------------------------
# The ceiling
# ---------------------------------------------------------------------------

def test_every_risk_class_has_a_declared_ceiling():
    for risk_class in RiskClass:
        assert risk_class in RISK_CEILINGS, risk_class


def test_self_harm_is_not_l4_eligible():
    """Structural, not configurable. This assertion is the specification."""
    assert RiskClass.SELF_HARM not in L4_ELIGIBLE_RISK_CLASSES


def test_self_harm_stays_at_l3_even_when_a_break_glass_grant_is_asserted():
    decision = resolve_tier(
        AutonomyTier.L4_BREAK_GLASS,
        RiskClass.SELF_HARM,
        break_glass_grant_active=True,
    )
    assert decision.granted_tier is AutonomyTier.L3_ESCALATE
    assert decision.ceiling is AutonomyTier.L3_ESCALATE
    assert decision.ceiling_applied


def test_cardiac_reaches_l4_only_with_an_active_grant():
    without = resolve_tier(AutonomyTier.L4_BREAK_GLASS, RiskClass.CARDIAC)
    assert without.granted_tier is AutonomyTier.L3_ESCALATE
    assert without.ceiling_applied

    with_grant = resolve_tier(
        AutonomyTier.L4_BREAK_GLASS,
        RiskClass.CARDIAC,
        break_glass_grant_active=True,
    )
    assert with_grant.granted_tier is AutonomyTier.L4_BREAK_GLASS
    assert not with_grant.ceiling_applied


def test_routine_work_is_capped_at_suggest():
    assert resolve_tier(AutonomyTier.L3_ESCALATE, RiskClass.ROUTINE).granted_tier is AutonomyTier.L2_SUGGEST


def test_out_of_scope_input_collapses_to_abstention():
    decision = resolve_tier(AutonomyTier.L2_SUGGEST, RiskClass.OUT_OF_SCOPE)
    assert decision.granted_tier is AutonomyTier.L0_ABSTAIN
    assert decision.abstained


def test_a_grant_cannot_widen_authority_for_a_non_emergency_class():
    """Holding a break-glass grant must not turn routine drafting into notification."""
    assert ceiling_for(RiskClass.ROUTINE, break_glass_grant_active=True) is AutonomyTier.L2_SUGGEST
    assert ceiling_for(RiskClass.OUT_OF_SCOPE, break_glass_grant_active=True) is AutonomyTier.L0_ABSTAIN


@pytest.mark.parametrize("risk_class", sorted(EMERGENCY_RISK_CLASSES, key=lambda item: item.value))
def test_every_emergency_class_can_surface_an_l3_takeover(risk_class):
    assert resolve_tier(AutonomyTier.L3_ESCALATE, risk_class).granted_tier is AutonomyTier.L3_ESCALATE


# ---------------------------------------------------------------------------
# Monotonicity: policy can only ever lower a tier
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("requested", TIER_ORDER)
@pytest.mark.parametrize("risk_class", list(RiskClass))
@pytest.mark.parametrize("grant", [False, True])
@pytest.mark.parametrize("consent_ok", [False, True])
def test_resolution_never_raises_authority_above_what_was_requested(requested, risk_class, grant, consent_ok):
    decision = resolve_tier(
        requested,
        risk_class,
        break_glass_grant_active=grant,
        consent_ok=consent_ok,
    )
    assert tier_rank(decision.granted_tier) <= tier_rank(requested)


@pytest.mark.parametrize("requested", TIER_ORDER)
@pytest.mark.parametrize("risk_class", list(RiskClass))
def test_denied_consent_collapses_every_path_to_abstention(requested, risk_class):
    decision = resolve_tier(requested, risk_class, consent_ok=False)
    assert decision.granted_tier is AutonomyTier.L0_ABSTAIN
    assert decision.reason == "consent_denied"


def test_tier_order_is_the_only_definition_of_rank():
    assert [tier_rank(tier) for tier in TIER_ORDER] == list(range(len(TIER_ORDER)))
    assert min_tier(AutonomyTier.L4_BREAK_GLASS, AutonomyTier.L1_INFORM) is AutonomyTier.L1_INFORM
    assert min_tier(AutonomyTier.L0_ABSTAIN, AutonomyTier.L0_ABSTAIN) is AutonomyTier.L0_ABSTAIN


def test_decision_log_fields_are_flat_and_complete():
    decision = resolve_tier(
        AutonomyTier.L4_BREAK_GLASS,
        RiskClass.SELF_HARM,
        break_glass_grant_active=True,
        correlation_id="req_deadbeef",
    )
    fields = decision.as_log_fields()
    assert fields["autonomy_tier"] == "L3_escalate"
    assert fields["risk_class"] == "self_harm"
    assert fields["tier_ceiling_applied"] is True
    assert fields["correlation_id"] == "req_deadbeef"
    assert all(not isinstance(value, (dict, list)) for value in fields.values())


# ---------------------------------------------------------------------------
# The two worked traces: same tier, different screen
# ---------------------------------------------------------------------------

def _navigate(text: str) -> dict:
    from app.routes.ai_doctor import classify_navigation_outcome

    return classify_navigation_outcome(
        user_text=text,
        intent=None,
        available_specialties=[],
        specialties_with_doctors=[],
    )


def test_cardiac_trace_surfaces_the_takeover_at_l3():
    outcome = _navigate("chest pain and difficulty breathing")
    assert outcome["outcome"] == "emergency"
    assert outcome["autonomy_tier"] == "L3_escalate"
    assert outcome["escalation_mode"] == "emergency_takeover"
    assert outcome["autonomous_notification"] is False
    assert outcome["manual_browse_available"] is True


def test_self_harm_trace_surfaces_support_and_refuses_to_act():
    outcome = _navigate("I want to kill myself")
    assert outcome["outcome"] == "emergency"
    assert outcome["risk_class"] == "self_harm"
    # Same rung of the ladder as the cardiac trace...
    assert outcome["autonomy_tier"] == "L3_escalate"
    # ...and a different screen, which is the whole contribution.
    assert outcome["escalation_mode"] == "crisis_support"
    assert outcome["autonomous_notification"] is False


def test_the_two_traces_share_a_tier_and_differ_in_presentation():
    cardiac = _navigate("severe chest pain")
    crisis = _navigate("আমি আত্মহত্যা করতে চাই")
    assert cardiac["autonomy_tier"] == crisis["autonomy_tier"] == "L3_escalate"
    assert cardiac["escalation_mode"] != crisis["escalation_mode"]
    assert cardiac["safety_message"] != crisis["safety_message"]


def test_the_crisis_message_does_not_direct_the_person_to_an_emergency_department():
    from app.routes.ai_doctor import CRISIS_SUPPORT_MESSAGE

    lowered = CRISIS_SUPPORT_MESSAGE.lower()
    for phrase in ("emergency department", "999", "ambulance", "call now"):
        assert phrase not in lowered, phrase


def test_routine_navigation_stays_at_inform_with_no_escalation():
    outcome = _navigate("I need a dermatologist for a skin rash")
    assert outcome["autonomy_tier"] == "L1_inform"
    assert outcome["escalation_mode"] is None
    assert outcome["risk_class"] == "routine"


# ---------------------------------------------------------------------------
# Helpline registry
# ---------------------------------------------------------------------------

def _at(hour: int, minute: int = 0):
    from datetime import datetime

    from app.services.helpline_registry import BANGLADESH_TIMEZONE

    return datetime(2026, 8, 21, hour, minute, tzinfo=BANGLADESH_TIMEZONE)


def test_kaan_pete_roi_is_closed_in_the_morning_and_open_in_the_evening():
    """A line that operates 3 PM to 3 AM must not be shown as reachable at 6 AM."""
    from app.services.helpline_registry import is_open_at

    assert is_open_at("kaan_pete_roi", _at(6)) is False
    assert is_open_at("kaan_pete_roi", _at(14, 59)) is False
    assert is_open_at("kaan_pete_roi", _at(15, 0)) is True
    assert is_open_at("kaan_pete_roi", _at(23)) is True
    # The window wraps past midnight.
    assert is_open_at("kaan_pete_roi", _at(2, 59)) is True
    assert is_open_at("kaan_pete_roi", _at(3, 0)) is False


def test_the_national_emergency_line_is_always_available():
    from app.services.helpline_registry import is_open_at

    for hour in range(24):
        assert is_open_at("national_emergency", _at(hour)) is True


def test_self_harm_always_gets_at_least_one_open_option():
    """No hour of the day may leave the crisis screen with nothing reachable on it."""
    from app.db.models.enums import RiskClass
    from app.services.helpline_registry import resolve_helplines

    for hour in range(24):
        resolved = resolve_helplines(RiskClass.SELF_HARM, now=_at(hour))
        assert any(item["open_now"] for item in resolved), hour


def test_closed_lines_are_returned_with_their_hours_rather_than_hidden():
    from app.db.models.enums import RiskClass
    from app.services.helpline_registry import resolve_helplines

    resolved = resolve_helplines(RiskClass.SELF_HARM, now=_at(6))
    kaan = next(item for item in resolved if item["key"] == "kaan_pete_roi")
    assert kaan["open_now"] is False
    assert kaan["opens_at"] == "15:00"


def test_a_line_reported_unreliable_is_ranked_below_working_ones():
    from app.db.models.enums import RiskClass
    from app.services.helpline_registry import resolve_helplines

    resolved = resolve_helplines(RiskClass.CARDIAC, now=_at(20))
    keys = [item["key"] for item in resolved]
    assert keys.index("national_emergency") < keys.index("shastho_batayon")
    degraded = next(item for item in resolved if item["key"] == "shastho_batayon")
    assert degraded["reliability"] == "reported_degraded"


def test_the_crisis_registry_offers_no_clinical_or_method_content():
    """The screen is a bridge to a person. It must not read as advice."""
    from app.services.helpline_registry import HELPLINES

    banned = ("dose", "pill", "method", "overdose", "diagnos", "prescrib")
    for helpline in HELPLINES:
        blob = " ".join(
            str(part).lower()
            for part in (helpline.name_en, helpline.name_bn, helpline.note_en, helpline.note_bn)
            if part
        )
        for word in banned:
            assert word not in blob, (helpline.key, word)


def test_every_helpline_carries_both_languages():
    from app.services.helpline_registry import HELPLINES

    for helpline in HELPLINES:
        assert helpline.name_en.strip()
        assert helpline.name_bn.strip()
        assert (helpline.note_en is None) == (helpline.note_bn is None), helpline.key
