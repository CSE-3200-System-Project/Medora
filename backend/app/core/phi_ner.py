"""Learned PHI span recognition, run on CPU inside the trust boundary.

This module is the second half of a union ensemble. `ai_privacy` owns the rule-based
redactor, which is precise and cheap and misses previously-unseen names; this owns a
token-classification model that generalises to names no gazetteer contains. Redaction
fires if *either* system fires. The union is the deployment configuration because the two
failure modes are not symmetric: a missed identifier is a disclosure, a redacted benign
token costs only utility.

Three properties are structural rather than advisory.

**Off by default, and fails closed to rules.** `PHI_NER_ENABLED` defaults to false. If the
flag is on but the artifacts are missing, unreadable, or the wrong shape, `get_recognizer`
returns `None` and logs once — the caller then runs exactly the rules that ship today. A
privacy component that degrades silently to *nothing* would be worse than one that never
loaded, so there is no path where a failure here reduces redaction below the baseline.

**Inference never leaves the process.** `onnxruntime` on the CPU execution provider plus
the Rust `tokenizers` library. No torch, no transformers, no network call, no third-party
inference endpoint — text that is about to be de-identified must not be sent anywhere to
find out what to remove.

**Placeholders are never re-read.** Spans overlapping an existing `[redacted-...]` marker
are dropped, so running the redactor twice is a no-op. The rule layer already guarantees
this for itself; the learned layer has to as well or the ensemble loses idempotence.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, Sequence

from app.core.config import settings

logger = logging.getLogger(__name__)

PHI_ADMISSION_VERSION = "phi-ner-admission-1.0"
PHI_MIN_PRECISION = 0.90
PHI_MIN_NOVEL_RECALL = 0.88
PHI_MAX_OVER_REDACTION = 0.06
ROOT = Path(__file__).resolve().parents[3]
ADMISSION_DATASETS = {
    "pii_safety_134": ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl",
    "novel_identifier_probe": ROOT / "tests" / "benchmarks" / "datasets" / "pii_holdout_cases.jsonl",
}

PLACEHOLDER_PATTERN = re.compile(r"\[redacted-[a-z0-9-]+\]", flags=re.IGNORECASE)

# Character window used to cut long text before tokenisation. Kept well inside the 256-token
# training length so a window never truncates mid-sentence, with an overlap so an identifier
# straddling a boundary is still seen whole in one of the two windows.
_WINDOW_CHARS = 700
_WINDOW_OVERLAP = 120


@dataclass(frozen=True, slots=True)
class PhiSpan:
    start: int
    end: int
    label: str
    score: float


class SpanRecognizer(Protocol):
    """What `ai_privacy` needs from a recogniser, and nothing more.

    Narrow on purpose: tests substitute a deterministic stub, and the ensemble arithmetic
    is then testable without shipping model weights into the test suite.
    """

    def predict(self, text: str) -> list[PhiSpan]:
        ...


# ---------------------------------------------------------------------------
# ONNX implementation
# ---------------------------------------------------------------------------


class OnnxSpanRecognizer:
    """Token classification over an exported ONNX graph.

    The bundle is what `tools/phi_ner/train.py --model muril` writes: `model.onnx`,
    `tokenizer.json`, `labels.json`. Nothing else is read, so the deployed artifact set is
    small enough to review.
    """

    def __init__(self, bundle_dir: Path, threshold: float | None = None) -> None:
        import numpy as np
        import onnxruntime
        from tokenizers import Tokenizer

        self._np = np
        self.bundle_dir = bundle_dir
        labels = _read_json(bundle_dir / "labels.json")
        recorded_threshold = labels.get("selected_threshold")
        if recorded_threshold is None:
            raise ValueError("labels.json has no selected_threshold from the training gate")
        self.threshold = float(recorded_threshold if threshold is None else threshold)
        self.bio_labels: list[str] = list(labels["bio_labels"])
        if not self.bio_labels or self.bio_labels[0] != "O":
            raise ValueError(
                f"{bundle_dir / 'labels.json'} must list 'O' first; the entity score is "
                "computed as 1 - P(O) and a reordered label set would invert it."
            )
        self.max_length = int(labels.get("max_length", 256))

        self.tokenizer = Tokenizer.from_file(str(bundle_dir / "tokenizer.json"))
        self.session = onnxruntime.InferenceSession(
            str(bundle_dir / "model.onnx"), providers=["CPUExecutionProvider"]
        )
        self.input_names = [i.name for i in self.session.get_inputs()]

    def predict(self, text: str) -> list[PhiSpan]:
        spans: list[PhiSpan] = []
        for window_start, window_text in _windows(text):
            spans.extend(
                PhiSpan(span.start + window_start, span.end + window_start, span.label, span.score)
                for span in self._predict_window(window_text)
            )
        return merge_spans(spans)

    def _predict_window(self, text: str) -> list[PhiSpan]:
        np = self._np
        encoding = self.tokenizer.encode(text)
        ids = encoding.ids[: self.max_length]
        offsets = encoding.offsets[: self.max_length]
        if not ids:
            return []

        feeds = {}
        for name in self.input_names:
            if name == "input_ids":
                feeds[name] = np.asarray([ids], dtype=np.int64)
            elif name == "attention_mask":
                feeds[name] = np.asarray([[1] * len(ids)], dtype=np.int64)
            elif name == "token_type_ids":
                type_ids = list(encoding.type_ids[: self.max_length]) or [0] * len(ids)
                feeds[name] = np.asarray([type_ids], dtype=np.int64)
            else:
                raise ValueError(
                    f"Exported graph expects an input this runtime does not supply: {name!r}. "
                    "Re-export with tools/phi_ner/train.py rather than hand-editing the graph."
                )

        logits = self.session.run(["logits"], feeds)[0][0]
        shifted = logits - logits.max(axis=-1, keepdims=True)
        exponentiated = np.exp(shifted)
        probabilities = exponentiated / exponentiated.sum(axis=-1, keepdims=True)
        return decode_bio(probabilities.tolist(), offsets, self.bio_labels, self.threshold)


def decode_bio(
    probabilities: Sequence[Sequence[float]],
    offsets: Sequence[tuple[int, int]],
    bio_labels: Sequence[str],
    threshold: float,
) -> list[PhiSpan]:
    """Turn per-subword probabilities into character spans.

    A subword fires when `1 - P(O)` clears the threshold, and its entity type is the
    argmax over the non-`O` labels. The B/I distinction is used to *split* adjacent spans
    of the same type rather than to gate detection: a model that emits `I-` without a
    preceding `B-` is common under a recall-first threshold, and dropping those tokens
    would quietly undo the threshold choice.
    """
    spans: list[PhiSpan] = []
    current: dict | None = None
    for row, (start, end) in zip(probabilities, offsets):
        if start == end:
            continue
        entity_score = 1.0 - row[0]
        if entity_score < threshold:
            if current:
                spans.append(_close(current))
                current = None
            continue
        best_index = max(range(1, len(row)), key=lambda i: row[i])
        tag = bio_labels[best_index]
        prefix, _, label = tag.partition("-")
        if current and current["label"] == label and prefix != "B":
            current["end"] = end
            current["score"] = max(current["score"], entity_score)
        else:
            if current:
                spans.append(_close(current))
            current = {"start": start, "end": end, "label": label, "score": entity_score}
    if current:
        spans.append(_close(current))
    return spans


def _close(current: dict) -> PhiSpan:
    return PhiSpan(current["start"], current["end"], current["label"], current["score"])


def merge_spans(spans: Sequence[PhiSpan]) -> list[PhiSpan]:
    """Union overlapping or touching spans, keeping the higher-scoring label.

    Windows overlap, so the same identifier is often proposed twice. Emitting both would
    double-count it in any span metric and produce nested placeholders in the output.
    """
    if not spans:
        return []
    ordered = sorted(spans, key=lambda s: (s.start, s.end))
    merged = [ordered[0]]
    for span in ordered[1:]:
        last = merged[-1]
        if span.start <= last.end:
            winner = last if last.score >= span.score else span
            merged[-1] = PhiSpan(
                min(last.start, span.start),
                max(last.end, span.end),
                winner.label,
                max(last.score, span.score),
            )
        else:
            merged.append(span)
    return merged


def _windows(text: str) -> list[tuple[int, str]]:
    if len(text) <= _WINDOW_CHARS:
        return [(0, text)]
    windows: list[tuple[int, str]] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + _WINDOW_CHARS)
        if end < len(text):
            # Prefer a whitespace boundary so a window edge does not cut a name in half.
            pivot = text.rfind(" ", start + _WINDOW_CHARS // 2, end)
            if pivot > start:
                end = pivot
        windows.append((start, text[start:end]))
        if end >= len(text):
            break
        start = max(end - _WINDOW_OVERLAP, start + 1)
    return windows


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_bundle_admission(bundle: Path, threshold_override: float | None = None) -> float:
    """Validate measured release evidence and return the only admitted threshold."""
    admission = _read_json(bundle / "admission.json")
    labels = _read_json(bundle / "labels.json")
    if admission.get("admission_version") != PHI_ADMISSION_VERSION:
        raise ValueError("PHI admission evidence has an unsupported version")
    if admission.get("status") != "passed" or admission.get("passed") is not True:
        raise ValueError("PHI bundle has not passed the release gate")
    if labels.get("commercial_use_permitted") is not True:
        raise ValueError("PHI bundle licence is not cleared for deployment")

    selected = float(labels.get("selected_threshold"))
    admitted = float(admission.get("threshold"))
    if selected != admitted:
        raise ValueError("PHI bundle threshold differs from its admission evidence")
    if threshold_override is not None and float(threshold_override) != admitted:
        raise ValueError("PHI_NER_THRESHOLD differs from the admitted threshold")

    for name in ("model.onnx", "tokenizer.json", "labels.json"):
        recorded = (admission.get("bundle_files") or {}).get(name)
        if recorded != sha256_file(bundle / name):
            raise ValueError(f"PHI admission evidence is stale for {name}")
    for name, path in ADMISSION_DATASETS.items():
        recorded = (admission.get("datasets") or {}).get(name)
        if recorded != sha256_file(path):
            raise ValueError(f"PHI admission evidence is stale for {name}")

    metrics = admission.get("headline_metrics") or {}
    rules_recall = float(metrics.get("rules_recall"))
    union_recall = float(metrics.get("union_recall"))
    union_precision = float(metrics.get("union_precision"))
    union_over_redaction = float(metrics.get("union_over_redaction"))
    if not (
        union_recall >= PHI_MIN_NOVEL_RECALL
        and union_recall > rules_recall
        and union_precision >= PHI_MIN_PRECISION
        and union_over_redaction <= PHI_MAX_OVER_REDACTION
    ):
        raise ValueError("PHI admission metrics do not satisfy the release thresholds")
    return admitted


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

_LOCK = threading.Lock()
_CACHED: SpanRecognizer | None = None
_LOAD_ATTEMPTED = False


def bundle_dir() -> Path:
    configured = getattr(settings, "PHI_NER_MODEL_DIR", None)
    if configured:
        return Path(str(configured)).expanduser()
    return Path(__file__).resolve().parents[3] / "tools" / "phi_ner" / "artifacts" / "deploy"


def get_recognizer() -> SpanRecognizer | None:
    """The process-wide recogniser, or `None` when the ensemble must not run.

    Loading is attempted at most once. A failure is logged at warning level and cached as
    `None`: retrying a broken bundle on every request would turn a misconfiguration into a
    latency problem on the AI path, and the fallback (rules only) is already correct.
    """
    global _CACHED, _LOAD_ATTEMPTED
    if not getattr(settings, "PHI_NER_ENABLED", False):
        return None
    if _LOAD_ATTEMPTED:
        return _CACHED
    with _LOCK:
        if _LOAD_ATTEMPTED:
            return _CACHED
        _LOAD_ATTEMPTED = True
        directory = bundle_dir()
        required = ["model.onnx", "tokenizer.json", "labels.json", "admission.json"]
        missing = [name for name in required if not (directory / name).exists()]
        if missing:
            logger.warning(
                "PHI_NER_ENABLED is set but the model bundle at %s is missing %s. "
                "Falling back to rule-based redaction only.", directory, ", ".join(missing),
            )
            _CACHED = None
            return None
        try:
            threshold = validate_bundle_admission(
                directory,
                getattr(settings, "PHI_NER_THRESHOLD", None),
            )
            _CACHED = OnnxSpanRecognizer(directory, threshold)
            logger.info("Learned PHI span recogniser loaded from %s", directory)
        except Exception:  # noqa: BLE001 - a load failure must never break the AI path
            logger.warning(
                "Failed to load the learned PHI span recogniser from %s; "
                "falling back to rule-based redaction only.", directory, exc_info=True,
            )
            _CACHED = None
    return _CACHED


def reset_recognizer_cache() -> None:
    """Drop the cached recogniser. Tests and the flag-flip path use this; nothing else should."""
    global _CACHED, _LOAD_ATTEMPTED
    with _LOCK:
        _CACHED = None
        _LOAD_ATTEMPTED = False


# ---------------------------------------------------------------------------
# Applying spans to text
# ---------------------------------------------------------------------------

_LABEL_PLACEHOLDERS = {
    "NAME": "[redacted-name]",
    "DOCTOR": "[redacted-name]",
    "PHONE": "[redacted-phone]",
    "NID": "[redacted-national-id]",
    "ADDRESS": "[redacted-address]",
    "DATE": "[redacted-date]",
    "AGE": "[redacted-age]",
    "HOSPITAL": "[redacted-facility]",
    "EMAIL": "[redacted-email]",
    "MRN": "[redacted-account-id]",
}


def apply_spans(
    text: str,
    spans: Sequence[PhiSpan],
    *,
    redact_dates: bool = True,
) -> tuple[str, dict[str, int]]:
    """Replace predicted spans with the redactor's own placeholder vocabulary.

    Replacement runs right-to-left so earlier offsets stay valid as the string shortens —
    the alternative, rebuilding offsets after every substitution, is where off-by-one
    disclosure bugs live.

    `redact_dates=False` is honoured here as well as in the rule layer. A caller that has
    decided dates must survive (clinical timelines are often the point of the summary) must
    not have them removed by the model instead; a flag that only half the pipeline obeys is
    not a flag.
    """
    if not spans:
        return text, {}
    protected = [(m.start(), m.end()) for m in PLACEHOLDER_PATTERN.finditer(text)]
    counts: dict[str, int] = {}
    result = text
    for span in sorted(spans, key=lambda s: s.start, reverse=True):
        if span.label == "DATE" and not redact_dates:
            continue
        if any(span.start < end and start < span.end for start, end in protected):
            continue
        placeholder = _LABEL_PLACEHOLDERS.get(span.label)
        if placeholder is None:
            continue
        result = result[: span.start] + placeholder + result[span.end :]
        key = f"learned_{span.label.lower()}"
        counts[key] = counts.get(key, 0) + 1
    return result, counts
