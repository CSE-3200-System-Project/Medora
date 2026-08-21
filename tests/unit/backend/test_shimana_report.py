"""Shimana's reporter, checked for the ways a frontier analysis flatters itself.

The failure modes this defends against are all forms of claiming more than the sweep
measured: calling an unpaired comparison paired, presenting a dominated configuration as a
point on a trade-off, and printing a knee for a front too short to have one or for a
configuration that achieves nothing.

The sweep itself is not re-run here. These tests read fixed inputs and check the analysis.
"""

import csv
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tests" / "benchmarks"))

from run_shimana_report import (  # noqa: E402
    bootstrap_mean,
    build_report,
    dominates,
    knee,
    non_dominated,
    paired_deltas,
    write_csv,
)

ARCHIVED = ROOT / "tests" / "benchmarks" / "reports" / "shimana_results.json"


def _point(config: str, utility: float, exposure: float) -> dict:
    return {"config": config, "utility": utility, "exposure": exposure, "note": None}


def _sweep(configs: list[dict], **meta) -> dict:
    return {
        "provider": meta.get("provider", "mock"),
        "patients": meta.get("patients", 3),
        "seeds": 1,
        "task": "grounded_patient_summary",
        "executed_at": "2026-08-21T00:00:00+00:00",
        "configs": configs,
    }


# ---------------------------------------------------------------------------
# Dominance
# ---------------------------------------------------------------------------

def test_more_utility_at_less_exposure_dominates():
    assert dominates(_point("A", 0.8, 100), _point("B", 0.5, 200))


def test_equal_on_both_axes_is_not_domination():
    """Two configurations that behave identically must both survive."""
    a, b = _point("A", 0.5, 100), _point("B", 0.5, 100)
    assert not dominates(a, b)
    assert not dominates(b, a)
    assert len(non_dominated([a, b])) == 2


def test_equal_utility_at_lower_exposure_dominates():
    assert dominates(_point("A", 0.5, 50), _point("B", 0.5, 200))


def test_a_configuration_that_disclosed_more_for_less_is_reported_as_dominated():
    """The finding the archived sweep actually produced, in miniature."""
    points = [_point("narrow", 0.33, 958), _point("wide", 0.12, 1958)]
    assert [point["config"] for point in non_dominated(points)] == ["narrow"]


# ---------------------------------------------------------------------------
# Knee
# ---------------------------------------------------------------------------

def test_a_front_of_two_has_no_knee():
    """Both points are endpoints; naming one would dress an arbitrary pick as an inflection."""
    assert knee([_point("A", 0.0, 0), _point("B", 1.0, 100)]) is None


def test_the_knee_is_the_point_furthest_from_the_chord():
    front = [_point("A", 0.0, 0), _point("K", 0.9, 20), _point("B", 1.0, 100)]
    assert knee(front)["config"] == "K"


def test_the_knee_is_scale_invariant():
    """Exposure is per thousand and utility is a proportion.

    Without normalisation the perpendicular distance is measured almost entirely along
    whichever axis carries the larger units, so the answer would change with a unit change.
    """
    small = [_point("A", 0.0, 0), _point("K", 0.9, 20), _point("B", 1.0, 100)]
    large = [_point("A", 0.0, 0), _point("K", 0.9, 20_000), _point("B", 1.0, 100_000)]
    assert knee(small)["config"] == knee(large)["config"]


def test_a_flat_front_has_no_knee():
    front = [_point("A", 0.5, 10), _point("B", 0.5, 10), _point("C", 0.5, 10)]
    assert knee(front) is None


# ---------------------------------------------------------------------------
# Paired analysis
# ---------------------------------------------------------------------------

def _config_with_patients(name: str, values: dict[str, float], exposure: int = 0) -> dict:
    return {
        "config": name,
        "note": None,
        "utility_mean": sum(values.values()) / len(values),
        "exposure_spans_per_1000": exposure,
        "per_patient": [
            {"patient_token": token, "utility": utility, "term_coverage": 0.0, "exposure_spans": exposure}
            for token, utility in values.items()
        ],
    }


