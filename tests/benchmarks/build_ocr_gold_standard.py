#!/usr/bin/env python3
"""Validate independent review/adjudication and build the OCR gold set."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
ANNOTATIONS = ROOT / "tests" / "benchmarks" / "annotations"
GOLD = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_gold_standard.jsonl"
AGREEMENT = ROOT / "tests" / "benchmarks" / "reports" / "ocr_pre_adjudication_agreement.json"
FIELDS = ("medicine", "strength", "dose", "frequency", "duration", "route", "quantity", "instructions")


def edit_distance(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for row, left_value in enumerate(left, 1):
        current = [row]
        for column, right_value in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (left_value != right_value)))
        previous = current
    return previous[-1]


def normalize(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def load_label(record_id: str, role: str) -> dict:
    path = ANNOTATIONS / record_id / f"{role}.json"
    if not path.exists():
        raise ValueError(f"{record_id}: missing {role} label")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_record(record: dict) -> tuple[dict, dict]:
    record_id = record["id"]
    primary = load_label(record_id, "primary")
    independent = load_label(record_id, "independent")
    adjudicated = load_label(record_id, "adjudication")
    if primary.get("source_sha256") != record["sha256"] or independent.get("source_sha256") != record["sha256"] or adjudicated.get("source_sha256") != record["sha256"]:
        raise ValueError(f"{record_id}: source hash mismatch")
    if primary.get("reviewer", {}).get("id") == independent.get("reviewer", {}).get("id"):
        raise ValueError(f"{record_id}: primary and independent reviewer must differ")
    if independent.get("reviewer", {}).get("credential_role") not in {"licensed_clinician", "licensed_pharmacist"}:
        raise ValueError(f"{record_id}: independent reviewer credential role is not eligible")
    decision = adjudicated.get("adjudication", {})
    if decision.get("state") != "adjudicated" or decision.get("unresolved_fields"):
        raise ValueError(f"{record_id}: adjudication is incomplete")

    left_text = normalize(primary.get("raw_transcription"))
    right_text = normalize(independent.get("raw_transcription"))
    character_denominator = max(len(left_text), len(right_text), 1)
    left_words, right_words = left_text.split(), right_text.split()
    word_denominator = max(len(left_words), len(right_words), 1)
    left_rows, right_rows = primary.get("medications", []), independent.get("medications", [])
    field_total = max(len(left_rows), len(right_rows)) * len(FIELDS)
    field_exact = 0
    for index in range(max(len(left_rows), len(right_rows))):
        left_row = left_rows[index] if index < len(left_rows) else {}
        right_row = right_rows[index] if index < len(right_rows) else {}
        field_exact += sum(normalize(left_row.get(field)) == normalize(right_row.get(field)) for field in FIELDS)
    agreement = {
        "record_id": record_id,
        "exact_text": left_text == right_text,
        "character_error_rate": edit_distance(list(left_text), list(right_text)) / character_denominator,
        "word_error_rate": edit_distance(left_words, right_words) / word_denominator,
        "exact_fields": field_exact,
        "field_denominator": field_total,
        "all_fields_exact": field_total > 0 and field_exact == field_total,
    }
    gold = {
        "record_id": record_id,
        "source_sha256": record["sha256"],
        "split": record["split"],
        "difficulty": record["difficulty"],
        "raw_transcription": adjudicated.get("raw_transcription", ""),
        "boxes": adjudicated.get("boxes", []),
        "medications": adjudicated.get("medications", []),
        "language": adjudicated.get("language"),
        "script": adjudicated.get("script"),
        "writer_or_template_group": record.get("writer_or_template_group"),
        "image_quality": adjudicated.get("image_quality", {}),
        "flags": adjudicated.get("flags", {}),
        "review": {
            "primary_reviewer": primary["reviewer"]["id"],
            "independent_reviewer": independent["reviewer"]["id"],
            "independent_credential_role": independent["reviewer"]["credential_role"],
            "adjudicator": adjudicated["reviewer"]["id"],
            "state": "adjudicated",
        },
    }
    return gold, agreement


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Validate only; do not write artifacts")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if not manifest.get("frozen"):
        raise SystemExit("Manifest is not frozen; resolve its metadata blockers before building gold")
    records = [item for item in manifest["records"] if item["included_in_metrics"]]
    gold, agreement = zip(*(validate_record(record) for record in records))
    summary = {
        "schema_version": "1.0.0",
        "records": len(records),
        "exact_text_agreement": sum(item["exact_text"] for item in agreement) / len(agreement),
        "mean_character_error_rate": sum(item["character_error_rate"] for item in agreement) / len(agreement),
        "mean_word_error_rate": sum(item["word_error_rate"] for item in agreement) / len(agreement),
        "exact_field_agreement": sum(item["exact_fields"] for item in agreement) / max(sum(item["field_denominator"] for item in agreement), 1),
        "complete_record_field_agreement": sum(item["all_fields_exact"] for item in agreement) / len(agreement),
        "per_record": agreement,
    }
    if args.check:
        print(f"Validated {len(gold)} independently reviewed and adjudicated records")
        return 0
    GOLD.write_text("".join(json.dumps(item, ensure_ascii=False) + "\n" for item in gold), encoding="utf-8")
    AGREEMENT.parent.mkdir(parents=True, exist_ok=True)
    AGREEMENT.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {GOLD.relative_to(ROOT)} with {len(gold)} records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
