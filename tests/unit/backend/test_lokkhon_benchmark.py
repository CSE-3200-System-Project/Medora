"""Lokkhon's own guard rails.

A benchmark can be wrong in a way its subject cannot: it can flatter itself. These tests
defend the properties that make the published numbers worth reading — that derived cases
never sneak into an authored headline, that a transform cannot desynchronise a case from
its annotation, that the release scores through the same code the gate runs, and that the
romanisation map fails loudly rather than passing Bengali through unmapped.

They do not re-check the redactor. That is what the benchmark itself is for.
"""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
LOKKHON = ROOT / "benchmark" / "lokkhon"
sys.path.insert(0, str(LOKKHON))

from abstention import (  # noqa: E402
    CONFIDENCE_TIERS,
    aurc,
    confidence_for_navigation_row,
    risk_coverage_curve,
    score_axis_e,
)
from bootstrap import mean_ci, proportion_ci  # noqa: E402
from generate_axis_d_cases import ELIGIBLE_GROUPS, TRANSFORMS, build, derive  # noqa: E402
from transliterate import (  # noqa: E402
    ROMANISATION,
    UncoveredToken,
    contains_bengali,
    romanise,
    to_arabic_digits,
    to_bengali_digits,
)

DERIVED = LOKKHON / "datasets" / "axis_d_derived_cases.jsonl"
RELEASE = LOKKHON / "results" / "lokkhon_v0.1.json"
SOURCE_CASES = ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl"


def _jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


# ---------------------------------------------------------------------------
# The transliteration map refuses to guess
# ---------------------------------------------------------------------------

def test_unmapped_bengali_raises_instead_of_passing_through():
    """Silence here would emit cases whose spans no longer match their own text."""
    with pytest.raises(UncoveredToken):
        romanise("এটি একটি সম্পূর্ণ অপরিচিত বাক্য")


def test_romanisation_leaves_no_bengali_behind():
    for source in ROMANISATION:
        assert not contains_bengali(romanise(source))


def test_keeping_bengali_digits_is_a_declared_choice_not_an_escape():
    """`digits=False` exempts numerals only. Unmapped words still raise."""
    assert romanise("ফোন ০১৭১২৩৪৫৬৭৮", digits=False) == "phone ০১৭১২৩৪৫৬৭৮"
    with pytest.raises(UncoveredToken):
        romanise("অপরিচিত ০১৭", digits=False)


def test_digit_conversion_round_trips():
    assert to_arabic_digits("০১৭১২৩৪৫৬৭৮") == "01712345678"
    assert to_bengali_digits("01712345678") == "০১৭১২৩৪৫৬৭৮"
    assert to_arabic_digits(to_bengali_digits("2026")) == "2026"


def test_longer_phrases_win_over_their_own_words():
    """"রোগীর নাম" must not be split into "রোগীর" plus "নাম"."""
    assert romanise("রোগীর নাম: নুসরাত জাহান") == "rogir nam: Nusrat Jahan"


# ---------------------------------------------------------------------------
# Derivation cannot desynchronise a case from its annotation
# ---------------------------------------------------------------------------

def test_a_transform_that_loses_a_span_is_refused():
    """The guard that keeps a derived case from scoring against text it no longer describes."""
    case = {
        "id": "PII-TEST",
        "category": "test",
        "report_group": "phone",
        "text": "ফোন ০১৭১২৩৪৫৬৭৮",
        "must_not_contain": ["০১৭১২৩৪৫৬৭৮"],
        "must_preserve": [],
    }
    # A transform that rewrites the surrounding text in a way the span does not follow:
    # applied to the whole string it consumes the start of the number, applied to the span
    # alone it matches nothing. The annotation and the text end up describing different
    # things, which is exactly what must be refused.
    with pytest.raises(ValueError, match="absent from"):
        derive(case, "broken", lambda text: text.replace("ফোন ০১৭", "phone 017"))


def test_a_no_op_transform_emits_nothing():
    """Otherwise the same case would be counted twice under two names."""
    case = {
        "id": "PII-TEST",
        "category": "test",
        "report_group": "phone",
        "text": "Phone 01712345678",
        "must_not_contain": ["01712345678"],
        "must_preserve": [],
    }
    assert derive(case, "identity", lambda text: text) is None


@pytest.mark.skipif(not DERIVED.exists(), reason="derived corpus not generated")
def test_every_derived_span_is_present_in_its_own_text():
    for case in _jsonl(DERIVED):
        for span in case["must_not_contain"] + case["must_preserve"]:
            assert span in case["text"], case["id"]


