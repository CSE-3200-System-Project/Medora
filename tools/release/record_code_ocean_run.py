#!/usr/bin/env python3
"""Record the public, final Code Ocean run receipt after downloading its manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
METADATA = ROOT / "docs/softwarex/release_metadata.json"
REQUIRED_OUTPUTS = {
    "safety_results.json",
    "booking_results.json",
    "safety_results.tex",
    "booking_results.tex",
    "fixture-tests.xml",
    "privacy_extension_results.json",
    "consent_scope_results.json",
    "extended_results.tex",
    "archived_observation_verification.json",
    "current_safety_results.json",
    "current_booking_results.json",
    "booking-tests.xml",
    "model_execution_coverage.json",
    "requirements-resolved.txt",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="downloaded /results/reproduction_manifest.json")
    parser.add_argument("--capsule-url", required=True, help="stable public capsule URL, not an owner-only review link")
    parser.add_argument("--capsule-version", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--doi", help="published Code Ocean DOI, if one has been minted")
    args = parser.parse_args()

    parsed = urlparse(args.capsule_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"codeocean.com", "www.codeocean.com"}
        or not parsed.path.startswith("/capsule/")
        or parsed.query
        or parsed.fragment
    ):
        raise SystemExit("capsule-url must be a reader-accessible https://codeocean.com/capsule/... URL")
    if args.doi and not re.fullmatch(r"10\.\d{4,9}/\S+", args.doi):
        raise SystemExit("--doi must be a valid DOI identifier without https://doi.org/")

    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        raise SystemExit(f"manifest does not exist: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if manifest.get("source_commit") != commit:
        raise SystemExit("Code Ocean manifest source_commit does not match the final candidate HEAD")
    if manifest.get("ai_provider") != "deterministic mock":
        raise SystemExit("the SoftwareX capsule run must use the deterministic mock")
    missing = sorted(REQUIRED_OUTPUTS - set(manifest.get("artifacts", {})))
    if missing:
        raise SystemExit("Code Ocean manifest is missing output hashes: " + ", ".join(missing))
    for name, expected in manifest["artifacts"].items():
        path = (manifest_path.parent / name).resolve()
        if path.parent != manifest_path.parent or not path.is_file():
            raise SystemExit("download all /results files beside the manifest; missing/unsafe artifact: " + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise SystemExit("downloaded artifact hash mismatch: " + name)
    booking = json.loads((manifest_path.parent / "current_booking_results.json").read_text(encoding="utf-8"))
    if not booking.get("passed") or len(booking.get("results", [])) != 3:
        raise SystemExit("current booking experiment did not complete")

    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    citation_version = re.search(r'^version:\s*"?([^"\s]+)"?\s*$', citation, re.M)
    if not citation_version or metadata.get("version") != f"v{citation_version.group(1)}":
        raise SystemExit("CITATION.cff and release_metadata.json versions disagree")

    destination = ROOT / "docs/softwarex/generated/code_ocean" / f"reproduction_manifest_{commit[:12]}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    copied = manifest_path.read_bytes()
    if destination.exists() and destination.read_bytes() != copied:
        raise SystemExit(f"refusing to overwrite a different capsule receipt: {destination.relative_to(ROOT)}")
    if not destination.exists():
        destination.write_bytes(copied)

    metadata["code_ocean"] = {
        "capsule_url": args.capsule_url,
        "doi": args.doi,
        "version": args.capsule_version,
        "run_id": args.run_id,
        "source_commit": commit,
        "manifest_path": destination.relative_to(ROOT).as_posix(),
        "manifest_sha256": hashlib.sha256(copied).hexdigest(),
    }
    METADATA.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Recorded capsule {args.capsule_url} version {args.capsule_version}")
    print(f"Run ID: {args.run_id}; source commit: {commit}")
    print(f"Manifest: {destination.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
