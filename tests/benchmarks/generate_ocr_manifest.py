#!/usr/bin/env python3
"""Create a deterministic inventory and frozen development/test split."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "samples"
OUTPUT = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
EXPECTED_FILES = 105
EXPECTED_UNIQUE = 103
DEV_TARGETS = {"easy": 8, "medium": 7, "hard": 6}


def natural_key(path: Path) -> tuple[str, int, str]:
    match = re.search(r"(easy|medium|hard)[- ]?(\d+)", path.stem, re.IGNORECASE)
    if not match:
        raise ValueError(f"Unrecognized sample name: {path.name}")
    return match.group(1).lower(), int(match.group(2)), path.name.lower()


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def build_manifest() -> dict:
    paths = sorted(
        (path for path in SAMPLES.iterdir() if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}),
        key=natural_key,
    )
    if len(paths) != EXPECTED_FILES:
        raise RuntimeError(f"Expected {EXPECTED_FILES} images, found {len(paths)}")

    hashes = {path: digest(path) for path in paths}
    groups: dict[str, list[Path]] = defaultdict(list)
    for path, sha256 in hashes.items():
        groups[sha256].append(path)
    if len(groups) != EXPECTED_UNIQUE:
        raise RuntimeError(f"Expected {EXPECTED_UNIQUE} unique images, found {len(groups)}")

    canonical_for_hash = {sha: min(items, key=natural_key) for sha, items in groups.items()}
    unique_by_difficulty: dict[str, list[Path]] = defaultdict(list)
    for canonical in canonical_for_hash.values():
        unique_by_difficulty[natural_key(canonical)[0]].append(canonical)

    development: set[str] = set()
    for difficulty, target in DEV_TARGETS.items():
        ranked = sorted(
            unique_by_difficulty[difficulty],
            key=lambda path: hashlib.sha256(f"medora-softwarex-v1:{hashes[path]}".encode()).hexdigest(),
        )
        development.update(hashes[path] for path in ranked[:target])

    records = []
    for index, path in enumerate(paths, 1):
        sha256 = hashes[path]
        group = sorted(groups[sha256], key=natural_key)
        canonical = canonical_for_hash[sha256]
        duplicate_of = None if path == canonical else f"RX-{paths.index(canonical) + 1:04d}"
        records.append(
            {
                "id": f"RX-{index:04d}",
                "file": f"samples/{path.name}",
                "sha256": sha256,
                "bytes": path.stat().st_size,
                "difficulty": natural_key(path)[0],
                "language": "unreviewed",
                "script": "unreviewed",
                "image_quality": {
                    "blur": "unreviewed",
                    "rotation": "unreviewed",
                    "contrast": "unreviewed",
                    "occlusion": "unreviewed",
                },
                "provenance": "author-curated public prescription corpus",
                "redistribution_basis": "written approval confirmed by authors",
                "approval_reference": "RELEASE_GATE: enter authority/date/reference from approval record",
                "writer_or_template_group": "unassigned",
                "duplicate_of": duplicate_of,
                "duplicate_group_size": len(group),
                "included_in_metrics": path == canonical,
                "split": None if path != canonical else ("development" if sha256 in development else "test"),
            }
        )

    unique_records = [item for item in records if item["included_in_metrics"]]
    counts = Counter(str(item["split"]) for item in unique_records)
    if counts != Counter({"test": 82, "development": 21}):
        raise RuntimeError(f"Unexpected split counts: {dict(counts)}")
    duplicates = [[f"samples/{path.name}" for path in items] for items in groups.values() if len(items) > 1]
    return {
        "schema_version": "1.0.0",
        "corpus_version": "medora-rx-2026-08-01",
        "split_seed": "medora-softwarex-v1",
        "frozen": False,
        "freeze_blockers": [
            "writer_or_template_group must be reviewed",
            "language/script and image-quality attributes must be reviewed",
            "approval authority/date/reference must replace the release-gate marker",
        ],
        "counts": {"files": len(records), "unique": len(unique_records), "development": 21, "test": 82},
        "duplicate_groups": sorted(duplicates),
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if the committed manifest differs")
    args = parser.parse_args()
    rendered = json.dumps(build_manifest(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != rendered:
            raise SystemExit("OCR corpus manifest is missing or stale; regenerate without --check")
        print(f"Verified {OUTPUT.relative_to(ROOT)}")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(rendered, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
