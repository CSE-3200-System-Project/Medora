#!/usr/bin/env python3
"""Freeze reviewed OCR metadata and a deterministic group-preserving split."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests/benchmarks/datasets/ocr_corpus_manifest.json"
ANNOTATIONS = ROOT / "tests/benchmarks/annotations"
RECEIPT = ROOT / "tests/benchmarks/reports/ocr_manifest_freeze_receipt.json"
DIFFICULTY_TARGET = {"easy": 8, "medium": 7, "hard": 6}
LANGUAGES = ("bn", "en", "mixed", "other")
QUALITY_FIELDS = ("blur", "rotation", "contrast", "occlusion")
GROUP_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
IDENTIFYING_GROUP_TERMS = re.compile(r"(?:doctor|dr[._-]|patient|clinic|hospital|name)", re.I)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_annotation(record_id: str, role: str) -> dict:
    path = ANNOTATIONS / record_id / f"{role}.json"
    if not path.is_file():
        raise ValueError(f"{record_id}: missing {role} annotation")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_approval_day(value: str) -> str:
    parsed = date.fromisoformat(value)
    if parsed > date.today():
        raise ValueError("approval date cannot be in the future")
    return parsed.isoformat()


def reviewed_metadata(record: dict) -> dict:
    record_id = record["id"]
    primary = load_annotation(record_id, "primary")
    independent = load_annotation(record_id, "independent")
    adjudication = load_annotation(record_id, "adjudication")
    for role, label in (("primary", primary), ("independent", independent), ("adjudication", adjudication)):
        if label.get("source_sha256") != record["sha256"]:
            raise ValueError(f"{record_id}: {role} source hash does not match the manifest")
    if primary.get("reviewer", {}).get("id") == independent.get("reviewer", {}).get("id"):
        raise ValueError(f"{record_id}: primary and independent reviewers must differ")
    if independent.get("reviewer", {}).get("credential_role") not in {"licensed_clinician", "licensed_pharmacist"}:
        raise ValueError(f"{record_id}: independent reviewer is not an eligible licensed reviewer")
    decision = adjudication.get("adjudication", {})
    if decision.get("state") != "adjudicated" or decision.get("unresolved_fields"):
        raise ValueError(f"{record_id}: adjudication is incomplete")

    language = str(adjudication.get("language") or "")
    script = str(adjudication.get("script") or "")
    group = str(adjudication.get("writer_or_template_group") or "").strip()
    quality = adjudication.get("image_quality") or {}
    if language not in LANGUAGES:
        raise ValueError(f"{record_id}: language must be one of {', '.join(LANGUAGES)}")
    if script not in {"bengali", "latin", "mixed"}:
        raise ValueError(f"{record_id}: script is unreviewed or invalid")
    if not GROUP_PATTERN.fullmatch(group) or IDENTIFYING_GROUP_TERMS.search(group):
        raise ValueError(f"{record_id}: use a non-identifying opaque writer/template group")
    if any(not quality.get(field) or quality.get(field) == "unreviewed" for field in QUALITY_FIELDS):
        raise ValueError(f"{record_id}: every image-quality field must be reviewed")
    return {"language": language, "script": script, "writer_or_template_group": group, "image_quality": quality}


def choose_development_groups(records: list[dict], seed: str) -> set[str]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        grouped[record["writer_or_template_group"]].append(record)
    groups = sorted(grouped, key=lambda value: hashlib.sha256(f"{seed}:{value}".encode()).hexdigest())
    language_totals = Counter(item["language"] for item in records)
    expected_language = {name: 21 * language_totals[name] / len(records) for name in LANGUAGES}

    def composition_score(state: tuple[int, ...], selected: tuple[str, ...]) -> tuple[float, tuple[str, ...]]:
        total = max(state[0], 1)
        progress = total / 21
        difficulty_error = sum((state[index] - DIFFICULTY_TARGET[name] * progress) ** 2 for index, name in enumerate(("easy", "medium", "hard"), 1))
        language_error = sum((state[index] - expected_language[name] * progress) ** 2 for index, name in enumerate(LANGUAGES, 4))
        return difficulty_error * 100 + language_error, selected

    # State is (total, easy, medium, hard, bn, en, mixed, other). Keeping a single
    # deterministic path per identical composition is an exact grouped subset DP.
    empty = (0, 0, 0, 0, 0, 0, 0, 0)
    states: dict[tuple[int, ...], tuple[str, ...]] = {empty: ()}
    for group in groups:
        members = grouped[group]
        counts = Counter(item["difficulty"] for item in members)
        languages = Counter(item["language"] for item in members)
        delta = (
            len(members), counts["easy"], counts["medium"], counts["hard"],
            languages["bn"], languages["en"], languages["mixed"], languages["other"],
        )
        additions: dict[tuple[int, ...], tuple[str, ...]] = {}
        for state, selected in states.items():
            candidate = tuple(left + right for left, right in zip(state, delta))
            if candidate[0] <= 21 and candidate not in states and candidate not in additions:
                additions[candidate] = (*selected, group)
        states.update(additions)
        # Preserve a diverse, deterministic beam for each attainable record count.
        # Reachability depends only on the count because all paths see the same
        # remaining groups; the beam affects stratification quality, not whether an
        # exact 21-record grouped subset can be found.
        by_total: dict[int, list[tuple[tuple[int, ...], tuple[str, ...]]]] = defaultdict(list)
        for state, selected in states.items():
            by_total[state[0]].append((state, selected))
        states = {
            state: selected
            for candidates in by_total.values()
            for state, selected in sorted(candidates, key=lambda item: composition_score(*item))[:512]
        }

    candidates = [(state, selected) for state, selected in states.items() if state[0] == 21]
    if not candidates:
        sizes = sorted(len(items) for items in grouped.values())
        raise ValueError(f"writer/template groups cannot form exactly 21 development records; group sizes={sizes}")

    def score(item: tuple[tuple[int, ...], tuple[str, ...]]) -> tuple[float, tuple[str, ...]]:
        state, selected = item
        difficulty_error = sum((state[index] - DIFFICULTY_TARGET[name]) ** 2 for index, name in enumerate(("easy", "medium", "hard"), 1))
        language_error = sum((state[index] - expected_language[name]) ** 2 for index, name in enumerate(LANGUAGES, 4))
        return difficulty_error * 100 + language_error, selected

    return set(min(candidates, key=score)[1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--approval-authority", required=True)
    parser.add_argument("--approval-date", required=True, type=validate_approval_day)
    parser.add_argument("--approval-reference", required=True)
    parser.add_argument(
        "--approval-scope",
        default="Permanent public download and inclusion in the Zenodo software archive",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate and show the proposed split without writing")
    args = parser.parse_args()
    for name, value in (
        ("authority", args.approval_authority),
        ("reference", args.approval_reference),
        ("scope", args.approval_scope),
    ):
        if not value.strip() or "RELEASE_PENDING" in value:
            raise SystemExit(f"approval {name} must be the verified release value")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("frozen"):
        raise SystemExit("manifest is already frozen; do not silently replace a frozen corpus")
    records = manifest.get("records", [])
    unique = [record for record in records if record.get("included_in_metrics")]
    if len(records) != 105 or len(unique) != 103:
        raise SystemExit("manifest must contain 105 files and 103 unique metric records")

    by_id = {record["id"]: record for record in records}
    for record in unique:
        record.update(reviewed_metadata(record))
    for record in records:
        if record.get("included_in_metrics"):
            continue
        canonical = by_id.get(record.get("duplicate_of"))
        if canonical is None or canonical["sha256"] != record["sha256"]:
            raise SystemExit(f"{record['id']}: invalid duplicate mapping")
        for field in ("language", "script", "writer_or_template_group", "image_quality"):
            record[field] = canonical[field]

    development_groups = choose_development_groups(unique, manifest["split_seed"])
    for record in records:
        record["split"] = None if not record.get("included_in_metrics") else (
            "development" if record["writer_or_template_group"] in development_groups else "test"
        )
        record["approval_reference"] = args.approval_reference.strip()
    development = [record for record in unique if record["split"] == "development"]
    test = [record for record in unique if record["split"] == "test"]
    if len(development) != 21 or len(test) != 82:
        raise SystemExit("internal split error: expected 21 development and 82 test records")
    if {record["writer_or_template_group"] for record in development} & {record["writer_or_template_group"] for record in test}:
        raise SystemExit("internal split error: a writer/template group crosses splits")

    manifest["frozen"] = True
    manifest["freeze_blockers"] = []
    manifest["approval"] = {
        "authority": args.approval_authority.strip(),
        "date": args.approval_date,
        "reference": args.approval_reference.strip(),
        "scope": args.approval_scope.strip(),
    }
    manifest["split_protocol"] = {
        "unit": "writer_or_template_group",
        "development_records": 21,
        "test_records": 82,
        "selection": "deterministic exact grouped subset; difficulty prioritized, language secondarily stratified",
        "development_difficulty": dict(Counter(record["difficulty"] for record in development)),
        "development_language": dict(Counter(record["language"] for record in development)),
    }
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    proposed_hash = hashlib.sha256(rendered.encode("utf-8")).hexdigest()
    print(json.dumps({"development": 21, "test": 82, "groups": len(set(record["writer_or_template_group"] for record in unique)), "proposed_sha256": proposed_hash}, indent=2))
    if args.dry_run:
        return 0

    MANIFEST.write_text(rendered, encoding="utf-8")
    receipt = {
        "schema_version": "1.0.0",
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(MANIFEST.relative_to(ROOT)).replace("\\", "/"),
        "manifest_sha256": file_sha256(MANIFEST),
        "approval": manifest["approval"],
        "split_protocol": manifest["split_protocol"],
        "development_groups": sorted(development_groups),
    }
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Frozen {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
