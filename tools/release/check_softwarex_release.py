#!/usr/bin/env python3
"""Fail closed unless the SoftwareX archive and manuscript are release-complete."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import urllib.request
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


def main() -> int:
    errors: list[str] = []
    metadata_path = DOCS / "release_metadata.json"
    metadata = read_json(metadata_path, errors)
    serialized = json.dumps(metadata)
    if PENDING in serialized:
        fail(errors, "release metadata contains RELEASE_PENDING")

    # OCR accuracy is a withdrawn claim (no gold-standard annotation exists;
    # see the manuscript's Ethics/related-work framing and
    # response_to_revision.md). The gate no longer requires a frozen
    # manifest, adjudicated gold standard, or ocr_results.* artifacts --
    # requiring them here would make the gate unsatisfiable for exactly the
    # release this repository actually ships.

    corpus_csv = ROOT / "data" / "medicine_reference" / "Final_Medicine_Dataset.csv"
    if not corpus_csv.exists():
        fail(errors, "medicine reference corpus CSV is missing")
    else:
        import csv

        with corpus_csv.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if len(rows) != 71795:
            fail(errors, f"medicine reference corpus has {len(rows)} rows, expected 71795")
        drug_keys = {row["drug_key"] for row in rows}
        if len(drug_keys) != 7389:
            fail(errors, f"medicine reference corpus resolves to {len(drug_keys)} drugs, expected 7389")
        brand_keys = {(row["drug_key"], row["brand_name"], row["manufacturer"]) for row in rows}
        if len(brand_keys) != 67001:
            fail(errors, f"medicine reference corpus resolves to {len(brand_keys)} brands, expected 67001")

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
        "release_metadata.tex", "dependency_container_model_checksums.json",
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
    try:
        verification_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        if verification.get("git_commit") != verification_commit:
            fail(errors, "verification evidence does not refer to HEAD")
    except (OSError, subprocess.CalledProcessError) as exc:
        fail(errors, f"cannot resolve verification commit: {exc}")
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

    for report_name in ("booking_results.json", "safety_results.json"):
        report = read_json(DOCS / "generated" / report_name, errors)
        if report.get("passed") is False:
            fail(errors, f"generated report did not pass: {report_name}")

    try:
        actual_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        if metadata.get("git_commit") != actual_commit:
            fail(errors, "release metadata commit does not match HEAD")
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
