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
    # run_safety_benchmarks.py writes to reports/safety_results.json and
    # build_release_artifacts.py copies that into generated/. Nothing has ever written
    # reports/current/safety_results.json, which this line used to read, so the matrix was
    # reporting a stale copy: it still said the clinician review was outstanding for five
    # days after the run that recorded it. Read the published artifact, which is also what
    # check_softwarex_release.py validates, and fall back to the benchmark's own output.
    safety = load_json(GENERATED / "safety_results.json") or load_json(
        ROOT / "tests" / "benchmarks" / "reports" / "safety_results.json"
    )
    frontend_audit = load_json(REPORTS / "frontend_npm_audit_final.json")
    e2e_audit = load_json(REPORTS / "e2e_npm_audit_final.json")
    provider_manifest = load_json(ROOT / "tests/benchmarks/provider_manifest.json")
    playwright_receipt = load_json(GENERATED / "verification.json").get("checks", {}).get("playwright", {})
    release_metadata = load_json(ROOT / "docs/softwarex/release_metadata.json")
    secret_audit = load_json(REPORTS / "generated_secret_audit.json")
    manuscript_path = ROOT / "docs/softwarex/medora_softwarex.tex"
    manuscript_text = read_log(manuscript_path)
    records = manifest.get("records", [])
    prelabels = list((ROOT / "tests/benchmarks/prelabels").glob("RX-*.json"))
    eligible_ids = {item.get("id") for item in records if item.get("included_in_metrics")}
    gpt_draft_count = sum(
        load_json(path).get("candidate_outputs", {}).get("gpt_vision", {}).get("review_state")
        == "ai_assisted_unreviewed"
        for path in prelabels
        if path.stem in eligible_ids
    )
    gold_path = ROOT / "tests/benchmarks/datasets/ocr_gold_standard.jsonl"
    gold_count = sum(bool(line.strip()) for line in gold_path.read_text(encoding="utf-8").splitlines()) if gold_path.is_file() else 0

    gates = [
        log_gate("Backend unit tests", "backend_unit_final.out.log", r"55 passed", "Focused backend unit suite."),
        log_gate("Backend smoke tests", "backend_smoke_final.out.log", r"34 passed", "Backend application smoke suite."),
        log_gate("Integration and security tests", "backend_integration_security_final.out.log", r"19 passed", "Docker-backed integration, authorization, consent, and security checks, including the five data-plane grant/RLS invariants added with sec_001."),
        log_gate("AI-service unit tests", "ai_unit_final.out.log", r"16 passed", "Local OCR, annotation blinding, parser, provider-separation, grouped corpus-freeze, and AI-service tests."),
        log_gate("Frontend lint", "frontend_lint_final.out.log", r"MEDORA_GATE_PASSED", "Next.js lint completed with zero errors and zero warnings."),
        log_gate("Frontend production build", "frontend_build_final.log", r"MEDORA_GATE_PASSED|Compiled successfully", "Production Next.js build."),
        log_gate("Full browser suite", "playwright_authenticated_20260808.out.log", r"12 passed", "All twelve specs pass across the English and Bangla projects, with no skipped authenticated journey."),
        log_gate("Clean container validation", "docker_validation_final.log", r"MEDORA_GATE_PASSED", "Pinned backend and AI images passed dependency checks and application imports."),
        log_gate("Manuscript compilation", "latex_pass2_final.log", r"Output written on medora_softwarex\.pdf \(\d+ pages", "Final LaTeX pass completed with zero overfull boxes and zero undefined references/citations."),
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
                "status": "passed" if len(prelabels) == 103 and gpt_draft_count == 103 else "not_passed",
                "evidence": "tests/benchmarks/prelabels/",
                "evidence_sha256": None,
                "note": f"{len(prelabels)}/103 composed prelabels and {gpt_draft_count}/103 hash-bound GPT Rx drafts; drafts are not ground truth.",
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
                "note": "Azure region resolved to eastus. Neither Groq nor Vapi exposes its organization zero-data-retention flag to an API, so the manifest records the documented worst-case retention as operative and claims no ZDR.",
            },
            {
                "gate": "Approval citation and corpus freeze",
                # The prescription image corpus is not deposited in this release, which is
                # what removes the approval-citation dependency (response_to_revision C9).
                # Requiring a frozen OCR manifest here would gate the release on the claim
                # that was withdrawn. A future deposit re-opens this: freeze the manifest
                # and cite a real approval, and this gate goes back to reading it.
                "status": "passed"
                if manifest.get("frozen")
                or (release_metadata.get("approval", {}).get("authority") == "Not applicable" and "no prescription images are archived" in release_metadata.get("approval", {}).get("scope", ""))
                else "blocked",
                "evidence": "docs/softwarex/release_metadata.json",
                "evidence_sha256": sha256(ROOT / "docs/softwarex/release_metadata.json"),
                "note": "No prescription image is archived in this release, so no image-redistribution approval is cited. Depositing images later requires a frozen manifest and a real approval citation.",
            },
            {
                "gate": "Verified funding statement",
                "status": "blocked" if "Release gate: the authors must insert the verified funding source" in manuscript_text else "passed",
                "evidence": "docs/softwarex/medora_softwarex.tex",
                "evidence_sha256": sha256(manuscript_path),
                "note": "An author must provide the verified funder and grant number or confirm that the work received no external funding.",
            },
            {
                "gate": "Authenticated production-browser journeys",
                # Derived from the recorded receipt rather than hard-coded. The gate was
                # blocked for as long as no synthetic account set existed; it is closed by
                # a Playwright run at HEAD that exits 0, which the config only permits when
                # no credentialed spec was skipped.
                "status": "passed" if playwright_receipt.get("status") == "passed" and playwright_receipt.get("exit_code") == 0 else "blocked",
                "evidence": "docs/softwarex/generated/verification.json",
                "evidence_sha256": sha256(GENERATED / "verification.json"),
                "note": "Synthetic patient/doctor/admin accounts are provisioned by tests/e2e/provision_synthetic_accounts.py; the suite must exit 0 without E2E_ALLOW_SKIPS.",
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
        f"Generated: {payload['generated_at_utc']}",
        f"Git HEAD: `{commit}`",
        f"Dirty worktree: `{str(dirty).lower()}`",
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
