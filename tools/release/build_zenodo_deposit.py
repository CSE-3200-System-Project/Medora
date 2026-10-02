#!/usr/bin/env python3
"""Build the archive and Zenodo metadata for an already verified, tagged release.

The candidate commit must already contain its final paper/capsule URL and a reserved
version DOI. Run all verification checks on that commit, create/push its GitHub tag, then
run this command. It injects build-time release identity and fresh verification receipts
into the archive, computes the ZIP hash, and records the detached receipt in the working
tree. It never publishes to Zenodo or GitHub. Upload its output to a manually
reserved Zenodo new-version draft; GitHub auto-import archives the unfinalized
tag snapshot and cannot substitute for this release ZIP.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "softwarex"
DIST = ROOT / "dist"

# Zenodo's licence vocabulary uses SPDX identifiers in lower case.
SPDX_TO_ZENODO = {"MIT": "mit", "Apache-2.0": "apache-2.0", "BSD-3-Clause": "bsd-3-clause", "AGPL-3.0-only": "agpl-3.0-only"}


def distribution_license(citation: dict, metadata: dict) -> str:
    """Do not label a combined detector-containing archive blanket MIT."""
    requested = metadata.get('distribution_license', citation.get('license', 'MIT'))
    included = metadata.get('author_decisions', {}).get('detector_distribution', {}).get('decision') == 'cleared'
    if included and requested != 'AGPL-3.0-only':
        raise ValueError('Combined detector distribution requires AGPL-3.0-only and preserved source/notices')
    return SPDX_TO_ZENODO.get(requested, requested.lower())


def archive_prefix(version: str) -> str:
    """Return the single root prefix shared by archive creation and identity binding."""
    return f"medora-{version}/"


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def read_citation() -> dict:
    """Parse the handful of CITATION.cff fields we need without a YAML dependency."""
    text = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    citation: dict = {"authors": [], "keywords": []}
    for key in ("title", "version", "license", "repository-code"):
        match = re.search(rf"^{key}:\s*\"?(.+?)\"?\s*$", text, re.M)
        if match:
            citation[key] = match.group(1)

    author_block = re.search(r"^authors:\n((?:\s+-.*\n|\s{4}.*\n)+)", text, re.M)
    if author_block:
        current: dict = {}
        for line in author_block.group(1).splitlines():
            stripped = line.strip()
            if stripped.startswith("- "):
                if current:
                    citation["authors"].append(current)
                current = {}
                stripped = stripped[2:]
            if ":" in stripped:
                field, _, value = stripped.partition(":")
                current[field.strip()] = value.strip().strip('"')
        if current:
            citation["authors"].append(current)

    keyword_block = re.search(r"^keywords:\n((?:\s+-.*\n)+)", text, re.M)
    if keyword_block:
        citation["keywords"] = [line.strip()[2:].strip('"') for line in keyword_block.group(1).splitlines()]

    abstract = re.search(r"^abstract: >-\n((?:\s{2,}.*\n?)+)", text, re.M)
    if abstract:
        citation["abstract"] = " ".join(line.strip() for line in abstract.group(1).splitlines()).strip()
    return citation


def release_tex(version: str, doi: str, release_date: str, metadata: dict, commit: str) -> bytes:
    capsule = metadata.get("code_ocean") or {}
    if capsule.get("source_commit") != commit:
        raise ValueError("capsule source commit does not match release source commit")
    macros = {
        "ReleaseVersion": version,
        "ReleaseDOI": doi,
        "ReleaseDate": release_date,
        "ReleaseCommit": commit,
        "ReleaseCommitShort": commit[:12],
        "ReleaseCapsuleURL": str(capsule.get("capsule_url") or ""),
        "ReleaseCapsuleDOI": str(capsule.get("doi") or ""),
        "ReleaseCapsuleVersion": str(capsule.get("version") or ""),
        "ReleaseCapsuleRun": str(capsule.get("run_id") or ""),
    }
    return "".join(f"\\newcommand{{\\{name}}}{{{value}}}\n" for name, value in macros.items()).encode("utf-8")


def finalize_archive_identity(archive_path: Path, version: str, commit: str, metadata: dict, deposition: dict) -> None:
    """Inject build-time identity/verification receipts into the tag archive.

    The commit hash is only knowable after the source commit exists, while the archive is
    generated from that commit. The ZIP is therefore a release build product: this helper
    binds its internal receipt and generated paper macros to the immutable tag, without
    putting the ZIP's self-referential checksum inside the ZIP.
    """
    release_date = str(metadata["release_date"])
    prefix = archive_prefix(version)
    try:
        with ZipFile(archive_path, "r") as source:
            infos = source.infolist()
            members = {info.filename: (info, source.read(info.filename)) for info in infos if not info.is_dir()}
    except (OSError, KeyError) as exc:
        raise SystemExit(f"cannot inspect the generated release archive: {exc}") from exc

    def member_path(relative: str) -> str:
        return prefix + relative

    def required_member(relative: str) -> bytes:
        path = member_path(relative)
        if path not in members:
            raise SystemExit(f"release archive is missing required path: {relative}")
        return members[path][1]

    metadata_relative = "docs/softwarex/release_metadata.json"
    embedded_metadata = json.loads(required_member(metadata_relative).decode("utf-8"))
    embedded_metadata.update(
        version=version,
        release_date=release_date,
        git_commit=commit,
        zenodo_doi=metadata["zenodo_doi"],
        zenodo_url=metadata["zenodo_url"],
    )
    if metadata.get("code_ocean"):
        embedded_metadata["code_ocean"] = metadata["code_ocean"]
    # These values depend on the finalized ZIP and are recorded in the detached receipt.
    embedded_metadata.pop("archive_sha256", None)
    embedded_metadata.pop("archive_path", None)
    embedded_metadata.pop("zenodo_file_md5", None)
    embedded_metadata["archive_note"] = (
        "Release identity is bound to the Git tag and commit. The downloaded-archive SHA-256 "
        "is recorded externally because a ZIP cannot contain its own final checksum."
    )
    members[member_path(metadata_relative)] = (
        members[member_path(metadata_relative)][0],
        (json.dumps(embedded_metadata, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
    )

    release_tex_path = member_path("docs/softwarex/generated/release_metadata.tex")
    if release_tex_path not in members:
        raise SystemExit("release archive is missing docs/softwarex/generated/release_metadata.tex")
    members[release_tex_path] = (
        members[release_tex_path][0],
        release_tex(version, metadata["zenodo_doi"], release_date, metadata, commit),
    )

    verification_path = ROOT / "docs/softwarex/generated/verification.json"
    if not verification_path.is_file():
        raise SystemExit("fresh verification.json is missing; record all checks on the candidate commit first")
    verification = json.loads(verification_path.read_text(encoding="utf-8"))
    if verification.get("git_commit") != commit:
        raise SystemExit("verification.json does not refer to the exact candidate commit")
    members[member_path("docs/softwarex/generated/verification.json")] = (
        members.get(member_path("docs/softwarex/generated/verification.json"), (ZipInfo("verification.json"), b""))[0],
        verification_path.read_bytes(),
    )
    for receipt in verification.get("checks", {}).values():
        log_value = receipt.get("log")
        log_path = ROOT / str(log_value or "")
        if not log_value or not log_path.is_file():
            raise SystemExit(f"verification log is missing: {log_value}")
        log_bytes = log_path.read_bytes()
        if hashlib.sha256(log_bytes).hexdigest() != receipt.get("log_sha256"):
            raise SystemExit(f"verification log hash mismatch: {log_value}")
        archive_log_path = member_path(str(log_value).replace("\\", "/"))
        info = members.get(archive_log_path, (ZipInfo(archive_log_path), b""))[0]
        members[archive_log_path] = (info, log_bytes)

    code_ocean = metadata.get("code_ocean", {})
    capsule_manifest_path = str(code_ocean.get("manifest_path") or "")
    if capsule_manifest_path:
        local_manifest = ROOT / capsule_manifest_path
        if not local_manifest.is_file():
            raise SystemExit(f"Code Ocean reproduction manifest is missing: {capsule_manifest_path}")
        manifest_bytes = local_manifest.read_bytes()
        if hashlib.sha256(manifest_bytes).hexdigest() != code_ocean.get("manifest_sha256"):
            raise SystemExit("Code Ocean reproduction manifest hash does not match release_metadata.json")
        archive_manifest_path = member_path(capsule_manifest_path.replace("\\", "/"))
        info = members.get(archive_manifest_path, (ZipInfo(archive_manifest_path), b""))[0]
        members[archive_manifest_path] = (info, manifest_bytes)

    evidence_path = member_path("docs/softwarex/generated/evidence_manifest.json")
    if evidence_path not in members:
        raise SystemExit("release archive is missing docs/softwarex/generated/evidence_manifest.json")
    evidence = json.loads(members[evidence_path][1].decode("utf-8"))
    identity = evidence.setdefault("release_identity", {})
    identity.update(version=version, git_commit=commit, zenodo_doi=metadata["zenodo_doi"])
    identity.pop("archive_sha256", None)
    for relative, item in evidence.get("artifacts", {}).items():
        path = member_path(str(relative).replace("\\", "/"))
        if path not in members:
            raise SystemExit(f"evidence-manifest artifact is missing from release archive: {relative}")
        data = members[path][1]
        item["sha256"] = hashlib.sha256(data).hexdigest()
        item["bytes"] = len(data)
    if capsule_manifest_path:
        manifest_data = members[member_path(capsule_manifest_path.replace("\\", "/"))][1]
        evidence.setdefault("artifacts", {})[capsule_manifest_path.replace("\\", "/")] = {
            "sha256": hashlib.sha256(manifest_data).hexdigest(),
            "bytes": len(manifest_data),
        }
    # These receipts are generated after the immutable source commit. Include them in the
    # release evidence manifest, but keep archive_sha256 external to avoid self-reference.
    receipt_paths = ["docs/softwarex/generated/verification.json"]
    for receipt in verification.get("checks", {}).values():
        log_value = receipt.get("log")
        if log_value:
            receipt_paths.append(str(log_value).replace("\\", "/"))
    for relative in receipt_paths:
        path = member_path(relative)
        if path not in members:
            raise SystemExit(f"post-commit verification artifact is missing from release archive: {relative}")
        data = members[path][1]
        evidence.setdefault("artifacts", {})[relative] = {
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
        }
    members[evidence_path] = (
        members[evidence_path][0],
        (json.dumps(evidence, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
    )

    deposition_path = member_path("docs/softwarex/zenodo_deposition.json")
    if deposition_path in members:
        members[deposition_path] = (
            members[deposition_path][0],
            (json.dumps(deposition, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        )

    temporary = archive_path.with_name(archive_path.stem + ".identity.tmp.zip")
    try:
        with ZipFile(temporary, "x", compression=ZIP_DEFLATED, compresslevel=6) as output:
            for name, (info, content) in members.items():
                info.filename = name
                info.compress_type = ZIP_DEFLATED
                output.writestr(info, content)
        temporary.replace(archive_path)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    args = parser.parse_args()

    # These files are produced after tests run on the immutable candidate commit, or
    # during packaging. They are injected into the release ZIP as receipts.
    #
    #   verification.json  is a post-test receipt naming the already tagged HEAD.
    #   release_metadata.json  is rewritten by this script a few lines below.
    #   sw.js              is Serwist output whose precache manifest carries a fresh
    #                      revision token on every build, so two builds of identical
    #                      source differ by one line. Consumers rebuild it anyway.
    #
    # Everything else must be committed so the tag and archive have the same source.
    EXPECTED_DIRTY = {
        "docs/softwarex/generated/verification.json",
        "docs/softwarex/release_metadata.json",
        "frontend/public/sw.js",
    }

    # Not git(): its .strip() would eat the leading status column of the first line, and
    # the path offset would then be wrong for exactly that entry.
    porcelain = subprocess.check_output(
        ["git", "status", "--porcelain", "--untracked-files=all"], cwd=ROOT, text=True
    )
    dirty = []
    for line in porcelain.splitlines():
        if not line:
            continue
        path = line[3:].strip().strip('"')
        is_capsule_receipt = bool(re.fullmatch(
            r"docs/softwarex/generated/code_ocean/reproduction_manifest_[0-9a-f]{12}\.json", path
        ))
        if path not in EXPECTED_DIRTY and not is_capsule_receipt:
            dirty.append(line)
    if dirty:
        print("working tree has changes outside the permitted post-test receipts:", file=sys.stderr)
        for line in dirty:
            print(f"  {line}", file=sys.stderr)
        print("Commit the final source/paper first, then rerun verification and package that tag.", file=sys.stderr)
        return 2

    commit = git("rev-parse", "HEAD")
    citation = read_citation()
    version = f"v{citation.get('version', '1.0.0')}"
    try:
        tag_commit = git("rev-list", "-n", "1", version)
    except subprocess.CalledProcessError:
        print(f"create and push GitHub tag {version} only after its checks pass", file=sys.stderr)
        return 2
    if tag_commit != commit:
        print(f"tag {version} points to {tag_commit}, but HEAD is {commit}", file=sys.stderr)
        return 2

    metadata_path = DOCS / "release_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("version") != version:
        print("release_metadata.json version does not match CITATION.cff/Git tag", file=sys.stderr)
        return 2
    if not re.fullmatch(r"10\.5281/zenodo\.\d+", str(metadata.get("zenodo_doi", ""))):
        print("reserve the new Zenodo version DOI and record it before finalizing the candidate", file=sys.stderr)
        return 2
    if not re.search(r"https://zenodo\.org/records/\d+", str(metadata.get("zenodo_url", ""))):
        print("release_metadata.json zenodo_url must identify the reserved version record", file=sys.stderr)
        return 2
    superseded_doi = (metadata.get("superseded_release") or {}).get("zenodo_doi")
    if superseded_doi and superseded_doi == metadata.get("zenodo_doi"):
        print("new release must use a new version DOI, not the superseded version DOI", file=sys.stderr)
        return 2
    # The final source commit and archive checksum are intentionally unknown until after
    # commit/tag and deposit. The builder fills those detached receipt fields below.
    prebuild_metadata = dict(metadata)
    for field in ("git_commit", "archive_path", "archive_sha256", "zenodo_file_md5", "archive_note"):
        prebuild_metadata.pop(field, None)
    if "RELEASE_PENDING" in json.dumps(prebuild_metadata):
        print("release_metadata.json still contains RELEASE_PENDING", file=sys.stderr)
        return 2

    author_decisions = metadata.get("author_decisions", {})
    medicine_review = author_decisions.get("medicine_content_review", {})
    medicine_distribution = author_decisions.get("medicine_corpus_distribution", {})
    detector_distribution = author_decisions.get("detector_distribution", {})
    image_ethics = author_decisions.get("prescription_image_ethics", {})
    if medicine_review.get("status") != "recorded" or not medicine_review.get("evidence"):
        print("record the scope and evidence for the qualified-doctor medicine review", file=sys.stderr)
        return 2
    if medicine_distribution.get("decision") not in {"cleared", "excluded"} or not medicine_distribution.get("evidence"):
        print("record whether the medicine corpus is cleared for public distribution or excluded", file=sys.stderr)
        return 2
    corpus_path = ROOT / "data/medicine_reference/Final_Medicine_Dataset.csv"
    if medicine_distribution.get("decision") == "excluded" and corpus_path.exists():
        print("remove the uncleared medicine corpus from the public candidate before release", file=sys.stderr)
        return 2
    if medicine_distribution.get("decision") == "cleared" and not corpus_path.is_file():
        print("medicine corpus is marked cleared but is absent from the candidate", file=sys.stderr)
        return 2
    if detector_distribution.get("decision") not in {"cleared", "excluded"} or not detector_distribution.get("evidence"):
        print("record whether the prescription-detector model is cleared for distribution or excluded", file=sys.stderr)
        return 2
    detector_path = ROOT / "ai_service/models/Yolo26s/Yolo26s-prescription-5.onnx"
    if detector_distribution.get("decision") == "excluded" and detector_path.exists():
        print("remove the uncleared detector weights from the public candidate before release", file=sys.stderr)
        return 2
    if detector_distribution.get("decision") == "cleared":
        if not detector_path.is_file() or hashlib.sha256(detector_path.read_bytes()).hexdigest() != detector_distribution.get("sha256"):
            print("detector weight file/hash does not match its distribution clearance record", file=sys.stderr)
            return 2
        try:
            distribution_license(citation, metadata)
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        for notice in ('THIRD_PARTY_NOTICES.md', 'ai_service/models/Yolo26s/COPYING.AGPL-3.0', 'ai_service/models/Yolo26s/training_recipe.sanitized.ipynb'):
            if not (ROOT / notice).is_file():
                print(f'combined detector distribution is missing source/notice: {notice}', file=sys.stderr)
                return 2
    if image_ethics.get("status") not in {"documented", "not_required_with_authority"} or not image_ethics.get("evidence"):
        print("record the consent scope and institutional image-ethics determination", file=sys.stderr)
        return 2

    release_date = str(metadata.get("release_date", ""))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", release_date):
        print("release_metadata.json needs the intended YYYY-MM-DD release_date before the final candidate", file=sys.stderr)
        return 2

    verification_path = DOCS / "generated" / "verification.json"
    if not verification_path.is_file():
        print("fresh verification.json is missing", file=sys.stderr)
        return 2
    verification = json.loads(verification_path.read_text(encoding="utf-8"))
    if verification.get("git_commit") != commit:
        print("verification.json does not refer to the tagged candidate commit", file=sys.stderr)
        return 2
    required_checks = ("backend", "ai_service", "integration", "security", "benchmarks", "playwright", "frontend_lint", "frontend_build", "clean_docker")
    if any(verification.get("checks", {}).get(name, {}).get("status") != "passed" for name in required_checks):
        print("all nine release verification checks must pass on the candidate commit", file=sys.stderr)
        return 2

    capsule = metadata.get("code_ocean", {})
    capsule_url = str(capsule.get("capsule_url") or "")
    manifest_path = ROOT / str(capsule.get("manifest_path") or "")
    if capsule.get("source_commit") != commit or not capsule.get("version") or not capsule.get("run_id"):
        print("final Code Ocean receipt must refer to the tagged candidate commit", file=sys.stderr)
        return 2
    if not capsule_url.startswith("https://codeocean.com/capsule/"):
        print("a reader-accessible Code Ocean capsule URL is required", file=sys.stderr)
        return 2
    if not manifest_path.is_file() or hashlib.sha256(manifest_path.read_bytes()).hexdigest() != capsule.get("manifest_sha256"):
        print("the saved Code Ocean reproduction manifest is missing or its hash is wrong", file=sys.stderr)
        return 2
    capsule_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if capsule_manifest.get("source_commit") != commit or capsule_manifest.get("ai_provider") != "deterministic mock":
        print("Code Ocean reproduction manifest does not match the candidate/mock run", file=sys.stderr)
        return 2
    manuscript_source = (DOCS / "medora_softwarex.tex").read_text(encoding="utf-8")
    response_source = (DOCS / "response_to_revision.md").read_text(encoding="utf-8")
    manuscript_uses_capsule_macro = "\\ReleaseCapsuleURL" in manuscript_source
    if (capsule_url not in manuscript_source and not manuscript_uses_capsule_macro) or capsule_url not in response_source:
        print("the stable Code Ocean URL must be present in both manuscript and response before release", file=sys.stderr)
        return 2

    DIST.mkdir(exist_ok=True)
    archive = DIST / f"Medora-{version}-{commit[:12]}.zip"
    if archive.exists():
        print(f"refusing to overwrite existing archive: {archive}", file=sys.stderr)
        return 2
    subprocess.check_call(["git", "archive", "--format=zip", f"--prefix={archive_prefix(version)}", "-o", str(archive), commit], cwd=ROOT)

    related_identifiers = [
        {"relation": "isSupplementTo", "identifier": f"{citation.get('repository-code', '').rstrip('/')}/tree/{version}", "scheme": "url"}
    ]
    code_ocean = metadata.get("code_ocean", {})
    if code_ocean.get("doi"):
        related_identifiers.append({"relation": "isSupplementTo", "identifier": code_ocean["doi"], "scheme": "doi"})
    elif code_ocean.get("capsule_url"):
        related_identifiers.append({"relation": "isSupplementTo", "identifier": code_ocean["capsule_url"], "scheme": "url"})

    deposition = {
        "metadata": {
            "upload_type": "software",
            "title": citation.get("title", "Medora"),
            "creators": [
                {"name": f"{author.get('family-names', '')}, {author.get('given-names', '')}".strip(", ")}
                for author in citation["authors"]
            ],
            "description": citation.get("abstract", ""),
            "keywords": citation["keywords"],
            "license": distribution_license(citation, metadata),
            "version": version,
            "publication_date": release_date,
            "related_identifiers": related_identifiers,
            "notes": (
                "Research software. Not clinically validated, not a medical device, and not for "
                "clinical use. The archive contains source, evaluation harnesses, and the build "
                "script for the medicine reference. No patient images or records are included; "
                "see samples/DATA_USE_NOTICE.md."
            ),
        }
    }
    finalize_archive_identity(archive, version, commit, metadata, deposition)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (DOCS / "zenodo_deposition.json").write_text(json.dumps(deposition, indent=2) + "\n", encoding="utf-8")

    metadata["git_commit"] = commit
    metadata["release_date"] = release_date
    metadata["archive_path"] = str(archive.relative_to(ROOT)).replace("\\", "/")
    metadata["archive_sha256"] = digest
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"archive     {archive.relative_to(ROOT)}  ({archive.stat().st_size:,} bytes)")
    print(f"sha256      {digest}")
    print(f"commit      {commit}")
    print(f"deposition  {(DOCS / 'zenodo_deposition.json').relative_to(ROOT)}")
    print()
    print("Next author actions:")
    print("  1. Upload this exact ZIP to the manually reserved Zenodo new-version draft; do not use GitHub auto-import for this version.")
    print("  2. Publish the Zenodo draft, download its ZIP, and verify its SHA-256 equals the value above.")
    print("  3. Publish the matching GitHub release/tag only with Zenodo GitHub auto-import disabled, to avoid a duplicate record.")
    print("  4. Point release_metadata.json archive_path at the downloaded ZIP; regenerate evidence, build the PDF, and run check_softwarex_release.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
