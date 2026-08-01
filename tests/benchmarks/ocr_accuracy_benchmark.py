#!/usr/bin/env python3
"""Evaluate frozen OCR configurations A-H on one adjudicated test set.

The evaluator never calls a provider. It consumes immutable response-cache entries
keyed by the prescription SHA-256 so every downstream configuration receives the
same OCR observations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("medicine", "strength", "dose", "frequency", "duration", "route", "quantity", "instructions")
CONFIGS = {
    "A": ("paddle_full", False, False, False, False),
    "B": ("azure_full", False, False, False, False),
    "C": ("azure_yolo", False, False, False, False),
    "D": ("azure_yolo", True, False, False, False),
    "E": ("azure_yolo", True, True, False, False),
    "F": ("azure_yolo", True, True, True, False),
    "G": ("azure_yolo", True, True, True, True),
    "H": ("azure_yolo", True, True, True, True),
}
DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
STRENGTH = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%)\b", re.I)
FREQUENCY = re.compile(r"\b(?:od|bd|bid|tds|tid|qid|hs|\d\s*[+x×-]\s*\d\s*[+x×-]\s*\d)\b", re.I)
DURATION = re.compile(r"\b\d+\s*(?:day|days|week|weeks|month|months|দিন|সপ্তাহ|মাস)\b", re.I)
QUANTITY = re.compile(r"\b(?:qty\.?\s*)?\d+\s*(?:tab(?:let)?s?|cap(?:sule)?s?|ml|pcs?)?\b", re.I)
ROUTE = re.compile(r"\b(?:oral|po|iv|im|sc|topical|inhaled|nasal|চামড়ায়|মুখে)\b", re.I)


def normalize(value: object, *, bangla: bool = True) -> str:
    text = str(value or "").casefold()
    if bangla:
        text = text.translate(DIGITS).replace("×", "+").replace("x", "+")
    return " ".join(re.sub(r"[^\w%+.-]+", " ", text, flags=re.UNICODE).split())


def distance(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for row, a in enumerate(left, 1):
        current = [row]
        for column, b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (a != b)))
        previous = current
    return previous[-1]


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"required artifact missing: {path.relative_to(ROOT)}")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def cache_entry(cache_root: Path, provider: str, source_hash: str) -> dict:
    path = cache_root / provider / f"{source_hash}.json"
    if not path.exists():
        raise SystemExit(f"missing immutable cache entry: {path.relative_to(ROOT)}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("source_sha256") != source_hash or payload.get("provider_key") != provider:
        raise SystemExit(f"cache identity mismatch: {path.relative_to(ROOT)}")
    response = payload.get("response")
    expected = payload.get("response_sha256")
    actual = hashlib.sha256(json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if not expected or actual != expected:
        raise SystemExit(f"cache response hash mismatch: {path.relative_to(ROOT)}")
    return payload


def extract_rows(response: dict, *, grammar: bool, bangla: bool) -> list[dict]:
    supplied = response.get("raw_medication_rows")
    if supplied:
        return [{field: str(row.get(field, "")) for field in FIELDS} | {"confidence": row.get("confidence")} for row in supplied]
    lines = response.get("lines") or str(response.get("raw_text", "")).splitlines()
    rows: list[dict] = []
    for item in lines:
        text = item.get("text", "") if isinstance(item, dict) else str(item)
        normalized = text.translate(DIGITS) if bangla else text
        if not normalized.strip():
            continue
        row = {field: "" for field in FIELDS}
        row["medicine"] = normalized.strip()
        if grammar:
            for field, pattern in (("strength", STRENGTH), ("frequency", FREQUENCY), ("duration", DURATION), ("route", ROUTE), ("quantity", QUANTITY)):
                match = pattern.search(normalized)
                if match:
                    row[field] = match.group(0)
                    row["medicine"] = row["medicine"].replace(match.group(0), " ")
            row["medicine"] = " ".join(row["medicine"].split())
        row["confidence"] = item.get("confidence") if isinstance(item, dict) else None
        rows.append(row)
    return rows


def catalog_correct(rows: list[dict], catalog: list[str], *, fuzzy: bool) -> tuple[list[dict], list[tuple[str, str]]]:
    corrected, changes = [], []
    normalized_catalog = {normalize(item): item for item in catalog if normalize(item)}
    for source in rows:
        row = dict(source)
        raw = str(row.get("medicine", ""))
        candidate = normalize(raw)
        replacement = normalized_catalog.get(candidate)
        if not replacement:
            exact_terms = [canonical for key, canonical in normalized_catalog.items() if key and re.search(rf"\b{re.escape(key)}\b", candidate)]
            replacement = max(exact_terms, key=len, default=None)
        if fuzzy and not replacement and candidate:
            ranked = max(((SequenceMatcher(None, candidate, key).ratio(), value) for key, value in normalized_catalog.items()), default=(0.0, None))
            if ranked[0] >= 0.84:
                replacement = ranked[1]
        if replacement and normalize(replacement) != candidate:
            row["medicine"] = replacement
            changes.append((raw, replacement))
        corrected.append(row)
    return corrected, changes


def confidence_gate(rows: list[dict], threshold: float) -> tuple[list[dict], bool]:
    uncertain = False
    for row in rows:
        confidence = row.get("confidence")
        if confidence is None or float(confidence) < threshold or not row.get("medicine"):
            uncertain = True
    return rows, uncertain


def row_tuple(row: dict) -> tuple[str, ...]:
    return tuple(normalize(row.get(field)) for field in FIELDS)


def per_record_metrics(gold: dict, prediction: list[dict], raw_text: str, changes: list[tuple[str, str]], review: bool) -> dict:
    truth_rows = gold.get("medications", [])
    truth_text = normalize(gold.get("raw_transcription"))
    predicted_text = normalize(raw_text)
    chars_truth, chars_pred = list(truth_text), list(predicted_text)
    words_truth, words_pred = truth_text.split(), predicted_text.split()

    values: dict[str, float] = {
        "cer": distance(chars_truth, chars_pred) / max(len(chars_truth), 1),
        "wer": distance(words_truth, words_pred) / max(len(words_truth), 1),
    }
    for field in FIELDS:
        truth = Counter(normalize(row.get(field)) for row in truth_rows if normalize(row.get(field)))
        pred = Counter(normalize(row.get(field)) for row in prediction if normalize(row.get(field)))
        true_positive = sum((truth & pred).values())
        predicted = sum(pred.values())
        actual = sum(truth.values())
        precision = true_positive / predicted if predicted else (1.0 if not actual else 0.0)
        recall = true_positive / actual if actual else (1.0 if not predicted else 0.0)
        values[f"{field}_precision"] = precision
        values[f"{field}_recall"] = recall
        values[f"{field}_f1"] = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    truth_counter = Counter(row_tuple(row) for row in truth_rows)
    pred_counter = Counter(row_tuple(row) for row in prediction)
    exact_rows = sum((truth_counter & pred_counter).values())
    values["complete_row_accuracy"] = exact_rows / max(sum(truth_counter.values()), 1)
    values["full_prescription_exact"] = float(truth_counter == pred_counter)
    truth_names = {normalize(row.get("medicine")) for row in truth_rows}
    values["false_catalog_corrections"] = float(sum(normalize(after) not in truth_names for _, after in changes))
    values["review_flag"] = float(review)
    values["review_coverage"] = float(review and values["full_prescription_exact"] == 0.0)
    return values


def summarize(records: list[dict]) -> dict[str, float]:
    keys = records[0].keys()
    return {key: mean(float(record[key]) for record in records) for key in keys}


def bootstrap(all_scores: dict[str, list[dict]], iterations: int, seed: int) -> tuple[dict, dict]:
    rng = random.Random(seed)
    count = len(next(iter(all_scores.values())))
    distributions: dict[str, dict[str, list[float]]] = {config: {} for config in CONFIGS}
    deltas: dict[str, dict[str, list[float]]] = {f"H-{config}": {} for config in CONFIGS if config != "H"}
    for _ in range(iterations):
        indices = [rng.randrange(count) for _ in range(count)]
        sampled = {config: summarize([scores[index] for index in indices]) for config, scores in all_scores.items()}
        for config, metrics in sampled.items():
            for key, value in metrics.items():
                distributions[config].setdefault(key, []).append(value)
        for config in CONFIGS:
            if config == "H":
                continue
            for key in sampled["H"]:
                deltas[f"H-{config}"].setdefault(key, []).append(sampled["H"][key] - sampled[config][key])

    def interval(values: list[float]) -> list[float]:
        ordered = sorted(values)
        return [ordered[math.floor(0.025 * (len(ordered) - 1))], ordered[math.ceil(0.975 * (len(ordered) - 1))]]

    return (
        {config: {metric: interval(values) for metric, values in metrics.items()} for config, metrics in distributions.items()},
        {pair: {metric: interval(values) for metric, values in metrics.items()} for pair, metrics in deltas.items()},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", type=Path, default=ROOT / "tests/benchmarks/datasets/ocr_gold_standard.jsonl")
    parser.add_argument("--cache", type=Path, default=ROOT / "tests/benchmarks/cache/ocr")
    parser.add_argument("--catalog", type=Path, default=ROOT / "tests/benchmarks/datasets/medicine_catalog.json")
    parser.add_argument("--output", type=Path, default=ROOT / "tests/benchmarks/reports/ocr_results.json")
    parser.add_argument("--split", choices=("development", "test"), default="test")
    parser.add_argument("--review-threshold", type=float, default=0.75)
    parser.add_argument("--bootstrap", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=104729)
    args = parser.parse_args()

    gold = [record for record in load_jsonl(args.gold) if record.get("split") == args.split]
    expected = 82 if args.split == "test" else 21
    if len(gold) != expected:
        raise SystemExit(f"expected {expected} frozen {args.split} records, found {len(gold)}")
    if not args.catalog.exists():
        raise SystemExit("frozen medicine catalog is missing")
    catalog_payload = json.loads(args.catalog.read_text(encoding="utf-8"))
    catalog = catalog_payload.get("medicines", catalog_payload) if isinstance(catalog_payload, dict) else catalog_payload
    if not isinstance(catalog, list) or not catalog:
        raise SystemExit("medicine catalog must be a non-empty JSON list")

    all_scores: dict[str, list[dict]] = {config: [] for config in CONFIGS}
    raw_rows: list[dict] = []
    failures, runtimes = [], {provider: [] for provider in {spec[0] for spec in CONFIGS.values()}}
    cache_by_record: dict[tuple[str, str], dict] = {}
    for record in gold:
        for provider in runtimes:
            entry = cache_entry(args.cache, provider, record["source_sha256"])
            cache_by_record[(record["record_id"], provider)] = entry
            if entry.get("failure"):
                failures.append({"record_id": record["record_id"], "provider": provider, "failure": entry["failure"]})
            else:
                runtimes[provider].append(float(entry.get("runtime_ms", 0)))

        for config, (provider, exact, fuzzy, grammar, bangla) in CONFIGS.items():
            entry = cache_by_record[(record["record_id"], provider)]
            response = entry.get("response") or {}
            if entry.get("failure"):
                rows, raw_text, changes, review = [], "", [], True
            else:
                raw_text = str(response.get("raw_text", ""))
                rows = extract_rows(response, grammar=grammar, bangla=bangla)
                changes: list[tuple[str, str]] = []
                if exact:
                    rows, changes = catalog_correct(rows, catalog, fuzzy=fuzzy)
                review = False
                if config == "H":
                    rows, review = confidence_gate(rows, args.review_threshold)
            metrics = per_record_metrics(record, rows, raw_text, changes, review)
            all_scores[config].append(metrics)
            raw_rows.append({"record_id": record["record_id"], "source_sha256": record["source_sha256"], "configuration": config, **metrics})

    intervals, paired_differences = bootstrap(all_scores, args.bootstrap, args.seed)
    output = {
        "schema_version": "1.0.0",
        "split": args.split,
        "denominator": len(gold),
        "configurations": {key: {"provider_cache": value[0], "exact_catalog": value[1], "fuzzy_catalog": value[2], "grammar": value[3], "bangla_normalization": value[4], "review_gating": key == "H"} for key, value in CONFIGS.items()},
        "bootstrap": {"unit": "prescription", "paired": True, "iterations": args.bootstrap, "seed": args.seed, "confidence": 0.95},
        "summary": {config: summarize(scores) for config, scores in all_scores.items()},
        "confidence_intervals": intervals,
        "paired_differences": paired_differences,
        "runtime_ms": {provider: {"scope": "provider_only", "n": len(values), "mean": mean(values) if values else None} for provider, values in runtimes.items()},
        "failures": failures,
        "exclusions": {"exact_duplicate_files": 2, "development_records": 21},
        "raw_scores": raw_rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.output.relative_to(ROOT)} for {len(gold)} prescriptions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
