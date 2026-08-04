#!/usr/bin/env python3
"""Assemble a self-contained, blinded review package for the independent reviewer.

The reviewer receives a folder (or zip) containing only:

* the prescription images, renamed to their record identifier
* a manifest holding record id, image filename, and source hash
* a stdlib-only local server and a static web page
* start scripts and reviewer instructions

Everything that could break blinding is excluded by construction rather than by
policy: no prelabels, no model drafts, no primary-author annotations, and no
difficulty or split metadata. Original filenames such as ``Easy-1.jpeg`` and
``Hard33.jpg`` encode the difficulty stratum, so images are renamed on copy.

Usage:
    python tools/ocr_annotation/build_reviewer_package.py
    python tools/ocr_annotation/build_reviewer_package.py --zip --out dist/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
SAMPLES = ROOT / "samples"
APP = Path(__file__).resolve().parent / "reviewer_app"

# Fields that would leak a stratum or another reviewer's judgement to a blinded
# reviewer. Asserted against the emitted manifest so this cannot rot silently.
FORBIDDEN_KEYS = {
    "difficulty",
    "split",
    "writer_or_template_group",
    "language",
    "script",
    "image_quality",
    "duplicate_of",
    "duplicate_group_size",
    "included_in_metrics",
    "provenance",
    "approval_reference",
    "redistribution_basis",
}

START_WINDOWS = """@echo off
setlocal
cd /d "%~dp0"
echo Starting the Medora prescription review tool...
echo.
where py >nul 2>nul && (py -3 review_server.py & goto :eof)
where python >nul 2>nul && (python review_server.py & goto :eof)
echo Python 3 was not found on this computer.
echo Install it from https://www.python.org/downloads/ ^(tick "Add Python to PATH"^),
echo then double-click this file again.
pause
"""

START_UNIX = """#!/bin/sh
cd "$(dirname "$0")" || exit 1
echo "Starting the Medora prescription review tool..."
if command -v python3 >/dev/null 2>&1; then
  exec python3 review_server.py
fi
if command -v python >/dev/null 2>&1; then
  exec python review_server.py
fi
echo "Python 3 was not found. Install it from https://www.python.org/downloads/ and run this again."
read -r _
"""

REVIEWER_README = """# Prescription Rx review — instructions

Thank you for helping with this study. This takes about {minutes} minutes in total and
everything runs on your own computer.

## Start

**Windows** — double-click `START-WINDOWS.bat`
**macOS / Linux** — double-click `START-MAC-LINUX.command` (or run `./START-MAC-LINUX.command`)

A black window opens and your browser should load the tool automatically. If it does not,
open <http://127.0.0.1:8777> yourself. Leave the black window open while you work.

If your computer says Python is not installed, install it from
<https://www.python.org/downloads/> — on Windows tick **Add Python to PATH** during setup —
then start again.

## What you are asked to do

For each of the {count} prescription photographs, type out **only the Rx section**: the
list of prescribed medicines and their instructions.

**Include** everything written after the ℞ symbol: medicine names, strength, dose,
frequency, duration, route, quantity, and instructions.

**Do not include** the patient's name, age, sex, address, phone number or ID, the date,
the doctor's name, degrees or registration number, the clinic or hospital letterhead, the
signature, vital signs, or advice written outside the medicine list.

If you cannot read something, type `[illegible]` instead of guessing. If an image has no
readable Rx section at all, tick that box and move on.

The structured medicine table underneath the transcription is optional. It is genuinely
useful if you have the patience, but a clean free-text transcription is the priority.

## Important

Please do not use any OCR, AI, or automatic transcription tool, and please do not discuss
the images with anyone else working on this study. The whole point of this review is that
it is an independent human reading, so it can be compared against the automated system.

## Finishing

Your work saves automatically after every record and you can stop and resume whenever you
like. When you are done, click **Finish & export**, download the file, and email it back
to the study author.

That file contains your transcriptions and the registration details you entered. It does
not contain any images.

## Privacy

