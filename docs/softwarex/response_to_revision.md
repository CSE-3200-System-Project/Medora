# Point-by-point SoftwareX revision response

Status meanings: **implemented** means code or curated source exists and has a named
test/evidence path; **evidence pending** means the implementation exists but a frozen
run or human review is still required; **external gate** means completion needs an
authorized person or archive service and cannot be truthfully automated.

## Critical items C1–C10

| Item | Response | Code or document | Evidence/release artifact | Status |
|---|---|---|---|---|
| C1 | Fixed `v1.0.0` archive, DOI, and checksum | `CITATION.cff`; `tools/release/check_softwarex_release.py` | `release_metadata.json`, Zenodo record, archive SHA-256 | External gate: created only from the final tested commit |
| C2 | Text, image, and live-audio flows are separated | `backend/app/services/processing_consent.py`; `ai_service/app/pipeline.py` | Trust-boundary figure; provider-separation tests | Implemented |
| C3 | Removed anonymity claims; documented unknown/indirect identifier risk | `backend/app/core/ai_privacy.py`; `docs/DATA_GOVERNANCE.md` | PII case-level output and leakage report | Deterministic evidence generated: 130/130 cases, zero known-identifier leaks; unknown/indirect risk remains documented |
| C4 | Bilingual redaction, consent state, over-redaction, prompt-injection fixtures | `tests/benchmarks/datasets/pii_safety_cases.jsonl` | `generated/safety_results.json/.tex` | Generated from case-level results: 130/130 cases passed; known-span TP=90, FP=0, FN=0, precision=1.00, recall=1.00, false-redaction rate=0, and 10 explicit residual-risk cases |
| C5 | Adjudicated OCR labels, grouped split, denominators, failures, exclusions, raw scores, CIs | `tools/ocr_annotation`; `freeze_ocr_manifest.py`; `build_ocr_gold_standard.py`; `ocr_accuracy_benchmark.py` | Gold JSONL, agreement report, raw score table | Workflow implemented, but evidence pending: provider candidate records and separate Rx-only GPT-assisted drafts exist for 103/103 eligible images; primary-author, independent, and adjudicated label counts remain zero |
| C6 | Frozen A–H ablation with immutable provider caches | `generate_prelabels.py`; `import_gpt_vision_drafts.py`; `ocr_accuracy_benchmark.py` | Cache hashes and `ocr_results.json/.tex` | Candidate outputs and GPT-assisted Rx transcriptions exist for all 103 unique prescriptions. Metrics remain blocked on primary correction, licensed review, adjudication, and split freeze |
| C7 | Transactional idempotency, uniqueness, and post-commit outbox; 2/10/50 contention protocol | `appointment_service.py`; `test_booking_contention_release.py` | `generated/booking_results.json/.tex`; 90 raw repetitions | Passed 30/30 at each concurrency on fresh PostgreSQL 16 after excluded warm-ups |
| C8 | Deterministic navigation red flags, source-linked summaries, failure fixtures; mock/live separation | `ai_doctor.py`; `ai_orchestrator.py`; safety datasets; `review_navigation_cases.py` | Clinician-reviewed navigation and summary report | Deterministic navigation 12/12 and summaries 10/10; auditable review tool added, licensed review and live-provider report pending |
| C9 | Public-image approval scope and separate image/derived-data notice | `samples/DATA_USE_NOTICE.md`; `DATA_LICENSE.md`; `freeze_ocr_manifest.py` | Approval authority/date/reference in frozen corpus and release metadata | External metadata gate; validated freeze command prevents placeholder approval data |
| C10 | Reframed as research software, with no clinical or production-readiness claim | Manuscript abstract, limitations, conclusion; README | Manuscript word/claim gate | Implemented |

## Manuscript items M1–M12

