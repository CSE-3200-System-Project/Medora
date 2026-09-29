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
import shlex
import subprocess
import sys
import tarfile
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EXCLUSIONS: tuple[tuple[str, str], ...] = (
    ("docs/softwarex/author-evidence/", "blank author worksheets, not computational inputs; completed evidence belongs in private author storage"),
    ("docs/softwarex/submission-history/", "historical submission text, not current reproducibility evidence"),
    ("ai_service/models/", "approved detector has a separate AGPL/source bundle; this focused fixture/table run does not consume model assets"),
    ("data/medicine_reference/Final_Medicine_Dataset.csv", "included only with the verified S4/S5 licensed-public capsule profile"),
    ("data/maya_navigation_sft_v1/", "not required for the SoftwareX reproduction scope"),
    ("docs/BCOLBD/", "not required for the SoftwareX reproduction scope"),
    ("docs/softwarex/imagesui/", "raw interface captures: replace/inspect for the paper; not used by this run"),
    ("docs/softwarex/figures-ui/", "paper screenshots are not consumed by this reproduction run"),
    ("docs/softwarex/revisions/", "review correspondence and working audits are not capsule inputs"),
)
REQUIRED_PATHS = (
    "run",
    "tools/release/run_softwarex_capsule.sh",
    "tools/release/run_capsule_booking.sh",
    "tools/release/verify_capsule_observations.py",
    "tools/release/run_capsule_models.py",
    "tools/release/run_capsule_medicine.py",
    "codeocean/environment/Dockerfile",
    "tools/release/render_softwarex_tables.py",
    "backend/requirements-release.txt",
    "tests/requirements-release.txt",
    "docs/softwarex/generated/safety_results.json",
    "docs/softwarex/generated/booking_results.json",
    "docs/softwarex/generated/privacy_extension_results.json",
    "docs/softwarex/generated/consent_scope_results.json",
    "tools/softwarex/build_revision_evidence.py",
    "codeocean/metadata/metadata.yml",
    "docs/softwarex/CAPSULE_RESULT_COVERAGE.md",
    "data/medicine_reference/PUBLIC_SOURCE_NOTICES.md",
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
    parser.add_argument("--detector-source-dir", type=Path, help="include approved detector and pinned Ultralytics source archives")
    parser.add_argument("--phi-bundle", type=Path, help="include exact local MuRIL inference assets; not an authorization for public publication")
    parser.add_argument("--medicine-build", type=Path, help="S4/S5 licensed-public output directory with verified build manifest")
    parser.add_argument("--medicine-source-root", type=Path, help="root containing the two exact S4/S5 raw inputs")
    return parser.parse_args()


def environment_postinstall(included: list[tuple[str, bytes, int]], detector: bool) -> bytes:
    """Embed committed pins: Code Ocean's build cannot read /code or /data."""
    payloads = {name.removeprefix("code/"): payload for name, payload, _ in included}
    def pins(path: str) -> list[str]:
        return [line.strip() for line in payloads[path].decode("utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")]
    main_pins = list(dict.fromkeys(pins("backend/requirements-release.txt") + pins("tests/requirements-release.txt")))
    lines = ["#!/usr/bin/env bash", "set -euo pipefail",
             "# Keep Code Ocean's supported starter image and platform configuration.",
             "# Select a Python 3.11 starter. Build phase has network; run phase does not need it.",
             "if [[ ! -x /usr/lib/postgresql/16/bin/initdb ]]; then",
             "  . /etc/os-release",
             "  [[ \"$ID\" == debian || \"$ID\" == ubuntu ]] || { echo 'Need Debian/Ubuntu PostgreSQL 16 environment' >&2; exit 2; }",
             "  apt-get update && apt-get install -y --no-install-recommends curl ca-certificates postgresql-common",
             "  install -d /usr/share/postgresql-common/pgdg",
             "  curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc",
             "  printf 'Types: deb\\nURIs: https://apt.postgresql.org/pub/repos/apt\\nSuites: %s-pgdg\\nComponents: main\\nSigned-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc\\n' \"$VERSION_CODENAME\" > /etc/apt/sources.list.d/pgdg.sources",
             "  apt-get update && apt-get install -y --no-install-recommends postgresql-16",
             "fi",
             "apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0",
             "python3.11 -m venv /opt/medora-python",
             "/opt/medora-python/bin/python -m pip install pip==25.3",
             "/opt/medora-python/bin/python -m pip install " + " ".join(map(shlex.quote, main_pins)),
             "/opt/medora-python/bin/python -m pip check"]
    if detector:
        detector_pins = pins("tools/softwarex/requirements-detector-verification.txt")
        lines += ["python3.11 -m venv /opt/medora-detector",
                  "/opt/medora-detector/bin/python -m pip install pip==25.3",
                  "/opt/medora-detector/bin/python -m pip install --index-url https://download.pytorch.org/whl/cpu "
                  "--extra-index-url https://pypi.org/simple torch==2.10.0+cpu torchvision==0.25.0+cpu",
                  "/opt/medora-detector/bin/python -m pip install " + " ".join(map(shlex.quote, detector_pins)),
                  "/opt/medora-detector/bin/python -m pip check"]
    lines += ["test -x /usr/lib/postgresql/16/bin/initdb || { echo 'PostgreSQL 16 missing after environment build' >&2; exit 2; }"]
    return ("\n".join(lines) + "\n").encode("utf-8")


def main() -> int:
    args = parse_args()
    if bool(args.medicine_build) != bool(args.medicine_source_root):
        print("--medicine-build and --medicine-source-root must be supplied together", file=sys.stderr)
        return 2
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
                detector_names = {"Yolo26s-prescription-5.pt", "Yolo26s-prescription-5.onnx", "MODEL_CARD.md",
                                  "AUTHOR_DISTRIBUTION_DECISION.md", "DISTRIBUTION.md", "COPYING.AGPL-3.0",
                                  "training_recipe.sanitized.ipynb"}
                approved_detector = (args.detector_source_dir and relative.startswith("ai_service/models/Yolo26s/")
                                     and path.name in detector_names)
                public_summary = relative == "docs/softwarex/author-evidence/COMPLETED_REVIEW_SUMMARIES.md"
                approved_medicine = (bool(args.medicine_build) and
                                     relative == "data/medicine_reference/Final_Medicine_Dataset.csv")
                reason = None if approved_detector or public_summary or approved_medicine else excluded(relative)
                if reason:
                    excluded_files.append({"path": relative, "reason": reason, "bytes": member.size})
                    continue
                extracted = archive.extractfile(member)
                if extracted is None:
                    print(f"could not read archived source entry: {member.name}", file=sys.stderr)
                    return 2
                payload = extracted.read()
                if (relative == "run" or relative.endswith(".sh")) and b"\r\n" in payload:
                    # Preserve source identity: fix/commit the source, not the ZIP bytes.
                    if relative in {"run", "tools/release/run_softwarex_capsule.sh", "tools/release/run_capsule_booking.sh"}:
                        raise SystemExit(f"Linux run entry point has CRLF line endings; renormalize and commit {relative}")
                included.append((member.name, payload, member.mode))
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
    data_assets = {}
    if args.medicine_build:
        build = json.loads((args.medicine_build / "build_manifest.json").read_text(encoding="utf-8"))
        if build.get("profile") != "licensed-public" or set(build.get("sources", {})) != {"S4", "S5"}:
            raise SystemExit("medicine build must select exactly S4/S5 licensed-public")
        if build.get("builder_sha256") != source_files["data/medicine_reference/rebuild_corpus.py"]["sha256"]:
            raise SystemExit("medicine builder hash differs from committed source")
        committed_csv = source_files["data/medicine_reference/Final_Medicine_Dataset.csv"]["sha256"]
        if committed_csv != build["outputs"]["Final_Medicine_Dataset.csv"]["sha256"]:
            raise SystemExit("committed medicine CSV differs from selected build")
        for sid, info in build["sources"].items():
            raw_path = (args.medicine_source_root / info["file"]).resolve()
            raw_payload = raw_path.read_bytes()
            if hashlib.sha256(raw_payload).hexdigest() != info["sha256"] or len(raw_payload) != info["size_bytes"]:
                raise SystemExit(f"medicine input mismatch: {sid}")
            destination = "data/medicine_reference/raw/" + info["file"].replace("\\", "/")
            data_assets[destination] = {"sha256": info["sha256"], "bytes": len(raw_payload), "source": sid}
            included.append(("code/" + destination, raw_payload, 0o644))
        for name, info in build["outputs"].items():
            if name == "Final_Medicine_Dataset.csv":
                continue  # already supplied as the committed runtime/release CSV
            payload = (args.medicine_build / name).read_bytes()
            if hashlib.sha256(payload).hexdigest() != info["sha256"] or len(payload) != info["size_bytes"]:
                raise SystemExit(f"medicine output mismatch: {name}")
            destination = "data/medicine_reference/release-build/" + name
            data_assets[destination] = {"sha256": info["sha256"], "bytes": len(payload), "source": "S4/S5 build"}
            included.append(("code/" + destination, payload, 0o644))
    if args.phi_bundle:
        archived = json.loads(next(data for name, data, _ in included
                                   if name == "code/docs/softwarex/generated/privacy_extension_results.json"))
        for name, expected in archived["release_gate"]["bundle_files"].items():
            if name not in {"model.onnx", "model.onnx.data", "tokenizer.json", "labels.json"}:
                raise SystemExit("unexpected model asset filename")
            payload = (args.phi_bundle / name).read_bytes()
            if hashlib.sha256(payload).hexdigest() != expected:
                raise SystemExit(f"MuRIL asset hash mismatch: {name}")
            destination = "data/medora-phi-ner-muril/" + name
            data_assets[destination] = {"sha256": expected, "bytes": len(payload),
                                       "status": "local inference asset; public publication basis remains separately recorded"}
            included.append(("code/" + destination, payload, 0o644))
    if args.detector_source_dir:
        for version in ("8.4.21", "8.4.19"):
            name = f"ultralytics-v{version}.tar.gz"
            payload = (args.detector_source_dir / name).read_bytes()
            destination = "upstream-source/" + name
            data_assets[destination] = {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload)}
            included.append(("code/" + destination, payload, 0o644))
    metadata = next(data for name, data, _ in included if name == "code/codeocean/metadata/metadata.yml")
    capsule_commit_file = (commit + "\n").encode("ascii")
    release_metadata = json.loads(next(data for name, data, _ in included
                                      if name == "code/docs/softwarex/release_metadata.json"))
    capsule_manifest = {
        "schema_version": "1.0.0",
        "source_commit": commit,
        "source_tree": tree,
        "release_version": release_metadata["version"],
        "scope": "SoftwareX current safety scoring, isolated PostgreSQL booking rerun, archived-observation checks and table regeneration",
        "omissions": excluded_files,
        "included_source_files": source_files,
        "additional_data_assets": data_assets,
        "profiles": {"detector": bool(args.detector_source_dir), "phi_inference": bool(args.phi_bundle),
                     "medicine": bool(args.medicine_build)},
        "combined_distribution_licence": "AGPL-3.0 with original MIT/third-party notices" if args.detector_source_dir else "retain individual source licences",
    }
    readme = f"""# Medora SoftwareX Code Ocean upload bundle

Source commit: `{commit}`
Git tree: `{tree}`

This bundle is laid out for a Code Ocean capsule: upload `code/` to `/code` and enter
`metadata/metadata.yml` in the capsule metadata editor. Configure a CPU environment with
Python 3.11 and PostgreSQL 16, then mark `/code/run` as the run file. The supplied
`environment/Dockerfile` is a tested local reference, not a guaranteed supported Code Ocean
starter image. Preserve platform-required configuration when adapting it. Prepare the pinned
Python requirements and separate CPU detector environment before Reproducible Run, as
described in `code/docs/softwarex/CODE_OCEAN_CAPSULE.md`. The default run does not install
dependencies or fetch models and writes its outputs under `/results`.

Application release candidate: `{release_metadata['version']}`. This is not a minted
Zenodo DOI or a published Code Ocean version. Bind the real identifiers only after the
author-owned platforms return them; never substitute the older release's DOI.

Only the focused SoftwareX reproduction scope is claimed. The run checks synthetic
fixtures, recomputes archived observation statistics, scores current mock/rule safety,
and runs 90 fresh-slot booking trials against a new capsule-local PostgreSQL cluster.
Historical reports/tables remain separate from new measurements. It does not perform
a new clinical, independent held-out privacy, OCR accuracy or live-provider evaluation.
See `/code/docs/softwarex/CODE_OCEAN_CAPSULE.md`.

The base bundle omits the medicine corpus and YOLO weights; selected licensed-public
medicine and approved detector profiles include their exact inputs and notices. BCOLBD-only
material, raw UI captures, derived UI screenshots, private images, and review correspondence
remain outside this run.
The exact paths and reasons are recorded in
`/code/CAPSULE_SOURCE_MANIFEST.json`. Do not add omitted assets until the author/institution
has documented clearance and the reproduction scope is intentionally updated.

Selected optional profiles: detector={bool(args.detector_source_dir)}, PHI inference={bool(args.phi_bundle)}, medicine={bool(args.medicine_build)}.
The detector profile includes approved assets, AGPL and pinned corresponding source.
The PHI profile includes exact inference files with Apache base-model notice; this local
transport option is not a public-publication clearance. See `tools/phi_ner/INFERENCE_ASSET_NOTICE.md`.
The manifest's actual file inventory overrides the default omission description above.

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
    profile = (("-medicine" if args.medicine_build else "") +
               ("-detector" if args.detector_source_dir else "") +
               ("-phi" if args.phi_bundle else ""))
    output_path = output_dir / f"Medora-SoftwareX-CodeOcean-{commit[:12]}{profile}.zip"
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
        environment_recipe = next(data for name, data, _ in included if name == "code/codeocean/environment/Dockerfile")
        bundle.writestr("environment/Dockerfile", environment_recipe)
        bundle.writestr("environment/postInstall", environment_postinstall(included, bool(args.detector_source_dir)))
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
