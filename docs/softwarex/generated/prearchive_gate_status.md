# Medora SoftwareX pre-archive gate status

Generated: 2026-08-07T20:39:00.405258+00:00
Git HEAD: `f99079d1971756d7d47f94adb532fc689f64f1ad`
Dirty worktree: `true`
Scope: pre-Zenodo evidence only; this is not a final release verification receipt.

| Gate | Status | Evidence | Note |
|---|---|---|---|
| Backend unit tests | passed | `tests/benchmarks/reports/current/backend_unit_final.out.log` | Focused backend unit suite. |
| Backend smoke tests | passed | `tests/benchmarks/reports/current/backend_smoke_final.out.log` | Backend application smoke suite. |
| Integration and security tests | passed | `tests/benchmarks/reports/current/backend_integration_security_final.out.log` | Docker-backed integration, authorization, consent, and security checks, including the five data-plane grant/RLS invariants added with sec_001. |
| AI-service unit tests | passed | `tests/benchmarks/reports/current/ai_unit_final.out.log` | Local OCR, annotation blinding, parser, provider-separation, grouped corpus-freeze, and AI-service tests. |
| Frontend lint | passed | `tests/benchmarks/reports/current/frontend_lint_final.out.log` | Next.js lint completed with zero errors and zero warnings. |
| Frontend production build | passed | `tests/benchmarks/reports/current/frontend_build_final.log` | Production Next.js build. |
| Full browser suite | passed | `tests/benchmarks/reports/current/playwright_authenticated_20260808.out.log` | All twelve specs pass across the English and Bangla projects, with no skipped authenticated journey. |
| Clean container validation | passed | `tests/benchmarks/reports/current/docker_validation_final.log` | Pinned backend and AI images passed dependency checks and application imports. |
| Manuscript compilation | passed | `tests/benchmarks/reports/current/latex_pass2_final.log` | Final LaTeX pass completed with zero overfull boxes and zero undefined references/citations. |
| JavaScript production dependency audit | passed | `tests/benchmarks/reports/current/{frontend,e2e}_npm_audit_final.json` | Combined reported production vulnerabilities: 0. |
| Generated archive-candidate secret audit | passed | `tests/benchmarks/reports/current/generated_secret_audit.json` | Scanned 732 files against 27 local environment values; exact-value hits=0. |
| OCR corpus inventory | passed | `tests/benchmarks/datasets/ocr_corpus_manifest.json` | 105 archive files; 103 unique metric records. Metadata freeze remains separate. |
| Assisted OCR prelabels | passed | `tests/benchmarks/prelabels/` | 103/103 composed prelabels and 103/103 hash-bound GPT Rx drafts; drafts are not ground truth. |
| Booking contention benchmark | passed | `tests/benchmarks/reports/current/booking_results.json` | Concurrency 2, 10, and 50 with 30 fresh-slot repetitions each. |
| Deterministic safety fixtures | passed | `tests/benchmarks/reports/current/safety_results.json` | Privacy, navigation behavior, and source-grounded summary fixtures; licensed navigation review is a separate gate. |
| OCR gold standard and held-out A-H benchmark | blocked | `tests/benchmarks/datasets/ocr_gold_standard.jsonl` | Manifest frozen=False; adjudicated records=0/103. Requires independent licensed review and adjudication. |
| Licensed symptom-navigation review | blocked | `tests/benchmarks/reports/current/safety_results.json` | required |
| Provider/account release metadata | passed | `tests/benchmarks/provider_manifest.json` | Azure region resolved to eastus. Neither Groq nor Vapi exposes its organization zero-data-retention flag to an API, so the manifest records the documented worst-case retention as operative and claims no ZDR. |
| Approval citation and corpus freeze | passed | `docs/softwarex/release_metadata.json` | No prescription image is archived in this release, so no image-redistribution approval is cited. Depositing images later requires a frozen manifest and a real approval citation. |
| Verified funding statement | passed | `docs/softwarex/medora_softwarex.tex` | An author must provide the verified funder and grant number or confirm that the work received no external funding. |
| Authenticated production-browser journeys | passed | `docs/softwarex/generated/verification.json` | Synthetic patient/doctor/admin accounts are provisioned by tests/e2e/provision_synthetic_accounts.py; the suite must exit 0 without E2E_ALLOW_SKIPS. |
| Final commit verification and Zenodo metadata | deferred_by_request | `docs/softwarex/release_metadata.json` | Intentionally stopped before tagging, archiving, DOI insertion, or deposit, as requested. |

A blocked gate is intentionally not converted into a pass by automation.
