from __future__ import annotations

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from tools.release.check_softwarex_release import check_archive_contents
from tools.release import build_zenodo_deposit as deposit_builder
from tools.release.build_zenodo_deposit import archive_prefix, release_tex
import pytest


def test_combined_detector_archive_cannot_be_labelled_blanket_mit() -> None:
    metadata = {"author_decisions": {"detector_distribution": {"decision": "cleared"}}}
    with pytest.raises(ValueError, match="AGPL"):
        deposit_builder.distribution_license({"license": "MIT"}, metadata)
    metadata["distribution_license"] = "AGPL-3.0-only"
    assert deposit_builder.distribution_license({"license": "MIT"}, metadata) == "agpl-3.0-only"


def test_source_only_archive_retains_declared_licence() -> None:
    assert deposit_builder.distribution_license({"license": "MIT"}, {}) == "mit"


def test_zenodo_builder_uses_one_versioned_archive_root() -> None:
    assert archive_prefix("v1.0.3") == "medora-v1.0.3/"


def _write_archive(path: Path, *, version: str, commit: str, doi: str) -> dict[str, str]:
    prefix = f"medora-{version}/"
    artifact = b"source snapshot"
    payloads = {
        "docs/softwarex/release_metadata.json": {
            "version": version,
            "git_commit": commit,
            "zenodo_doi": doi,
            "zenodo_url": "https://zenodo.org/records/123456",
            "code_ocean": {
                "capsule_url": "https://codeocean.com/capsule/abc123",
                "source_commit": commit,
            },
        },
        "docs/softwarex/generated/release_metadata.tex": (
            f"\\newcommand{{\\ReleaseVersion}}{{{version}}}\n"
            f"\\newcommand{{\\ReleaseDOI}}{{{doi}}}\n"
            "\\newcommand{\\ReleaseDate}{2026-09-23}\n"
            f"\\newcommand{{\\ReleaseCommit}}{{{commit}}}\n"
            f"\\newcommand{{\\ReleaseCommitShort}}{{{commit[:12]}}}\n"
            "\\newcommand{\\ReleaseCapsuleURL}{https://codeocean.com/capsule/abc123}\n"
            "\\newcommand{\\ReleaseCapsuleDOI}{10.24433/CO.example.v1}\n"
            "\\newcommand{\\ReleaseCapsuleVersion}{v1}\n"
            "\\newcommand{\\ReleaseCapsuleRun}{12345}\n"
        ),
        "CITATION.cff": f"cff-version: 1.2.0\nversion: {version.removeprefix('v')}\n",
        "codemeta.json": {"version": version.removeprefix("v")},
        "docs/softwarex/generated/verification.json": {"git_commit": commit},
        "README.md": artifact,
    }
    normalized: dict[str, bytes] = {}
    for name, value in payloads.items():
        if isinstance(value, dict):
            normalized[name] = (json.dumps(value, indent=2) + "\n").encode("utf-8")
        elif isinstance(value, str):
            normalized[name] = value.encode("utf-8")
        else:
            normalized[name] = value

    evidence = {
        "release_identity": {"version": version, "git_commit": commit, "zenodo_doi": doi},
        "artifacts": {"README.md": {"sha256": hashlib.sha256(artifact).hexdigest()}},
    }
    normalized["docs/softwarex/generated/evidence_manifest.json"] = (
        json.dumps(evidence, indent=2) + "\n"
    ).encode("utf-8")
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in normalized.items():
            archive.writestr(prefix + name, data)
    return evidence


def test_release_archive_identity_matches_tag_and_generated_metadata(tmp_path: Path) -> None:
    commit = "a" * 40
    metadata = {
        "version": "v1.0.3",
        "git_commit": commit,
        "zenodo_doi": "10.5281/zenodo.123456",
        "release_date": "2026-09-23",
        "code_ocean": {
            "capsule_url": "https://codeocean.com/capsule/abc123",
            "doi": "10.24433/CO.example.v1",
            "version": "v1",
            "run_id": "12345",
            "source_commit": commit,
        },
    }
    archive = tmp_path / "consistent.zip"
    _write_archive(archive, version=metadata["version"], commit=commit, doi=metadata["zenodo_doi"])

    errors: list[str] = []
    check_archive_contents(archive, metadata, commit, errors)

    assert errors == []


def test_release_tex_binds_source_and_capsule_receipt() -> None:
    commit = "a" * 40
    metadata = {
        "code_ocean": {
            "capsule_url": "https://codeocean.com/capsule/abc123",
            "doi": "10.24433/CO.example.v1",
            "version": "v1",
            "run_id": "12345",
            "source_commit": commit,
        }
    }
    rendered = release_tex("v1.0.5", "10.5281/zenodo.123456", "2026-10-03", metadata, commit).decode()
    assert f"\\newcommand{{\\ReleaseCommit}}{{{commit}}}" in rendered
    assert "\\newcommand{\\ReleaseCommitShort}{aaaaaaaaaaaa}" in rendered
    assert "\\newcommand{\\ReleaseCapsuleDOI}{10.24433/CO.example.v1}" in rendered


def test_v1_0_2_style_archive_with_previous_identity_is_rejected(tmp_path: Path) -> None:
    release_commit = "a" * 40
    metadata = {
        "version": "v1.0.2",
        "git_commit": release_commit,
        "zenodo_doi": "10.5281/zenodo.21846125",
        "release_date": "2026-09-23",
    }
    archive = tmp_path / "stale-embedded-identity.zip"
    _write_archive(
        archive,
        version="v1.0.1",
        commit="b" * 40,
        doi="10.5281/zenodo.21844743",
    )

    errors: list[str] = []
    check_archive_contents(archive, metadata, release_commit, errors)

    assert any("archive internal version" in error for error in errors)
    assert any("archive internal git_commit" in error for error in errors)
    assert any("archive internal zenodo_doi" in error for error in errors)
    assert any("archive generated TeX macro ReleaseVersion" in error for error in errors)
    assert any("archive verification receipt" in error for error in errors)


