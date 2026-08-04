#!/usr/bin/env python3
"""Apply marked identifier regions to produce the redistributable image set.

Opaque fill, not blur. Blurring text is not a de-identification control: Gaussian
blur is a linear operation and is partially invertible by deconvolution, and for a
constrained character set a blurred name can be recovered by rendering candidates
and matching. Pixelation has the same weakness at the block sizes people actually
use. A solid fill destroys the pixels outright and is the only variant that can be
defended in writing.

Originals are never modified. Redacted copies are written to a separate directory
and the originals stay out of the public deposit.

Redaction removes *direct identifiers*. It does not make the corpus anonymous:
handwriting is quasi-biometric, and letterhead layout, dates, and medication
combinations remain. The manuscript language must stay bounded accordingly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
MARKS = ROOT / "tests" / "benchmarks" / "redaction_marks"
DEFAULT_OUT = ROOT / "samples_redacted"
REPORT = ROOT / "tests" / "benchmarks" / "reports" / "redaction_report.json"

# Boxes are drawn by hand at display scale; a small outward margin absorbs the
# imprecision so a descender or an edge stroke does not survive.
MARGIN = 0.004


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def apply_one(source: Path, marks: dict, destination: Path) -> dict:
    with Image.open(source) as handle:
        image = handle.convert("RGB")
        width, height = image.size
        draw = ImageDraw.Draw(image)
        for box in marks.get("boxes", []):
            left = max(0, int((box["x"] - MARGIN) * width))
            top = max(0, int((box["y"] - MARGIN) * height))
            right = min(width, int((box["x"] + box["w"] + MARGIN) * width))
            bottom = min(height, int((box["y"] + box["h"] + MARGIN) * height))
            if right > left and bottom > top:
                draw.rectangle([left, top, right, bottom], fill=(0, 0, 0))
        destination.parent.mkdir(parents=True, exist_ok=True)
        # Re-encode without EXIF: camera metadata carries device, timestamp, and
        # sometimes GPS, all of which are identifiers in their own right.
        image.save(destination, quality=95, optimize=True)
    return {
        "boxes_applied": len(marks.get("boxes", [])),
        "categories_absent": marks.get("categories_absent", []),
        # Carried into the report so the published set states which identifier fields
        # were deliberately retained, rather than leaving that to be inferred.
        "scope_policy": marks.get("scope_policy"),
        "width": width,
        "height": height,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--check", action="store_true", help="Report readiness; write nothing")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = manifest["records"]

    missing = [item["id"] for item in records if not (MARKS / f"{item['id']}.json").exists()]
    if missing:
        print(f"{len(missing)} of {len(records)} image(s) have no redaction marks.")
        print(f"  first missing: {', '.join(missing[:8])}{'…' if len(missing) > 8 else ''}")
        print("  Run: python tools/redaction/redact_server.py")
        return 2

    stale = []
    for item in records:
        marks = json.loads((MARKS / f"{item['id']}.json").read_text(encoding="utf-8"))
        if marks.get("source_sha256") != item["sha256"]:
            stale.append(item["id"])
    if stale:
        print(f"marks were made against a different image for: {', '.join(stale[:8])}")
        return 2

    if args.check:
        print(f"All {len(records)} images have marks bound to the current source hashes.")
        return 0

    entries = []
    for item in records:
        marks = json.loads((MARKS / f"{item['id']}.json").read_text(encoding="utf-8"))
        source = ROOT / item["file"]
        destination = args.out / f"{item['id']}{source.suffix.lower()}"
        applied = apply_one(source, marks, destination)
        redacted_hash = sha256_file(destination)
        if redacted_hash == item["sha256"]:
            # Identical bytes mean nothing was covered and nothing was re-encoded.
            print(f"{item['id']}: redacted output is byte-identical to the original; refusing.")
            return 2
        entries.append(
            {
                "record_id": item["id"],
                "original_sha256": item["sha256"],
                "redacted_sha256": redacted_hash,
                "redacted_file": str(destination.relative_to(ROOT)).replace("\\", "/"),
                **applied,
            }
        )

    report = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "opaque_fill",
        "margin_fraction": MARGIN,
        "records": len(entries),
        "total_boxes": sum(item["boxes_applied"] for item in entries),
        "images_with_no_boxes": [item["record_id"] for item in entries if item["boxes_applied"] == 0],
        "limitations": [
            "Removes marked direct identifiers only; does not constitute anonymization.",
            "Handwriting remains and is quasi-biometric.",
            "Letterhead layout, dates, and medication combinations can still support re-identification.",
            "Rx regions and page layout are deliberately preserved so region-detection ablations stay meaningful.",
        ],
        "entries": entries,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Redacted {len(entries)} images -> {args.out.relative_to(ROOT)}")
    print(f"  boxes applied : {report['total_boxes']}")
    if report["images_with_no_boxes"]:
        print(f"  no boxes on   : {len(report['images_with_no_boxes'])} image(s) — confirm that is correct")
    print(f"  report        : {REPORT.relative_to(ROOT)}")
    print()
    print("Every source hash has changed. The cached provider responses, prelabels,")
    print("GPT drafts, and corpus manifest were all computed against the originals and")
    print("must be regenerated against these images before any of them can be published.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
