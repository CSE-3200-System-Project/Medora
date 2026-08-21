#!/usr/bin/env python3
"""Shimana: turn a consent-utility sweep into the four things the paper promises.

    python tests/benchmarks/run_shimana_report.py --input tests/benchmarks/reports/shimana_results.json

The sweep answers "what did each consent configuration score". This answers the question
the frontier is actually about: **what does consent cost?** That takes four outputs, and
the whitepaper names all four.

**Paired results.** Configurations are compared on the same patients, not through two
independent aggregates. Widening consent changes what one patient's summary can contain;
an unpaired comparison at n=24 mostly measures how much patients differ from each other.
Paired deltas need per-patient values, so a sweep that predates that field gets an
explicit "unavailable" rather than an unpaired number quietly relabelled as paired.

**Bootstrap intervals.** On the paired deltas, not only on the levels. A difference can be
reliable while both levels are wide, and it can be noise while both levels look tight.

**The non-dominated set.** A configuration is dominated when another one achieves at least
as much utility with no more exposure. Dominated configurations are not points on a
trade-off - they are configurations with no reason to exist, and naming them is the useful
part.

**A knee.** The point of maximum perpendicular distance from the chord joining the extreme
non-dominated points, on min-max normalised axes. It is reported with the caveat it
deserves: with a handful of configurations a knee is a description of five points, not an
optimum, and it is suppressed entirely when the front has fewer than three.

This reads a sweep and computes. It never calls a provider, so it cannot change the
numbers it is reporting on.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[2]

BOOTSTRAP_ITERATIONS = 2000
BOOTSTRAP_SEED = 20260821


# ---------------------------------------------------------------------------
# Intervals
# ---------------------------------------------------------------------------

def bootstrap_mean(
    values: Sequence[float],
    *,
    iterations: int = BOOTSTRAP_ITERATIONS,
    seed: int = BOOTSTRAP_SEED,
) -> dict:
    """Point estimate and a 95% percentile interval, resampling the unit of analysis."""
    n = len(values)
    if n == 0:
        return {"n": 0, "estimate": None, "ci_low": None, "ci_high": None}
    point = sum(values) / n
    if n == 1:
        return {"n": 1, "estimate": point, "ci_low": None, "ci_high": None}

    rng = random.Random(seed)
    means = []
    for _ in range(iterations):
        means.append(sum(values[rng.randrange(n)] for _ in range(n)) / n)
    means.sort()
    return {
        "n": n,
        "estimate": point,
        "ci_low": means[int(0.025 * iterations)],
        "ci_high": means[min(iterations - 1, int(0.975 * iterations))],
    }


# ---------------------------------------------------------------------------
# Pareto
# ---------------------------------------------------------------------------

def dominates(a: dict, b: dict) -> bool:
    """True when `a` is at least as good as `b` everywhere and strictly better somewhere.

    Better means more utility and less exposure. Ties on both axes are not domination, so
    two configurations that behave identically both survive rather than one arbitrarily
    eliminating the other.
    """
    at_least_as_good = a["utility"] >= b["utility"] and a["exposure"] <= b["exposure"]
    strictly_better = a["utility"] > b["utility"] or a["exposure"] < b["exposure"]
    return at_least_as_good and strictly_better


def non_dominated(points: Sequence[dict]) -> list[dict]:
    return [
        point
        for point in points
        if not any(other is not point and dominates(other, point) for other in points)
    ]


def knee(front: Sequence[dict]) -> dict | None:
    """Maximum perpendicular distance from the chord joining the front's extremes.

    Returns None for a front of fewer than three points: with two points every point is an
    endpoint, and calling one of them a knee would dress an arbitrary pick up as an
    inflection. Axes are min-max normalised first, because exposure is counted per
    thousand requests and utility is a proportion - without that the distance is measured
    almost entirely along whichever axis happens to have the larger units.
    """
    if len(front) < 3:
        return None

    ordered = sorted(front, key=lambda point: point["exposure"])
    xs = [point["exposure"] for point in ordered]
    ys = [point["utility"] for point in ordered]
    x_span = (max(xs) - min(xs)) or 1.0
    y_span = (max(ys) - min(ys)) or 1.0

    normalised = [
        ((point["exposure"] - min(xs)) / x_span, (point["utility"] - min(ys)) / y_span)
        for point in ordered
    ]
    (x0, y0), (x1, y1) = normalised[0], normalised[-1]
    chord = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
    if chord == 0:
        return None

    best_index, best_distance = None, -1.0
    for index, (x, y) in enumerate(normalised[1:-1], start=1):
        distance = abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / chord
        if distance > best_distance:
            best_index, best_distance = index, distance

    if best_index is None:
        return None
    return {
        "config": ordered[best_index]["config"],
        "utility": ordered[best_index]["utility"],
        "exposure_per_1000": ordered[best_index]["exposure"],
        "normalised_distance_from_chord": round(best_distance, 4),
        "method": "max perpendicular distance to the chord between front extremes, min-max normalised axes",
    }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _points(configs: Sequence[dict]) -> list[dict]:
    return [
        {
            "config": row["config"],
            "utility": row["utility_mean"],
            "exposure": row["exposure_spans_per_1000"],
            "note": row.get("note"),
        }
        for row in configs
    ]


def paired_deltas(configs: Sequence[dict], *, seed: int, iterations: int) -> dict:
    """Utility difference between every ordered pair, patient by patient."""
    with_patients = [row for row in configs if row.get("per_patient")]
    if len(with_patients) < 2:
        return {
            "available": False,
            "note": (
                "This sweep stored aggregates only, so configurations cannot be compared on "
                "the same patients. Re-run run_shimana_sweep.py to record per-patient values. "
                "An unpaired comparison is not substituted here, because reporting one under "
                "the paired heading would misdescribe what was measured."
            ),
            "comparisons": [],
        }

    by_name = {
        row["config"]: {entry["patient_token"]: entry for entry in row["per_patient"]}
        for row in with_patients
    }
    order = [row["config"] for row in with_patients]

    comparisons = []
    for index in range(len(order) - 1):
        narrower, wider = order[index], order[index + 1]
        shared = sorted(set(by_name[narrower]) & set(by_name[wider]))
        if not shared:
            continue

        utility_deltas = [
            by_name[wider][token]["utility"] - by_name[narrower][token]["utility"]
            for token in shared
        ]
        exposure_deltas = [
            by_name[wider][token]["exposure_spans"] - by_name[narrower][token]["exposure_spans"]
            for token in shared
        ]
        interval = bootstrap_mean(utility_deltas, iterations=iterations, seed=seed)
        # An interval straddling zero means the sweep cannot tell the two apart at this n,
        # which is a finding and not a gap to be filled with a point estimate.
        separates = bool(
            interval["ci_low"] is not None
            and interval["ci_high"] is not None
            and (interval["ci_low"] > 0 or interval["ci_high"] < 0)
        )
        comparisons.append({
            "from": narrower,
            "to": wider,
            "patients": len(shared),
            "utility_delta": interval,
            "exposure_delta_mean": sum(exposure_deltas) / len(exposure_deltas),
            "separates_at_95": separates,
            "improved": sum(1 for delta in utility_deltas if delta > 0),
            "unchanged": sum(1 for delta in utility_deltas if delta == 0),
            "worsened": sum(1 for delta in utility_deltas if delta < 0),
        })

    return {"available": True, "unit_of_analysis": "patient", "comparisons": comparisons}


def build_report(sweep: dict, *, seed: int, iterations: int) -> dict:
    configs = sweep["configs"]
    points = _points(configs)
    front = non_dominated(points)
    front_names = {point["config"] for point in front}

    dominated = []
    for point in points:
        if point["config"] in front_names:
            continue
        dominated_by = [
            other["config"] for other in points if other is not point and dominates(other, point)
        ]
        dominated.append({
            "config": point["config"],
            "utility": point["utility"],
            "exposure_per_1000": point["exposure"],
            "dominated_by": dominated_by,
        })

    front_knee = knee(front)
    # A front can contain configurations that disclose nothing and achieve nothing. They
    # are formally non-dominated - nothing has lower exposure than zero - and they are not
    # candidates anyone would deploy. When the knee lands on one, say so, and report the
    # knee over the configurations that actually completed the task as well.
    productive_front = [point for point in front if point["utility"] > 0]
    if front_knee and front_knee["utility"] == 0:
        front_knee["degenerate"] = True
        front_knee["caveat"] = (
            "This knee sits on a configuration with zero utility. It is the mechanical "
            "answer to the geometry and not a deployable operating point: disclosing "
            "nothing trivially minimises exposure. Read productive_knee instead."
        )
    elif front_knee:
        front_knee["degenerate"] = False

    reference = next((point for point in points if point["config"] == "U"), None)
    recovery = []
    if reference and reference["utility"]:
        for point in points:
            recovery.append({
                "config": point["config"],
                "utility_fraction_of_unrestricted": round(point["utility"] / reference["utility"], 4),
                "exposure_fraction_of_unrestricted": (
                    round(point["exposure"] / reference["exposure"], 4) if reference["exposure"] else None
                ),
            })

    monotone_utility = all(
        points[index]["utility"] <= points[index + 1]["utility"] for index in range(len(points) - 1)
    )

    return {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "provider": sweep.get("provider"),
            "patients": sweep.get("patients"),
            "seeds": sweep.get("seeds"),
            "task": sweep.get("task"),
            "executed_at": sweep.get("executed_at"),
        },
        "bootstrap": {"iterations": iterations, "seed": seed, "method": "percentile over resampled patients"},
        "points": [
            {
                "config": point["config"],
                "note": point["note"],
                "utility": point["utility"],
                "exposure_per_1000": point["exposure"],
                "non_dominated": point["config"] in front_names,
            }
            for point in points
        ],
        "non_dominated_set": [point["config"] for point in front],
        "non_dominated_with_utility": [point["config"] for point in productive_front],
        "dominated": dominated,
        "knee": front_knee,
        "productive_knee": knee(productive_front),
        "paired": paired_deltas(configs, seed=seed, iterations=iterations),
        "utility_recovery_vs_unrestricted": {
            "reference": "U",
            "note": (
                "The registered framing asks what fraction of unrestricted utility a narrower "
                "configuration recovers, which presumes unrestricted is the ceiling. A fraction "
                "above 1.0 says it is not: the narrower configuration completed the task more "
                "often than full disclosure did. That is reported as measured; it is not "
                "renormalised to keep the fraction under one."
            ),
            "rows": recovery,
        },
        "shape": {
            "utility_monotone_in_disclosure": monotone_utility,
            "note": (
                "The registered hypothesis is that utility rises with disclosure. Where it "
                "does not, the frontier is not a trade-off curve over that range and the "
                "wider configuration is simply dominated: it disclosed more and achieved no "
                "more. That is reported as measured rather than smoothed."
            ),
        },
        "limitations": [
            f"n={sweep.get('patients')} synthetic patients. Intervals are wide.",
            "Utility is source-accounting on a grounded summary: whether the task could be "
            "completed at all under the configuration, not how good the summary reads.",
            "Exposure is counted offline from the redaction policy. The unrestricted "
            "configuration is a counterfactual and is never sent to a provider.",
            "Configurations differ in both the record subset and the redaction policy, so a "
            "single delta cannot attribute the change to one of them.",
        ],
    }


def write_csv(report: dict, path: Path) -> None:
    """Figure-ready long format: one row per point, ready to plot without reshaping."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["config", "exposure_per_1000", "utility", "non_dominated", "is_knee", "note"])
        knee_config = (report["productive_knee"] or report["knee"] or {}).get("config")
        for point in report["points"]:
            writer.writerow([
                point["config"],
                point["exposure_per_1000"],
                point["utility"],
                int(point["non_dominated"]),
                int(point["config"] == knee_config),
                point["note"] or "",
            ])