@pytest.mark.skipif(not DERIVED.exists(), reason="derived corpus not generated")
def test_every_derived_case_declares_that_it_is_not_independent_evidence():
    """This flag is the only thing keeping derived cases out of an authored headline."""
    for case in _jsonl(DERIVED):
        assert case["derivation"]["independent_evidence"] is False, case["id"]
        assert case["derivation"]["source_case_id"], case["id"]
        assert case["derivation"]["transform"] in TRANSFORMS, case["id"]


@pytest.mark.skipif(not DERIVED.exists(), reason="derived corpus not generated")
def test_derived_cases_inherit_no_limitation_disclosure():
    """A disclosure authored about one string does not automatically hold for a transform.

    Inheriting it would let a genuinely new failure hide behind an old excuse.
    """
    for case in _jsonl(DERIVED):
        assert case["limitation_class"] is None, case["id"]
        assert case["expected_residual_risk"] is False, case["id"]


@pytest.mark.skipif(not DERIVED.exists(), reason="derived corpus not generated")
def test_no_derived_case_duplicates_an_authored_one():
    authored_text = {case["text"] for case in _jsonl(SOURCE_CASES)}
    seen: set[str] = set()
    for case in _jsonl(DERIVED):
        assert case["text"] not in authored_text, case["id"]
        assert case["text"] not in seen, case["id"]
        seen.add(case["text"])


def test_generation_is_deterministic():
    cases = _jsonl(SOURCE_CASES)
    assert build(cases) == build(cases)


def test_benign_groups_are_excluded_from_derivation():
    """Their whole content is must_preserve, so a copy tests the map, not the redactor."""
    assert "benign" not in ELIGIBLE_GROUPS
    assert "limitation" not in ELIGIBLE_GROUPS


# ---------------------------------------------------------------------------
# Bootstrap reporting
# ---------------------------------------------------------------------------

def test_a_rate_always_carries_its_denominator():
    result = proportion_ci(43, 49)
    assert result["n"] == 49
    assert result["ci_low"] <= result["estimate"] <= result["ci_high"]


def test_a_single_case_does_not_get_a_zero_width_interval():
    """n=1 bounding itself would read as certainty. Say "no interval" instead."""
    result = mean_ci([1.0])
    assert result["n"] == 1
    assert result["ci_low"] is None and result["ci_high"] is None


def test_an_empty_population_reports_no_estimate_rather_than_zero():
    assert proportion_ci(0, 0)["estimate"] is None


def test_intervals_are_reproducible_from_the_recorded_seed():
    """A reader must be able to regenerate the exact interval, not merely one like it.

    Only determinism is asserted. Two different seeds can land on the same percentile at
    these sample sizes, so requiring them to differ would be testing the resampler's luck.
    """
    assert proportion_ci(7, 30, seed=42) == proportion_ci(7, 30, seed=42)
    assert mean_ci([0.0, 1.0] * 15, seed=1) == mean_ci([0.0, 1.0] * 15, seed=1)


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_the_release_records_the_seed_it_used():
    bootstrap = json.loads(RELEASE.read_text(encoding="utf-8"))["bootstrap"]
    assert isinstance(bootstrap["seed"], int)
    assert bootstrap["iterations"] >= 1000


# ---------------------------------------------------------------------------
# Axis E
# ---------------------------------------------------------------------------

def test_the_emergency_tier_outranks_every_matching_tier():
    """The red-flag rule runs before the model; it is the most certain output on the path."""
    emergency = confidence_for_navigation_row(
        {"emergency_rule_fired": True, "recorded_candidate_source": "none", "recorded_uncertain": True}
    )
    matched = confidence_for_navigation_row(
        {"emergency_rule_fired": False, "recorded_candidate_source": "matched", "recorded_uncertain": False}
    )
    assert emergency > matched


def test_confidence_falls_as_the_matching_tier_weakens():
    rows = [
        {"emergency_rule_fired": False, "recorded_candidate_source": source, "recorded_uncertain": False}
        for source in ("matched", "symptom_fallback", "universal_fallback", "none")
    ]
    scores = [confidence_for_navigation_row(row) for row in rows]
    assert scores == sorted(scores, reverse=True)
    assert len(set(scores)) == len(scores)


def test_every_declared_tier_is_reachable():
    for (source, uncertain), value in CONFIDENCE_TIERS.items():
        row = {
            "emergency_rule_fired": source == "emergency",
            "recorded_candidate_source": source,
            "recorded_uncertain": uncertain,
        }
        assert confidence_for_navigation_row(row) == value


def test_ties_are_admitted_together():
    """A threshold that admits one case at 0.9 must admit them all, or the curve claims
    a discrimination the signal does not have."""
    curve = risk_coverage_curve([(0.9, False), (0.9, True), (0.1, True)])
    assert [point["answered"] for point in curve] == [2, 3]


