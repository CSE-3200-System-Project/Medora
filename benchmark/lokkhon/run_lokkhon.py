#!/usr/bin/env python3
"""Lokkhon: the five-axis bilingual clinical safety benchmark, as one versioned release.

    python benchmark/lokkhon/run_lokkhon.py

Lokkhon (লক্ষণ) is the clinical sign - the symptom a system must not miss. The name is
also a homophone of লক্ষ্মণ, whose লক্ষ্মণরেখা is the line that must not be crossed.
The benchmark is named for both.

| Axis | Question | Population |
|------|----------|------------|
| A | Does an emergency red flag escalate? | 30 clinician-reviewed navigation fixtures |
| B | Does indirect prompt injection change what is disclosed? | 10 injection cases |
| C | Do identifiers leak, and is benign text over-redacted? | 134 production-path privacy cases |
| D | Does any of that hold under Bangla/English code-mixing? | 4 authored + derived variants |
| E | Does the system decline where it would have been wrong? | risk-coverage over axis A |

This module scores nothing itself. Axes A to C are computed by
`tests/benchmarks/run_safety_benchmarks.py`, which is the harness that produced the
archived v1.0.2 results, and it is **imported rather than reimplemented**. A benchmark
whose released numbers come from a second copy of the scoring code is measuring the copy.

What this adds on top of that harness:

* one versioned artifact with `n` printed beside every metric,
* bootstrap intervals on every rate,
* axis D scored over derived code-mixed cases, reported separately from the authored four,
* axis E, which the harness does not compute at all.

Provider handling is inherited: the underlying harness pins `AI_PROVIDER=mock` and refuses
to run otherwise, so a release can never pool deterministic results with live ones.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "tests" / "benchmarks"))

from abstention import score_axis_e  # noqa: E402
from bootstrap import BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED, proportion_ci  # noqa: E402

# The deployed harness. Importing it also applies its environment pinning, including
# AI_PROVIDER=mock, before any backend module is loaded.
from run_safety_benchmarks import (  # noqa: E402
    AIOrchestrator,
    privacy_span_metrics,
    score_navigation,
    score_privacy,
    score_privacy_case,
    score_summaries,
)

LOKKHON_VERSION = "lokkhon-v0.1"
DERIVED_AXIS_D = HERE / "datasets" / "axis_d_derived_cases.jsonl"
DEFAULT_OUTPUT = HERE / "results" / "lokkhon_v0.1.json"

#: Which privacy report groups belong to which axis. Axis C is the leakage measurement on
#: the production path; axis B is injection; axis D is code-mixing. `benign` and `consent`
#: rows sit inside axis C's over-redaction denominator and are not a separate axis.
AXIS_B_GROUPS = frozenset({"injection"})
AXIS_D_AUTHORED_GROUPS = frozenset({"mixed_script"})


def _rate(metrics: dict, numerator_key: str, denominator_key: str) -> dict:
    """A rate with its counts and interval, never a bare float."""
    return proportion_ci(int(metrics.get(numerator_key) or 0), int(metrics.get(denominator_key) or 0))


def _score_derived_axis_d() -> tuple[list[dict], dict]:
    """Score the derived code-mixed corpus through the harness's own per-case scorer.

    `score_privacy_case` is the same function the release gate runs over the authored
    corpus. Routing the derived cases through a second implementation would make axis D
    a measurement of that implementation rather than of the redactor.
    """
    if not DERIVED_AXIS_D.exists():
        return [], {
            "available": False,
            "note": (
                "Derived cases absent. Run benchmark/lokkhon/generate_axis_d_cases.py to "
                "build them; the release reports the authored four alone until then."
            ),
        }

    cases = [
        json.loads(line)
        for line in DERIVED_AXIS_D.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    rows = [score_privacy_case(case) for case in cases]
    return rows, {"available": True, "cases": len(cases)}


def build_release(*, iterations: int, seed: int) -> dict:
    probe = AIOrchestrator()
    if probe.provider != "mock":
        raise SystemExit(
            f"Refusing to build a release: resolved AI provider is {probe.provider!r}, expected 'mock'."
        )

    privacy_rows, privacy_failures = score_privacy()
    navigation_rows, navigation_failures, reviewed = score_navigation()
    summary_rows, summary_failures = score_summaries()

    # The known-identifier group is excluded from headline metrics for the same reason the
    # underlying harness excludes it: no production call site supplies known identifiers,
    # so including it would inflate recall with a path users never exercise.
    production_rows = [row for row in privacy_rows if not row["uses_known_identifier_api"]]

    axis_b_rows = [row for row in production_rows if row["report_group"] in AXIS_B_GROUPS]
    axis_c_rows = production_rows
    axis_d_authored_rows = [
        row for row in production_rows if row["report_group"] in AXIS_D_AUTHORED_GROUPS
    ]

    derived_rows, derived_meta = _score_derived_axis_d()

    axis_c = privacy_span_metrics(axis_c_rows)
    axis_b = privacy_span_metrics(axis_b_rows)
    axis_d_authored = privacy_span_metrics(axis_d_authored_rows)
    axis_d_derived = privacy_span_metrics(derived_rows) if derived_rows else None

    emergency_false_negatives = sum(
        not row["emergency_rule_fired"] and row["expected_emergency"] for row in navigation_rows
    )
    emergency_false_positives = sum(
        row["emergency_rule_fired"] and not row["expected_emergency"] for row in navigation_rows
    )
    emergency_expected = sum(row["expected_emergency"] for row in navigation_rows)

    axis_e = score_axis_e(navigation_rows)

    release = {
        "benchmark": "Lokkhon",
        "version": LOKKHON_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": probe.provider,
        "provider_result_class": "deterministic_mock_and_rules",
        "bootstrap": {"iterations": iterations, "seed": seed, "method": "percentile over resampled cases"},
        "scoring_source": {
            "module": "tests/benchmarks/run_safety_benchmarks.py",
            "note": (
                "Axes A to C are scored by the deployed harness, imported rather than "
                "reimplemented, so the released numbers come from the same code the release "
                "gate runs."
            ),
        },
        "axes": {
            "A": {
                "axis": "A",
                "name": "emergency red-flag escalation",
                "status": "measured",
                "n": len(navigation_rows),
                "clinician_reviewed": reviewed,
                "review_state": "complete" if reviewed == len(navigation_rows) else "required",
                "emergency_cases": emergency_expected,
                "false_negatives": emergency_false_negatives,
                "false_positives": emergency_false_positives,
                "emergency_recall": proportion_ci(
                    emergency_expected - emergency_false_negatives, emergency_expected
                ),
                "outcome_agreement": proportion_ci(
                    sum(row["matched_expected"] for row in navigation_rows), len(navigation_rows)
                ),
                "hard_failures": len(navigation_failures),
                "note": (
                    "Recall-first by design. Every false positive is a person shown a takeover "
                    "they did not need; every false negative is a missed emergency. The ratio "
                    "is chosen, not accidental."
                ),
            },
            "B": {
                "axis": "B",
                "name": "indirect prompt injection",
                "status": "measured",
                "n": axis_b["cases"],
                "identifier_spans": axis_b["expected_identifier_spans"],
                "leaked_spans": axis_b["expected_identifier_spans"] - axis_b["true_positives"],
                "span_recall": _rate(axis_b, "true_positives", "expected_identifier_spans"),
                "agreement": proportion_ci(axis_b["matched_expected"], axis_b["cases"]),
            },
            "C": {
                "axis": "C",
                "name": "identifier leakage and over-redaction",
                "status": "measured",
                "n": axis_c["cases"],
                "identifier_spans": axis_c["expected_identifier_spans"],
                "benign_spans": axis_c["benign_spans"],
                "span_recall": _rate(axis_c, "true_positives", "expected_identifier_spans"),
                "over_redaction_rate": _rate(axis_c, "false_positives", "benign_spans"),
                "precision": axis_c["precision"],
                "recall": axis_c["recall"],
                "by_report_group": {
                    group: privacy_span_metrics([row for row in axis_c_rows if row["report_group"] == group])
                    for group in sorted({row["report_group"] for row in axis_c_rows})
                },
                "note": (
                    "These rules were tuned on this set, so it is a development figure. The "
                    "honest test of generalisation is the held-out probe and the planned "
                    "learned span recogniser, not this number."
                ),
            },
            "D": {
                "axis": "D",
                "name": "Bangla/English code-mixing",
                "status": "pilot plus derived",
                "authored": {
                    "n": axis_d_authored["cases"],
                    "span_recall": _rate(axis_d_authored, "true_positives", "expected_identifier_spans"),
                    "note": "Independently authored. Four cases cannot support a percentage.",
                },
                "derived": (
                    {
                        "n": axis_d_derived["cases"],
                        "span_recall": _rate(axis_d_derived, "true_positives", "expected_identifier_spans"),
                        "over_redaction_rate": _rate(axis_d_derived, "false_positives", "benign_spans"),
                        "by_transform": {
                            transform: privacy_span_metrics(
                                [row for row in derived_rows if row["category"] == f"axis_d_{transform}"]
                            )
                            for transform in sorted(
                                {row["category"].removeprefix("axis_d_") for row in derived_rows}
                            )
                        },
                        "note": (
                            "Mechanically derived from the authored Bengali fixtures by declared "
                            "transforms. Reported separately because a derived case shares its "
                            "identifier and clinical text with its source and is therefore not "
                            "independent evidence."
                        ),
                    }
                    if axis_d_derived
                    else None
                ),
                "generation": derived_meta,
                "pooled_headline": None,
                "pooled_note": (
                    "Deliberately not pooled. Combining four authored cases with derived variants "
                    "into a single n would present transformed copies as independent evidence."
                ),
            },
            "E": axis_e,
        },
        "summaries": {
            "name": "source accounting",
            "n": len(summary_rows),
            "accounted": proportion_ci(len(summary_rows) - len(summary_failures), len(summary_rows)),
            "hard_failures": len(summary_failures),
        },
        "hard_gate": {
            "passed": not (privacy_failures or navigation_failures or summary_failures),
            "privacy_failures": len(privacy_failures),
            "navigation_failures": len(navigation_failures),
            "summary_failures": len(summary_failures),
            "note": (
                "The gate is failed only by an undisclosed failure. Measured precision and "
                "recall sit below 1.00 on purpose; a documented limitation does not turn the "
                "gate red, and a documented limitation that starts passing is reported as "
                "stale so the disclosure can be retired."
            ),
        },
        "limitations": [
            "Every population here is constructed. These are containment baselines and a "
            "reproducible harness, not a population study.",
            "Axis C rules were tuned on the axis C set. It is a development figure.",
            "Axis D's authored population is four cases. Derived variants are not independent.",
            "Axis E ranks by an ordinal proxy, so it measures ordering quality rather than "
            "probability calibration.",
            "Results are produced under the deterministic mock provider and are never pooled "
            "with live-provider output.",
            "Prescription OCR accuracy is not measured anywhere in this benchmark. The "
            "handwriting pipeline is a review-gated prototype and no accuracy figure is claimed.",
        ],
    }
    return release


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a versioned Lokkhon release.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--iterations", type=int, default=BOOTSTRAP_ITERATIONS)
    parser.add_argument("--seed", type=int, default=BOOTSTRAP_SEED)
    args = parser.parse_args()

    release = build_release(iterations=args.iterations, seed=args.seed)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    axes = release["axes"]
    print(
        json.dumps(
            {
                "version": release["version"],
                "hard_gate_passed": release["hard_gate"]["passed"],
                "A_false_negatives": axes["A"]["false_negatives"],
                "A_false_positives": axes["A"]["false_positives"],
                "A_n": axes["A"]["n"],
                "B_n": axes["B"]["n"],
                "C_recall": axes["C"]["recall"],
                "C_n": axes["C"]["n"],
                "D_authored_n": axes["D"]["authored"]["n"],
                "D_derived_n": (axes["D"]["derived"] or {}).get("n"),
                "E_aurc": axes["E"]["aurc"],
                "E_aurc_random": axes["E"]["aurc_random"],
                "output": str(args.output),
            },
            indent=2,
        )
    )
    return 0 if release["hard_gate"]["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
