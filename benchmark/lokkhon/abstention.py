"""Axis E: does the system decline in the cases where it would have been wrong?

Accuracy alone cannot answer that. A navigator that is right 80% of the time is safe if
the 20% it gets wrong are the ones it flagged as uncertain, and unsafe if they are
scattered through the answers it presented confidently. The risk-coverage curve separates
those two systems; a single accuracy number does not.

Method. Rank every case by the confidence the deployed code already exposes, sweep a
threshold from "answer everything" down to "answer only the most confident case", and at
each point record two numbers: **coverage**, the fraction of cases answered, and **risk**,
the error rate among the answered ones. AURC is the mean risk across those coverage
levels, so lower is better. It is reported against two reference curves, because AURC in
isolation is uninterpretable:

* the **oracle**, which ranks by whether the case was actually correct - the best any
  ordering of this population could achieve;
* **random** ordering, whose risk is flat at the overall error rate.

A confidence signal that carries real information sits between them. One that sits at the
random line is noise wearing a number.

What the confidence signal is, and is not. `CONFIDENCE_TIERS` is an **ordinal proxy** read
off outputs the deployed navigation path already produces - which matching tier supplied
the candidates, and how ambiguous the request was judged to be. It is not a calibrated
probability, and nothing in the platform is trained to produce one. The whitepaper calls
axis E calibrated abstention; what is delivered here is the risk-coverage curve over the
signal that actually exists, which is the honest version of that claim and is stated as
such in the output.
"""

from __future__ import annotations

from typing import Sequence

from bootstrap import proportion_ci

__all__ = [
    "CONFIDENCE_TIERS",
    "confidence_for_navigation_row",
    "risk_coverage_curve",
    "aurc",
    "score_axis_e",
]


#: Ordinal confidence read off the deployed navigation outputs. Higher means the system
#: had a stronger basis for what it returned.
#:
#: The ordering is the tier structure `classify_navigation_outcome` already implements:
#: a deterministic red flag pre-empts the model entirely and is the most certain thing the
#: path produces; a catalogue-matched provider candidate is next; symptom-derived and
#: universal fallbacks are progressively weaker; and a provider failure leaves nothing at
#: all. These are ranks, not probabilities.
CONFIDENCE_TIERS: dict[tuple[str, bool], float] = {
    ("emergency", False): 1.00,
    ("emergency", True): 1.00,
    ("matched", False): 0.90,
    ("matched", True): 0.60,
    ("symptom_fallback", False): 0.50,
    ("symptom_fallback", True): 0.40,
    ("universal_fallback", False): 0.30,
    ("universal_fallback", True): 0.20,
    ("none", False): 0.10,
    ("none", True): 0.00,
}


def confidence_for_navigation_row(row: dict) -> float:
    """Confidence for one scored navigation row.

    An emergency is its own tier because the red-flag rule runs before the model and does
    not depend on the specialty match at all. Treating it as an ordinary `candidate_source
    == "none"` result would rank the most certain output the path produces at the bottom.
    """
    if row.get("emergency_rule_fired"):
        source = "emergency"
    else:
        source = row.get("recorded_candidate_source") or "none"
    uncertain = bool(row.get("recorded_uncertain"))
    return CONFIDENCE_TIERS.get((source, uncertain), 0.0)


def risk_coverage_curve(scored: Sequence[tuple[float, bool]]) -> list[dict[str, float | int]]:
    """Sweep the threshold and record coverage against risk at every point.

    `scored` is (confidence, is_error) per case. Ties are kept together: a threshold that
    admits one case at confidence 0.9 must admit every case at 0.9, otherwise the curve
    reports a discrimination the signal does not have.
    """
    if not scored:
        return []

    ordered = sorted(scored, key=lambda item: -item[0])
    total = len(ordered)
    points: list[dict[str, float | int]] = []

    index = 0
    errors = 0
    while index < total:
        tier = ordered[index][0]
        while index < total and ordered[index][0] == tier:
            errors += int(ordered[index][1])
            index += 1
        points.append(
            {
                "threshold": tier,
                "answered": index,
                "coverage": index / total,
                "errors": errors,
                "risk": errors / index,
            }
        )
    return points


def aurc(points: Sequence[dict[str, float | int]]) -> float | None:
    """Area under the risk-coverage curve, as the mean risk over its points.

    Coverage-weighted rather than uniform would over-count the high-coverage end, which is
    the region every system looks similar in. The plain mean over threshold points keeps
    the low-coverage behaviour - where abstention is supposed to earn its keep - visible.
    """
    if not points:
        return None
    return sum(float(point["risk"]) for point in points) / len(points)


