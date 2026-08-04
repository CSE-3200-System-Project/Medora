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
| C3 | Removed anonymity claims; documented unknown/indirect identifier risk | `backend/app/core/ai_privacy.py`; `docs/DATA_GOVERNANCE.md` | PII case-level output and leakage report | Deterministic evidence generated: 134 production-path cases, zero *undisclosed* leaks, and 43 cases carrying a written limitation. Measured recall is 0.755, so identifiable text demonstrably survives in named classes; the residual risk is reported, not claimed away |
| C4 | Bilingual redaction, consent state, over-redaction, prompt-injection fixtures | `tests/benchmarks/datasets/pii_safety_cases.jsonl` | `generated/safety_results.json/.tex` | Rebuilt as a hand-authored corpus that is not derived from the redaction patterns it tests. 134 production-path cases: TP=71, FP=4, FN=23, precision=0.947, recall=0.755, false-redaction rate=0.032, 43 documented limitations, 0 undisclosed failures. Coverage now includes unlabelled names, clinician details, addresses, dates, misspelled and spaced labels, obfuscated formats, and mixed-script records |
| C5 | Adjudicated OCR labels, grouped split, denominators, failures, exclusions, raw scores, CIs | `tools/ocr_annotation`; `freeze_ocr_manifest.py`; `build_ocr_gold_standard.py`; `ocr_accuracy_benchmark.py` | Not claimed in this release | **Withdrawn as a claim.** The manuscript now reports prescription OCR as a negative result: the pipeline did not reach usable accuracy on handwritten Bangladeshi prescriptions, no accuracy figure is stated, and no OCR table is published. The annotation and adjudication workflow remains in the repository for future work, but this release makes no assertion that C5's evidence would support, so there is nothing left to under-report |
| C6 | Frozen A–H ablation with immutable provider caches | `generate_prelabels.py`; `import_gpt_vision_drafts.py`; `ocr_accuracy_benchmark.py` | Not claimed in this release | **Withdrawn as a claim**, for the same reason as C5. The eight-configuration ablation was designed to attribute accuracy across pipeline stages; with no accuracy claim there is no attribution to make. The scripts and immutable-cache mechanism remain available for a future evaluation |
| C7 | Transactional idempotency, uniqueness, and post-commit outbox; 2/10/50 contention protocol | `appointment_service.py`; `test_booking_contention_release.py` | `generated/booking_results.json/.tex`; 90 raw repetitions | Passed 30/30 at each concurrency on fresh PostgreSQL 16 after excluded warm-ups |
| C8 | Deterministic navigation red flags, source-linked summaries, failure fixtures; mock/live separation | `ai_doctor.py`; `ai_orchestrator.py`; safety datasets; `review_navigation_cases.py` | Clinician-reviewed navigation and summary report | 30 navigation fixtures scored against the extracted `classify_navigation_outcome` on two paths (recorded intent and mock provider): 30/30 with no undisclosed failure, 17/30 agreeing with the labelled class, 5 emergency false positives from negated/third-person/historical mentions, 0 false negatives, 9 documented limitations. 12 summary fixtures now invoke the summarizer end to end. Licensed review and live-provider report pending |
| C9 | Public-image approval scope and separate image/derived-data notice | `samples/DATA_USE_NOTICE.md`; `samples/MEDICINE_CORPUS_NOTICE.md`; `tests/benchmarks/DATA_LICENSE.md` | Data-use notices; medicine-corpus provenance and licence records | Resolved for this release. The prescription image corpus is **not deposited**, which removes the approval-citation dependency: its notice, per-record provenance classification, and re-identification prohibition remain in the repository, and any future deposit requires documented consent or controlled access. Separately, the medicine reference now carries a full provenance and licence record — five sources under CC0 1.0 (two), Apache 2.0, MIT, and CC BY 4.0, aggregate offered under CC BY 4.0 with a NOTICE crediting each source and an Apache-2.0 statement of changes. Two sources are website scrapes, disclosed as a provenance limitation rather than a redistribution barrier |
| C10 | Reframed as research software, with no clinical or production-readiness claim | Manuscript abstract, limitations, conclusion; README | Manuscript word/claim gate | Implemented |

## Manuscript items M1–M12

