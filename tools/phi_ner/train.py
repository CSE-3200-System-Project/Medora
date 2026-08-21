#!/usr/bin/env python3
"""Train the PHI span recogniser and export it for CPU inference.

    python tools/phi_ner/train.py --model muril --seeds 3
    python tools/phi_ner/train.py --model banglabert --allow-noncommercial   # comparator only
    python tools/phi_ner/train.py --list-models

Requires `torch` and `transformers`, which are deliberately **not** in `backend/requirements.txt`.
The backend never trains; its requirement files contain only the smaller inference runtime:
`onnxruntime` and the Rust `tokenizers` library. Keeping the training stack out of the service
image is the reason the deployed component stays small enough to run on CPU inside the trust
boundary.

Three decisions are encoded here rather than left to the operator.

**Threshold is tuned for recall, not F1.** Under-redaction discloses an identifier; over-redaction
costs only utility, and the rule-based baseline is running at a 3.2% false-redaction rate, so there
is headroom to spend. The sweep therefore selects the *lowest* decision threshold whose dev
over-redaction stays within `--over-redaction-cap` (default 6%), and records the entire sweep so
the choice is auditable rather than asserted.

**Licence is enforced in code, not in a README.** `csebuetnlp/banglabert` is the strongest Bangla
encoder and it is released under a non-commercial licence. It may be trained as a research
comparator — that is a legitimate published comparison — but `export_onnx` refuses to write
deployment artifacts for it. A licence that only lives in prose eventually ends up in a container.

**Three seeds, reported separately.** A single fine-tuning run on 12k synthetic sentences has
enough seed variance to move span F1 by a point or two. One number from one seed is a sample, not
a result.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

CORPUS_DIR = HERE / "corpus"
ARTIFACT_DIR = HERE / "artifacts"

LABELS = ["NAME", "DOCTOR", "PHONE", "NID", "ADDRESS", "DATE", "AGE", "HOSPITAL", "EMAIL", "MRN"]
BIO_LABELS = ["O"] + [f"{prefix}-{label}" for label in LABELS for prefix in ("B", "I")]


class LicenceViolation(RuntimeError):
    """Raised when a model would be exported into the deployment path against its licence."""


@dataclass(frozen=True)
class ModelSpec:
    key: str
    hf_id: str
    licence: str
    commercial_use: bool
    learning_rate: float
    why: str

    @property
    def deployable(self) -> bool:
        return self.commercial_use


MODELS: dict[str, ModelSpec] = {
    "muril": ModelSpec(
        key="muril",
        hf_id="google/muril-base-cased",
        licence="Apache-2.0",
        commercial_use=True,
        learning_rate=2e-5,
        why="Pretrained on transliterated Indic text, which is the romanised Banglish case "
            "the rule-based redactor is weakest on.",
    ),
    "xlmr": ModelSpec(
        key="xlmr",
        hf_id="xlm-roberta-base",
        licence="MIT",
        commercial_use=True,
        learning_rate=2e-5,
        why="Multilingual control. If it matches MuRIL, the Indic pretraining is not what is "
            "carrying the result, and the paper should say so.",
    ),
    "banglabert": ModelSpec(
        key="banglabert",
        hf_id="csebuetnlp/banglabert",
        licence="CC BY-NC-SA 4.0 (non-commercial)",
        commercial_use=False,
        learning_rate=3e-5,
        why="Strongest Bangla encoder and the right research comparator. Its licence forbids "
            "commercial use, so it is measured and reported, never shipped.",
    ),
}


def assert_export_allowed(spec: ModelSpec) -> None:
    if not spec.deployable:
        raise LicenceViolation(
            f"{spec.hf_id} is licensed {spec.licence}. It may be trained and reported as a "
            "research comparator, but exporting it produces a deployment artifact for a "
            "service that is not non-commercial. Train it with --allow-noncommercial and "
            "read the numbers; do not export it."
        )


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


@dataclass
class Example:
    text: str
    spans: list[dict] = field(default_factory=list)


def load_split(name: str) -> list[Example]:
    path = CORPUS_DIR / f"phi_corpus_{name}.jsonl"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Build it first:\n"
            f"    python tools/phi_ner/generate_corpus.py\n"
            "The corpus is a reproducible build artifact and is not committed."
        )
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            rows.append(Example(text=row["text"], spans=row["spans"]))
    return rows


def encode(examples: list[Example], tokenizer, max_length: int):
    """Tokenise and project character spans onto subword labels via offset mapping.

    Offsets are the source of truth in the corpus precisely so this projection is exact and
    tokeniser-independent: swapping MuRIL for XLM-R changes the subwords, not the gold spans.
    A subword is labelled `B-` when it starts at or before the span start, `I-` otherwise, and
    special tokens get -100 so they are excluded from the loss.
    """
    encoded = tokenizer(
        [ex.text for ex in examples],
        truncation=True,
        max_length=max_length,
        padding=False,
        return_offsets_mapping=True,
    )
    label_ids: list[list[int]] = []
    index = {name: position for position, name in enumerate(BIO_LABELS)}
    for row, example in enumerate(examples):
        offsets = encoded["offset_mapping"][row]
        labels = []
        for start, end in offsets:
            if start == end:  # special token or empty piece
                labels.append(-100)
                continue
            hit = next((s for s in example.spans if s["start"] < end and start < s["end"]), None)
            if hit is None:
                labels.append(index["O"])
            else:
                prefix = "B" if start <= hit["start"] else "I"
                labels.append(index[f"{prefix}-{hit['label']}"])
        label_ids.append(labels)
    encoded = {k: v for k, v in encoded.items() if k != "offset_mapping"}
    encoded["labels"] = label_ids
    return encoded


# ---------------------------------------------------------------------------
# Threshold sweep
# ---------------------------------------------------------------------------


def sweep_threshold(
    probabilities, gold_labels, thresholds: list[float], over_redaction_cap: float
) -> dict:
    """Pick the recall-maximising threshold that keeps dev over-redaction within cap.

    `probabilities` is per-subword softmax output; the entity score is `1 - P(O)`. Recall is
    measured over gold entity subwords, over-redaction over gold `O` subwords. Both are
    token-level here — span-level scoring against the real holdout is `evaluate.py`'s job, and
    mixing the two would let a threshold tuned on synthetic spans claim a holdout number.
    """
    rows = []
    for threshold in thresholds:
        true_positive = false_positive = positives = negatives = 0
        for probs_row, gold_row in zip(probabilities, gold_labels):
            for probs, gold in zip(probs_row, gold_row):
                if gold == -100:
                    continue
                entity_score = 1.0 - probs[0]
                fired = entity_score >= threshold
                if gold != 0:
                    positives += 1
                    true_positive += fired
                else:
                    negatives += 1
                    false_positive += fired
        rows.append({
            "threshold": round(threshold, 4),
            "recall": (true_positive / positives) if positives else None,
            "over_redaction_rate": (false_positive / negatives) if negatives else None,
            "entity_tokens": positives,
            "benign_tokens": negatives,
        })
    eligible = [r for r in rows
                if r["over_redaction_rate"] is not None and r["over_redaction_rate"] <= over_redaction_cap]
    if eligible:
        chosen = max(eligible, key=lambda r: (r["recall"] or 0.0, -r["threshold"]))
        reason = f"highest dev recall with over-redaction <= {over_redaction_cap:.1%}"
    else:
        # Never silently fall back to an F1-optimal point: say that the cap could not be met.
        chosen = max(rows, key=lambda r: -(r["over_redaction_rate"] or 1.0))
        reason = (f"no threshold met the {over_redaction_cap:.1%} over-redaction cap; "
                  "selected the least over-redacting point and flagged it")
    return {
        "chosen": chosen,
        "selection_reason": reason,
        "cap_met": bool(eligible),
        "sweep": rows,
        "over_redaction_cap": over_redaction_cap,
    }


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def _require_training_stack():
    try:
        import numpy  # noqa: F401
        import torch  # noqa: F401
        from transformers import (  # noqa: F401
            AutoModelForTokenClassification,
            AutoTokenizer,
            DataCollatorForTokenClassification,
            Trainer,
            TrainingArguments,
        )
    except ImportError as exc:  # pragma: no cover - exercised only on a training host
        raise SystemExit(
            "Training requires torch + transformers, which are not part of the backend "
            "runtime by design.\n"
            "    pip install 'torch' 'transformers>=4.44' 'accelerate'\n"
            f"(import failed: {exc})"
        ) from exc


def train_one(spec: ModelSpec, seed: int, args) -> dict:  # pragma: no cover - needs a GPU host
    import numpy as np
    import torch
    from transformers import (
        AutoModelForTokenClassification,
        AutoTokenizer,
        DataCollatorForTokenClassification,
        Trainer,
        TrainingArguments,
    )

    torch.manual_seed(seed)
    np.random.seed(seed)

    tokenizer = AutoTokenizer.from_pretrained(spec.hf_id, use_fast=True)
    train_examples = load_split("train")
    dev_examples = load_split("dev")
    train_encoded = encode(train_examples, tokenizer, args.max_length)
    dev_encoded = encode(dev_examples, tokenizer, args.max_length)

    class ListDataset(torch.utils.data.Dataset):
        def __init__(self, encoded):
            self.encoded = encoded

        def __len__(self):
            return len(self.encoded["input_ids"])

        def __getitem__(self, i):
            return {key: value[i] for key, value in self.encoded.items()}

    model = AutoModelForTokenClassification.from_pretrained(
        spec.hf_id,
        num_labels=len(BIO_LABELS),
        id2label={i: name for i, name in enumerate(BIO_LABELS)},
        label2id={name: i for i, name in enumerate(BIO_LABELS)},
    )
    run_dir = ARTIFACT_DIR / f"{spec.key}-seed{seed}"
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(run_dir / "checkpoints"),
            learning_rate=spec.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size,
            num_train_epochs=args.epochs,
            warmup_ratio=0.1,
            seed=seed,
            eval_strategy="epoch",
            save_strategy="no",
            logging_steps=100,
            report_to=[],
        ),
        train_dataset=ListDataset(train_encoded),
        eval_dataset=ListDataset(dev_encoded),
        data_collator=DataCollatorForTokenClassification(tokenizer),
    )
    trainer.train()

    predictions = trainer.predict(ListDataset(dev_encoded))
    logits = torch.tensor(predictions.predictions)
    probabilities = torch.softmax(logits, dim=-1).numpy().tolist()
    threshold_report = sweep_threshold(
        probabilities,
        predictions.label_ids.tolist(),
        [round(0.05 * i, 4) for i in range(1, 20)],
        args.over_redaction_cap,
    )

    run_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(run_dir)
    tokenizer.save_pretrained(run_dir)
    (run_dir / "threshold.json").write_text(
        json.dumps(threshold_report, indent=2) + "\n", encoding="utf-8")
    return {
        "seed": seed,
        "run_dir": str(run_dir.relative_to(ROOT)).replace("\\", "/"),
        "threshold": threshold_report["chosen"]["threshold"],
        "dev_recall": threshold_report["chosen"]["recall"],
        "dev_over_redaction": threshold_report["chosen"]["over_redaction_rate"],
        "cap_met": threshold_report["cap_met"],
    }


def export_onnx(
    spec: ModelSpec,
    run_dir: Path,
    out_dir: Path,
    max_length: int,
    selected_threshold: float,
    over_redaction_cap: float,
) -> Path:  # pragma: no cover
    """Write the CPU inference bundle the backend loads: graph, tokenizer, labels, manifest."""
    assert_export_allowed(spec)
    import torch
    from transformers import AutoModelForTokenClassification, AutoTokenizer

    out_dir.mkdir(parents=True, exist_ok=True)
    model = AutoModelForTokenClassification.from_pretrained(run_dir).eval()
    tokenizer = AutoTokenizer.from_pretrained(run_dir, use_fast=True)
    dummy = tokenizer("de-identification export probe", return_tensors="pt")
    inputs = ["input_ids", "attention_mask"]
    if "token_type_ids" in dummy:
        inputs.append("token_type_ids")
    torch.onnx.export(
        model,
        tuple(dummy[name] for name in inputs),
        str(out_dir / "model.onnx"),
        input_names=inputs,
        output_names=["logits"],
        dynamic_axes={name: {0: "batch", 1: "sequence"} for name in inputs + ["logits"]},
        opset_version=14,
    )
    tokenizer.backend_tokenizer.save(str(out_dir / "tokenizer.json"))
    (out_dir / "labels.json").write_text(
        json.dumps(
            {
                "bio_labels": BIO_LABELS,
                "max_length": max_length,
                "selected_threshold": selected_threshold,
                "training_over_redaction_cap": over_redaction_cap,
                "model": spec.hf_id,
                "licence": spec.licence,
                "commercial_use_permitted": spec.commercial_use and spec.deployable,
            },
            indent=2,
        ) + "\n",
        encoding="utf-8")
    return out_dir


def build_manifest(spec: ModelSpec, runs: list[dict], args) -> dict:
    return {
        "component": "phi-span-recogniser",
        "model": spec.hf_id,
        "model_key": spec.key,
        "licence": spec.licence,
        "commercial_use_permitted": spec.commercial_use,
        "deployable": spec.deployable,
        "rationale": spec.why,
        "labels": LABELS,
        "bio_labels": BIO_LABELS,
        "corpus": "phi-corpus-1.0 (synthetic; see tools/phi_ner/corpus/manifest.json)",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "hyperparameters": {
            "learning_rate": spec.learning_rate,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "max_length": args.max_length,
            "warmup_ratio": 0.1,
        },
        "threshold_policy": {
            "objective": "recall-first",
            "over_redaction_cap": args.over_redaction_cap,
            "note": "Under-redaction is a disclosure; over-redaction costs utility only. The "
                    "threshold is the lowest one whose dev over-redaction stays within the cap.",
        },
        "runs": runs,
        "holdout": "Never trained or tuned on. Span scoring lives in tools/phi_ner/evaluate.py.",
    }


def select_export_run(runs: list[dict]) -> dict | None:
    """Choose the highest-recall seed that actually satisfied the training safety cap."""
    eligible = [run for run in runs if run["cap_met"]]
    return max(eligible, key=lambda run: (run["dev_recall"] or 0.0)) if eligible else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", choices=sorted(MODELS), default="muril")
    parser.add_argument("--seeds", type=int, default=3)
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--over-redaction-cap", type=float, default=0.06)
    parser.add_argument("--allow-noncommercial", action="store_true",
                        help="permit training a non-commercially licensed comparator; export "
                             "stays blocked regardless")
    parser.add_argument("--no-export", action="store_true")
    parser.add_argument("--list-models", action="store_true")
    args = parser.parse_args(argv)

    if args.list_models:
        for spec in MODELS.values():
            flag = "deployable" if spec.deployable else "RESEARCH COMPARATOR ONLY"
            print(f"{spec.key:12} {spec.hf_id:32} {spec.licence:32} {flag}")
            print(f"{'':12} {spec.why}")
        return 0

    spec = MODELS[args.model]
    if not spec.deployable and not args.allow_noncommercial:
        parser.error(
            f"{spec.hf_id} is licensed {spec.licence}. Pass --allow-noncommercial to train it "
            "as a reported comparator. It can never be exported for deployment."
        )

    _require_training_stack()
    runs = [train_one(spec, seed, args) for seed in range(1, args.seeds + 1)]

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(spec, runs, args)

    if not args.no_export and spec.deployable:
        best = select_export_run(runs)
        if best:
            bundle = export_onnx(
                spec,
                ROOT / best["run_dir"],
                ARTIFACT_DIR / "deploy",
                args.max_length,
                best["threshold"],
                args.over_redaction_cap,
            )
            manifest["export"] = {
                "bundle": str(bundle.relative_to(ROOT)).replace("\\", "/"),
                "from_run": best["run_dir"],
                "threshold": best["threshold"],
                "admitted": False,
                "next_step": "Run evaluate.py --admit-bundle; runtime refuses unadmitted exports.",
            }
        else:
            manifest["export"] = {
                "blocked": True,
                "reason": "No seed satisfied the training over-redaction cap.",
            }
    elif not spec.deployable:
        manifest["export"] = {"blocked": True, "reason": spec.licence}

    (ARTIFACT_DIR / f"manifest-{spec.key}.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"model": spec.hf_id, "runs": runs,
                      "export": manifest.get("export")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
