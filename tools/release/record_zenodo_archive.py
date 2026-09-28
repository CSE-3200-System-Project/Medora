#!/usr/bin/env python3
"""Bind the downloaded Zenodo file to the local SoftwareX release receipt.

Run only after the exact release ZIP has been downloaded from its published Zenodo
record. This verifies the public record's version, DOI, file checksum, then records the
downloaded copy's path and SHA-256 for the final release gate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
METADATA = ROOT / "docs/softwarex/release_metadata.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("downloaded_archive", type=Path, help="downloaded ZIP from the published Zenodo record")
    args = parser.parse_args()

    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    archive_path = args.downloaded_archive.resolve()
    if not archive_path.is_file():
        raise SystemExit(f"downloaded archive does not exist: {archive_path}")
    try:
        relative = archive_path.relative_to(ROOT)
    except ValueError:
        raise SystemExit("place the downloaded archive under this repository (normally dist/) so CI can verify it")

    record_match = re.search(r"/records/(\d+)", str(metadata.get("zenodo_url", "")))
    if not record_match:
        raise SystemExit("release_metadata.json zenodo_url must identify the published record")
    api_url = f"https://zenodo.org/api/records/{record_match.group(1)}"
    request = urllib.request.Request(api_url, headers={"User-Agent": "Medora-release-check/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        record = json.load(response)

    if record.get("doi") != metadata.get("zenodo_doi"):
        raise SystemExit("published Zenodo DOI does not match release_metadata.json")
    if record.get("metadata", {}).get("version") != metadata.get("version"):
        raise SystemExit("published Zenodo version does not match release_metadata.json")

    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    md5 = hashlib.md5(archive_path.read_bytes(), usedforsecurity=False).hexdigest()
    matching_files = [
        file for file in record.get("files", [])
        if file.get("checksum", "").casefold() == f"md5:{md5}".casefold()
    ]
    if len(matching_files) != 1:
        raise SystemExit("downloaded archive checksum must match exactly one file in the published Zenodo record")

    metadata["archive_path"] = relative.as_posix()
    metadata["archive_sha256"] = digest
    metadata["zenodo_file_md5"] = md5
    metadata["archive_note"] = (
        "archive_path is the file downloaded back from the published Zenodo record; "
        "SHA-256 and the public Zenodo MD5 were verified by record_zenodo_archive.py."
    )
    METADATA.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # The external evidence manifest carries the downloaded archive checksum. Refresh
    # its artifact hashes now that the post-deposit release metadata has changed, and
    # add all detached capsule/verification receipts that the archive builder injected.
    evidence_path = ROOT / "docs/softwarex/generated/evidence_manifest.json"
    if not evidence_path.is_file():
        raise SystemExit("generated/evidence_manifest.json is missing; rebuild release evidence before recording the archive")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    identity = evidence.setdefault("release_identity", {})
    identity.update(
        version=metadata.get("version"),
        git_commit=metadata.get("git_commit"),
        zenodo_doi=metadata.get("zenodo_doi"),
        archive_sha256=digest,
    )
    artifacts = evidence.setdefault("artifacts", {})
    extra_receipts = ["docs/softwarex/generated/verification.json"]
    capsule_manifest = (metadata.get("code_ocean") or {}).get("manifest_path")
    if capsule_manifest:
        extra_receipts.append(str(capsule_manifest))
    verification_path = ROOT / "docs/softwarex/generated/verification.json"
    if verification_path.is_file():
        verification = json.loads(verification_path.read_text(encoding="utf-8"))
        extra_receipts.extend(
            str(receipt.get("log"))
            for receipt in verification.get("checks", {}).values()
            if receipt.get("log")
        )
    for artifact in extra_receipts:
        normalized = artifact.replace("\\", "/")
        artifact_path = (ROOT / normalized).resolve()
        try:
            artifact_path.relative_to(ROOT.resolve())
        except ValueError:
            raise SystemExit(f"evidence artifact path escapes the repository: {artifact}")
        if not artifact_path.is_file():
            raise SystemExit(f"evidence artifact is missing: {artifact}")
        artifacts[normalized] = {
            "sha256": hashlib.sha256(artifact_path.read_bytes()).hexdigest(),
            "bytes": artifact_path.stat().st_size,
        }
    for artifact, receipt in artifacts.items():
        artifact_path = (ROOT / artifact).resolve()
        try:
            artifact_path.relative_to(ROOT.resolve())
        except ValueError:
            raise SystemExit(f"evidence artifact path escapes the repository: {artifact}")
        if not artifact_path.is_file():
            raise SystemExit(f"evidence-manifest artifact is missing: {artifact}")
        data = artifact_path.read_bytes()
        receipt["sha256"] = hashlib.sha256(data).hexdigest()
        receipt["bytes"] = len(data)
    evidence_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Zenodo DOI: {metadata['zenodo_doi']}")
    print(f"Version:    {metadata['version']}")
    print(f"Downloaded: {relative.as_posix()}")
    print(f"SHA-256:    {digest}")
    print(f"Zenodo MD5: {md5}")
    print("Next: build the final manuscript PDF from the already-frozen source, then run check_softwarex_release.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