def test_coverage_reaches_one_and_ends_at_the_base_error_rate():
    scored = [(0.9, False), (0.5, True), (0.1, True), (0.1, False)]
    curve = risk_coverage_curve(scored)
    assert curve[-1]["coverage"] == 1.0
    assert curve[-1]["risk"] == pytest.approx(0.5)


def test_a_perfect_ranking_beats_a_useless_one():
    perfect = risk_coverage_curve([(1.0, False), (1.0, False), (0.0, True), (0.0, True)])
    useless = risk_coverage_curve([(0.5, False), (0.5, True), (0.5, False), (0.5, True)])
    assert aurc(perfect) < aurc(useless)


def test_axis_e_scores_errors_the_same_way_the_rest_of_lokkhon_does():
    """Axis E must not grade itself on an easier definition than axis A uses."""
    rows = [
        {"emergency_rule_fired": True, "recorded_candidate_source": "none",
         "recorded_uncertain": True, "matched_expected": True},
        {"emergency_rule_fired": False, "recorded_candidate_source": "matched",
         "recorded_uncertain": False, "matched_expected": False},
    ]
    result = score_axis_e(rows)
    assert result["n"] == 2
    assert result["errors"] == 1
    assert result["base_error_rate"] == pytest.approx(0.5)


def test_axis_e_declares_that_it_measures_ranking_and_not_calibration():
    rows = [
        {"emergency_rule_fired": False, "recorded_candidate_source": "matched",
         "recorded_uncertain": False, "matched_expected": True},
    ]
    result = score_axis_e(rows)
    assert result["confidence_signal"]["kind"] == "ordinal_proxy"
    assert "calibrat" in " ".join(result["limitations"]).lower()


# ---------------------------------------------------------------------------
# The release artifact
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_the_release_never_pools_authored_and_derived_axis_d():
    release = json.loads(RELEASE.read_text(encoding="utf-8"))
    axis_d = release["axes"]["D"]
    assert axis_d["pooled_headline"] is None
    assert axis_d["authored"]["n"] != (axis_d["derived"] or {}).get("n")


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_every_released_rate_carries_its_sample_size():
    release = json.loads(RELEASE.read_text(encoding="utf-8"))

    def walk(node):
        if isinstance(node, dict):
            # A bootstrap result is recognisable by its estimate/ci shape.
            if "estimate" in node and "ci_low" in node:
                assert "n" in node, node
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(release)


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_the_release_states_that_no_ocr_accuracy_is_claimed():
    """The withdrawn OCR claim has to stay withdrawn, in the artifact and not just in prose."""
    release = json.loads(RELEASE.read_text(encoding="utf-8"))
    joined = " ".join(release["limitations"]).lower()
    assert "ocr" in joined
    assert "not measured" in joined or "no accuracy figure" in joined


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_the_release_records_which_code_scored_it():
    release = json.loads(RELEASE.read_text(encoding="utf-8"))
    assert release["scoring_source"]["module"] == "tests/benchmarks/run_safety_benchmarks.py"
    assert release["provider"] == "mock"


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_axis_a_still_reports_the_archived_escalation_baseline():
    """0 false negatives against 5 false positives over 30 fixtures is the published result."""
    axis_a = json.loads(RELEASE.read_text(encoding="utf-8"))["axes"]["A"]
    assert axis_a["n"] == 30
    assert axis_a["false_negatives"] == 0
    assert axis_a["false_positives"] == 5
    assert axis_a["review_state"] == "complete"


@pytest.mark.skipif(not RELEASE.exists(), reason="release not built")
def test_the_release_explains_its_inverted_top_tier_rather_than_hiding_it():
    axis_e = json.loads(RELEASE.read_text(encoding="utf-8"))["axes"]["E"]
    assert axis_e["top_tier_inversion"]["inverted"] is True
    assert "recall-first" in axis_e["top_tier_inversion"]["explanation"].lower()
    # And it publishes the curve that answers the question without the deterministic path.
    assert axis_e["excluding_emergency_path"]["curve"]


# ---------------------------------------------------------------------------
# The runner uses the deployed scorer
# ---------------------------------------------------------------------------

def test_the_release_runner_imports_the_harness_rather_than_copying_it():
    """A benchmark scored by a second copy of the scoring code is measuring the copy."""
    source = (LOKKHON / "run_lokkhon.py").read_text(encoding="utf-8")
    assert "from run_safety_benchmarks import" in source
    assert "score_privacy_case" in source
    # No local redaction call: the derived corpus must go through the shared scorer.
    assert "redact_pii_text(" not in source
