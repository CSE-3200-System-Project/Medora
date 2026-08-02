#!/usr/bin/env python3
"""Import review-required GPT vision transcriptions into OCR prelabels.

The source JSONL is deliberately separate from human annotations. Importing a
draft never changes the corpus manifest, creates ground truth, or makes a draft
available to the blinded independent reviewer.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
DEFAULT_DRAFTS = ROOT / "tests" / "benchmarks" / "datasets" / "gpt_vision_drafts.jsonl"
PRELABEL_ROOT = ROOT / "tests" / "benchmarks" / "prelabels"
REVIEW_STATE = "ai_assisted_unreviewed"
PROVIDER = "gpt-5.6-codex-vision"


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp"
    ) as stream:
        stream.write(rendered)
        temporary = Path(stream.name)
    os.replace(temporary, path)


def load_jsonl(path: Path) -> list[dict]:
    records: list[dict] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
    return records


def validate_drafts(drafts: list[dict], manifest: dict) -> list[dict]:
    records_by_id = {
        record["id"]: record
        for record in manifest["records"]
        if record.get("included_in_metrics")
    }
    seen: set[str] = set()
    validated: list[dict] = []
    for draft in drafts:
        record_id = str(draft.get("record_id", ""))
        if record_id in seen:
            raise ValueError(f"{record_id}: duplicate GPT vision draft")
        if record_id not in records_by_id:
            raise ValueError(f"{record_id or '<missing>'}: not a metric-eligible manifest record")
        record = records_by_id[record_id]
        if draft.get("source_sha256") != record["sha256"]:
            raise ValueError(f"{record_id}: source hash does not match the manifest")
        if draft.get("review_state") != REVIEW_STATE:
            raise ValueError(f"{record_id}: review_state must be {REVIEW_STATE!r}")
        if draft.get("model") != PROVIDER:
            raise ValueError(f"{record_id}: model must be {PROVIDER!r}")
        if draft.get("scope") != "rx_section_only":
            raise ValueError(f"{record_id}: scope must be 'rx_section_only'")
        if not str(draft.get("raw_transcription", "")).strip():
            raise ValueError(f"{record_id}: raw_transcription is required")
        uncertain_spans = draft.get("uncertain_spans", [])
        if not isinstance(uncertain_spans, list) or not all(
            isinstance(value, str) and value.strip() for value in uncertain_spans
        ):
            raise ValueError(f"{record_id}: uncertain_spans must be a list of non-empty strings")
        seen.add(record_id)
        validated.append(draft)
    return validated


def merge_draft(draft: dict, prelabel: dict) -> dict:
    candidate = {
        "model": draft["model"],
        "scope": draft["scope"],
        "review_state": draft["review_state"],
        "raw_text": draft["raw_transcription"],
        "uncertain_spans": draft.get("uncertain_spans", []),
        "transcribed_at": draft.get("transcribed_at"),
    }
    digest = hashlib.sha256(
        json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    candidate_outputs = dict(prelabel.get("candidate_outputs") or {})
    candidate_outputs["gpt_vision"] = candidate
    assisted = {
        item.get("provider"): item
        for item in prelabel.get("assisted_from", [])
        if isinstance(item, dict) and item.get("provider")
    }
    assisted[PROVIDER] = {"provider": PROVIDER, "draft_sha256": digest}
    notes = str(prelabel.get("reviewer_notes", "")).strip()
    notice = (
        "GPT vision-assisted Rx-only transcription imported; every character and "
        "structured medication field still requires human verification."
    )
    if notice not in notes:
        notes = f"{notes} {notice}".strip()
    return {
        **prelabel,
        "raw_transcription": draft["raw_transcription"],
        "flags": {
            **(prelabel.get("flags") or {}),
            "uncertain": True,
            "illegible": bool(draft.get("uncertain_spans")),
        },
        "reviewer_notes": notes,
        "assisted_from": [assisted[name] for name in sorted(assisted)],
        "candidate_outputs": candidate_outputs,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--drafts", type=Path, default=DEFAULT_DRAFTS)
    parser.add_argument("--record", action="append", help="Opaque record ID; repeat to select several")
    parser.add_argument("--check", action="store_true", help="Validate drafts without changing prelabels")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    drafts = validate_drafts(load_jsonl(args.drafts), manifest)
    if args.record:
        selected = set(args.record)
        drafts = [draft for draft in drafts if draft["record_id"] in selected]
        missing = selected - {draft["record_id"] for draft in drafts}
        if missing:
            raise ValueError(f"No GPT vision draft for: {', '.join(sorted(missing))}")

    for draft in drafts:
        record_id = draft["record_id"]
        prelabel_path = PRELABEL_ROOT / f"{record_id}.json"
        if not prelabel_path.exists():
            raise ValueError(f"{record_id}: generate provider prelabels before importing GPT drafts")
        prelabel = json.loads(prelabel_path.read_text(encoding="utf-8"))
        if prelabel.get("source_sha256") != draft["source_sha256"]:
            raise ValueError(f"{record_id}: prelabel source hash mismatch")
        merged = merge_draft(draft, prelabel)
        if not args.check:
            atomic_json(prelabel_path, merged)
        print(f"{'Validated' if args.check else 'Imported'} {record_id}")
    print(f"GPT vision drafts: {len(drafts)}; status remains {REVIEW_STATE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
