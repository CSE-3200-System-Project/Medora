from pathlib import Path
from zipfile import ZipFile

import pytest

from tools.softwarex.package_overleaf import ROOT, build_author_kit, build_package, collect_files


def test_overleaf_package_contains_every_live_dependency_and_no_private_assets(tmp_path):
    archive = build_package(ROOT, tmp_path)
    with ZipFile(archive) as bundle:
        names = set(bundle.namelist())
        assert "main.tex" in names and "generated/extended_results.tex" in names
        assert "figures-src/consent_flow.tex" in names
        assert "figures-src/chorui_architecture.pdf" in names
        assert len([n for n in names if n.endswith(".png")]) == 8
        assert not any(n.endswith((".onnx", ".pt", ".csv", ".ipynb")) for n in names)
        assert not any("submission-history" in n or "imagesui" in n or ".env" in n for n in names)
        assert "bibliography is inside main.tex" in bundle.read("README_UPLOAD.txt").decode()
    before = archive.read_bytes()
    assert build_package(ROOT, tmp_path).read_bytes() == before


def test_missing_optional_tex_dependency_is_not_silently_skipped(tmp_path):
    (tmp_path / "medora_softwarex.tex").write_text(
        r"\IfFileExists{generated/missing.tex}{\input{generated/missing.tex}}{}", encoding="utf-8"
    )
    with pytest.raises(FileNotFoundError, match="generated/missing.tex"):
        collect_files(tmp_path)


def test_parent_path_dependency_is_rejected(tmp_path):
    (tmp_path / "medora_softwarex.tex").write_text(r"\input{../private.tex}", encoding="utf-8")
    with pytest.raises(ValueError, match="Unsafe"):
        collect_files(tmp_path)


def test_author_kit_is_blank_forms_and_provenance_not_private_data(tmp_path):
    target = build_author_kit(ROOT, tmp_path)
    with ZipFile(target) as bundle:
        assert len(bundle.namelist()) == 6
        assert "02_DOCTOR_SOURCE_REVIEW_NOTE.md" in bundle.namelist()
        assert "CAPSULE_RESULT_COVERAGE.md" in bundle.namelist()
        assert all(n.endswith((".md", ".json")) for n in bundle.namelist())
        assert "not evidence of permission" in bundle.read("01_MEDICINE_PERMISSION_REQUESTS.md").decode()
    assert build_author_kit(ROOT, tmp_path).read_bytes() == target.read_bytes()
