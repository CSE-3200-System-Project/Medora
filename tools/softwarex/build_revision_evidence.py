"""Prepare tables from existing component experiments, without rerunning models."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/release"))
from build_release_artifacts import interval_text  # noqa: E402


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_privacy(report: dict, *, verify_model: bool = False) -> dict:
    checks = {}
    gate = report["release_gate"]
    for name, population in report["populations"].items():
        path = ROOT / population["path"]
        checks[population["path"]] = sha256(path) == gate["datasets"][name]
        for system in population["systems"].values():
            metrics = system["metrics"]
            tp, fp, fn = (metrics[key] for key in ("true_positives", "false_positives", "false_negatives"))
            assert tp + fn == metrics["expected_identifier_spans"]
            assert abs(metrics["recall"] - tp / (tp + fn)) < 1e-10
            assert abs(metrics["precision"] - tp / (tp + fp)) < 1e-10
            assert abs(metrics["false_redaction_rate"] - fp / population["benign_spans"]) < 1e-10
    if verify_model:
        for name, expected in gate["bundle_files"].items():
            path = ROOT / report["bundle"] / name
            checks[f"{report['bundle']}/{name}"] = sha256(path) == expected
    if not all(checks.values()):
        raise ValueError("Archived component report does not match its named fixtures/model files")
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "passed": True,
        "local_model_hashes_checked": verify_model,
        "checks": checks,
        "scope": "Artifact identity and metric arithmetic, not a new model or clinical evaluation",
    }


def render_privacy(report: dict) -> str:
    lines = [
        r"\begin{table}[!htbp]",
        r"\caption{Archived privacy-component comparison. Development results reuse the 134-case tuning set; the separate probe has 36 synthetic cases, 36 identifier spans and 36 benign spans. Recall intervals are two-sided Wilson 95\% intervals. These populations are not pooled or treated as clinical evidence.}",
        r"\label{tab:privacy-extension}",
        r"\centering\small\setlength{\tabcolsep}{3pt}",
        r"\begin{tabular}{@{}llrrr@{}}\toprule",
        r"Population & System & \shortstack{Precision\\(\%)} & \shortstack{Recall (\%)\\95\% CI} & \shortstack{False redaction\\(\%)} \\",
        r"\midrule",
    ]
    for name, population in report["populations"].items():
        for key, system in population["systems"].items():
            metrics = system["metrics"]
            label = "Development" if name == "pii_safety_134" else "Separate probe"
            system_label = {"rules": "Rules", "model": "MuRIL", "union": "Union"}[key]
            ci = interval_text(metrics["true_positives"], metrics["expected_identifier_spans"])
            lines.append(f"{label} & {system_label} & {100*metrics['precision']:.1f} & "
                         f"{100*metrics['recall']:.1f} ({ci}) & {100*metrics['false_redaction_rate']:.1f} " + r"\\")
            lines.append(r"\midrule")
    lines.pop()
    lines += [r"\bottomrule\end{tabular}", r"\end{table}"]
    return "\n".join(lines) + "\n"


def render_consent(report: dict) -> str:
    lines = [
        r"\begin{table}[!htbp]",
        r"\caption{Archived consent-scope experiment on 24 synthetic summaries. Utility is a binary source-accounting contract, not clinical quality. Exposure counts surviving identifiers offline per 1,000 requests; U is an offline exposure counterfactual, not unredacted provider disclosure. Aggregate-only observations do not support paired or causal inference.}",
        r"\label{tab:consent-scope}",
        r"\centering\small\begin{tabular}{@{}lrr@{}}\toprule",
        r"Configuration & Contract utility (\%) & Exposure /1,000 requests \\",
        r"\midrule",
    ]
    for point in report["points"]:
        lines.append(f"{point['config']} & {100*point['utility']:.1f} & {point['exposure_per_1000']:.1f} " + r"\\")
        lines.append(r"\midrule")
    lines.pop()
    lines += [r"\bottomrule\end{tabular}", r"\end{table}"]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-local-model", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/softwarex/generated")
    args = parser.parse_args()
    privacy_path = ROOT / "tools/phi_ner/reports/phi_ner_eval.json"
    consent_path = ROOT / "tests/benchmarks/reports/shimana_report.json"
    privacy = json.loads(privacy_path.read_text(encoding="utf-8"))
    consent = json.loads(consent_path.read_text(encoding="utf-8"))
    verification = validate_privacy(privacy, verify_model=args.verify_local_model)
    verification["report_sha256"] = {p.relative_to(ROOT).as_posix(): sha256(p) for p in (privacy_path, consent_path)}
    args.output.mkdir(parents=True, exist_ok=True)
    for name, value in (("privacy_extension_results.json", privacy), ("consent_scope_results.json", consent),
                        ("extended_evidence_verification.json", verification)):
        (args.output / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    (args.output / "extended_results.tex").write_text(render_privacy(privacy) + render_consent(consent), encoding="utf-8")
    print("Prepared existing privacy/consent component reports; no new inference or clinical evidence claimed.")


if __name__ == "__main__":
    main()