def test_a_sweep_without_per_patient_values_reports_paired_as_unavailable():
    """An unpaired number under a paired heading would misdescribe what was measured."""
    result = paired_deltas(
        [{"config": "A", "utility_mean": 0.1, "exposure_spans_per_1000": 0},
         {"config": "B", "utility_mean": 0.2, "exposure_spans_per_1000": 5}],
        seed=1,
        iterations=200,
    )
    assert result["available"] is False
    assert result["comparisons"] == []
    assert "not substituted" in result["note"]


def test_paired_deltas_compare_the_same_patients():
    narrow = _config_with_patients("narrow", {"p1": 0.0, "p2": 0.0, "p3": 1.0})
    wide = _config_with_patients("wide", {"p1": 1.0, "p2": 1.0, "p3": 1.0}, exposure=4)

    result = paired_deltas([narrow, wide], seed=1, iterations=500)

    assert result["available"] is True
    assert result["unit_of_analysis"] == "patient"
    comparison = result["comparisons"][0]
    assert comparison["patients"] == 3
    assert comparison["improved"] == 2
    assert comparison["unchanged"] == 1
    assert comparison["worsened"] == 0
    assert comparison["utility_delta"]["estimate"] == pytest.approx(2 / 3)


def test_a_delta_interval_that_straddles_zero_is_reported_as_not_separating():
    """At these sample sizes "we cannot tell" is a finding, not a gap to fill."""
    narrow = _config_with_patients("narrow", {"p1": 1.0, "p2": 0.0, "p3": 1.0, "p4": 0.0})
    wide = _config_with_patients("wide", {"p1": 0.0, "p2": 1.0, "p3": 1.0, "p4": 0.0})

    comparison = paired_deltas([narrow, wide], seed=7, iterations=1000)["comparisons"][0]
    assert comparison["utility_delta"]["estimate"] == pytest.approx(0.0)
    assert comparison["separates_at_95"] is False


def test_patients_present_in_only_one_configuration_are_excluded_from_the_pair():
    narrow = _config_with_patients("narrow", {"p1": 0.0, "p2": 0.0})
    wide = _config_with_patients("wide", {"p1": 1.0, "p3": 1.0})

    comparison = paired_deltas([narrow, wide], seed=1, iterations=200)["comparisons"][0]
    assert comparison["patients"] == 1


# ---------------------------------------------------------------------------
# Intervals
# ---------------------------------------------------------------------------

def test_a_single_observation_gets_no_interval():
    result = bootstrap_mean([0.5])
    assert result["n"] == 1
    assert result["ci_low"] is None


def test_intervals_reproduce_from_the_recorded_seed():
    values = [0.0, 1.0, 0.0, 1.0, 1.0]
    assert bootstrap_mean(values, seed=3, iterations=500) == bootstrap_mean(values, seed=3, iterations=500)


# ---------------------------------------------------------------------------
# The whole report
# ---------------------------------------------------------------------------

def test_a_zero_utility_knee_is_flagged_as_degenerate():
    """Disclosing nothing trivially minimises exposure. That is geometry, not an operating point."""
    sweep = _sweep([
        {"config": "L", "note": None, "utility_mean": 0.0, "exposure_spans_per_1000": 0.0},
        {"config": "L+K", "note": None, "utility_mean": 0.0, "exposure_spans_per_1000": 0.0},
        {"config": "L+K+R", "note": None, "utility_mean": 0.33, "exposure_spans_per_1000": 958.3},
    ])
    report = build_report(sweep, seed=1, iterations=200)
    assert report["knee"]["degenerate"] is True
    assert "not a deployable operating point" in report["knee"]["caveat"]


def test_the_report_names_which_configuration_dominates_a_dominated_one():
    sweep = _sweep([
        {"config": "narrow", "note": None, "utility_mean": 0.33, "exposure_spans_per_1000": 958.3},
        {"config": "wide", "note": None, "utility_mean": 0.12, "exposure_spans_per_1000": 1958.3},
    ])
    report = build_report(sweep, seed=1, iterations=200)
    assert report["dominated"][0]["config"] == "wide"
    assert report["dominated"][0]["dominated_by"] == ["narrow"]