def test_nested_component_citation_does_not_shadow_root_citation(tmp_path: Path) -> None:
    commit = "a" * 40
    version = "v1.0.3"
    doi = "10.5281/zenodo.123456"
    archive = tmp_path / "nested-citation.zip"
    _write_archive(archive, version=version, commit=commit, doi=doi)
    with ZipFile(archive, "a", compression=ZIP_DEFLATED) as output:
        output.writestr(f"medora-{version}/benchmark/lokkhon/CITATION.cff", "version: 0.1\n")

    metadata = {
        "version": version,
        "git_commit": commit,
        "zenodo_doi": doi,
        "release_date": "2026-09-23",
        "code_ocean": {
            "capsule_url": "https://codeocean.com/capsule/abc123",
            "doi": "10.24433/CO.example.v1",
            "version": "v1",
            "run_id": "12345",
            "source_commit": commit,
        },
    }
    errors: list[str] = []
    check_archive_contents(archive, metadata, commit, errors)
    assert errors == []


def test_archive_finalizer_binds_detached_receipts_and_embedded_hashes(
    tmp_path: Path, monkeypatch
) -> None:
    version = "v1.0.3"
    commit = "c" * 40
    doi = "10.5281/zenodo.123456"
    prefix = archive_prefix(version)
    root = tmp_path
    verification_rel = Path("docs/softwarex/generated/verification.json")
    log_rel = Path("docs/softwarex/generated/verification-logs/backend.log")
    capsule_rel = Path("docs/softwarex/generated/code_ocean/reproduction_manifest_cccccccccccc.json")
    for rel in (verification_rel, log_rel, capsule_rel):
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
    log_bytes = b"passed\n"
    (root / log_rel).write_bytes(log_bytes)
    verification = {
        "git_commit": commit,
        "checks": {
            "backend": {
                "status": "passed",
                "log": log_rel.as_posix(),
                "log_sha256": hashlib.sha256(log_bytes).hexdigest(),
            }
        },
    }
    (root / verification_rel).write_text(json.dumps(verification), encoding="utf-8")
    capsule_manifest = {"source_commit": commit, "ai_provider": "deterministic mock"}
    capsule_bytes = (json.dumps(capsule_manifest) + "\n").encode("utf-8")
    (root / capsule_rel).write_bytes(capsule_bytes)

    archive = root / "candidate.zip"
    initial_metadata = {
        "version": "v1.0.2",
        "git_commit": "old",
        "zenodo_doi": "10.5281/zenodo.old",
        "zenodo_url": "https://zenodo.org/records/123456",
        "archive_path": "dist/old.zip",
        "archive_sha256": "old-hash",
        "code_ocean": {},
    }
    initial_evidence = {
        "release_identity": {"version": "v1.0.2", "git_commit": "old", "zenodo_doi": "10.5281/zenodo.old"},
        "artifacts": {"README.md": {"sha256": hashlib.sha256(b"capsule source").hexdigest()}},
    }
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as output:
        output.writestr(prefix + "README.md", b"capsule source")
        output.writestr(prefix + "docs/softwarex/release_metadata.json", json.dumps(initial_metadata))
        output.writestr(prefix + "docs/softwarex/generated/release_metadata.tex", b"old macros")
        output.writestr(prefix + "docs/softwarex/generated/evidence_manifest.json", json.dumps(initial_evidence))
        output.writestr(prefix + "docs/softwarex/zenodo_deposition.json", "{}")

    monkeypatch.setattr(deposit_builder, "ROOT", root)
    metadata = {
        "version": version,
        "release_date": "2026-09-23",
        "zenodo_doi": doi,
        "zenodo_url": "https://zenodo.org/records/123456",
        "code_ocean": {
            "capsule_url": "https://codeocean.com/capsule/abc123",
            "doi": "10.24433/CO.example.v1",
            "version": "v1",
            "run_id": "12345",
            "source_commit": commit,
            "manifest_path": capsule_rel.as_posix(),
            "manifest_sha256": hashlib.sha256(capsule_bytes).hexdigest(),
        },
    }
    deposition = {"metadata": {"version": version}}
    deposit_builder.finalize_archive_identity(archive, version, commit, metadata, deposition)

    with ZipFile(archive) as result:
        names = set(result.namelist())
        assert prefix + "docs/softwarex/release_metadata.json" in names
        assert prefix + log_rel.as_posix() in names
        archived_metadata = json.loads(result.read(prefix + "docs/softwarex/release_metadata.json"))
        assert archived_metadata["version"] == version
        assert archived_metadata["git_commit"] == commit
        assert archived_metadata["zenodo_doi"] == doi
        assert "archive_sha256" not in archived_metadata
        archived_tex = result.read(prefix + "docs/softwarex/generated/release_metadata.tex").decode()
        assert f"\\newcommand{{\\ReleaseCommit}}{{{commit}}}" in archived_tex
        assert "\\newcommand{\\ReleaseCapsuleDOI}{10.24433/CO.example.v1}" in archived_tex
        evidence = json.loads(result.read(prefix + "docs/softwarex/generated/evidence_manifest.json"))
        for relative, receipt in evidence["artifacts"].items():
            data = result.read(prefix + relative)
            assert hashlib.sha256(data).hexdigest() == receipt["sha256"]
