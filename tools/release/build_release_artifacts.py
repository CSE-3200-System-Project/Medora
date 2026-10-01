#!/usr/bin/env python3
"""Generate release macros, checksums, and manuscript tables from frozen JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "docs" / "softwarex" / "generated"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tex_escape(value: object) -> str:
    text = str(value)
    for source, replacement in (("\\", r"\textbackslash{}"), ("_", r"\_"), ("%", r"\%"), ("&", r"\&"), ("#", r"\#")):
        text = text.replace(source, replacement)
    return text


def percent(value: float | None) -> str:
    return "--" if value is None else f"{100 * value:.1f}"


def wilson_95(successes: int, trials: int) -> tuple[float | None, float | None]:
    """Two-sided Wilson interval for a binomial fixture proportion."""
    if trials == 0:
        return None, None
    z = 1.959963984540054
    proportion = successes / trials
    denominator = 1 + z * z / trials
    center = (proportion + z * z / (2 * trials)) / denominator
    margin = z * math.sqrt(
        proportion * (1 - proportion) / trials + z * z / (4 * trials * trials)
    ) / denominator
    return center - margin, center + margin


def interval_text(successes: int, trials: int) -> str:
    lower, upper = wilson_95(successes, trials)
    if lower is None or upper is None:
        return "--"
    return f"{100 * lower:.1f}--{100 * upper:.1f}\\%"


def publication_table_layout(source: str) -> str:
    """Use flexible floats and put table captions above their bodies."""
    pattern = r"\\begin\{table(\*?)\}\[[^\]]*\][\s\S]*?\\end\{table\1\}"

    def arrange(match: re.Match) -> str:
        block = match.group(0)
        start = block.find(r"\caption{")
        if start < 0:
            return block
        end, depth = start + len(r"\caption{"), 1
        while depth and end < len(block):
            if block[end - 1] != "\\":
                depth += (block[end] == "{") - (block[end] == "}")
            end += 1
        if depth:
            raise ValueError("Unbalanced table caption")
        caption = block[start:end]
        remainder = block[:start] + block[end:]
        label_match = re.search(r"\\label\{[^}]+\}", remainder)
        label = label_match.group(0) if label_match else ""
        remainder = remainder.replace(label, "", 1) if label else remainder
        line = remainder.index("\n") + 1
        body = remainder[line:].lstrip("\n")
        return remainder[:line] + caption + "\n" + label + "\n" + body

    source = re.sub(pattern, arrange, source)
    source = re.sub(r"\\begin\{table(\*?)\}\[[^\]]*\]", r"\\begin{table\1}[!htbp]", source)
    return re.sub(r"\n{3,}", "\n\n", source)


def render_ocr(report: dict) -> str:
    lines = [
        r"\begin{table}[!h]", r"\centering\small", r"\begin{tabular}{@{}lrrrr@{}}", r"\toprule",
        r"Config. & Rx CER & Rx WER & Complete row (\%) & Full Rx exact (\%) \\", r"\midrule",
    ]
    for config in "ABCDEFGH":
        metrics = report["summary"][config]
        lines.append(f"{config} & {metrics['cer']:.3f} & {metrics['wer']:.3f} & {percent(metrics['complete_row_accuracy'])} & {percent(metrics['full_prescription_exact'])} \\\\")
    lines.extend([r"\bottomrule", r"\end{tabular}", r"\caption{Held-out OCR results generated from the frozen prescription-level score table. Confidence intervals and field metrics are in the archive.}", r"\label{tab:ocr-results}", r"\end{table}"])
    return "\n".join(lines) + "\n"


def render_booking(report: dict) -> str:
    lines = [
        r"\begin{table}[!htbp]", r"\centering\small\setlength{\tabcolsep}{3pt}",
        r"\begin{tabular}{@{}rrlrrrr@{}}", r"\toprule",
        r"Attempts & Trials & Stage & n & p50 (ms) & p95 (ms) & p99 (ms) \\", r"\midrule",
    ]
    for row_index, item in enumerate(report["results"]):
        tx = item["transaction_latency_ms"]
        delivery = item["notification_propagation_latency_ms"]
        lines.append(
            f"{item['concurrency']} & {item['passed_repetitions']} / {item['repetitions']} & "
            f"Request--commit & {tx['n']} & {tx['p50']:.1f} & {tx['p95']:.1f} & {tx['p99']:.1f} \\\\"
        )
        lines.append(r"\midrule")
        lines.append(f" & & Outbox & {delivery['n']} & {delivery['p50']:.1f} & {delivery['p95']:.1f} & {delivery['p99']:.1f} \\\\")
        if row_index < len(report["results"]) - 1:
            lines.append(r"\midrule")
    lines.extend([
        r"\bottomrule", r"\end{tabular}",
        r"\caption{Thirty fresh-slot trials per concurrency, excluding one warm-up. All correctness checks passed. Request-through-commit and outbox latency are separate; nearest-rank quantiles describe this topology. Raw observations and trial-cluster bootstrap intervals accompany the report.}",
        r"\label{tab:booking-results}", r"\end{table}",
    ])
    return publication_table_layout("\n".join(lines) + "\n")


def render_safety_summary(report: dict) -> str:
    pii, nav, summary = report["privacy"], report["navigation"], report["summaries"]
    recall_interval = interval_text(pii["true_positives"], pii["expected_identifier_spans"])
    emergency_cases = sum(bool(item["expected_emergency"]) for item in nav["raw"])
    emergency_detected = emergency_cases - nav["emergency_false_negatives"]
    emergency_interval = interval_text(emergency_detected, emergency_cases)
    return publication_table_layout("\n".join([
        r"\begin{table}[!htbp]", r"\centering\small",
        r"\begin{tabularx}{\linewidth}{@{}L{0.23\linewidth}rYL{0.18\linewidth}@{}}", r"\toprule",
        r"Suite & Cases & Reported measurement & Scope \\", r"\midrule",
        f"Bilingual privacy & {pii['cases']} & recall {percent(pii['recall'])}\\% (95\\% CI {recall_interval}); TP={pii['true_positives']}, FP={pii['false_positives']}, FN={pii['false_negatives']} & synthetic \\\\",
        r"\midrule",
        f"Symptom navigation & {nav['cases']} & emergency sensitivity {emergency_detected}/{emergency_cases} (95\\% CI {emergency_interval}); FP={nav['emergency_false_positives']} & clinician-reviewed \\\\",
        r"\midrule",
        f"Source-grounded summaries & {summary['cases']} & {summary['passed']}/{summary['cases']} fixture assertions & deterministic mock \\\\",
        r"\bottomrule", r"\end{tabularx}",
        r"\caption{Fixture measurements. Privacy counts are span-level; intervals are two-sided "
        r"Wilson 95\% intervals describing fixture denominators, not clinical performance. "
        r"Assertions check software contracts rather than every output's correctness. Group rates are in "
        r"Table~\ref{tab:privacy-span-results}.}",
        r"\label{tab:safety-results}", r"\end{table}",
    ]) + "\n")


def navigation_confusion(nav: dict) -> dict[str, int]:
    counts = {"tp": 0, "fn": 0, "fp": 0, "tn": 0}
    for item in nav["raw"]:
        expected = bool(item["expected_emergency"])
        detected = bool(item["emergency_rule_fired"])
        key = "tp" if expected and detected else "fn" if expected else "fp" if detected else "tn"
        counts[key] += 1
    return counts


def render_navigation(report: dict) -> str:
    nav = report["navigation"]
    matrix = navigation_confusion(nav)
    metrics = (
        ("Sensitivity", matrix["tp"], matrix["tp"] + matrix["fn"]),
        ("Specificity", matrix["tn"], matrix["tn"] + matrix["fp"]),
        ("Positive predictive value", matrix["tp"], matrix["tp"] + matrix["fp"]),
        ("Negative predictive value", matrix["tn"], matrix["tn"] + matrix["fn"]),
    )
    matrix_lines = [
        r"\begin{table}[!h]", r"\centering\small",
        r"\begin{tabular}{@{}lrrl@{}}", r"\toprule",
        r"Measure & n & N & Estimate (95\% Wilson CI) \\",
        r"\midrule",
    ]
    for row_index, (label, successes, trials) in enumerate(metrics):
        lower, upper = wilson_95(successes, trials)
        estimate = f"{100 * successes / trials:.1f}\\%" if trials else "--"
        interval = f"{100 * lower:.1f}--{100 * upper:.1f}\\%" if lower is not None and upper is not None else "--"
        matrix_lines.append(f"{label} & {successes} & {trials} & {estimate} ({interval}) " + r"\\")
        if row_index < len(metrics) - 1:
            matrix_lines.append(r"\midrule")
    matrix_lines.extend([
        r"\bottomrule", r"\end{tabular}",
        r"\caption{Deterministic emergency screen on 30 clinician-reviewed fixtures: "
        f"TP={matrix['tp']}, FN={matrix['fn']}, FP={matrix['fp']}, TN={matrix['tn']}. Wilson intervals describe fixtures only, not clinical triage performance.}}",
        r"\label{tab:navigation-emergency-results}", r"\end{table}",
    ])
    rows: dict[str, dict[str, int]] = {}
    for item in nav["raw"]:
        bucket = rows.setdefault(
            item["expected"], {"cases": 0, "recorded": 0, "mock": 0, "documented": 0}
        )
        bucket["cases"] += 1
        bucket["recorded"] += bool(item["matched_expected"])
        bucket["mock"] += item["mock_candidate_source"] == item["expected_candidate_source"]
        bucket["documented"] += bool(item["limitation_class"])

    lines = matrix_lines + [
        r"\begin{table}[!h]",
        r"\centering\small",
        r"\begin{tabular}{@{}lrrrr@{}}",
        r"\toprule",
        r"Expected class & Cases & Recorded & Mock & Documented \\",
        r"\midrule",
    ]
    ordered_rows = sorted(rows.items())
    for row_index, (label, bucket) in enumerate(ordered_rows):
        lines.append(
            f"{tex_escape(label)} & {bucket['cases']} & {bucket['recorded']} & "
            f"{bucket['mock']} & {bucket['documented']}" + r" \\"
        )
        if row_index < len(ordered_rows) - 1:
            lines.append(r"\midrule")
    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\caption{Provider-dependent specialty outcomes are separated from the deterministic emergency screen. "
        r"Recorded and Mock are fixture paths and do not represent a live-provider comparison.}",
        r"\label{tab:navigation-agreement-results}",
        r"\end{table}",
    ])
    return publication_table_layout("\n".join(lines) + "\n")


def render_safety(report: dict) -> str:
    pii = report["privacy"]

    def percent(value: float | None) -> str:
        return "--" if value is None else f"{value * 100:.1f}\\%"

    lines = [
        render_safety_summary(report).rstrip(),
        render_navigation(report).rstrip(),
        r"\begin{table*}[!ht]",
        r"\centering\scriptsize",
        r"\begin{tabular}{@{}lrrrrr@{}}",
        r"\toprule",
        r"Identifier group & Cases & Precision & Recall & False redaction & Documented limitations \\",
        r"\midrule",
    ]
    ordered_groups = list(pii["by_report_group"].items())
    for row_index, (group, metrics) in enumerate(ordered_groups):
        lines.append(
            f"{tex_escape(group)} & {metrics['cases']} & {percent(metrics['precision'])} & "
            f"{percent(metrics['recall'])} & {percent(metrics['false_redaction_rate'])} & "
            f"{metrics['documented_limitations']}" + r" \\"
        )
        if row_index < len(ordered_groups) - 1:
            lines.append(r"\midrule")
    lines.extend([
        r"\midrule",
        f"All production-path cases & {pii['cases']} & {percent(pii['precision'])} & "
        f"{percent(pii['recall'])} & {percent(pii['false_redaction_rate'])} & "
        f"{pii['documented_limitations']}" + r" \\",
        r"\bottomrule",
        r"\end{tabular}",
        r"\caption{Span-level privacy metrics on the production call path, which supplies the "
        r"redactor with no known identifiers. A dash means the group annotates no span for that "
        r"denominator. The undetected identifier forms are named in the text.}",
        r"\label{tab:privacy-span-results}",
        r"\end{table*}",
    ])
    return publication_table_layout("\n".join(lines) + "\n")


def copy_json(source: Path, destination: Path) -> dict:
    payload = json.loads(source.read_text(encoding="utf-8"))
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, default=ROOT / "docs/softwarex/release_metadata.json")
    parser.add_argument("--ocr", type=Path)
    parser.add_argument("--booking", type=Path)
    parser.add_argument("--safety", type=Path)
    parser.add_argument(
        "--pre-archive",
        action="store_true",
        help="Generate available evidence tables before DOI/archive metadata exists",
    )
    args = parser.parse_args()
    evidence_sources = [source for source in (args.ocr, args.booking, args.safety) if source is not None]
    if not evidence_sources:
        raise SystemExit("provide at least one of --ocr, --booking, or --safety")
    # --ocr is no longer required for a final build. The OCR accuracy claim is withdrawn
    # for this release, so demanding its report here made final generation impossible for
    # exactly the release this repository ships. check_softwarex_release.py dropped the
    # same requirement for the same reason; this file had been left behind.
    if not args.pre_archive and not (args.booking and args.safety):
        raise SystemExit("final generation requires --booking and --safety")
    required_sources = evidence_sources if args.pre_archive else [args.metadata, *evidence_sources]
    for source in required_sources:
        if not source.exists():
            raise SystemExit(f"missing required source: {source}")
    GENERATED.mkdir(parents=True, exist_ok=True)

    # The paper needs the version DOI/date before the source commit. The exact commit hash,
    # capsule run receipt, and archive checksum are post-commit/post-deposit values and
    # must not block generating the manuscript macros or pre-commit evidence manifest.
    if args.metadata.exists():
        metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
        required_paper_identity = ("version", "zenodo_doi", "release_date")
        paper_identity_complete = all(
            metadata.get(field) and "RELEASE_PENDING" not in str(metadata.get(field))
            for field in required_paper_identity
        )
        if not paper_identity_complete and not args.pre_archive:
            raise SystemExit("release version, reserved Zenodo DOI, and release date are required to build final paper metadata")
        if paper_identity_complete:
            # A 40-character hash in the code-metadata table overflows the column by
            # 26pt and there is no break opportunity inside \url in a tabularx cell.
            # Twelve characters resolve unambiguously on GitHub and in git; the full
            # value stays in release_metadata.json, verification.json, and the deposit.
            macros = {
                "ReleaseVersion": metadata["version"],
                "ReleaseDOI": metadata["zenodo_doi"],
                "ReleaseDate": metadata["release_date"],
            }
            (GENERATED / "release_metadata.tex").write_text("".join(f"\\newcommand{{\\{name}}}{{{tex_escape(value)}}}\n" for name, value in macros.items()), encoding="utf-8")
    elif not args.pre_archive:
        raise SystemExit(f"missing required source: {args.metadata}")

    if args.ocr:
        ocr = copy_json(args.ocr, GENERATED / "ocr_results.json")
        if ocr.get("denominator") != 82 or ocr.get("split") != "test":
            raise SystemExit("OCR report is not the frozen 82-record held-out test run")
        (GENERATED / "ocr_results.tex").write_text(render_ocr(ocr), encoding="utf-8")
    if args.booking:
        booking = copy_json(args.booking, GENERATED / "booking_results.json")
        if not booking.get("passed"):
            raise SystemExit("booking report did not pass")
        (GENERATED / "booking_results.tex").write_text(render_booking(booking), encoding="utf-8")
    if args.safety:
        safety = copy_json(args.safety, GENERATED / "safety_results.json")
        if not safety.get("passed") and not args.pre_archive:
            raise SystemExit("safety report did not pass")
        (GENERATED / "safety_results.tex").write_text(render_safety(safety), encoding="utf-8")

    checksum_candidates = [ROOT / "backend/requirements-release.txt", ROOT / "ai_service/requirements-release.txt", ROOT / "tests/requirements-release.txt", ROOT / "frontend/package-lock.json", ROOT / "tests/e2e/package-lock.json", ROOT / "backend/Dockerfile", ROOT / "ai_service/Dockerfile", ROOT / "tests/benchmarks/provider_manifest.json", ROOT / "tests/benchmarks/datasets/ocr_corpus_manifest.json"]
    model_root = ROOT / "ai_service/models"
    if model_root.exists():
        checksum_candidates.extend(path for path in model_root.rglob("*") if path.is_file())
    checksums = {str(path.relative_to(ROOT)).replace("\\", "/"): {"sha256": sha256(path), "bytes": path.stat().st_size} for path in checksum_candidates if path.is_file()}

    external_models: dict[str, dict[str, object]] = {}
    model_cache_root = Path(os.environ.get("USERPROFILE", "")) / ".paddlex" / "official_models"
    for model_name in ("PP-OCRv4_mobile_det", "en_PP-OCRv4_mobile_rec"):
        model_dir = model_cache_root / model_name
        for path in model_dir.glob("inference.*") if model_dir.is_dir() else ():
            if path.is_file():
                external_models[f"paddlex-cache/{model_name}/{path.name}"] = {
                    "sha256": sha256(path),
                    "bytes": path.stat().st_size,
                    "archive_inclusion": "downloaded model artifact; package separately or reproduce from the named Paddle model",
                }

    containers: dict[str, dict[str, object]] = {}
    for tag in ("medora-backend:softwarex-rc", "medora-ai:softwarex-rc"):
        try:
            raw = subprocess.check_output(
                ["docker", "image", "inspect", tag],
                cwd=ROOT,
                text=True,
                stderr=subprocess.DEVNULL,
            )
            item = json.loads(raw)[0]
            containers[tag] = {
                "image_id": item.get("Id"),
                "repo_digests": item.get("RepoDigests") or [],
                "os": item.get("Os"),
                "architecture": item.get("Architecture"),
                "size_bytes": item.get("Size"),
            }
        except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, IndexError):
            containers[tag] = {"status": "not built in this environment"}

    inventory = {
        "schema_version": "1.0.0",
        "files": checksums,
        "external_model_artifacts": external_models,
        "container_images": containers,
    }
    (GENERATED / "dependency_container_model_checksums.json").write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")

    evidence_paths = [
        ROOT / "docs/softwarex/release_metadata.json",
        ROOT / "tests/benchmarks/provider_manifest.json",
        ROOT / "docs/softwarex/generated/safety_results.json",
        ROOT / "docs/softwarex/generated/safety_results.tex",
        ROOT / "docs/softwarex/generated/booking_results.json",
        ROOT / "docs/softwarex/generated/booking_results.tex",
        ROOT / "docs/softwarex/generated/privacy_extension_results.json",
        ROOT / "docs/softwarex/generated/consent_scope_results.json",
        ROOT / "docs/softwarex/generated/extended_results.tex",
        ROOT / "docs/softwarex/generated/extended_evidence_verification.json",
        ROOT / "docs/softwarex/generated/dependency_container_model_checksums.json",
        ROOT / "docs/softwarex/medora_softwarex.tex",
        ROOT / "docs/softwarex/Medora-Overleaf-First-Submission.tex",
        ROOT / "docs/softwarex/figures-src/consent_flow.tex",
        ROOT / "docs/REPRODUCING.md",
        ROOT / "docs/softwarex/response_to_revision.md",
        ROOT / "docs/softwarex/CODE_OCEAN_CAPSULE.md",
        ROOT / "docs/softwarex/FINAL_HUMAN_GATES.md",
        ROOT / "docs/softwarex/FINAL_REVISION_REPORT.md",
        ROOT / "docs/softwarex/CAPSULE_RESULT_COVERAGE.md",
        ROOT / "tools/softwarex/build_revision_evidence.py",
        ROOT / "docs/INTEROPERABILITY.md",
        ROOT / "docs/THREAT_MODEL.md",
        ROOT / "tools/release/render_softwarex_tables.py",
        ROOT / "tools/release/run_softwarex_capsule.sh",
        ROOT / "run",
        ROOT / "data/medicine_reference/PROVENANCE.md",
        ROOT / "data/medicine_reference/UPDATE_POLICY.md",
        ROOT / "data/medicine_reference/SOURCE_PERMISSION_RECORD.json",
        ROOT / "THIRD_PARTY_NOTICES.md",
        ROOT / "docs/softwarex/generated/dashboard_capture_receipt.json",
        ROOT / "docs/softwarex/generated/detector_metadata_inspection.json",
        ROOT / "docs/softwarex/generated/detector_pair_verification.json",
        ROOT / "docs/softwarex/generated/medicine_v2_full_build_manifest.json",
        ROOT / "docs/softwarex/generated/medicine_v2_full_quality_report.json",
        ROOT / "docs/softwarex/generated/medicine_v2_full_change_report.json",
        ROOT / "docs/softwarex/generated/medicine_v2_full_verification.json",
        ROOT / "ai_service/models/Yolo26s/AUTHOR_DISTRIBUTION_DECISION.md",
        ROOT / "ai_service/models/Yolo26s/MODEL_CARD.md",
        ROOT / "ai_service/models/Yolo26s/DISTRIBUTION.md",
    ]
    code_ocean_manifest = (metadata.get("code_ocean") or {}).get("manifest_path") if "metadata" in locals() else None
    if code_ocean_manifest:
        evidence_paths.append(ROOT / str(code_ocean_manifest))
    release_identity = (
        {
            field: metadata.get(field)
            for field in ("version", "git_commit", "zenodo_doi", "archive_sha256")
        }
        if args.metadata.exists() and "metadata" in locals()
        else {}
    )
    evidence_manifest = {
        "schema_version": "1.0.0",
        "release_identity": release_identity,
        "artifacts": {
            str(path.relative_to(ROOT)).replace("\\", "/"): {
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
            }
            for path in evidence_paths
            if path.is_file()
        },
    }
    (GENERATED / "evidence_manifest.json").write_text(
        json.dumps(evidence_manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(
        "generated manuscript inputs and "
        f"{len(checksums) + len(external_models)} file/model checksums plus {len(containers)} container records"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
