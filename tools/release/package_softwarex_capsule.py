#!/usr/bin/env python3
"""Package the committed SoftwareX run into Code Ocean's folder layout.

The generated archive is a transport bundle, not a Zenodo/GitHub release. By default
it omits data/model/screenshot material whose public redistribution or privacy basis is
not established in this repository. The Code Ocean run itself only needs the checked-in
synthetic fixtures and frozen machine-readable reports.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
import sys
import tarfile
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EXCLUSIONS: tuple[tuple[str, str], ...] = (
    ("ai_service/models/", "approved detector has a separate AGPL/source bundle; this focused fixture/table run does not consume model assets"),
    ("data/medicine_reference/Final_Medicine_Dataset.csv", "medicine corpus redistribution rights pending"),
    ("data/maya_navigation_sft_v1/", "not required for the SoftwareX reproduction scope"),
    ("docs/BCOLBD/", "not required for the SoftwareX reproduction scope"),
    ("docs/softwarex/imagesui/", "raw interface captures: replace/inspect for the paper; not used by this run"),
    ("docs/softwarex/figures-ui/", "paper screenshots are not consumed by this reproduction run"),
    ("docs/softwarex/revisions/", "review correspondence and working audits are not capsule inputs"),
)
REQUIRED_PATHS = (
    "run",
    "tools/release/run_softwarex_capsule.sh",
    "tools/release/render_softwarex_tables.py",
    "backend/requirements-release.txt",
    "tests/requirements-release.txt",
    "docs/softwarex/generated/safety_results.json",
    "docs/softwarex/generated/booking_results.json",
    "codeocean/metadata/metadata.yml",
)


def run_git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def excluded(path: str) -> str | None:
    for prefix, reason in DEFAULT_EXCLUSIONS:
        if path == prefix.rstrip("/") or path.startswith(prefix):
            return reason
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", default="HEAD", help="committed source ref to package (default: HEAD)")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    parser.add_argument("--dry-run", action="store_true", help="list included/excluded files without writing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        commit = run_git("rev-parse", "--verify", f"{args.commit}^{{commit}}")
        tree = run_git("rev-parse", f"{commit}^{{tree}}")
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"cannot resolve source commit {args.commit!r}: {exc}", file=sys.stderr)
        return 2

    dirty = run_git("status", "--porcelain", "--untracked-files=all")
    if dirty:
        print("refusing to package: commit and working tree differ; commit the intended source first", file=sys.stderr)
        return 2

    try:
        archive_bytes = subprocess.check_output(
            ["git", "archive", "--format=tar", "--prefix=code/", commit], cwd=ROOT
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"cannot archive source commit: {exc}", file=sys.stderr)
        return 2

    included: list[tuple[str, bytes, int]] = []
    excluded_files: list[dict[str, str | int]] = []
    try:
        with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
            for member in archive.getmembers():
                if not member.isfile():
                    if not member.isdir():
                        print(f"unsupported non-regular source entry: {member.name}", file=sys.stderr)
                        return 2
                    continue
                path = PurePosixPath(member.name)
                if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] != "code":
                    print(f"unsafe archive path: {member.name}", file=sys.stderr)
                    return 2
                relative = str(path.relative_to("code"))
                reason = excluded(relative)
                if reason:
                    excluded_files.append({"path": relative, "reason": reason, "bytes": member.size})
                    continue
                extracted = archive.extractfile(member)
                if extracted is None:
                    print(f"could not read archived source entry: {member.name}", file=sys.stderr)
                    return 2
                included.append((member.name, extracted.read(), member.mode))
    except (OSError, tarfile.TarError) as exc:
        print(f"cannot inspect archived source tree: {exc}", file=sys.stderr)
        return 2

    found = {name.removeprefix("code/") for name, _, _ in included}
    missing = sorted(set(REQUIRED_PATHS) - found)
    if missing:
        print("source commit is missing capsule inputs: " + ", ".join(missing), file=sys.stderr)
        return 2

    source_files = {
        name.removeprefix("code/"): {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        for name, data, _ in included
    }
    metadata = next(data for name, data, _ in included if name == "code/codeocean/metadata/metadata.yml")
    capsule_commit_file = (commit + "\n").encode("ascii")
    capsule_manifest = {
        "schema_version": "1.0.0",
        "source_commit": commit,
        "source_tree": tree,
        "scope": "SoftwareX deterministic fixture checks and frozen-table regeneration",
        "omissions": excluded_files,
        "included_source_files": source_files,
    }
    readme = f"""# Medora SoftwareX Code Ocean upload bundle

Source commit: `{commit}`
Git tree: `{tree}`

This bundle is laid out for a Code Ocean capsule: upload `code/` to `/code` and enter
`metadata/metadata.yml` in the capsule metadata editor. Configure a CPU environment with
Python 3.11 in Code Ocean, then mark `/code/run` as the run file. The run installs the
pinned requirements and writes its outputs under `/results`.

Only the focused SoftwareX reproduction scope is claimed. The run checks synthetic
fixtures, copies the frozen safety/booking reports, and regenerates their tables; it does
not perform a new clinical, held-out privacy, OCR, or host-specific booking evaluation.
See `/code/docs/softwarex/CODE_OCEAN_CAPSULE.md`.

The capsule omits the listed medicine corpus, YOLO weights, BCOLBD-only dataset, raw UI
captures, derived UI screenshots, and review correspondence. Those assets are either not
needed by this run or have unresolved rights/privacy or publication-scope decisions.
The exact paths and reasons are recorded in
`/code/CAPSULE_SOURCE_MANIFEST.json`. Do not add omitted assets until the author/institution
has documented clearance and the reproduction scope is intentionally updated.

The full source snapshot and SHA-256 file manifest are recorded in
`/code/CAPSULE_SOURCE_MANIFEST.json`; `/code/CAPSULE_SOURCE_COMMIT` is consumed by the run
manifest so the capsule does not misidentify the source as the old Zenodo release.
"""

    if args.dry_run:
        print(f"source commit: {commit}")
        print(f"Git tree: {tree}")
        print(f"included files: {len(included)} ({sum(len(data) for _, data, _ in included):,} bytes)")
        print(f"excluded files: {len(excluded_files)} ({sum(int(item['bytes']) for item in excluded_files):,} bytes)")
        for item in excluded_files:
            print(f"EXCLUDE {item['path']} ({item['bytes']} bytes): {item['reason']}")
        return 0

    output_dir = args.output_dir.resolve()
    try:
        output_dir.relative_to(ROOT)
    except ValueError:
        print("output directory must be inside this repository", file=sys.stderr)
        return 2
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"Medora-SoftwareX-CodeOcean-{commit[:12]}.zip"
    if output_path.exists():
        print(f"refusing to overwrite existing bundle: {output_path}", file=sys.stderr)
        return 2

    with ZipFile(output_path, "x", compression=ZIP_DEFLATED, compresslevel=6) as bundle:
        for name, data, mode in included:
            info = ZipInfo(name)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = (mode & 0xFFFF) << 16
            bundle.writestr(info, data)
        bundle.writestr("metadata/metadata.yml", metadata)
        bundle.writestr("code/CAPSULE_SOURCE_COMMIT", capsule_commit_file)
        bundle.writestr(
            "code/CAPSULE_SOURCE_MANIFEST.json",
            (json.dumps(capsule_manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        )
        bundle.writestr("README_UPLOAD.md", readme.encode("utf-8"))

    print(f"Code Ocean upload bundle: {output_path.relative_to(ROOT)}")
    print(f"Source commit: {commit}")
    print(f"Included source files: {len(included)}; withheld files: {len(excluded_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
