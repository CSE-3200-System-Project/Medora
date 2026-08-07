#!/usr/bin/env python3
"""Prepare everything the Zenodo deposit needs except the deposit itself.

M-C1 wants a fixed archived release with a DOI and a checksum. The deposit is a manual,
authenticated step, but everything around it is mechanical: build the archive from the
exact commit that was verified, hash it, and turn `CITATION.cff` into a Zenodo
deposition record. This does that, so the release manager is left with "upload, then
paste the DOI back".

    backend/venv/Scripts/python.exe tools/release/build_zenodo_deposit.py

Refuses to run on a dirty tree. The archive has to be the commit that
`verification.json` refers to, or the checksum in `release_metadata.json` describes
something nobody tested.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "softwarex"
DIST = ROOT / "dist"

# Zenodo's licence vocabulary uses SPDX identifiers in lower case.
SPDX_TO_ZENODO = {"MIT": "mit", "Apache-2.0": "apache-2.0", "BSD-3-Clause": "bsd-3-clause"}


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def read_citation() -> dict:
    """Parse the handful of CITATION.cff fields we need without a YAML dependency."""
    text = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    citation: dict = {"authors": [], "keywords": []}
    for key in ("title", "version", "license", "repository-code"):
        match = re.search(rf"^{key}:\s*\"?(.+?)\"?\s*$", text, re.M)
        if match:
            citation[key] = match.group(1)

    author_block = re.search(r"^authors:\n((?:\s+-.*\n|\s{4}.*\n)+)", text, re.M)
    if author_block:
        current: dict = {}
        for line in author_block.group(1).splitlines():
            stripped = line.strip()
            if stripped.startswith("- "):
                if current:
                    citation["authors"].append(current)
                current = {}
                stripped = stripped[2:]
            if ":" in stripped:
                field, _, value = stripped.partition(":")
                current[field.strip()] = value.strip().strip('"')
        if current:
            citation["authors"].append(current)

    keyword_block = re.search(r"^keywords:\n((?:\s+-.*\n)+)", text, re.M)
    if keyword_block:
        citation["keywords"] = [line.strip()[2:].strip('"') for line in keyword_block.group(1).splitlines()]

    abstract = re.search(r"^abstract: >-\n((?:\s{2,}.*\n?)+)", text, re.M)
    if abstract:
        citation["abstract"] = " ".join(line.strip() for line in abstract.group(1).splitlines()).strip()
    return citation


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="build anyway; the checksum will not describe the verified commit",
    )
    args = parser.parse_args()

    # These four cannot be clean at this point and that is not a mistake: recording the
    # nine checks is what rewrites each of them.
    #
    #   verification.json  must name HEAD, so committing it always leaves it one commit
    #                      behind itself.
    #   release_metadata.json  is rewritten by this script a few lines below.
    #   sw.js              is Serwist output whose precache manifest carries a fresh
    #                      revision token on every build, so two builds of identical
    #                      source differ by one line. Consumers rebuild it anyway.
    #   booking_results.json  carries the timings of the run that just happened.
    #
    # Everything else has to be committed or the checksum describes a tree nobody
    # verified.
    EXPECTED_DIRTY = {
        "docs/softwarex/generated/verification.json",
        "docs/softwarex/release_metadata.json",
        "frontend/public/sw.js",
        "tests/benchmarks/reports/current/booking_results.json",
    }

    dirty = [
        line
        for line in git("status", "--porcelain").splitlines()
        if line and not line.startswith("??") and line[3:].strip().strip('"') not in EXPECTED_DIRTY
    ]
    if dirty and not args.allow_dirty:
        print("working tree has uncommitted tracked changes; the archive would not match the commit:", file=sys.stderr)
        for line in dirty:
            print(f"  {line}", file=sys.stderr)
        print("\nCommit them (verification.json and release_metadata.json are the usual pair),", file=sys.stderr)
        print("re-record the nine checks on that commit, then run this again.", file=sys.stderr)
        return 2

    commit = git("rev-parse", "HEAD")
    citation = read_citation()
    version = citation.get("version", "1.0.0")

    DIST.mkdir(exist_ok=True)
    archive = DIST / f"medora-v{version}-{commit[:8]}.zip"
    subprocess.check_call(["git", "archive", "--format=zip", f"--prefix=medora-v{version}/", "-o", str(archive), commit], cwd=ROOT)

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()

    deposition = {
        "metadata": {
            "upload_type": "software",
            "title": citation.get("title", "Medora"),
            "creators": [
                {"name": f"{author.get('family-names', '')}, {author.get('given-names', '')}".strip(", ")}
                for author in citation["authors"]
            ],
            "description": citation.get("abstract", ""),
            "keywords": citation["keywords"],
            "license": SPDX_TO_ZENODO.get(citation.get("license", "MIT"), "mit"),
            "version": f"v{version}",
            "publication_date": date.today().isoformat(),
            "related_identifiers": [
                {"relation": "isSupplementTo", "identifier": citation.get("repository-code", ""), "scheme": "url"}
            ],
            "notes": (
                "Research software. Not a clinically validated medical device. "
                "The prescription image corpus is not included in this archive; see samples/DATA_USE_NOTICE.md."
            ),
        }
    }
    (DOCS / "zenodo_deposition.json").write_text(json.dumps(deposition, indent=2) + "\n", encoding="utf-8")

    metadata_path = DOCS / "release_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["git_commit"] = commit
    metadata["release_date"] = date.today().isoformat()
    metadata["archive_path"] = str(archive.relative_to(ROOT)).replace("\\", "/")
    metadata["archive_sha256"] = digest
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"archive     {archive.relative_to(ROOT)}  ({archive.stat().st_size:,} bytes)")
    print(f"sha256      {digest}")
    print(f"commit      {commit}")
    print(f"deposition  {(DOCS / 'zenodo_deposition.json').relative_to(ROOT)}")
    print()
    print("Remaining manual steps, in order:")
    print(f"  1. git tag -a v{version} -m 'Medora v{version}' {commit[:8]} && git push origin v{version}")
    print("  2. Upload the archive to https://zenodo.org/uploads/new using the deposition record above.")
    print("  3. Publish, then put the DOI in release_metadata.json as zenodo_doi and zenodo_url.")
    print("  4. python tools/release/build_release_artifacts.py --booking ... --safety ...   (writes release_metadata.tex)")
    print("  5. Rebuild the manuscript so \\ReleaseDOI resolves, then re-run check_softwarex_release.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
