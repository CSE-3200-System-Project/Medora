"""Execute the model profiles actually included in the capsule; never mask missing assets."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def run(arguments: list[str]) -> None:
    subprocess.run(arguments, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    coverage = {}
    phi = root / "data/medora-phi-ner-muril"
    if (phi / "model.onnx").is_file():
        target = args.results / "current_privacy_extension_results.json"
        run([sys.executable, "tools/phi_ner/evaluate.py", "--bundle", str(phi), "--threshold", "0.30", "--per-script", "--out", str(target)])
        report = json.loads(target.read_text(encoding="utf-8"))
        assert report["release_gate"]["passed"], "model inference admission checks failed"
        assert all(s["status"] == "measured" for p in report["populations"].values() for s in p["systems"].values())
        coverage["phi_inference"] = {"status": "executed", "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
    else:
        coverage["phi_inference"] = {"status": "not included", "scope": "archived table only; no model inference reproduction claim"}
    detector = root / "ai_service/models/Yolo26s"
    if (detector / "Yolo26s-prescription-5.pt").is_file():
        env = Path(tempfile.mkdtemp(prefix="medora-capsule-detector-"))
        run([sys.executable, "-m", "venv", str(env)])
        python = str(env / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python"))
        run([python, "-m", "pip", "install", "pip==25.3"])
        run([python, "-m", "pip", "install", "--index-url", "https://download.pytorch.org/whl/cpu",
             "--extra-index-url", "https://pypi.org/simple", "torch==2.10.0+cpu", "torchvision==0.25.0+cpu"])
        run([python, "-m", "pip", "install", "-r", "tools/softwarex/requirements-detector-verification.txt"])
        target = args.results / "current_detector_verification.json"
        run([python, "tools/softwarex/verify_detector_pair.py", "--pt", str(detector / "Yolo26s-prescription-5.pt"),
             "--onnx", str(detector / "Yolo26s-prescription-5.onnx"), "--output", str(target)])
        report = json.loads(target.read_text(encoding="utf-8"))
        assert report["matched_parameter_count"] == 204 and report["matched_parameters_allclose"]
        assert all(c["finite"] and c["shape_match"] for c in report["cases"])
        coverage["detector"] = {"status": "executed", "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                                "scope": "named parameter correspondence and synthetic-input diagnostics; raw predictions not asserted identical"}
        with (args.results / "detector-requirements-resolved.txt").open("w", encoding="utf-8") as stream:
            subprocess.run([python, "-m", "pip", "freeze"], check=True, stdout=stream)
    else:
        coverage["detector"] = {"status": "not included", "scope": "documentation only; no detector runtime reproduction claim"}
    (args.results / "model_execution_coverage.json").write_text(json.dumps(coverage, indent=2) + "\n")


if __name__ == "__main__":
    main()
