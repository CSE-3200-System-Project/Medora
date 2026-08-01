#!/usr/bin/env python3
"""Generate release macros, checksums, and manuscript tables from frozen JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
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
        r"\begin{table}[!h]", r"\centering\small", r"\resizebox{\linewidth}{!}{%", r"\begin{tabular}{@{}rrrrr@{}}", r"\toprule",
        r"Concurrency & Passed / 30 & Transaction p95 (ms) & Outbox p95 (ms) & Unique commit \\", r"\midrule",
    ]
    for item in report["results"]:
        tx = item["transaction_latency_ms"]["p95"]
        delivery = item["notification_propagation_latency_ms"]["p95"]
        lines.append(f"{item['concurrency']} & {item['passed_repetitions']} / 30 & {tx:.1f} & {delivery:.1f} & {'yes' if item['passed'] else 'no'} \\\\")
    lines.extend([r"\bottomrule", r"\end{tabular}%", r"}", r"\caption{Booking contention. Transaction and post-commit outbox propagation latency are distinct measurements.}", r"\label{tab:booking-results}", r"\end{table}"])
    return "\n".join(lines) + "\n"


def render_safety(report: dict) -> str:
    pii, nav, summary = report["privacy"], report["navigation"], report["summaries"]
    return "\n".join([
        r"\begin{table}[!h]", r"\centering\small", r"\begin{tabular}{@{}lrrl@{}}", r"\toprule",
        r"Suite & Cases & Passed & Review state \\", r"\midrule",
        f"Bilingual privacy & {pii['cases']} & {pii['passed']} & synthetic \\\\",
        f"Symptom navigation & {nav['cases']} & {nav['passed']} & {tex_escape(nav['review_state'])} \\\\",
        f"Source-grounded summaries & {summary['cases']} & {summary['passed']} & fixtures \\\\",
        r"\bottomrule", r"\end{tabular}", r"\caption{Safety fixture results. Clinician review state is reported explicitly.}", r"\label{tab:safety-results}", r"\end{table}",
    ]) + "\n"


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
    if not args.pre_archive and len(evidence_sources) != 3:
        raise SystemExit("final generation requires --ocr, --booking, and --safety")
    required_sources = evidence_sources if args.pre_archive else [args.metadata, *evidence_sources]
    for source in required_sources:
        if not source.exists():
            raise SystemExit(f"missing required source: {source}")
    GENERATED.mkdir(parents=True, exist_ok=True)

    if not args.pre_archive:
        metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
        if "RELEASE_PENDING" in json.dumps(metadata):
            raise SystemExit("release metadata is incomplete")
        macros = {"ReleaseVersion": metadata["version"], "ReleaseDOI": metadata["zenodo_doi"], "ReleaseCommit": metadata["git_commit"], "ReleaseDate": metadata["release_date"]}
        (GENERATED / "release_metadata.tex").write_text("".join(f"\\newcommand{{\\{name}}}{{{tex_escape(value)}}}\n" for name, value in macros.items()), encoding="utf-8")

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
    print(
        "generated manuscript inputs and "
        f"{len(checksums) + len(external_models)} file/model checksums plus {len(containers)} container records"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
