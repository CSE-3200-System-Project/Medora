#!/usr/bin/env python3
"""Generate a conservative weighted audit of the whitepaper execution roadmap."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "docs" / "BCOLBD" / "Whitepaper" / "completion-audit.json"


def _json(relative_path: str) -> dict:
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def _all_exist(*relative_paths: str) -> bool:
    return all((ROOT / path).exists() for path in relative_paths)


def _core_arohon() -> bool:
    return _all_exist("backend/app/core/arohon.py", "backend/app/routes/arohon.py")


def _core_akkhor() -> bool:
    return _all_exist("backend/app/routes/akkhor.py", "packages/akkhor/README.md")


def _core_lokkhon() -> bool:
    report = _json("benchmark/lokkhon/results/lokkhon_v0.1.json")
    return bool(report) and _all_exist("benchmark/lokkhon/run_lokkhon.py")


def _core_shimana() -> bool:
    report = _json("tests/benchmarks/reports/shimana_report.json")
    return bool(report) and _all_exist("tests/benchmarks/reports/shimana_frontier.csv")


def _core_stewardship() -> bool:
    return _all_exist(
        "backend/alembic/versions/steward_001_admin_governance.py",
        "backend/app/core/admin_authorization.py",
        "backend/app/db/models/admin_governance.py",
    )


def _phi_corpus() -> bool:
    manifest = _json("tools/phi_ner/corpus/manifest.json")
    pools = manifest.get("pools", {}).get("source_totals", {})
    geography = manifest.get("geography_coverage", {})
    frames = manifest.get("frames", {})
    rows = sum(split.get("rows", 0) for split in manifest.get("splits", {}).values())
    return (
        rows == 12000
        and pools.get("given_name_forms", 0) >= 500
        and pools.get("family_name_forms", 0) >= 500
        and geography.get("upazilas", 0) >= 495
        and 60 <= frames.get("realised_total", 0)
    )


def _phi_measured() -> bool:
    report = _json("tools/phi_ner/reports/phi_ner_eval.json")
    gate = report.get("release_gate", {})
    probe = report.get("populations", {}).get("novel_identifier_probe", {}).get("systems", {})
    return (
        gate.get("admission_version") == "phi-ner-admission-1.1"
        and gate.get("passed") is True
        and "model.onnx.data" in gate.get("bundle_files", {})
        and probe.get("model", {}).get("status") == "measured"
        and probe.get("union", {}).get("status") == "measured"
    )


def _maya_automated() -> bool:
    protocol = _json("experiments/maya/qwen35_2b_protocol.json")
    template_path = ROOT / "experiments/maya/qwen35_2b_responses_template.jsonl"
    template = [json.loads(line) for line in template_path.read_text(encoding="utf-8").splitlines()]
    return (
        protocol.get("status") == "frozen_blocked_pending_clinical_review"
        and protocol.get("result_status") == "not_run"
        and len(template) == 35
        and all(row.get("response") == "" for row in template)
        and _all_exist(
            "experiments/maya/run_gate.py",
            "experiments/maya/Maya_Qwen35_2B_Baseline_Colab.ipynb",
            "experiments/maya/Maya_Qwen35_2B_QLoRA_Colab.ipynb",
            "data/maya_navigation_sft_v1/draft_combined.jsonl",
        )
    )


def _maya_clinical_review() -> bool:
    path = ROOT / "data/maya_navigation_sft_v1/approved_combined.jsonl"
    if not path.exists():
        return False
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    return len(rows) == 120 and all(row.get("review_status") == "clinician_approved" for row in rows)


def _maya_training() -> bool:
    path = ROOT / "experiments/maya/reports/qwen35_2b_training_summary.json"
    if not path.exists():
        return False
    summary = json.loads(path.read_text(encoding="utf-8"))
    return summary.get("status") == "complete" and {
        run.get("seed") for run in summary.get("runs", [])
    } == {17, 42, 73}


def _maya_admission() -> bool:
    path = ROOT / "experiments/maya/reports/maya_admission.json"
    return path.exists() and json.loads(path.read_text(encoding="utf-8")).get("passed") is True


def _signed_evidence(relative_path: str) -> bool:
    path = ROOT / relative_path
    if not path.exists():
        return False
    evidence = json.loads(path.read_text(encoding="utf-8"))
    return evidence.get("status") == "passed" and bool(evidence.get("sign_offs"))


def _paper_synced() -> bool:
    claim_map = (ROOT / "docs/BCOLBD/Whitepaper/claim-evidence-map.md").read_text(encoding="utf-8")
    self_review = (ROOT / "docs/BCOLBD/Whitepaper/self-review.md").read_text(encoding="utf-8")
    return (
        "phi-ner-admission-1.1" in claim_map
        and "Qwen/Qwen3.5-2B" in claim_map
        and "MuRIL bundle is now measured" in self_review
    )


@dataclass(frozen=True)
class AuditItem:
    item_id: str
    title: str
    weight: int
    owner: str
    evidence: list[str]
    check: Callable[[], bool]
    remaining_action: str


ITEMS = [
    AuditItem("arohon", "Arohon implementation", 7, "automated", ["backend/app/core/arohon.py"], _core_arohon, "Restore the Arohon implementation artifacts."),
    AuditItem("akkhor", "Akkhor implementation", 7, "automated", ["backend/app/routes/akkhor.py"], _core_akkhor, "Restore the Akkhor API/package artifacts."),
    AuditItem("lokkhon", "Lokkhon v0.1 measurement", 7, "automated", ["benchmark/lokkhon/results/lokkhon_v0.1.json"], _core_lokkhon, "Regenerate Lokkhon v0.1."),
    AuditItem("shimana", "Shimana measured sweep", 7, "automated", ["tests/benchmarks/reports/shimana_report.json"], _core_shimana, "Regenerate the Shimana report and frontier."),
    AuditItem("stewardship_code", "Stewardship implementation", 7, "automated", ["backend/alembic/versions/steward_001_admin_governance.py"], _core_stewardship, "Restore the stewardship migration and authorization layer."),
    AuditItem("phi_corpus", "Registered PHI corpus coverage", 10, "automated", ["tools/phi_ner/corpus/manifest.json"], _phi_corpus, "Rebuild the 12,000-row corpus at registered coverage."),
    AuditItem("phi_admission", "Measured PHI union admission", 15, "automated", ["tools/phi_ner/reports/phi_ner_eval.json"], _phi_measured, "Evaluate an admitted bundle and bind all ONNX weight files."),
    AuditItem("maya_automated", "Frozen Maya harness and Qwen protocol", 10, "automated", ["experiments/maya/qwen35_2b_protocol.json"], _maya_automated, "Freeze the protocol, notebooks, datasets, and blank response sheet."),
    AuditItem("maya_clinical_review", "Maya training-corpus clinical approval", 6, "human_clinical", ["data/maya_navigation_sft_v1/approved_combined.jsonl"], _maya_clinical_review, "Complete two independent reviews and adjudication for all 120 rows."),
    AuditItem("maya_training", "Three-seed Qwen QLoRA run", 6, "gpu_and_human_gated", ["experiments/maya/reports/qwen35_2b_training_summary.json"], _maya_training, "Train seeds 17, 42, and 73 only after corpus approval."),
    AuditItem("maya_admission", "Paired Maya admission experiment", 4, "gpu_provider_and_clinical", ["experiments/maya/reports/maya_admission.json"], _maya_admission, "Capture paired responses, run the gate, and obtain output review."),
    AuditItem("staging", "Signed staging rollout", 4, "external_staging", ["evidence/releases/staging.json"], lambda: _signed_evidence("evidence/releases/staging.json"), "Snapshot and migrate the identified staging database, then record smoke evidence."),
    AuditItem("canary", "Signed canary decision", 5, "external_canary", ["evidence/releases/canary.json"], lambda: _signed_evidence("evidence/releases/canary.json"), "Measure latency/fallbacks and obtain privacy, clinical, and engineering sign-offs."),
    AuditItem("paper_sync", "Post-whitepaper evidence synchronization", 5, "automated", ["docs/BCOLBD/Whitepaper/claim-evidence-map.md", "docs/BCOLBD/Whitepaper/self-review.md"], _paper_synced, "Synchronize current PHI and Maya evidence without rewriting the archived submission result."),
]


def build_audit() -> dict:
    rows = []
    completed_weight = 0
    for item in ITEMS:
        check_error = None
        try:
            complete = item.check()
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            complete = False
            check_error = f"{type(exc).__name__}: {exc}"
        completed_weight += item.weight if complete else 0
        rows.append({
            "id": item.item_id,
            "title": item.title,
            "weight": item.weight,
            "status": "complete" if complete else "remaining",
            "owner": item.owner,
            "evidence": item.evidence,
            "remaining_action": None if complete else item.remaining_action,
            "check_error": check_error,
        })
    total_weight = sum(item.weight for item in ITEMS)
    return {
        "schema_version": "whitepaper-completion-audit-1.0",
        "generated_on": date.today().isoformat(),
        "method": "Conservative weighted checklist of the phase 7-10 operational runbook and post-whitepaper evidence commitments. A file counts only when its machine-readable status also passes the registered check.",
        "completed_weight": completed_weight,
        "total_weight": total_weight,
        "completion_percentage": round(100 * completed_weight / total_weight, 1),
        "items": rows,
        "scope_note": "This score is roadmap completion, not clinical safety, model accuracy, regulatory approval, or production readiness.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    audit = build_audit()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Whitepaper roadmap completion: {audit['completion_percentage']:.1f}%")
    print(f"written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
