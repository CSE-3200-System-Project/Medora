#!/usr/bin/env python3
"""Validate and import a returned independent-review bundle.

Consumes the single JSON file the reviewer downloads from the review package and
writes ``tests/benchmarks/annotations/<RX-id>/independent.json`` for each record.

Every check that ``build_ocr_gold_standard.py`` will later enforce is applied here
so problems surface when the file arrives, not weeks later at the release gate:

* source hash matches the corpus manifest
* credential role is licensed_clinician or licensed_pharmacist
* the independent reviewer is not the primary reviewer
* no assisted/model-derived provenance is attached
* every record marked included_in_metrics is present

Usage:
    python tools/ocr_annotation/import_independent_review.py review.json --check
    python tools/ocr_annotation/import_independent_review.py review.json
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
ANNOTATIONS = ROOT / "tests" / "benchmarks" / "annotations"
ELIGIBLE_ROLES = {"licensed_clinician", "licensed_pharmacist"}


def atomic_write(destination: Path, payload: object) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent, delete=False, suffix=".tmp") as stream:
        stream.write(rendered)
        stream.flush()
        os.fsync(stream.fileno())
        temporary = Path(stream.name)
    os.replace(temporary, destination)


def validate(bundle: dict) -> tuple[list[dict], list[str]]:
    problems: list[str] = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {item["id"]: item for item in manifest["records"] if item.get("included_in_metrics")}

    reviewer = bundle.get("reviewer") or {}
    reviewer_id = str(reviewer.get("id", "")).strip()
    if not reviewer_id:
        problems.append("reviewer.id is missing")
    if reviewer.get("credential_role") not in ELIGIBLE_ROLES:
        problems.append(
            f"reviewer.credential_role is {reviewer.get('credential_role')!r}; "
            f"must be one of {sorted(ELIGIBLE_ROLES)}"
        )
    if not reviewer.get("attestation_accepted"):
        problems.append("reviewer did not accept the independence attestation")
    if not str(reviewer.get("registration_number", "")).strip():
        problems.append("reviewer.registration_number is missing")
    reviewer["role"] = "independent"

    annotations = bundle.get("annotations") or []
    seen = {item.get("record_id") for item in annotations}
    missing = sorted(set(expected) - seen)
    if missing:
        problems.append(f"{len(missing)} record(s) not reviewed: {', '.join(missing[:8])}{'…' if len(missing) > 8 else ''}")
    unexpected = sorted(seen - set(expected))
    if unexpected:
        problems.append(f"unknown record ids in bundle: {', '.join(unexpected[:8])}")

    prepared: list[dict] = []
    for item in annotations:
        record_id = item.get("record_id")
        record = expected.get(record_id)
        if record is None:
            continue
        if item.get("source_sha256") != record["sha256"]:
            problems.append(f"{record_id}: source hash mismatch")
            continue
        if item.get("assisted_from"):
            problems.append(f"{record_id}: carries assisted provenance and cannot be an independent label")
            continue
        text = str(item.get("raw_transcription", "")).strip()
        no_rx = bool((item.get("flags") or {}).get("no_rx_section"))
        if not text and not no_rx:
            problems.append(f"{record_id}: empty transcription without a no-Rx-section flag")
            continue

        # Cross-check against the primary label if one already exists.
        primary_path = ANNOTATIONS / record_id / "primary.json"
        if primary_path.exists():
            primary = json.loads(primary_path.read_text(encoding="utf-8"))
            if str(primary.get("reviewer", {}).get("id", "")).strip() == reviewer_id:
                problems.append(f"{record_id}: independent reviewer is the same person as the primary reviewer")
                continue

        prepared.append(
            {
                "schema_version": "1.0.0",
                "record_id": record_id,
                "source_sha256": record["sha256"],
                "reviewer": reviewer,
                "scope": item.get("scope", "rx_section_only"),
                "raw_transcription": text,
                "boxes": item.get("boxes", []),
                "medications": item.get("medications", []),
                "language": "unreviewed",
                "script": "unreviewed",
                "image_quality": {
                    "blur": "unreviewed",
                    "rotation": "unreviewed",
                    "contrast": "unreviewed",
                    "occlusion": "unreviewed",
                },
                "flags": item.get("flags", {}),
                "omissions": item.get("omissions", ""),
                "reviewer_notes": item.get("reviewer_notes", ""),
                "review_state": "independent_human_review",
            }
        )
    return prepared, problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path, help="JSON file returned by the reviewer")
    parser.add_argument("--check", action="store_true", help="Validate only; write nothing")
    parser.add_argument("--allow-partial", action="store_true", help="Import a partial review")
    args = parser.parse_args()

    bundle = json.loads(args.bundle.read_text(encoding="utf-8"))
    prepared, problems = validate(bundle)

    blocking = [p for p in problems if "not reviewed" not in p] if args.allow_partial else problems
    if blocking:
        print("Independent review bundle rejected:")
        for problem in blocking:
            print(f" - {problem}")
        return 2

    reviewer = bundle["reviewer"]
    print(f"Validated {len(prepared)} independent labels")
    print(f"  reviewer   : {reviewer['id']} ({reviewer['credential_role']}, reg {reviewer['registration_number']})")
    if args.check:
        print("Check only; nothing written.")
        return 0

    for item in prepared:
        atomic_write(ANNOTATIONS / item["record_id"] / "independent.json", item)
    print(f"Wrote {len(prepared)} files under {ANNOTATIONS.relative_to(ROOT)}")
    print("Next: complete the primary pass and adjudication, then run freeze_ocr_manifest.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