| Item | Response | Location | Status |
|---|---|---|---|
| M1 | Concrete bilingual, mobile/patient-held-record motivation and research audience | Manuscript “Motivation and significance” | Implemented |
| M2 | Replaced triage/urgency with specialty navigation, manual browse, and deterministic emergency rules | `ai_doctor.py`; manuscript software description | Implemented |
| M3 | Summary items carry source type, record ID, timestamp, and conflict/missing state; no writeback | consultation schemas/orchestrator; manuscript | Implemented; deterministic source fixture report passed 10/10 |
| M4 | Receipt acknowledgment and discrepancy semantics replace accept/reject | consultation model/routes/UI; migration `softwarex_002` | Implemented with one-release aliases |
| M5 | Exact splits, cache policy, metrics, bootstrap unit, failures and exclusions documented | `docs/REPRODUCING.md`; benchmark scripts | Implemented; booking evidence generated, held-out OCR execution pending frozen gold |
| M6 | Database consistency separated from realtime/outbox propagation | booking timeline; contention report schema | Implemented |
| M7 | Static/public-only cache, no queued health writes, logout purge | `frontend/app/sw.ts`; `use-offline.ts`; session cleanup; `sensitive-browser-storage.spec.ts` | Production-browser storage assertions passed 4/4; complete provisional run passed 6 public/storage checks and skipped 6 credentialed journeys; final authenticated receipt still needs synthetic credentials |
| M8 | Backend role/ownership/care/consent matrix; frontend explicitly non-authoritative | `docs/ROLE_PERMISSION_MATRIX.md` | Implemented; 3x3 role/resource denial matrix plus cross-subject and care/consent tests pass |
| M9 | Versioned grants, list/update/revoke APIs, typed denials, expiry and revocation limitations | processing-consent model/service/routes/migration | Implemented |
| M10 | Balanced OpenMRS, Bahmni, GNU Health, OCR, summarization, and symptom-system discussion | Manuscript related work | Implemented |
| M11 | Provider/model/API/region/temperature/context/timeout/retry/retention/payment manifest | `tests/benchmarks/provider_manifest.json` | Actual Paddle/Groq/Vapi configuration and documented retention added; Azure region and organization ZDR/retention settings pending operator confirmation |
| M12 | Deterministic synthetic prescription-review and consent-gated assistant examples show input, intermediate output, confidence, review action, redacted prompt, output schema, uncertainty, manual fallback, and safe refusal | `tests/benchmarks/datasets/worked_examples.json`; manuscript “Illustrative examples” | Implemented and protected by `test_softwarex_worked_examples.py` |

## Presentation items P1–P6

| Item | Response | Location | Status |
|---|---|---|---|
| P1 | New title and claim-bounded abstract | Manuscript front matter | Implemented |
| P2 | New trust-boundary, consent-flow, and booking/outbox diagrams | `docs/softwarex/figures-src/*.tex` | Implemented; LaTeX build passes with no overfull boxes or unresolved citations, and all diagram pages were visually checked for overlap |
| P3 | Body rewritten below 3,000 words | `medora_softwarex.tex` | Implemented; release checker counts 1,823 words |
| P4 | Abbreviations expanded; navigation, acknowledgment, draft, and propagation terms corrected | Entire manuscript and captions | Implemented |
| P5 | All measured numbers enter through generated result files; approximate/manual result phrases are gated | manuscript `generated/*.tex` inputs; release checker | Booking and provisional safety tables generated directly; OCR table pending gold-standard gate |
| P6 | Ethics, consent, public data, deployment maturity, and residual limitations stated | Manuscript ethics/limitations; data-use notice | Implemented; approval citation pending |

## Final audit

Frontend release health was raised from 192 ESLint warnings to zero without disabling
rules. The cleanup removed explicit `any` from the reported paths, repaired hook
dependencies, removed dead clinical-flow code, replaced hard-coded chart data with
record-derived counts, added semantic keyboard controls and 44-pixel touch targets,
and replaced unbounded preview images with explicitly sized Next.js images. Both
`npm run lint` and the Next.js production build are release gates.

The final audit is executable, not a declaration. `check_softwarex_release.py` fails
until all curated metadata, 103 adjudicated labels, A–H output, booking and safety
reports, provider execution fields, a verified funding/no-funding statement,
test/lint/build evidence, exact commit, archive
checksum, and resolving DOI are present. As of this response, those external and
execution gates remain open and the repository must not be tagged or deposited as a
completed `v1.0.0` release.