def score_axis_e(navigation_rows: Sequence[dict]) -> dict:
    """Axis E over the scored navigation fixtures.

    An error is a case whose recorded outcome did not match the fixture's expectation -
    the same `matched_expected` measurement the rest of Lokkhon reports, so axis E cannot
    quietly grade itself on an easier definition than axis A does.
    """
    scored = [
        (confidence_for_navigation_row(row), not bool(row["matched_expected"]))
        for row in navigation_rows
    ]
    total = len(scored)
    errors = sum(1 for _, is_error in scored if is_error)

    curve = risk_coverage_curve(scored)

    # The oracle answers correct cases first. It is the ceiling for this population, not a
    # target: no ranking of a real signal reaches it.
    oracle_curve = risk_coverage_curve(
        [(0.0 if is_error else 1.0, is_error) for _, is_error in scored]
    )

    base_error_rate = errors / total if total else None

    # The coverage the system could reach with no error at all, if it abstained below the
    # first tier that introduces one.
    full_precision_coverage = 0.0
    for point in curve:
        if point["errors"] == 0:
            full_precision_coverage = float(point["coverage"])
        else:
            break

    # What the system's own abstention flag achieves, as one point on the same axes. The
    # curve says what the signal could do; this says what the deployed default does.
    answered_rows = [row for row in navigation_rows if not row.get("recorded_uncertain")]
    deployed_errors = sum(1 for row in answered_rows if not row["matched_expected"])

    # The emergency tier sits at the top of the confidence ranking and is also, by design,
    # the tier that over-triggers: the red-flag rule is recall-first, so five of thirty
    # reviewed fixtures escalate when the label says they need not. Scored against fixture
    # expectations those over-triggers are errors, which puts the *most* confident tier at
    # the *worst* risk and drags AURC toward the random line.
    #
    # That is a property of the design, not a defect in it, and it is reported rather than
    # smoothed over. The second curve below removes the deterministic emergency path and
    # asks the question abstention is actually meant to answer: among the cases the model
    # and matcher handle, does the ranking separate right from wrong?
    non_emergency = [row for row in navigation_rows if not row.get("emergency_rule_fired")]
    non_emergency_scored = [
        (confidence_for_navigation_row(row), not bool(row["matched_expected"]))
        for row in non_emergency
    ]
    non_emergency_curve = risk_coverage_curve(non_emergency_scored)
    non_emergency_errors = sum(1 for _, is_error in non_emergency_scored if is_error)
    non_emergency_base = (
        non_emergency_errors / len(non_emergency_scored) if non_emergency_scored else None
    )

    top_tier = curve[0] if curve else None
    top_tier_inverted = bool(
        top_tier and base_error_rate is not None and float(top_tier["risk"]) > base_error_rate
    )

    return {
        "axis": "E",
        "name": "calibrated abstention (risk-coverage)",
        "population": "navigation fixtures",
        "n": total,
        "errors": errors,
        "base_error_rate": base_error_rate,
        "base_error_rate_ci": proportion_ci(errors, total),
        "confidence_signal": {
            "kind": "ordinal_proxy",
            "source": "deployed candidate_source tier and uncertainty flag",
            "note": (
                "Ranks, not calibrated probabilities. Nothing in the platform is trained to "
                "emit a probability, so this measures whether the ordering the deployed code "
                "already produces carries information about error, not whether a score is "
                "well calibrated."
            ),
            "tiers": {f"{source}|uncertain={flag}": value for (source, flag), value in CONFIDENCE_TIERS.items()},
        },
        "curve": curve,
        "oracle_curve": oracle_curve,
        "aurc": aurc(curve),
        "aurc_oracle": aurc(oracle_curve),
        "aurc_random": base_error_rate,
        "full_precision_coverage": full_precision_coverage,
        "deployed_abstention_point": {
            "answered": len(answered_rows),
            "coverage": len(answered_rows) / total if total else None,
            "errors": deployed_errors,
            "risk": deployed_errors / len(answered_rows) if answered_rows else None,
            "note": (
                "Where the shipped `uncertain` flag actually sits. Unlike AURC over the full "
                "population, this is the operating point a user meets."
            ),
        },
        "top_tier_inversion": {
            "inverted": top_tier_inverted,
            "top_tier_risk": float(top_tier["risk"]) if top_tier else None,
            "base_error_rate": base_error_rate,
            "explanation": (
                "The highest-confidence tier is the deterministic emergency rule, which is "
                "recall-first and deliberately over-triggers. Scored against fixture "
                "expectations those over-triggers count as errors, so the most confident tier "
                "carries the highest risk and AURC over the whole population approaches the "
                "random line. This is the escalation policy working as specified, not a "
                "miscalibration to be tuned away - suppressing the over-triggers would trade "
                "false positives for missed emergencies."
            ),
        },
        "excluding_emergency_path": {
            "note": (
                "The same curve with the deterministic emergency path removed. This is where "
                "abstention is meant to do work: among cases the matcher actually handles, "
                "does the ranking separate right from wrong?"
            ),
            "n": len(non_emergency_scored),
            "errors": non_emergency_errors,
            "base_error_rate": non_emergency_base,
            "curve": non_emergency_curve,
            "aurc": aurc(non_emergency_curve),
            "aurc_random": non_emergency_base,
        },
        "limitations": [
            f"n={total}. Intervals are wide and no percentage here should be read to more than "
            f"the nearest few points.",
            "The confidence signal is an ordinal proxy over deployed outputs, not a calibrated "
            "probability. Axis E measures ranking quality, not calibration.",
            "Errors are scored against fixture expectations under the deterministic mock "
            "provider, so this describes the rule and matching layers, not a live model.",
        ],
    }