def main() -> int:
    parser = argparse.ArgumentParser(description="Report a Shimana consent-utility sweep.")
    parser.add_argument("--input", type=Path, default=ROOT / "tests/benchmarks/reports/shimana_results.json")
    parser.add_argument("--output", type=Path, default=ROOT / "tests/benchmarks/reports/shimana_report.json")
    parser.add_argument("--csv", type=Path, default=ROOT / "tests/benchmarks/reports/shimana_frontier.csv")
    parser.add_argument("--seed", type=int, default=BOOTSTRAP_SEED)
    parser.add_argument("--iterations", type=int, default=BOOTSTRAP_ITERATIONS)
    args = parser.parse_args()

    sweep = json.loads(args.input.read_text(encoding="utf-8"))
    report = build_report(sweep, seed=args.seed, iterations=args.iterations)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(report, args.csv)

    print(
        json.dumps(
            {
                "provider": report["source"]["provider"],
                "patients": report["source"]["patients"],
                "non_dominated_set": report["non_dominated_set"],
                "dominated": [row["config"] for row in report["dominated"]],
                "knee": (report["knee"] or {}).get("config"),
                "knee_degenerate": (report["knee"] or {}).get("degenerate"),
                "productive_knee": (report["productive_knee"] or {}).get("config"),
                "paired_available": report["paired"]["available"],
                "utility_monotone_in_disclosure": report["shape"]["utility_monotone_in_disclosure"],
                "output": str(args.output),
                "csv": str(args.csv),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