These are real prescriptions. The images stay on this computer — the tool has no internet
connection and uploads nothing. Please delete this folder once your review has been
confirmed as received.
"""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build(out_dir: Path, make_zip: bool) -> int:
    if not MANIFEST.exists():
        raise SystemExit("Corpus manifest missing; run tests/benchmarks/generate_ocr_manifest.py first.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    # Only records that actually count toward metrics; duplicates are excluded so the
    # reviewer is not asked to transcribe the same image twice.
    records = [item for item in manifest["records"] if item.get("included_in_metrics")]
    if not records:
        raise SystemExit("Manifest contains no records marked included_in_metrics.")

    package = out_dir / "medora-rx-review"
    if package.exists():
        shutil.rmtree(package)
    (package / "images").mkdir(parents=True)
    (package / "web").mkdir(parents=True)
    (package / "output").mkdir(parents=True)

    emitted = []
    for item in records:
        source = ROOT / item["file"]
        if not source.is_file():
            raise SystemExit(f"Missing image for {item['id']}: {source}")
        actual = sha256_file(source)
        if actual != item["sha256"]:
            raise SystemExit(
                f"{item['id']} hash mismatch: manifest says {item['sha256'][:12]}…, file is {actual[:12]}…"
            )
        # Rename on copy: the original filename encodes the difficulty stratum.
        target_name = f"{item['id']}{source.suffix.lower()}"
        shutil.copy2(source, package / "images" / target_name)
        emitted.append({"id": item["id"], "image": target_name, "source_sha256": item["sha256"]})

    package_id = hashlib.sha256(
        "".join(f"{r['id']}:{r['source_sha256']}" for r in emitted).encode("utf-8")
    ).hexdigest()[:16]

    reviewer_manifest = {
        "schema_version": "1.0.0",
        "package_id": package_id,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "scope": "rx_section_only",
        "records": emitted,
    }
    leaked = FORBIDDEN_KEYS & {key for record in emitted for key in record}
    if leaked:
        raise SystemExit(f"Blinding violation: reviewer manifest exposes {sorted(leaked)}")

    (package / "manifest.json").write_text(
        json.dumps(reviewer_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    shutil.copy2(APP / "review_server.py", package / "review_server.py")
    for asset in ("index.html", "app.js", "styles.css"):
        shutil.copy2(APP / asset, package / "web" / asset)

    (package / "START-WINDOWS.bat").write_text(START_WINDOWS, encoding="utf-8", newline="\r\n")
    unix_start = package / "START-MAC-LINUX.command"
    unix_start.write_text(START_UNIX, encoding="utf-8", newline="\n")
    unix_start.chmod(0o755)

    (package / "README-FOR-REVIEWER.md").write_text(
        REVIEWER_README.format(count=len(emitted), minutes=len(emitted) * 2), encoding="utf-8"
    )

    # Final assertion: nothing that breaks blinding may exist inside the package.
    banned = ("prelabel", "gpt_vision", "candidate_output", "primary.json", "adjudication")
    for path in package.rglob("*"):
        if path.is_file() and any(token in path.name.lower() for token in banned):
            raise SystemExit(f"Blinding violation: {path} would ship to the reviewer")

    print(f"Package built: {package}")
    print(f"  records : {len(emitted)}")
    print(f"  images  : renamed to record ids (original filenames encode difficulty)")
    print(f"  id      : {package_id}")

    if make_zip:
        archive = out_dir / "medora-rx-review.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            for path in sorted(package.rglob("*")):
                if path.is_file():
                    bundle.write(path, path.relative_to(out_dir))
        size_mb = archive.stat().st_size / (1024 * 1024)
        print(f"  zip     : {archive} ({size_mb:.1f} MB)")
        if size_mb > 20:
            print("  note    : too large for most email attachments; share via a link instead.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "dist")
    parser.add_argument("--zip", action="store_true", help="Also produce a zip for sharing")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    return build(args.out, args.zip)


if __name__ == "__main__":
    raise SystemExit(main())
