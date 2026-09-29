#!/usr/bin/env python3
"""Replay the selected public S4/S5 corpus from the capsule's exact raw inputs."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import tempfile
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data" / "medicine_reference"))
import rebuild_corpus as builder  # noqa: E402


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", required=True, type=Path)
    args = parser.parse_args()
    manifest = json.loads((ROOT / "data/medicine_reference/build_manifest.json").read_text(encoding="utf-8"))
    if manifest["profile"] != "licensed-public" or set(manifest["sources"]) != {"S4", "S5"}:
        raise SystemExit("capsule medicine profile must be the approved S4/S5 rebuild")
    raw_root = ROOT / "data/medicine_reference/raw"
    for sid, source in manifest["sources"].items():
        if sha(raw_root / source["file"]) != source["sha256"]:
            raise SystemExit(f"capsule medicine input hash differs: {sid}")
    with tempfile.TemporaryDirectory(prefix="medora-capsule-medicine-") as temp:
        replay = Path(temp) / "replay"
        result = builder.build(raw_root, replay, "licensed-public")
        for name, expected in manifest["outputs"].items():
            actual = sha(replay / name)
            if actual != expected["sha256"] or result["outputs"][name]["sha256"] != actual:
                raise SystemExit(f"capsule medicine output differs: {name}")
            archived = (ROOT / "data/medicine_reference/Final_Medicine_Dataset.csv" if name == "Final_Medicine_Dataset.csv"
                        else ROOT / "data/medicine_reference/release-build" / name)
            if name == "row_provenance.jsonl":
                with gzip.open(archived.with_name(name + ".gz"), "rb") as stream:
                    archived_sha = hashlib.sha256(stream.read()).hexdigest()
            else:
                archived_sha = sha(archived)
            if archived_sha != actual:
                raise SystemExit(f"capsule packaged medicine output differs: {name}")
        if sha(ROOT / "data/medicine_reference/Final_Medicine_Dataset.csv") != manifest["outputs"]["Final_Medicine_Dataset.csv"]["sha256"]:
            raise SystemExit("committed public medicine CSV differs")
    report = {
        "status": "pass", "profile": "licensed-public", "sources": list(manifest["sources"]),
        "counts": manifest["counts"], "outputs_rebuilt_and_sha256_matched": manifest["outputs"],
        "scope": "Exact deterministic S4/S5 reconstruction and hashes; not a clinical or official-register audit",
    }
    args.results.mkdir(parents=True, exist_ok=True)
    (args.results / "current_medicine_rebuild.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
