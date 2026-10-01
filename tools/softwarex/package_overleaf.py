"""Package only the files needed to compile the revised SoftwareX manuscript."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path("docs/softwarex")
MAIN = "medora_softwarex.tex"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def collect_files(source: Path) -> dict[str, bytes]:
    """Resolve TeX dependencies; fail instead of silently omitting optional tables."""
    files = {"main.tex": (source / MAIN).read_bytes()}
    pending = ["main.tex"]
    while pending:
        current = pending.pop()
        text = files[current].decode("utf-8")
        text = re.sub(r"(?<!\\)%[^\n]*", "", text)
        inputs = re.findall(r"\\input\{([^{}]+)\}", text)
        graphics = re.findall(r"\\includegraphics(?:\[[^\]]*\])?\{([^{}]+)\}", text)
        for name in inputs + graphics:
            rel = Path(name)
            if rel.is_absolute() or ".." in rel.parts or "\\" in name or ":" in name:
                raise ValueError(f"Unsafe TeX dependency: {name}")
            if not rel.suffix:
                rel = rel.with_suffix(".tex" if name in inputs else ".pdf")
            key = rel.as_posix()
            if key in files:
                continue
            path = source / rel
            if not path.resolve().is_relative_to(source.resolve()):
                raise ValueError(f"TeX dependency escapes the manuscript directory: {key}")
            if not path.is_file():
                raise FileNotFoundError(f"Required manuscript dependency is missing: {key}")
            files[key] = path.read_bytes()
            if rel.suffix == ".tex":
                pending.append(key)
    # Retain the editable source behind the included Chorui PDF.
    for name in ("figures-src/chorui_architecture.tex", "figures-src/diagram_preamble.tex"):
        files[name] = (source / name).read_bytes()
    return files


def build_package(root: Path, output_dir: Path) -> Path:
    source = root / SOURCE
    canonical = (source / MAIN).read_text(encoding="utf-8")
    if canonical != (source / "Medora-Overleaf-First-Submission.tex").read_text(encoding="utf-8"):
        raise ValueError("The two working manuscript sources differ; resolve before packaging")
    files = collect_files(source)
    files["README_UPLOAD.txt"] = (
        "MEDORA SOFTWAREX OVERLEAF UPLOAD\n\n"
        "Overleaf: New Project > Upload Project > select this ZIP.\n"
        "Main document: main.tex. Compiler: pdfLaTeX. Select the newest available TeX Live.\n"
        "Keep the generated/, figures-src/ and figures-ui/ directory structure unchanged.\n"
        "The bibliography is inside main.tex; no separate .bib file is required.\n"
        "Uses standard elsarticle and LaTeX packages; no shell escape or custom font install.\n"
        "Chorui is included as PDF; its editable TikZ sources are also supplied.\n\n"
        "This is the current SoftwareX revision draft, not the final deposited paper.\n"
        "It describes candidate release v1.0.4 and Code Ocean run 799661. The Code Ocean\n"
        "capsule is still under verification; its DOI is provisional. Zenodo DOI and\n"
        "publication date remain pending. Replace release metadata only after the\n"
        "corresponding public records are issued, then rebuild this ZIP.\n"
        "Rebuild this ZIP after final manuscript, figure, table or identifier changes.\n"
        "TeX distribution/class versions may change pagination: check final response pages.\n\n"
        "This ZIP contains no model weights, medicine corpus, private prescription images,\n"
        "credentials, review correspondence or original historical submission.\n"
    ).encode("utf-8")
    inventory = {name: {"sha256": sha256(data), "bytes": len(data)} for name, data in sorted(files.items())}
    manifest = {
        "scope": "Current SoftwareX revision manuscript compilation, not application reproduction",
        "main_document": "main.tex",
        "original_source": f"{SOURCE.as_posix()}/{MAIN}",
        "files": inventory,
    }
    files["UPLOAD_MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode("utf-8")
    identity = sha256(files["UPLOAD_MANIFEST.json"])[:12]
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"Medora-SoftwareX-Overleaf-{identity}.zip"
    if target.exists():
        with ZipFile(target) as archive:
            if set(archive.namelist()) != set(files) or any(archive.read(k) != v for k, v in files.items()):
                raise ValueError("Refusing to overwrite a different archive")
        return target
    with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    return target


def build_author_kit(root: Path, output_dir: Path) -> Path:
    paths = {
        "01_MEDICINE_PERMISSION_REQUESTS.md": "docs/softwarex/author-evidence/01_MEDICINE_PERMISSION_REQUESTS.md",
        "02_DOCTOR_SOURCE_REVIEW_NOTE.md": "docs/softwarex/author-evidence/02_DOCTOR_SOURCE_REVIEW_NOTE.md",
        "03_PRESCRIPTION_RESEARCH_ETHICS_STATUS.md": "docs/softwarex/author-evidence/03_PRESCRIPTION_RESEARCH_ETHICS_STATUS.md",
        "CAPSULE_RESULT_COVERAGE.md": "docs/softwarex/CAPSULE_RESULT_COVERAGE.md",
        "generated/medicine_v2_full_build_manifest.json": "docs/softwarex/generated/medicine_v2_full_build_manifest.json",
        "SOURCE_PERMISSION_RECORD.json": "data/medicine_reference/SOURCE_PERMISSION_RECORD.json",
    }
    files = {name: (root / path).read_bytes() for name, path in paths.items()}
    identity = sha256(b"".join(k.encode() + v for k, v in sorted(files.items())))[:12]
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"Medora-SoftwareX-Author-Evidence-Kit-{identity}.zip"
    if target.exists():
        with ZipFile(target) as archive:
            if set(archive.namelist()) != set(files) or any(archive.read(k) != v for k, v in files.items()):
                raise ValueError("Refusing to overwrite a different evidence kit")
        return target
    with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    parser.add_argument("--verify-compile", action="store_true")
    parser.add_argument("--author-kit", action="store_true")
    args = parser.parse_args()
    output = args.output_dir.resolve()
    if not output.is_relative_to(ROOT):
        raise ValueError("Output must remain inside the project workspace")
    archive = build_package(ROOT, output)
    print(f"Overleaf upload ZIP: {archive}")
    if args.author_kit:
        print(f"Author evidence kit (NOT for Overleaf): {build_author_kit(ROOT, output)}")
    if args.verify_compile:
        import tempfile
        checkout = Path(tempfile.mkdtemp(prefix="overleaf-compile-", dir=output))
        with ZipFile(archive) as bundle:
            bundle.extractall(checkout)
        for _ in range(2):
            subprocess.run(
                ["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "main.tex"],
                cwd=checkout, stdout=subprocess.DEVNULL, check=True,
            )
        log = (checkout / "main.log").read_text(encoding="utf-8", errors="replace")
        if "Overfull" in log or "There were undefined" in log:
            raise ValueError(f"Extracted project has layout/reference warnings: {checkout / 'main.log'}")
        print(f"Extracted ZIP compiled twice successfully: {checkout / 'main.pdf'}")


if __name__ == "__main__":
    main()