def test_non_monotone_utility_is_reported_rather_than_smoothed():
    """The registered hypothesis is that utility rises with disclosure. Where it does not,
    the report has to say so."""
    sweep = _sweep([
        {"config": "narrow", "note": None, "utility_mean": 0.33, "exposure_spans_per_1000": 958.3},
        {"config": "wide", "note": None, "utility_mean": 0.12, "exposure_spans_per_1000": 1958.3},
    ])
    report = build_report(sweep, seed=1, iterations=200)
    assert report["shape"]["utility_monotone_in_disclosure"] is False


def test_the_report_records_the_provider_it_analysed():
    """A frontier built from mock output must never be mistaken for a live one."""
    report = build_report(_sweep([], provider="mock"), seed=1, iterations=200)
    assert report["source"]["provider"] == "mock"


def test_the_csv_is_plottable_without_reshaping(tmp_path):
    sweep = _sweep([
        {"config": "L", "note": "local only", "utility_mean": 0.0, "exposure_spans_per_1000": 0.0},
        {"config": "L+K", "note": None, "utility_mean": 0.0, "exposure_spans_per_1000": 0.0},
        {"config": "L+K+R", "note": None, "utility_mean": 0.33, "exposure_spans_per_1000": 958.3},
    ])
    report = build_report(sweep, seed=1, iterations=200)
    target = tmp_path / "frontier.csv"
    write_csv(report, target)

    rows = list(csv.DictReader(target.open(encoding="utf-8")))
    assert [row["config"] for row in rows] == ["L", "L+K", "L+K+R"]
    assert {"exposure_per_1000", "utility", "non_dominated", "is_knee"} <= set(rows[0])


# ---------------------------------------------------------------------------
# Against the archived sweep
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not ARCHIVED.exists(), reason="archived sweep absent")
def test_the_archived_sweep_still_shows_the_two_widest_configurations_dominated():
    """The finding: past the redacted subset, more disclosure bought less utility.

    Pinned so a later change to the reporter cannot quietly reverse a published claim.
    """
    sweep = json.loads(ARCHIVED.read_text(encoding="utf-8"))
    report = build_report(sweep, seed=1, iterations=500)

    assert report["source"]["provider"] == "groq"
    assert set(report["non_dominated_set"]) == {"L", "L+K", "L+K+R"}
    assert {row["config"] for row in report["dominated"]} == {"L+K+R+H", "U"}
    assert report["shape"]["utility_monotone_in_disclosure"] is False


@pytest.mark.skipif(not ARCHIVED.exists(), reason="archived sweep absent")
def test_the_archived_sweep_cannot_support_paired_analysis():
    """It predates per-patient recording, and the report says so rather than improvising."""
    sweep = json.loads(ARCHIVED.read_text(encoding="utf-8"))
    report = build_report(sweep, seed=1, iterations=200)
    assert report["paired"]["available"] is False


@pytest.mark.skipif(not ARCHIVED.exists(), reason="archived sweep absent")
def test_a_recovery_fraction_above_one_is_reported_not_renormalised():
    """The narrow configuration beat full disclosure. The framing presumed it could not.

    Clamping this to 1.0 to keep "fraction of unrestricted" reading naturally would erase
    the finding, so the report keeps the number and explains what above 1.0 means.
    """
    sweep = json.loads(ARCHIVED.read_text(encoding="utf-8"))
    recovery = build_report(sweep, seed=1, iterations=200)["utility_recovery_vs_unrestricted"]

    narrow = next(row for row in recovery["rows"] if row["config"] == "L+K+R")
    assert narrow["utility_fraction_of_unrestricted"] > 1.0
    assert narrow["exposure_fraction_of_unrestricted"] < 0.2
    assert "above 1.0" in recovery["note"]
