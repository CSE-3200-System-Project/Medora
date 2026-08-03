# Medora SoftwareX pre-archive gate status

Generated: 2026-08-03T02:03:27.814695+00:00
Git HEAD: `a3f3162f9167d72234888bbd916845b61d6d7201`
Dirty worktree: `true`
Scope: pre-Zenodo evidence only; this is not a final release verification receipt.

| Gate | Status | Evidence | Note |
|---|---|---|---|
| Backend unit tests | passed | `tests/benchmarks/reports/current/backend_unit_final.out.log` | Focused backend unit suite. |
| Backend smoke tests | passed | `tests/benchmarks/reports/current/backend_smoke_final.out.log` | Backend application smoke suite. |
| Integration and security tests | passed | `tests/benchmarks/reports/current/backend_integration_security_final.out.log` | Docker-backed integration, authorization, consent, and security checks. |
| AI-service unit tests | passed | `tests/benchmarks/reports/current/ai_unit_final.out.log` | Local OCR, annotation blinding, parser, provider-separation, grouped corpus-freeze, and AI-service tests. |
| Frontend lint | passed | `tests/benchmarks/reports/current/frontend_lint_final.out.log` | Next.js lint completed with zero errors and zero warnings. |
| Frontend production build | passed | `tests/benchmarks/reports/current/frontend_build_final.log` | Production Next.js build. |
| Provisional browser checks | passed | `tests/benchmarks/reports/current/playwright_provisional_final.out.log` | Six public/storage checks passed; six authenticated journeys were skipped because synthetic credentials were not supplied. |
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
| Provider/account release metadata | blocked | `tests/benchmarks/provider_manifest.json` | Azure region and organization retention/ZDR facts must be verified by the account owner; execution date is set only for the frozen final run. |
| Approval citation and corpus freeze | blocked | `samples/DATA_USE_NOTICE.md` | Enter verified approval authority, date, reference, scope, and review grouping/language/image-quality metadata before freezing. |
| Verified funding statement | blocked | `docs/softwarex/medora_softwarex.tex` | An author must provide the verified funder and grant number or confirm that the work received no external funding. |
| Authenticated production-browser journeys | blocked | `tests/e2e/playwright.config.ts` | Requires a non-production synthetic patient/doctor/admin account set; no real account is created by this tool. |
| Final commit verification and Zenodo metadata | deferred_by_request | `docs/softwarex/release_metadata.json` | Intentionally stopped before tagging, archiving, DOI insertion, or deposit, as requested. |

A blocked gate is intentionally not converted into a pass by automation.
