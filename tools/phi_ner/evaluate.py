#!/usr/bin/env python3
"""Score rules, model, and union on the held-out 134-case bilingual privacy set.

    python tools/phi_ner/evaluate.py                       # rules-only if no bundle is present
    python tools/phi_ner/evaluate.py --bundle tools/phi_ner/artifacts/deploy
    python tools/phi_ner/evaluate.py --per-script          # add the Bangla/English/romanised split

Three systems are reported, never one:

1. **rules** — the shipped rule-based redactor, the published baseline (94.7% precision /
   75.5% recall at v1.0.2).
2. **model** — the learned span recogniser alone.
3. **union** — redact if either fires. This is what deployment turns on, so it is the row
   that has to justify itself.

...and two populations, which is the part the build plan did not anticipate.

`pii_safety_cases.jsonl` (n=134) is the set the published baseline was measured on. The
rules have since been extended *against that set*, and they now score 1.000 recall on it.
That is a development figure, not a generalisation estimate, and a saturated population
cannot discriminate between three systems — every row would read 1.000 and the table would
say nothing. It is still reported, because continuity with the published number matters,
but it is labelled saturated and no claim rests on it.

`pii_holdout_cases.jsonl` is the novel-identifier probe: identifiers the rules were never
written against. The rules score 0.750 there, and every single miss is an unlabelled,
previously-unseen personal name. That is the population with headroom, it is the one the
learned recogniser exists to move, and it is where the headline comparison belongs.

Both are scored through `score_privacy_case` from the deployed harness rather than through
a second copy of the scoring logic. Three implementations of "did it leak" would eventually
disagree, and the disagreement would be invisible in the table.

**When no model bundle exists this script does not fabricate the other two rows.** It emits
the rules rows with real numbers and marks `model` and `union` unavailable with the reason.
Training needs a GPU session; the evaluator shipping before the weights is expected, and an
empty row is the honest representation of that.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests" / "benchmarks"))
sys.path.insert(0, str(ROOT / "benchmark" / "lokkhon"))

for key, value in {
    "SUPABASE_DATABASE_URL": "postgresql+asyncpg://p:p@localhost:5432/p",
    "SUPABASE_URL": "http://localhost:54321",
    "SUPABASE_KEY": "x",
    "SUPABASE_STORAGE_BUCKET": "x",
    "AI_PROVIDER": "mock",
    "AI_ID_HASH_SECRET": "phi-ner-eval",
}.items():
    os.environ.setdefault(key, value)

from bootstrap import BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED, proportion_ci  # noqa: E402
from run_safety_benchmarks import privacy_span_metrics, score_privacy_case  # noqa: E402

from app.core.ai_privacy import redact_pii_text  # noqa: E402
from app.core import phi_ner  # noqa: E402

DATASETS = ROOT / "tests" / "benchmarks" / "datasets"
REPORTS = HERE / "reports"
DEFAULT_BUNDLE = HERE / "artifacts" / "deploy"

# Baseline as published in the v1.0.2 archive, carried here so the table shows movement
# rather than a bare number. Not recomputed from the archive: it is a fixed reference point.
PUBLISHED_BASELINE = {"precision": 0.947, "recall": 0.755, "false_redaction_rate": 0.032,
                      "source": "Medora v1.0.2 archived safety benchmark"}


POPULATIONS = {
    "pii_safety_134": {
        "path": "tests/benchmarks/datasets/pii_safety_cases.jsonl",
        "role": "continuity with the published v1.0.2 baseline",
        "caveat": "The rules were extended against this set, so their recall here is a "
                  "development figure. Check the reported recall before drawing from it: at "
                  "1.000 the population is saturated and cannot separate the three systems.",
    },
    "novel_identifier_probe": {
        "path": "tests/benchmarks/datasets/pii_holdout_cases.jsonl",
        "role": "generalisation to identifiers the rules were never written against",
        "caveat": "Small (n is printed beside every metric) and synthetic in construction, but "
                  "disjoint from the rules by design. This is the discriminating population.",
    },
}


def load_cases(population: str) -> list[dict]:
    path = ROOT / POPULATIONS[population]["path"]
    if not path.exists():
        raise SystemExit(
            f"{path} not found. Rebuild it with tests/benchmarks/generate_phi_holdout.py."
        )
    cases = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    # Production parity, matching Lokkhon axis C: no deployed call site supplies known
    # identifiers, so scoring that group would inflate recall on a path users never take.
    return [case for case in cases if not case.get("uses_known_identifier_api")]


def script_of(case: dict) -> str:
    text = case.get("text", "")
    if any("ঀ" <= ch <= "৿" for ch in text):
        return "bengali"
    group = str(case.get("report_group", ""))
    return "romanised" if "romanis" in group or "banglish" in group else "english"


def score_system(cases: list[dict], redactor) -> tuple[dict, list[float], list[dict]]:
    rows: list[dict] = []
    latencies: list[float] = []
    for case in cases:
        started = time.perf_counter()
        row = score_privacy_case(case, redactor=redactor)
        latencies.append((time.perf_counter() - started) * 1000.0)
        row["script"] = script_of(case)
        rows.append(row)
    return privacy_span_metrics(rows), latencies, rows


def with_intervals(metrics: dict, iterations: int, seed: int) -> dict:
    true_positive = metrics["true_positives"]
    identifiers = metrics["expected_identifier_spans"]
    benign = metrics["benign_spans"]
    detected = true_positive + metrics["false_positives"]
    out = dict(metrics)
    out["recall_ci"] = proportion_ci(true_positive, identifiers, iterations=iterations, seed=seed)
    out["precision_ci"] = (
        proportion_ci(true_positive, detected, iterations=iterations, seed=seed) if detected else None
    )
    out["false_redaction_rate_ci"] = (
        proportion_ci(metrics["false_positives"], benign, iterations=iterations, seed=seed)
        if benign else None
    )
    # n = 134. These intervals are wide, and that is the finding to report, not to round away.
    out["f1"] = (
        2 * out["precision"] * out["recall"] / (out["precision"] + out["recall"])
        if out["precision"] and out["recall"] else None
    )
    return out


def latency_summary(latencies: list[float]) -> dict:
    ordered = sorted(latencies)
    return {
        "n": len(ordered),
        "mean_ms": round(statistics.fmean(ordered), 3) if ordered else None,
        "median_ms": round(statistics.median(ordered), 3) if ordered else None,
        "p95_ms": round(ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))], 3) if ordered else None,
        "max_ms": round(ordered[-1], 3) if ordered else None,
        "note": "Wall clock for the whole redaction call on this machine's CPU, not GPU "
                "inference time. The component runs locally, so this is the number that matters.",
    }


def per_script(rows: list[dict], iterations: int, seed: int) -> dict:
    out = {}
    for script in sorted({row["script"] for row in rows}):
        subset = [row for row in rows if row["script"] == script]
        out[script] = with_intervals(privacy_span_metrics(subset), iterations, seed)
    return out


def unavailable(reason: str) -> dict:
    return {"status": "unavailable", "reason": reason}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--bundle", type=Path, default=DEFAULT_BUNDLE)
    parser.add_argument("--threshold", type=float, default=None,
                        help="override the deployed decision threshold for this run only")
    parser.add_argument("--iterations", type=int, default=BOOTSTRAP_ITERATIONS)
    parser.add_argument("--seed", type=int, default=BOOTSTRAP_SEED)
    parser.add_argument("--per-script", action="store_true")
    parser.add_argument(
        "--admit-bundle",
        action="store_true",
        help="write bundle/admission.json only when the measured union passes every release check",
    )
    parser.add_argument("--out", type=Path, default=REPORTS / "phi_ner_eval.json")
    args = parser.parse_args(argv)

    recognizer = None
    bundle_note = None
    required = ["model.onnx", "tokenizer.json", "labels.json"]
    missing = [name for name in required if not (args.bundle / name).exists()]
    if missing:
        bundle_note = (
            f"No model bundle at {args.bundle} (missing: {', '.join(missing)}). Train and export "
            "with tools/phi_ner/train.py; that run needs a GPU session and is deliberately "
            "out of band from this repository's test suite."
        )
    else:
        labels = json.loads((args.bundle / "labels.json").read_text(encoding="utf-8"))
        recorded_threshold = labels.get("selected_threshold")
        if recorded_threshold is None:
            raise SystemExit("labels.json has no selected_threshold from the training gate")
        threshold = args.threshold if args.threshold is not None else float(recorded_threshold)
        recognizer = phi_ner.OnnxSpanRecognizer(args.bundle, threshold)

    def model_only(text, **kw):
        # The model alone: the rule patterns are bypassed entirely by handing the learned
        # spans straight to the placement helper, so this row measures the recogniser
        # rather than the recogniser plus whatever the rules happened to catch.
        from app.core.ai_privacy import RedactionResult

        source = str(text or "")
        spans = recognizer.predict(source)
        replaced, counts = phi_ner.apply_spans(
            source, spans, redact_dates=kw.get("redact_dates", True))
        return RedactionResult(text=replaced, replacements=counts)

    redactors = {
        "rules": (lambda text, **kw: redact_pii_text(text, recognizer=None, **kw), None),
        "model": (model_only, "the learned recogniser alone"),
        "union": (lambda text, **kw: redact_pii_text(text, recognizer=recognizer, **kw),
                  "the shipped configuration when PHI_NER_ENABLED is set"),
    }

    populations: dict[str, dict] = {}
    for population, meta in POPULATIONS.items():
        cases = load_cases(population)
        systems: dict[str, dict] = {}
        spans_seen = benign_seen = 0
        for name, (redactor, note) in redactors.items():
            if name != "rules" and recognizer is None:
                systems[name] = unavailable(bundle_note)
                continue
            metrics, latencies, rows = score_system(cases, redactor)
            spans_seen = metrics["expected_identifier_spans"]
            benign_seen = metrics["benign_spans"]
            block = {
                "status": "measured",
                "metrics": with_intervals(metrics, args.iterations, args.seed),
                "latency": latency_summary(latencies),
            }
            if note:
                block["note"] = note
            if args.per_script:
                block["per_script"] = per_script(rows, args.iterations, args.seed)
            systems[name] = block

        rules_recall = systems["rules"]["metrics"]["recall"]
        populations[population] = {
            "path": meta["path"],
            "role": meta["role"],
            "caveat": meta["caveat"],
            "cases": len(cases),
            "identifier_spans": spans_seen,
            "benign_spans": benign_seen,
            # Stated from the measurement rather than asserted in prose: if a later change
            # moves the rules off 1.000 here, this set stops calling itself saturated.
            "saturated_by_rules": rules_recall is not None and rules_recall >= 1.0,
            "systems": systems,
        }

    report = {
        "component": "phi-span-recogniser",
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "selection": "production-path cases only (known-identifier group excluded)",
        "held_out": "Neither population is trained or tuned on; the corpus generator rejects "
                    "any synthetic sentence containing an identifier from either file.",
        "bootstrap": {"iterations": args.iterations, "seed": args.seed,
                      "note": "Populations are small. Intervals are wide; they are reported, "
                              "not narrowed."},
        "published_baseline": PUBLISHED_BASELINE,
        "headline_population": "novel_identifier_probe",
        "populations": populations,
        "bundle": str(args.bundle).replace("\\", "/"),
    }
    admission = {"status": "unavailable", "passed": False, "checks": {}}
    if recognizer is not None:
        probe = populations["novel_identifier_probe"]["systems"]
        rules_metrics = probe["rules"]["metrics"]
        union_metrics = probe["union"]["metrics"]
        checks = {
            "novel_recall_minimum": union_metrics["recall"] >= phi_ner.PHI_MIN_NOVEL_RECALL,
            "recall_improves_on_rules": union_metrics["recall"] > rules_metrics["recall"],
            "precision_minimum": union_metrics["precision"] >= phi_ner.PHI_MIN_PRECISION,
            "over_redaction_cap": (
                union_metrics["false_redaction_rate"] <= phi_ner.PHI_MAX_OVER_REDACTION
            ),
        }
        admission = {
            "admission_version": phi_ner.PHI_ADMISSION_VERSION,
            "status": "passed" if all(checks.values()) else "failed",
            "passed": all(checks.values()),
            "checks": checks,
            "threshold": recognizer.threshold,
            "bundle_files": {
                name: phi_ner.sha256_file(args.bundle / name)
                for name in ("model.onnx", "tokenizer.json", "labels.json")
            },
            "datasets": {
                name: phi_ner.sha256_file(path)
                for name, path in phi_ner.ADMISSION_DATASETS.items()
            },
            "headline_metrics": {
                "population": "novel_identifier_probe",
                "rules_recall": rules_metrics["recall"],
                "union_recall": union_metrics["recall"],
                "union_precision": union_metrics["precision"],
                "union_over_redaction": union_metrics["false_redaction_rate"],
            },
        }
    report["release_gate"] = admission
    if bundle_note:
        report["bundle_status"] = bundle_note

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.admit_bundle:
        if recognizer is None:
            raise SystemExit("Cannot admit a missing model bundle")
        admission_path = args.bundle / "admission.json"
        if admission["passed"]:
            admission_path.write_text(
                json.dumps(admission, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        else:
            admission_path.unlink(missing_ok=True)

    for population, block in populations.items():
        flag = "  [SATURATED — cannot discriminate]" if block["saturated_by_rules"] else ""
        print(f"\n{population}  n={block['cases']} cases, "
              f"{block['identifier_spans']} identifier spans, "
              f"{block['benign_spans']} benign spans{flag}")
        print(f"  {'system':8} {'precision':>10} {'recall':>10} {'F1':>8} "
              f"{'over-redact':>12} {'p95 ms':>8}")
        for name, system in block["systems"].items():
            if system.get("status") != "measured":
                print(f"  {name:8} unavailable — {str(system.get('reason'))[:58]}")
                continue
            metrics = system["metrics"]
            print(f"  {name:8} {_fmt(metrics['precision']):>10} {_fmt(metrics['recall']):>10} "
                  f"{_fmt(metrics['f1']):>8} {_fmt(metrics['false_redaction_rate']):>12} "
                  f"{system['latency']['p95_ms']:>8}")
    print("\nwritten to", args.out)
    return 0 if not args.admit_bundle or admission["passed"] else 2


def _fmt(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.3f}"


if __name__ == "__main__":
    raise SystemExit(main())
