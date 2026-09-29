#!/usr/bin/env python3
"""Fail closed unless the SoftwareX archive and manuscript are release-complete."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "softwarex"
PENDING = "RELEASE_PENDING"
INCOMPLETE_PROVIDER_MARKERS = (
    "release_pending",
    "must be recorded at release execution",
    "not established",
    "not verified",
    "unknown",
)


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def read_json(path: Path, errors: list[str]) -> dict:
    if not path.exists():
        fail(errors, f"missing {path.relative_to(ROOT)}")
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(errors, f"invalid {path.relative_to(ROOT)}: {exc}")
        return {}


FLOAT_PATTERN = re.compile(r"\\begin\{(table\*|table|figure\*|figure)\}.*?\\end\{\1\}", re.S)
# The two metadata tables are excluded by name in the SoftwareX Guide for Authors.
METADATA_CAPTIONS = ("Code metadata.", "Software metadata (optional)")


def _strip_macros(text: str) -> str:
    text = re.sub(r"\\(?:cite|ref|label|url|href|input|includegraphics)\s*(?:\[[^]]*\])?\{[^}]*\}", " ", text)
    text = re.sub(r"\\[A-Za-z*]+(?:\[[^]]*\])?", " ", text)
    text = re.sub(r"[^\w'-]+", " ", text, flags=re.UNICODE)
    return text


def _words(text: str) -> int:
    return len(_strip_macros(text).split())


def _captions(block: str) -> str:
    found = []
    for start in (match.end() for match in re.finditer(r"\\caption\{", block)):
        depth, index = 1, start
        while index < len(block) and depth:
            if block[index] == "{":
                depth += 1
            elif block[index] == "}":
                depth -= 1
            index += 1
        found.append(block[start:index - 1])
    return " ".join(found)


def _expand_inputs(source: str, base: Path) -> str:
    def replace(match: re.Match[str]) -> str:
        target = base / match.group(1)
        if not target.suffix:
            target = target.with_suffix(".tex")
        return target.read_text(encoding="utf-8") if target.is_file() else " "

    for _ in range(3):
        source = re.sub(r"\\input\{([^}]*)\}", replace, source)
    return source


def manuscript_word_count(path: Path) -> int:
    """Count the manuscript the way the SoftwareX Guide for Authors counts it.

    "The maximum word count is 3000 excluding: title, authors, affiliations,
    references, metadata tables and including: abstract, running text, captions,
    footnotes." Captions therefore count and table bodies do not.
    """
    source = re.sub(r"(?<!\\)%.*", " ", path.read_text(encoding="utf-8"))
    source = _expand_inputs(source, path.parent)
    body = source.split(r"\begin{document}", 1)[-1].split(r"\begin{thebibliography}", 1)[0]

    abstract = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", body, re.S)
    total = _words(abstract.group(1)) if abstract else 0

    main = body.split(r"\end{frontmatter}", 1)[-1]
    for block in (match.group(0) for match in FLOAT_PATTERN.finditer(main)):
        caption = _captions(block)
        if not any(marker in caption for marker in METADATA_CAPTIONS):
            total += _words(caption)
    return total + _words(FLOAT_PATTERN.sub(" ", main))


def manuscript_figure_count(path: Path) -> int:
    source = _expand_inputs(re.sub(r"(?<!\\)%.*", " ", path.read_text(encoding="utf-8")), path.parent)
    return len(re.findall(r"\\begin\{figure\*?\}", source))


def resolve_release_commit(metadata: dict, errors: list[str]) -> str | None:
    """The commit the release actually refers to, which is not necessarily HEAD.

    This used to compare everything against HEAD. That can never hold once a release
    exists: recording the nine verification receipts produces a commit of its own, so
    HEAD is always at least one commit ahead of the tag that was archived and given a
    DOI. Anchoring to the tag named in `version` is both satisfiable and stricter, since
    it ties the evidence to the artifact that was deposited rather than to whatever the
    working branch has moved on to.
    """
    version = str(metadata.get("version") or "").strip()
    if version:
        try:
            return subprocess.check_output(["git", "rev-list", "-n", "1", version], cwd=ROOT, text=True).strip()
        except (OSError, subprocess.CalledProcessError):
            fail(errors, f"release metadata names version {version}, which is not a tag in this repository")
            return None
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        fail(errors, f"cannot resolve release commit: {exc}")
        return None


def fetch_json(url: str, label: str, errors: list[str]) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "Medora-release-check/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except Exception as exc:
        fail(errors, f"{label} could not be read: {exc}")
        return {}


def archive_member(archive: zipfile.ZipFile, relative_path: str, errors: list[str]) -> bytes | None:
    suffix = "/" + relative_path.replace("\\", "/")
    matches = [name for name in archive.namelist() if name.endswith(suffix)]
    if len(matches) != 1:
        fail(errors, f"archive must contain exactly one {relative_path}")
        return None
    try:
        return archive.read(matches[0])
    except (OSError, KeyError, zipfile.BadZipFile) as exc:
        fail(errors, f"archive member {relative_path} is unreadable: {exc}")
        return None


def check_archive_contents(archive_path: Path, metadata: dict, release_commit: str, errors: list[str]) -> None:
    try:
        with zipfile.ZipFile(archive_path) as archive:
            raw_metadata = archive_member(archive, "docs/softwarex/release_metadata.json", errors)
            if raw_metadata is None:
                return
            try:
                archived = json.loads(raw_metadata.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                fail(errors, f"archive release metadata is invalid: {exc}")
                return
            for field in ("version", "git_commit", "zenodo_doi"):
                if archived.get(field) != metadata.get(field):
                    fail(
                        errors,
                        f"archive internal {field} does not match release metadata "
                        f"({archived.get(field)!r} != {metadata.get(field)!r})",
                    )
            archived_capsule = archived.get("code_ocean", {})
            current_capsule = metadata.get("code_ocean", {})
            if archived_capsule.get("capsule_url") != current_capsule.get("capsule_url"):
                fail(errors, "archive Code Ocean capsule URL does not match release metadata")
            if archived_capsule.get("source_commit") != release_commit:
                fail(errors, "archive Code Ocean receipt does not refer to the tagged source commit")
            if archived.get("archive_sha256"):
                fail(errors, "archive metadata must not embed its own archive_sha256; record that receipt outside the ZIP")
            if archived.get("archive_path"):
                fail(errors, "archive metadata must not embed a post-deposit archive_path; record it outside the ZIP")

            tex_data = archive_member(archive, "docs/softwarex/generated/release_metadata.tex", errors)
            if tex_data is not None:
                tex = tex_data.decode("utf-8", errors="replace")
                expected_macros = {
                    "ReleaseVersion": str(metadata.get("version", "")),
                    "ReleaseDOI": str(metadata.get("zenodo_doi", "")),
                    "ReleaseDate": str(metadata.get("release_date", "")),
                }
                for macro, value in expected_macros.items():
                    match = re.search(rf"\\newcommand\{{\\{macro}\}}\{{([^}}]*)\}}", tex)
                    if not match or match.group(1) != value:
                        fail(errors, f"archive generated TeX macro {macro} does not match the released identity")
                if re.search(r"\\newcommand\{\\ReleaseCommit\}", tex):
                    fail(errors, "archive release_metadata.tex must link the version tag, not embed a self-referential commit hash")

            citation_data = archive_member(archive, "CITATION.cff", errors)
            if citation_data is not None:
                citation = citation_data.decode("utf-8", errors="replace")
                match = re.search(r"^version:\s*['\"]?([^'\"\s]+)", citation, re.M)
                if not match or match.group(1) != str(metadata.get("version", "")).removeprefix("v"):
                    fail(errors, "archive CITATION.cff version does not match the release tag")

            codemeta_data = archive_member(archive, "codemeta.json", errors)
            if codemeta_data is not None:
                try:
                    codemeta = json.loads(codemeta_data.decode("utf-8"))
                    if codemeta.get("version") != str(metadata.get("version", "")).removeprefix("v"):
                        fail(errors, "archive codemeta.json version does not match the release tag")
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    fail(errors, f"archive codemeta.json is invalid: {exc}")

            verification_data = archive_member(archive, "docs/softwarex/generated/verification.json", errors)
            if verification_data is not None:
                try:
                    verification = json.loads(verification_data.decode("utf-8"))
                    if verification.get("git_commit") != release_commit:
                        fail(errors, "archive verification receipt does not refer to the tagged source commit")
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    fail(errors, f"archive verification receipt is invalid: {exc}")

            manifest_data = archive_member(archive, "docs/softwarex/generated/evidence_manifest.json", errors)
            if manifest_data is not None:
                try:
                    manifest = json.loads(manifest_data.decode("utf-8"))
                    identity = manifest.get("release_identity", {})
                    for field in ("version", "git_commit", "zenodo_doi"):
                        if identity.get(field) != metadata.get(field):
                            fail(errors, f"archive evidence manifest {field} does not match the released identity")
                    if identity.get("archive_sha256"):
                        fail(errors, "archive evidence manifest must not embed its own archive_sha256")
                    for relative, item in manifest.get("artifacts", {}).items():
                        data = archive_member(archive, relative, errors)
                        if data is not None and hashlib.sha256(data).hexdigest() != item.get("sha256"):
                            fail(errors, f"archive evidence-manifest hash mismatch: {relative}")
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    fail(errors, f"archive evidence manifest is invalid: {exc}")
    except (OSError, zipfile.BadZipFile) as exc:
        fail(errors, f"archive could not be inspected: {exc}")


def check_public_release_links(metadata: dict, archive_path: Path, release_commit: str, errors: list[str]) -> None:
    doi = str(metadata.get("zenodo_doi") or "")
    zenodo_url = str(metadata.get("zenodo_url") or "")
    record_match = re.search(r"/records/(\d+)", zenodo_url)
    if not record_match:
        fail(errors, "zenodo_url must identify a public Zenodo record (/records/<id>)")
        return

    record = fetch_json(f"https://zenodo.org/api/records/{record_match.group(1)}", "Zenodo record API", errors)
    if record:
        if record.get("doi") != doi:
            fail(errors, "public Zenodo DOI does not match release_metadata.json")
        if record.get("metadata", {}).get("version") != metadata.get("version"):
            fail(errors, "public Zenodo version does not match release_metadata.json")
        if record.get("metadata", {}).get("publication_date") != metadata.get("release_date"):
            fail(errors, "public Zenodo publication date does not match release_metadata.json")
        archive_md5 = hashlib.md5(archive_path.read_bytes(), usedforsecurity=False).hexdigest()
        matching_files = [item for item in record.get("files", []) if item.get("checksum", "").casefold() == f"md5:{archive_md5}".casefold()]
        if len(matching_files) != 1:
            fail(errors, "downloaded archive MD5 does not match exactly one file in the public Zenodo record")
        repo = str(metadata.get("source_repository") or "").rstrip("/")
        related = record.get("metadata", {}).get("related_identifiers", [])
        expected_tag_url = f"{repo}/tree/{metadata.get('version')}"
        if not any(item.get("identifier") == expected_tag_url for item in related):
            fail(errors, "Zenodo record does not link to the matching GitHub release tag")
        capsule = metadata.get("code_ocean", {})
        capsule_reference = capsule.get("doi") or capsule.get("capsule_url")
        if capsule_reference and not any(item.get("identifier") == capsule_reference for item in related):
            fail(errors, "Zenodo record does not link to the final Code Ocean capsule")

    parsed = urllib.parse.urlparse(str(metadata.get("source_repository") or ""))
    pieces = parsed.path.strip("/").removesuffix(".git").split("/")
    if parsed.netloc.casefold() != "github.com" or len(pieces) != 2:
        fail(errors, "source_repository must be a public GitHub owner/repository URL for release verification")
        return
    owner, repo_name = pieces
    api_root = f"https://api.github.com/repos/{owner}/{repo_name}"
    tag = urllib.parse.quote(str(metadata.get("version", "")), safe="")
    release = fetch_json(f"{api_root}/releases/tags/{tag}", "GitHub release API", errors)
    if release:
        if release.get("tag_name") != metadata.get("version") or release.get("draft") or release.get("prerelease"):
            fail(errors, "public GitHub release is not the matching published release")

    ref = fetch_json(f"{api_root}/git/ref/tags/{tag}", "GitHub tag API", errors)
    if ref:
        target = ref.get("object", {})
        for _ in range(5):
            if target.get("type") == "commit":
                break
            if target.get("type") != "tag" or not target.get("sha"):
                target = {}
                break
            tag_object = fetch_json(f"{api_root}/git/tags/{target['sha']}", "GitHub annotated-tag API", errors)
            target = tag_object.get("object", {}) if tag_object else {}
        if target.get("type") != "commit" or target.get("sha") != release_commit:
            fail(errors, "public GitHub tag does not resolve to the recorded release commit")


def main() -> int:
    errors: list[str] = []
    metadata_path = DOCS / "release_metadata.json"
    metadata = read_json(metadata_path, errors)
    serialized = json.dumps(metadata)
    if PENDING in serialized:
        fail(errors, "release metadata contains RELEASE_PENDING")

    expected_numeric_version = str(metadata.get("version", "")).removeprefix("v")
    citation_path = ROOT / "CITATION.cff"
    if citation_path.is_file():
        citation = citation_path.read_text(encoding="utf-8")
        citation_version = re.search(r"^version:\s*['\"]?([^'\"\s]+)", citation, re.M)
        if not citation_version or citation_version.group(1) != expected_numeric_version:
            fail(errors, "CITATION.cff version does not match release_metadata.json")
    else:
        fail(errors, "CITATION.cff is missing")
    codemeta_path = ROOT / "codemeta.json"
    codemeta = read_json(codemeta_path, errors)
    if codemeta.get("version") != expected_numeric_version:
        fail(errors, "codemeta.json version does not match release_metadata.json")

    # OCR accuracy is a withdrawn claim (no gold-standard annotation exists;
    # see the manuscript's Ethics/related-work framing and
    # response_to_revision.md). The gate no longer requires a frozen
    # manifest, adjudicated gold standard, or ocr_results.* artifacts --
    # requiring them here would make the gate unsatisfiable for exactly the
    # release this repository actually ships.

    author_decisions = metadata.get("author_decisions", {})
    content_review = author_decisions.get("medicine_content_review", {})
    if content_review.get("status") != "recorded" or not content_review.get("evidence"):
        fail(errors, "qualified-doctor medicine content review needs a dated, scoped evidence reference")
    corpus_decision = author_decisions.get("medicine_corpus_distribution", {})
    corpus_status = corpus_decision.get("decision")
    if corpus_status not in {"cleared", "excluded"} or not corpus_decision.get("evidence"):
        fail(errors, "medicine-corpus public-distribution decision/evidence is missing")
    corpus_csv = ROOT / "data" / "medicine_reference" / "Final_Medicine_Dataset.csv"
    if corpus_status == "cleared" and not corpus_csv.exists():
        fail(errors, "medicine corpus is marked cleared but its CSV is missing")
    elif corpus_status == "excluded" and corpus_csv.exists():
        fail(errors, "medicine corpus is marked excluded but remains in the public release tree")
    elif corpus_status == "cleared" and corpus_csv.exists():
        import csv

        with corpus_csv.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        corpus_manifest_path = corpus_csv.parent / 'build_manifest.json'
        expected = {'rows': 71795, 'drugs': 7389, 'brands': 67001}
        if corpus_manifest_path.is_file():
            corpus_manifest = json.loads(corpus_manifest_path.read_text(encoding='utf-8'))
            expected = corpus_manifest['counts']
            if hashlib.sha256(corpus_csv.read_bytes()).hexdigest() != corpus_manifest['outputs']['Final_Medicine_Dataset.csv']['sha256']:
                fail(errors, 'medicine CSV hash does not match its selected versioned build manifest')
        if len(rows) != expected['rows']:
            fail(errors, f"medicine reference corpus has {len(rows)} rows, expected {expected['rows']}")
        drug_keys = {row["drug_key"] for row in rows}
        if len(drug_keys) != expected['drugs']:
            fail(errors, f"medicine reference corpus resolves to {len(drug_keys)} drugs, expected {expected['drugs']}")
        brand_keys = {(row["drug_key"], row["brand_name"], row["manufacturer"]) for row in rows}
        if len(brand_keys) != expected['brands']:
            fail(errors, f"medicine reference corpus resolves to {len(brand_keys)} brands, expected {expected['brands']}")

    detector_decision = author_decisions.get("detector_distribution", {})
    detector_status = detector_decision.get("decision")
    detector_model = ROOT / "ai_service" / "models" / "Yolo26s" / "Yolo26s-prescription-5.onnx"
    if detector_status not in {"cleared", "excluded"} or not detector_decision.get("evidence"):
        fail(errors, "prescription-detector distribution decision/evidence is missing")
    elif detector_status == "cleared":
        if metadata.get('distribution_license') != 'AGPL-3.0-only':
            fail(errors, 'combined detector archive needs its AGPL-3.0-only distribution licence, not blanket MIT')
        if not detector_model.is_file():
            fail(errors, "detector model is marked cleared but the ONNX file is missing")
        elif hashlib.sha256(detector_model.read_bytes()).hexdigest() != detector_decision.get("sha256"):
            fail(errors, "detector model SHA-256 does not match its distribution record")
    elif detector_model.exists():
        fail(errors, "detector model is marked excluded but remains in the public release tree")

    image_ethics = author_decisions.get("prescription_image_ethics", {})
    if image_ethics.get("status") not in {"documented", "not_required_with_authority"} or not image_ethics.get("evidence"):
        fail(errors, "prescription-image consent/ethics determination is not recorded")

    provider_manifest = read_json(ROOT / "tests" / "benchmarks" / "provider_manifest.json", errors)
    serialized_providers = json.dumps(provider_manifest).casefold()
    if (
        any(marker in serialized_providers for marker in INCOMPLETE_PROVIDER_MARKERS)
        or not provider_manifest.get("execution_date")
    ):
        fail(errors, "provider manifest is incomplete or not execution-dated")

    required_generated = (
        "booking_results.json",
        "booking_results.tex", "safety_results.json", "safety_results.tex",
        "privacy_extension_results.json", "consent_scope_results.json", "extended_results.tex",
        "release_metadata.tex", "dependency_container_model_checksums.json", "evidence_manifest.json",
        "verification.json",
    )
    for name in required_generated:
        if not (DOCS / "generated" / name).exists():
            fail(errors, f"missing generated artifact {name}")

    manuscript = DOCS / "medora_softwarex.tex"
    if not manuscript.exists():
        fail(errors, "manuscript source is missing")
    else:
        source = manuscript.read_text(encoding="utf-8")
        lowered_source = source.casefold()
        if corpus_status == "excluded" and not any(phrase in lowered_source for phrase in ("corpus is not included", "corpus is not redistributed", "corpus was withheld")):
            fail(errors, "manuscript must say that the medicine corpus was excluded from the released artifact")
        if detector_status == "excluded" and not any(phrase in lowered_source for phrase in ("detector model is not included", "detector weights are not distributed", "weights were withheld")):
            fail(errors, "manuscript must say that the prescription-detector model was excluded")
        count = manuscript_word_count(manuscript)
        if count > 3000:
            fail(errors, f"manuscript is {count} words including captions (>3000)")
        figures = manuscript_figure_count(manuscript)
        if figures > 6:
            fail(errors, f"manuscript has {figures} figures (SoftwareX allows 6)")
        forbidden = ("about 92", "approximately 92", "~92", "representative run", "production-grade")
        for phrase in forbidden:
            if phrase.casefold() in source.casefold():
                fail(errors, f"manuscript contains forbidden unsupported phrase: {phrase}")

    verification = read_json(DOCS / "generated" / "verification.json", errors)
    required_checks = ("backend", "ai_service", "integration", "security", "benchmarks", "playwright", "frontend_lint", "frontend_build", "clean_docker")
    release_commit = resolve_release_commit(metadata, errors)
    if release_commit and verification.get("git_commit") != release_commit:
        fail(errors, "verification evidence does not refer to the released commit")
    for check in required_checks:
        receipt = verification.get("checks", {}).get(check, {})
        if receipt.get("status") != "passed" or receipt.get("exit_code") != 0 or not receipt.get("command"):
            fail(errors, f"verification check did not pass: {check}")
            continue
        log_value = receipt.get("log")
        log_path = ROOT / str(log_value or "")
        if not log_value or not log_path.is_file():
            fail(errors, f"verification log is missing: {check}")
        elif hashlib.sha256(log_path.read_bytes()).hexdigest() != receipt.get("log_sha256"):
            fail(errors, f"verification log hash mismatch: {check}")

    capsule = metadata.get("code_ocean", {})
    capsule_url = str(capsule.get("capsule_url") or "")
    parsed_capsule = urllib.parse.urlparse(capsule_url)
    if (
        parsed_capsule.scheme != "https"
        or parsed_capsule.hostname not in {"codeocean.com", "www.codeocean.com"}
        or not parsed_capsule.path.startswith("/capsule/")
        or parsed_capsule.query
        or parsed_capsule.fragment
    ):
        fail(errors, "release metadata lacks a reader-accessible Code Ocean capsule URL")
    if capsule.get("source_commit") != release_commit:
        fail(errors, "Code Ocean run source_commit does not match the tagged release commit")
    if not capsule.get("version") or not capsule.get("run_id"):
        fail(errors, "Code Ocean capsule version/run ID is missing")
    capsule_manifest_value = capsule.get("manifest_path")
    capsule_manifest_path = ROOT / str(capsule_manifest_value or "")
    if not capsule_manifest_value or not capsule_manifest_path.is_file():
        fail(errors, "Code Ocean reproduction manifest is missing")
    elif hashlib.sha256(capsule_manifest_path.read_bytes()).hexdigest() != capsule.get("manifest_sha256"):
        fail(errors, "Code Ocean reproduction manifest hash mismatch")
    else:
        capsule_manifest = read_json(capsule_manifest_path, errors)
        if capsule_manifest.get("source_commit") != release_commit:
            fail(errors, "Code Ocean reproduction manifest source commit does not match the release tag")
        if capsule_manifest.get("ai_provider") != "deterministic mock":
            fail(errors, "Code Ocean reproduction did not use the deterministic mock")
    manuscript_text = manuscript.read_text(encoding="utf-8") if manuscript.exists() else ""
    if capsule_url and capsule_url not in manuscript_text:
        fail(errors, "manuscript does not contain the recorded Code Ocean capsule URL")
    response_path = DOCS / "response_to_revision.md"
    if capsule_url and response_path.is_file() and capsule_url not in response_path.read_text(encoding="utf-8"):
        fail(errors, "response_to_revision.md does not contain the recorded Code Ocean capsule URL")

    for report_name in ("booking_results.json", "safety_results.json"):
        report = read_json(DOCS / "generated" / report_name, errors)
        if report.get("passed") is False:
            fail(errors, f"generated report did not pass: {report_name}")

    evidence_manifest = read_json(DOCS / "generated" / "evidence_manifest.json", errors)
    identity = evidence_manifest.get("release_identity", {})
    for field in ("version", "git_commit", "zenodo_doi", "archive_sha256"):
        if identity.get(field) != metadata.get(field):
            fail(errors, f"evidence manifest {field} does not match release metadata")
    for relative, item in evidence_manifest.get("artifacts", {}).items():
        artifact_path = ROOT / relative
        if not artifact_path.is_file():
            fail(errors, f"evidence-manifest artifact is missing: {relative}")
        elif hashlib.sha256(artifact_path.read_bytes()).hexdigest() != item.get("sha256"):
            fail(errors, f"evidence-manifest artifact hash mismatch: {relative}")

    if release_commit and metadata.get("git_commit") != release_commit:
        fail(errors, f"release metadata commit does not match the {metadata.get('version')} tag")
    try:
        tracked_files = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
        generated_python = [path for path in tracked_files if "/__pycache__/" in f"/{path}" or path.endswith((".pyc", ".pyo"))]
        if generated_python:
            fail(errors, f"generated Python bytecode is tracked ({len(generated_python)} files)")
    except (OSError, subprocess.CalledProcessError) as exc:
        fail(errors, f"cannot resolve git commit: {exc}")

    archive = metadata.get("archive_path")
    if archive:
        archive_path = ROOT / archive
        if not archive_path.exists():
            fail(errors, "archive_path does not exist")
        elif hashlib.sha256(archive_path.read_bytes()).hexdigest() != metadata.get("archive_sha256"):
            fail(errors, "archive checksum does not match release metadata")
        else:
            if release_commit:
                check_archive_contents(archive_path, metadata, release_commit, errors)
                check_public_release_links(metadata, archive_path, release_commit, errors)

    doi_url = metadata.get("zenodo_url")
    if doi_url and PENDING not in str(doi_url):
        try:
            request = urllib.request.Request(str(doi_url), method="HEAD", headers={"User-Agent": "Medora-release-check/1.0"})
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status >= 400:
                    fail(errors, f"Zenodo URL returned HTTP {response.status}")
        except Exception as exc:  # network errors are release failures, not skips
            fail(errors, f"Zenodo URL did not resolve: {exc}")

    if errors:
        print("SoftwareX release gate FAILED:", file=sys.stderr)
        for error in errors:
            print(f" - {error}", file=sys.stderr)
        return 2
    print("SoftwareX release gate passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