| Item | Response | Location | Status |
|---|---|---|---|
| M1 | Concrete bilingual, mobile/patient-held-record motivation and research audience | Manuscript “Motivation and significance” | Implemented |
| M2 | Replaced triage/urgency with specialty navigation, manual browse, and deterministic emergency rules | `ai_doctor.py`; manuscript software description | Implemented |
| M3 | Summary items carry source type, record ID, timestamp, and conflict/missing state; no writeback | consultation schemas/orchestrator; manuscript | Implemented; 12/12 summary fixtures invoke the summarizer under the mock provider and assert no invented record identifier, an explicit not-found item when no source record is supplied, and raising rather than degrading on malformed or schema-invalid output. Two limitations are now reported rather than asserted away: prompt sanitization removes record timestamps, and source references are attached per request rather than per item |
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
| P3 | Body rewritten below 3,000 words | `medora_softwarex.tex` | Implemented; release checker counts 2,998 words after the reframe. The AI component and endpoint inventories are carried in tables rather than prose, so breadth is documented without consuming the budget |
| P4 | Abbreviations expanded; navigation, acknowledgment, draft, and propagation terms corrected | Entire manuscript and captions | Implemented |
| P5 | All measured numbers enter through generated result files; approximate/manual result phrases are gated | manuscript `generated/*.tex` inputs; release checker | Booking and provisional safety tables generated directly; OCR table pending gold-standard gate |
| P6 | Ethics, consent, public data, deployment maturity, and residual limitations stated | Manuscript ethics/limitations; data-use notice | Implemented; approval citation pending |

## Evidence-integrity correction (2026-08-03)

An internal audit found that the earlier deterministic figures — 130/130 with
precision and recall of 1.00, navigation 12/12, and summaries 10/10 — were largely
self-fulfilling and have been rebuilt:

- The PII corpus was generated from label-prefixed templates that mirrored the
  redactor's own regexes, and no identifier-bearing case carried a benign span, so
  precision could not fall below 1.00 by construction. It is now hand-authored,
  covers the formats M-C4 asked for, and reports precision 0.947 / recall 0.755.
- The navigation scorer collapsed four declared classes into emergency versus
  non-emergency, so the `uncertain` path was never asserted. It now scores against the
  extracted `classify_navigation_outcome` on two paths.
- The summary scorer never invoked a summarizer; it validated fixture well-formedness.
  It now calls `generate_patient_summary` end to end under the mock provider.

Rebuilding the corpora surfaced four production defects, all fixed: the Bengali
`ঠিকানা` address label was unreachable because a trailing `\b` cannot match after a
vowel sign; labelled name and address redaction consumed the clinical remainder of the
line; the Bengali danda was not treated as a sentence terminator, which made redaction
non-idempotent (each pass consumed another clinical word); and `generate_patient_summary`
fabricated a `request_context` source when no record was supplied, contradicting the
grounding claim in this manuscript.

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

## Reframe (2026-08-04): assistive-AI layer and medicine reference lead the paper

An internal review found the manuscript described the system it was easiest to evaluate
rather than the system that was built. The word "Chorui" appeared zero times; "drug" and
"brand" zero; "voice" zero. A 74,390-term medicine reference and a twenty-one-endpoint
assistive-AI layer were visible only as OCR sub-stages. The paper has been restructured:

- **Title and abstract** now lead with the consent-gated assistive-AI layer over the
  medicine reference.
- **New Section 2.2** documents the medicine reference: three-table schema, deterministic
  published build, 7,389 drugs / 67,001 brands / 74,390 index terms from five sources.
- **New Section 2.3** documents the AI layer, with two new tables. `tab:components`
  enumerates all nineteen AI/ML components and records that fifteen are deterministic —
  routing, consent, redaction, red-flag detection, specialty fallback, and grammar parsing
  involve no model. `tab:ai-surface` enumerates all twenty-one endpoints in nine groups,
  with their human-in-the-loop control and, in the final column, whether each carries a
  reproducible evaluation. Six of nine do not, and the manuscript says so in the body.
- **Chorui is named, figured, and quantified**: 24 registry entries over 23 canonical
  intents, 11 patient-scoped, 11 doctor-scoped, 2 shared, administrative routes never
  registered.
- **OCR** moved to a clearly labelled negative result (see C5/C6 above).

The evaluation position is stated rather than implied: structural controls apply uniformly
across all twenty-one endpoints, empirical evidence does not, and capability is not
presented as validated performance.

## Gate status after the reframe

Withdrawing the OCR accuracy claim and the image deposit removes three previously blocked
gates from the release path (OCR gold standard / A–H benchmark; approval citation and
corpus freeze; and the OCR-label dependency in the navigation review). Three external
gates remain open and cannot be closed by automation:

| Gate | Needs |
|---|---|
| Licensed symptom-navigation review | A licensed clinician to review the 30 navigation fixtures |
| Provider/account release metadata | The Azure account owner to confirm region and organisation retention/ZDR settings |
| Authenticated production-browser journeys | A non-production synthetic patient/doctor/admin credential set |
| Final commit verification and Zenodo metadata | Tag, archive, DOI — intentionally deferred |

None of these is a scientific claim; each is an authorisation or credential an author must
supply. The manuscript makes no assertion that depends on them.
