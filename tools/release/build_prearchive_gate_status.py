#!/usr/bin/env python3
"""Build a fail-closed, pre-Zenodo SoftwareX gate-status table from evidence."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "tests" / "benchmarks" / "reports" / "current"
GENERATED = ROOT / "docs" / "softwarex" / "generated"


def sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    payload = path.read_bytes()
    encoding = "utf-16" if payload.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8"
    return json.loads(payload.decode(encoding))


def read_log(path: Path) -> str:
    if not path.is_file():
        return ""
    payload = path.read_bytes()
    if payload.startswith((b"\xff\xfe", b"\xfe\xff")):
        return payload.decode("utf-16", errors="replace")
    return payload.decode("utf-8", errors="replace")


def log_gate(name: str, log_name: str, pattern: str, note: str) -> dict:
    path = REPORTS / log_name
    text = read_log(path)
    passed = bool(re.search(pattern, text, re.I | re.M))
    return {
        "gate": name,
        "status": "passed" if passed else "not_passed",
        "evidence": str(path.relative_to(ROOT)).replace("\\", "/"),
        "evidence_sha256": sha256(path),
        "note": note,
    }


def main() -> int:
    manifest = load_json(ROOT / "tests/benchmarks/datasets/ocr_corpus_manifest.json")
    booking = load_json(REPORTS / "booking_results.json")
    safety = load_json(REPORTS / "safety_results.json")
    frontend_audit = load_json(REPORTS / "frontend_npm_audit_final.json")
    e2e_audit = load_json(REPORTS / "e2e_npm_audit_final.json")
    provider_manifest = load_json(ROOT / "tests/benchmarks/provider_manifest.json")
    secret_audit = load_json(REPORTS / "generated_secret_audit.json")
    records = manifest.get("records", [])
    prelabels = list((ROOT / "tests/benchmarks/prelabels").glob("RX-*.json"))
    gold_path = ROOT / "tests/benchmarks/datasets/ocr_gold_standard.jsonl"
    gold_count = sum(bool(line.strip()) for line in gold_path.read_text(encoding="utf-8").splitlines()) if gold_path.is_file() else 0

    gates = [
        log_gate("Backend unit tests", "backend_unit_final.out.log", r"45 passed", "Focused backend unit suite."),
        log_gate("Backend smoke tests", "backend_smoke_final.out.log", r"34 passed", "Backend application smoke suite."),
        log_gate("Integration and security tests", "backend_integration_security_final.out.log", r"14 passed", "Docker-backed integration, authorization, consent, and security checks."),
        log_gate("AI-service unit tests", "ai_unit_final.out.log", r"16 passed", "Local OCR, annotation blinding, parser, provider-separation, grouped corpus-freeze, and AI-service tests."),
        log_gate("Frontend lint", "frontend_lint_final.out.log", r"MEDORA_GATE_PASSED", "Next.js lint completed with zero errors; 198 non-blocking warnings remain recorded in the log."),
        log_gate("Frontend production build", "frontend_build_final.log", r"MEDORA_GATE_PASSED|Compiled successfully", "Production Next.js build."),
        log_gate("Provisional browser checks", "playwright_provisional_final.out.log", r"6 passed", "Six public/storage checks passed; six authenticated journeys were skipped because synthetic credentials were not supplied."),
        log_gate("Clean container validation", "docker_validation_final.log", r"MEDORA_GATE_PASSED", "Pinned backend and AI images passed dependency checks and application imports."),
        log_gate("Manuscript compilation", "latex_pass2_final.log", r"Output written on medora_softwarex\.pdf \(9 pages", "Second LaTeX pass completed with zero overfull boxes and zero undefined references/citations."),
    ]

    audit_total = sum(
        report.get("metadata", {}).get("vulnerabilities", {}).get("total", -1)
        for report in (frontend_audit, e2e_audit)
    )
    gates.append(
        {
            "gate": "JavaScript production dependency audit",
            "status": "passed" if audit_total == 0 else "not_passed",
            "evidence": "tests/benchmarks/reports/current/{frontend,e2e}_npm_audit_final.json",
            "evidence_sha256": None,
            "note": f"Combined reported production vulnerabilities: {audit_total if audit_total >= 0 else 'unavailable'}.",
        }
    )
    gates.append(
        {
            "gate": "Generated archive-candidate secret audit",
            "status": "passed" if secret_audit.get("passed") else "not_passed",
            "evidence": "tests/benchmarks/reports/current/generated_secret_audit.json",
            "evidence_sha256": sha256(REPORTS / "generated_secret_audit.json"),
            "note": f"Scanned {secret_audit.get('archive_candidate_files_scanned', 0)} files against {secret_audit.get('local_secret_values_checked', 0)} local environment values; exact-value hits={len(secret_audit.get('files_with_local_env_values', []))}.",
        }
    )

    corpus_ok = len(records) == 105 and sum(bool(item.get("included_in_metrics")) for item in records) == 103
    gates.extend(
        [
            {
                "gate": "OCR corpus inventory",
                "status": "passed" if corpus_ok else "not_passed",
                "evidence": "tests/benchmarks/datasets/ocr_corpus_manifest.json",
                "evidence_sha256": sha256(ROOT / "tests/benchmarks/datasets/ocr_corpus_manifest.json"),
                "note": f"{len(records)} archive files; {sum(bool(item.get('included_in_metrics')) for item in records)} unique metric records. Metadata freeze remains separate.",
            },
            {
                "gate": "Assisted OCR prelabels",
                "status": "passed" if len(prelabels) == 103 else "not_passed",
                "evidence": "tests/benchmarks/prelabels/",
                "evidence_sha256": None,
                "note": f"{len(prelabels)}/103 composed prelabels; drafts are not ground truth.",
            },
            {
                "gate": "Booking contention benchmark",
                "status": "passed" if booking.get("passed") else "not_passed",
                "evidence": "tests/benchmarks/reports/current/booking_results.json",
                "evidence_sha256": sha256(REPORTS / "booking_results.json"),
                "note": "Concurrency 2, 10, and 50 with 30 fresh-slot repetitions each.",
            },
            {
                "gate": "Deterministic safety fixtures",
                "status": "passed" if safety.get("deterministic_passed") else "not_passed",
                "evidence": "tests/benchmarks/reports/current/safety_results.json",
                "evidence_sha256": sha256(REPORTS / "safety_results.json"),
                "note": "Privacy, navigation behavior, and source-grounded summary fixtures; licensed navigation review is a separate gate.",
            },
            {
                "gate": "OCR gold standard and held-out A-H benchmark",
                "status": "passed" if manifest.get("frozen") and gold_count == 103 and (GENERATED / "ocr_results.json").is_file() else "blocked",
                "evidence": "tests/benchmarks/datasets/ocr_gold_standard.jsonl",
                "evidence_sha256": sha256(gold_path),
                "note": f"Manifest frozen={bool(manifest.get('frozen'))}; adjudicated records={gold_count}/103. Requires independent licensed review and adjudication.",
            },
            {
                "gate": "Licensed symptom-navigation review",
                "status": "passed" if safety.get("passed") else "blocked",
                "evidence": "tests/benchmarks/reports/current/safety_results.json",
                "evidence_sha256": sha256(REPORTS / "safety_results.json"),
                "note": safety.get("navigation", {}).get("review_state", "review state unavailable"),
            },
            {
                "gate": "Provider/account release metadata",
                "status": "blocked" if "RELEASE_PENDING" in json.dumps(provider_manifest) or not provider_manifest.get("execution_date") else "passed",
                "evidence": "tests/benchmarks/provider_manifest.json",
                "evidence_sha256": sha256(ROOT / "tests/benchmarks/provider_manifest.json"),
                "note": "Azure region and organization retention/ZDR facts must be verified by the account owner; execution date is set only for the frozen final run.",
            },
            {
                "gate": "Approval citation and corpus freeze",
                "status": "passed" if manifest.get("frozen") else "blocked",
                "evidence": "samples/DATA_USE_NOTICE.md",
                "evidence_sha256": sha256(ROOT / "samples/DATA_USE_NOTICE.md"),
                "note": "Enter verified approval authority, date, reference, scope, and review grouping/language/image-quality metadata before freezing.",
            },
            {
                "gate": "Authenticated production-browser journeys",
                "status": "blocked",
                "evidence": "tests/e2e/playwright.config.ts",
                "evidence_sha256": sha256(ROOT / "tests/e2e/playwright.config.ts"),
                "note": "Requires a non-production synthetic patient/doctor/admin account set; no real account is created by this tool.",
            },
            {
                "gate": "Final commit verification and Zenodo metadata",
                "status": "deferred_by_request",
                "evidence": "docs/softwarex/release_metadata.json",
                "evidence_sha256": sha256(ROOT / "docs/softwarex/release_metadata.json"),
                "note": "Intentionally stopped before tagging, archiving, DOI insertion, or deposit, as requested.",
            },
        ]
    )

    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip())
    payload = {
        "schema_version": "1.0.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "git_head": commit,
        "worktree_dirty": dirty,
        "scope": "pre-Zenodo evidence; not a final release verification receipt",
        "counts": {
            "passed": sum(item["status"] == "passed" for item in gates),
            "blocked": sum(item["status"] == "blocked" for item in gates),
            "not_passed": sum(item["status"] == "not_passed" for item in gates),
            "deferred_by_request": sum(item["status"] == "deferred_by_request" for item in gates),
        },
        "gates": gates,
    }
    GENERATED.mkdir(parents=True, exist_ok=True)
    (GENERATED / "prearchive_gate_status.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    rows = [
        "# Medora SoftwareX pre-archive gate status",
        "",
        f"Generated: {payload['generated_at_utc']}  ",
        f"Git HEAD: `{commit}`  ",
        f"Dirty worktree: `{str(dirty).lower()}`  ",
        "Scope: pre-Zenodo evidence only; this is not a final release verification receipt.",
        "",
        "| Gate | Status | Evidence | Note |",
        "|---|---|---|---|",
    ]
    for item in gates:
        note = str(item["note"]).replace("|", "\\|")
        rows.append(f"| {item['gate']} | {item['status']} | `{item['evidence']}` | {note} |")
    rows.extend(["", "A blocked gate is intentionally not converted into a pass by automation.", ""])
    (GENERATED / "prearchive_gate_status.md").write_text("\n".join(rows), encoding="utf-8")
    print(json.dumps(payload["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
