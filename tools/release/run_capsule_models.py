"""Execute the model profiles actually included in the capsule; never mask missing assets."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def run(arguments: list[str]) -> None:
    subprocess.run(arguments, check=True)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_package(root: Path) -> dict:
    """Check the immutable transport inventory before any experiment executes."""
    manifest_path = root / "CAPSULE_SOURCE_MANIFEST.json"
    if not manifest_path.is_file():
        return {"status": "local checkout; no transport inventory", "profiles": {}}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    marker = (root / "CAPSULE_SOURCE_COMMIT").read_text(encoding="utf-8").strip()
    if marker != manifest.get("source_commit"):
        raise SystemExit("capsule source marker does not match its inventory")
    version = json.loads((root / "docs/softwarex/release_metadata.json").read_text(encoding="utf-8"))["version"]
    if version != manifest.get("release_version"):
        raise SystemExit("capsule source inventory and release candidate version disagree")
    for group in ("included_source_files", "additional_data_assets"):
        for name, recorded in manifest[group].items():
            path = (root / name).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                raise SystemExit(f"missing or unsafe capsule input: {name}")
            if path.stat().st_size != recorded["bytes"] or file_sha256(path) != recorded["sha256"]:
                raise SystemExit(f"capsule input differs from packaged source: {name}")
    return {"status": "all packaged inputs verified", "source_commit": marker,
            "source_tree": manifest["source_tree"], "release_version": manifest.get("release_version"),
            "profiles": manifest["profiles"], "source_manifest_sha256": file_sha256(manifest_path)}


def require_profile_assets(root: Path, profiles: dict) -> None:
    required = {"phi_inference": ["data/medora-phi-ner-muril/" + name for name in
                                 ("model.onnx", "model.onnx.data", "tokenizer.json", "labels.json")],
                "detector": ["ai_service/models/Yolo26s/Yolo26s-prescription-5." + suffix
                             for suffix in ("pt", "onnx")]}
    for profile, names in required.items():
        if profiles.get(profile) and any(not (root / name).is_file() for name in names):
            raise SystemExit(f"required packaged profile has missing assets: {profile}")
        if profile in profiles and not profiles[profile] and any((root / name).is_file() for name in names):
            raise SystemExit(f"model assets added outside the declared packaged profile: {profile}")


def verify_requirements(paths: list[Path]) -> None:
    from packaging.requirements import Requirement
    for path in paths:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            requirement = Requirement(line)
            try:
                installed = importlib.metadata.version(requirement.name)
            except importlib.metadata.PackageNotFoundError:
                raise SystemExit(f"environment is missing required package: {requirement.name}")
            if installed not in requirement.specifier:
                raise SystemExit(f"environment dependency mismatch: {requirement.name} {installed}; need {requirement.specifier}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--preflight", action="store_true", help="verify package hashes without running models")
    parser.add_argument("--check-dependencies", action="store_true", help="check prepared main-environment pins without installation")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    args.results.mkdir(parents=True, exist_ok=True)
    if args.check_dependencies:
        if sys.version_info[:2] != (3, 11):
            raise SystemExit("capsule computational environment requires Python 3.11")
        verify_requirements([root / "backend/requirements-release.txt", root / "tests/requirements-release.txt"])
        return
    if args.preflight:
        verification = verify_package(root)
        require_profile_assets(root, verification["profiles"])
        (args.results / "capsule_input_verification.json").write_text(json.dumps(verification, indent=2) + "\n")
        return
    package_manifest = root / "CAPSULE_SOURCE_MANIFEST.json"
    profiles = json.loads(package_manifest.read_text(encoding="utf-8"))["profiles"] if package_manifest.is_file() else {}
    require_profile_assets(root, profiles)
    coverage = {}
    phi = root / "data/medora-phi-ner-muril"
    if (phi / "model.onnx").is_file():
        target = args.results / "current_privacy_extension_results.json"
        run([sys.executable, "tools/phi_ner/evaluate.py", "--bundle", str(phi), "--threshold", "0.30", "--per-script", "--out", str(target)])
        report = json.loads(target.read_text(encoding="utf-8"))
        if not report["release_gate"]["passed"] or not all(
            s["status"] == "measured" for p in report["populations"].values() for s in p["systems"].values()
        ):
            raise SystemExit("model inference admission checks failed or a system was not measured")
        coverage["phi_inference"] = {"status": "executed", "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
    else:
        coverage["phi_inference"] = {"status": "not included", "scope": "archived table only; no model inference reproduction claim"}
    detector = root / "ai_service/models/Yolo26s"
    if (detector / "Yolo26s-prescription-5.pt").is_file():
        python = os.environ.get("MEDORA_CAPSULE_DETECTOR_PYTHON", "")
        if not python:
            if os.environ.get("MEDORA_CAPSULE_DEPENDENCY_MODE", "install") == "preinstalled":
                raise SystemExit("set MEDORA_CAPSULE_DETECTOR_PYTHON to the environment's prepared CPU detector interpreter")
            env = Path(tempfile.mkdtemp(prefix="medora-capsule-detector-"))
            run([sys.executable, "-m", "venv", str(env)])
            python = str(env / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python"))
            run([python, "-m", "pip", "install", "pip==25.3"])
            run([python, "-m", "pip", "install", "--index-url", "https://download.pytorch.org/whl/cpu",
                 "--extra-index-url", "https://pypi.org/simple", "torch==2.10.0+cpu", "torchvision==0.25.0+cpu"])
            run([python, "-m", "pip", "install", "-r", "tools/softwarex/requirements-detector-verification.txt"])
        run([python, "-m", "pip", "check"])
        run([python, "-c", "from pathlib import Path; from tools.release.run_capsule_models import verify_requirements; "
             "verify_requirements([Path('tools/softwarex/requirements-detector-verification.txt')])"])
        target = args.results / "current_detector_verification.json"
        run([python, "tools/softwarex/verify_detector_pair.py", "--pt", str(detector / "Yolo26s-prescription-5.pt"),
             "--onnx", str(detector / "Yolo26s-prescription-5.onnx"), "--output", str(target)])
        report = json.loads(target.read_text(encoding="utf-8"))
        if report["matched_parameter_count"] != 204 or not report["matched_parameters_allclose"] or not all(
            c["finite"] and c["shape_match"] for c in report["cases"]
        ):
            raise SystemExit("detector parameter or synthetic-input checks failed")
        coverage["detector"] = {"status": "executed", "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                                "scope": "named parameter correspondence and synthetic-input diagnostics; raw predictions not asserted identical"}
        with (args.results / "detector-requirements-resolved.txt").open("w", encoding="utf-8") as stream:
            subprocess.run([python, "-m", "pip", "freeze"], check=True, stdout=stream)
    else:
        coverage["detector"] = {"status": "not included", "scope": "documentation only; no detector runtime reproduction claim"}
    (args.results / "model_execution_coverage.json").write_text(json.dumps(coverage, indent=2) + "\n")


if __name__ == "__main__":
    main()
