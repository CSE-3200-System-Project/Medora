# Medora SoftwareX — submission readiness ledger

**Verdict as of 2026-08-03: not submittable.** One blocker dominates everything else —
the manuscript contains no OCR results at all — and it is gated on human work no
automation can do.

This file is the hand- and agent-maintained record of where the submission actually
stands. It is deliberately separate from two neighbours:

| File | Who writes it | What it is |
|---|---|---|
| `generated/prearchive_gate_status.md` | `build_prearchive_gate_status.py` | Machine-generated gate matrix. **Never hand-edit.** |
| `PRE_ZENODO_HANDOFF.md` | humans | The ordered 7-step release procedure |
| **this file** | humans and agents | Verified status, findings, and an append-only work log |

---

## 1. The dominant blocker

`medora_softwarex.tex` wraps the A–H ablation table in
`\IfFileExists{generated/ocr_results.tex}`. That file does not exist, so the compiled
PDF renders an italic placeholder where the paper's central technical contribution
(M-C5, M-C6) should be. There are no OCR numbers in the paper.

Everything upstream of it is staged and everything downstream is blocked:

| Item | State |
|---|---|
| Prescription images | 105 archived, 103 hash-unique (RX-0071, RX-0083 excluded as duplicates) |
| Provider response caches | 103 × 3 (`paddle_full`, `azure_full`, `azure_yolo`), immutable, hash-verified |
| GPT-assisted Rx-only drafts | 103/103, all `review_state: ai_assisted_unreviewed` — explicitly **not** ground truth |
| Composed prelabels | 103/103, all `adjudication.state: not_started`, `boxes: []` |
| `tests/benchmarks/annotations/` | **does not exist** — no human annotation has ever been saved |
| `ocr_corpus_manifest.json` | `frozen: false`, three freeze blockers outstanding |
| `ocr_gold_standard.jsonl` | **absent** — 0 of 103 adjudicated |
| A–H ablation | harness complete (`ocr_accuracy_benchmark.py`), **never run**; fails closed on the missing gold standard |

The work is: the primary author corrects all 103 assisted drafts; a *different* licensed
clinician or pharmacist labels the same 103 images in the blinded independent role; an
adjudicator resolves every disagreement; then freeze, build the gold standard, and run
the held-out benchmark once. See `annotation_protocol.md` and `PRE_ZENODO_HANDOFF.md`.

---

## 2. Verified checklist matrix

Status column is what I verified in the repository, which is not always what
`response_to_revision.md` claimed before 2026-08-03.

### Submission blockers

| Code | Verified status | Evidence |
|---|---|---|
| M-C1 archived release + DOI | **Blocked (external)** | `CITATION.cff` and `CHANGELOG.md` exist; no DOI, no `release_metadata.json`. Correctly deferred |
| M-C2 separate text/image/audio paths | Done | `processing_consent.py`, `ai_service/app/pipeline.py`, `figures-src/trust_boundary.tex` |
| M-C3 no absolute anonymity claims | Done | Zero absolute claims in the `.tex`; the three `anonym*` hits are all limiting |
| M-C4 PII + consent guard evaluated | **Done, rebuilt 2026-08-03** | Was self-fulfilling; see §3. Now precision 0.947 / recall 0.755 over 134 hand-authored cases |
| M-C5 OCR evaluation transparency | **Blocked** | 0/103 adjudicated labels |
| M-C6 OCR baselines + ablation | **Blocked** | Harness exists; never run |
| M-C7 atomic booking under concurrency | Done | 30/30 at concurrency 2/10/50, `booking_results.json`. Advisory lock + partial unique index + idempotency key + post-commit outbox |
| M-C8 AI safety + factuality | **Partly done, rebuilt 2026-08-03** | Deterministic side now genuine (§3); licensed navigation review still blocked |
| M-C9 ethics / data governance | **Blocked (external)** | `samples/DATA_USE_NOTICE.md` exists; approval authority, date, and reference must be supplied by an author |
| M-C10 no production-grade wording | Done | Abstract, limitations, conclusion all research/pilot framed |

### Major revisions

| Code | Verified status | Note |
|---|---|---|
| M-M1 academic motivation | Done | |
| M-M2 navigation not triage | Done | Deterministic emergency rules fire before any LLM or consent call; `uncertain` flag in `ai_search.py`; triage vocabulary actively stripped |
| M-M3 grounded summaries | **Done, rebuilt 2026-08-03** | Scorer previously never invoked a summarizer; now end-to-end. Two honest limitations now reported rather than asserted away |
| M-M4 acknowledge/discrepancy semantics | Done | Enum, migration `softwarex_002`, routes, UI; deprecated aliases retained one release |
| M-M5 reproducible benchmark protocol | Partly | Booking and safety protocols frozen and executed; OCR pending gold standard |
| M-M6 propagation vs consistency | Done | Reported as separate outputs in `booking_results.json` |
| M-M7 offline cache | Done | `app/sw.ts` caches only same-origin static assets; `sensitive-browser-storage.spec.ts` enumerates cache contents. Authenticated journeys still blocked on credentials |
| M-M8 role/permission matrix | Done | `docs/ROLE_PERMISSION_MATRIX.md` + negative tests |
| M-M9 consent semantics | Done | Versioned grants, revocation, typed denials |
| M-M10 related work | Done | `tab:related-work`, 4 systems × 9 criteria |
| M-M11 provider/model config | **Blocked (external)** | Azure region is `RELEASE_PENDING`; Groq/Vapi ZDR unverified |
| M-M12 worked examples | Done | `worked_examples.json` + `test_softwarex_worked_examples.py` |

### Presentation

| Code | Verified status |
|---|---|
| M-P1 title/abstract | Done |
| M-P2 trust-boundary figures | Done — 3 diagram sources tracked; build has zero overfull boxes |
| M-P3 length | Done — 2,455 words against a 3,000 gate |
| M-P4 captions/terminology | Done |
| M-P5 generated result tables | Partly — booking and safety generated; OCR table blocked |
| M-P6 conclusion foregrounds limitations | Done except the approval citation |

---

## 3. Evidence-integrity defects found and fixed (2026-08-03)

An audit found the deterministic safety figures were largely self-fulfilling. All three
scorers have been rebuilt. **Fixing them surfaced four production defects**, all of
which are now fixed at root cause.

### Defects in the evaluation

| ID | Defect | Resolution |
|---|---|---|
| D1 | PII corpus generated from 8 label-prefixed templates mirroring the redactor's own regexes; 10 cases per category differed only by an integer counter | Replaced with 137 hand-authored cases covering unlabelled names, clinician details, addresses, dates, misspelled and spaced labels, obfuscated formats, mixed-script records, and Bengali injections |
| D1b | No identifier-bearing case carried a benign span, so false positives were uncountable and precision was pinned at 1.00 | Every detection case now carries ≥1 `must_preserve` clinical span in the same text; enforced by a generator invariant and a unit test |
| D1c | The harness passed `known_identifiers`, a path no production call site uses | Headline metrics now run the production path (no known identifiers). The API is documented by a small labelled group excluded from those metrics |
| D2 | Navigation scorer collapsed 4 declared classes into emergency/non-emergency, so `uncertain` was never asserted | Scores against the extracted `classify_navigation_outcome` on two paths: recorded provider intent and mock provider |
| D3 | Summary scorer never invoked a summarizer; it checked that `focus` was in a hard-coded set | Now calls `generate_patient_summary` end to end under the mock provider with per-case provider behaviours |

### Production defects the honest corpus exposed

| ID | Defect | Fix |
|---|---|---|
| P1 | `LABELED_ADDRESS_PATTERN`'s Bengali branch was unreachable — `ঠিকানা` ends in U+09BE, so a trailing `\b` can never match | Lookaround boundaries (`ai_privacy.py`) |
| P2 | Labelled name/address redaction ran to the next `;` or newline, destroying the clinical remainder of the line | Names bounded to 3 tokens; addresses bounded at a sentence boundary |
| P3 | The Bengali danda `।` was not a terminator, so redaction was **non-idempotent** — each pass consumed one more clinical word | `।` and `॥` added to both terminator classes; placeholders excluded from re-matching; idempotence now asserted per case |
| P4 | `generate_patient_summary` fabricated a `request_context/provided_context` source when given zero records — gap-filling that `medora_softwarex.tex` already claimed did not happen | Emits an explicit `not found in the record` item with a `no_source_record` sentinel |

### Resulting measurements

Two-tier results: `passed` is a hard assertion, false only for an **undisclosed**
failure; `matched_expected` is the measurement and gates nothing.

```
privacy    134 production-path cases | 0 undisclosed failures | 0 stale flags
           TP 71  FP 4  FN 23
           precision 0.947  recall 0.755  false-redaction 0.032
           43 cases carry a written limitation
navigation  30 cases | 0 undisclosed failures | 17/30 agree with the labelled class
           emergency false positives 5, false negatives 0, 9 documented limitations
summaries   12 cases | 12 pass end-to-end under the mock provider
```

Worst per-group recall, all disclosed: `name_unlabeled` 0.000, `clinician` 0.200,
`date` 0.500, `email` 0.556 (adversarial forms), `passport` 0.667. Perfect recall
remains in `phone`, `national_id`, `opaque_id`, `mixed_script`, and `injection`.

The gate was proven to bite: breaking `EMAIL_PATTERN` → exit 2; clearing one
disclosure flag → exit 2; omitting `--allow-unreviewed` → exit 2.

---

## 4. Remaining blockers — all need a human

| # | Blocker | Who | What is needed |
|---|---|---|---|
| 1 | OCR gold standard | primary author + licensed clinician/pharmacist + adjudicator | 103 primary corrections, 103 blinded independent labels, full adjudication, freeze, then one held-out A–H run |
| 2 | Licensed navigation review | licensed clinician | Sign off 30 fixtures. NAV-022/023 (Bengali paraphrases of red-flag presentations) need an explicit clinical decision — if either is an emergency, extend `EMERGENCY_PATTERNS` and clear the limitation |
| 3 | Provider/account metadata | Azure/Groq/Vapi account owner | Verified Azure region, organization ZDR/retention state, frozen-run execution date |
| 4 | Approval citation + corpus freeze | author with the approval on file | Authority, date, reference, scope, and review grouping/language/image-quality metadata |
| 5 | Authenticated browser journeys | whoever provisions test accounts | Non-production synthetic patient/doctor/admin credentials, then Playwright without `E2E_ALLOW_SKIPS` |
| 6 | Funding statement | an author | Verified funder and grant number, or an explicit statement of no external funding |
| — | Zenodo deposit/DOI | release manager | Deferred by request until 1–6 clear |

`check_softwarex_release.py` currently exits with 22 itemized blockers. That count is
unchanged by the 2026-08-03 work — no new failure was introduced.

---

## 5. Artifacts that must not be cited

These read as results but are not measurements:

- `tests/benchmarks/reports/sample/*` — hand-authored, labelled "(Sample)", round
  `2026-04-03T15:00:00Z` timestamps. Contains "79% exact OCR match", 1180.4 ms p95,
  field accuracies 0.82–0.91. **None of it was measured.**
- `tests/benchmarks/reports/current/regression_guard_report.json` — `violations: []` is
  vacuous: its `current` block is a copy of `sample/api_performance.json`, which has no
  top-level `p95_ms`, so the guard compares against 0.0 and can never fire.
- `tests/benchmarks/reports/current/benchmark_summary.md` — "Violations: 0" with all
  four data sections silently omitted because their inputs do not exist.
- `docs/defense/06_PROFESSOR_QNA.md:177` — claims 1.8 s LCP. Measured Lighthouse LCP is
  4.2–4.5 s (`frontend/.lighthouseci/`), and `baselines/web_vitals_baseline.json`
  records 4700 ms. **Direct contradiction; do not repeat the 1.8 s figure.**
- Locust, k6, `api_latency_benchmark`, `db_concurrency_benchmark`,
  `ocr_pipeline_benchmark`, and `chaos_recovery_test` have **no output files**.
  `run_benchmarks.sh` swallows two of these steps with `|| true`.

## 6. Known staleness

- **Integration and security evidence predates the 2026-08-03 backend changes.**
  `backend_integration_security_final.out.log` (14 passed) was recorded on a
  Docker-capable host; Docker was unavailable for this session, so those suites
  skipped rather than ran. They must be re-run before the release commit, since
  `ai_privacy.py`, `ai_orchestrator.py`, and `ai_doctor.py` all changed.
- `record_verification.py` resets all nine named receipts whenever HEAD changes, so
  every check must be re-recorded on the final release commit regardless.
- `LICENSE` and `LICENSE.txt` are byte-identical duplicates.
- `DATA_LICENSE.md` is cited in `response_to_revision.md` C9 but lives at
  `tests/benchmarks/DATA_LICENSE.md`, not the repo root.

---

## 7. Agent / contributor log

Append only. One row per work session. Never convert a blocked gate to passed by hand,
and cite a file path for every claim.

| Date | Who | Change | Evidence |
|---|---|---|---|
| 2026-08-02 | prior session | Frontend 192 ESLint warnings → 0; Next.js production build passes | `reports/current/frontend_lint_final.out.log`, `frontend_build_final.log` |
| 2026-08-02 | prior session | Booking contention benchmark executed at 2/10/50 × 30 | `reports/current/booking_results.json` |
| 2026-08-02 | prior session | 103/103 GPT-assisted Rx drafts imported, marked `ai_assisted_unreviewed` | `datasets/gpt_vision_drafts*.jsonl` |
| 2026-08-03 | Claude (audit) | Verified full checklist against the repo; found D1/D1b/D1c/D2/D3 | this file, §3 |
| 2026-08-03 | Claude | Fixed P1–P4 production defects | `backend/app/core/ai_privacy.py`, `backend/app/services/ai_orchestrator.py` |
| 2026-08-03 | Claude | Extracted pure `classify_navigation_outcome`; rewired `ai_doctor_search` to it | `backend/app/routes/ai_doctor.py` |
| 2026-08-03 | Claude | Rebuilt all three corpora (137/30/12), added merge-preserving review writer | `tests/benchmarks/generate_safety_datasets.py` |
| 2026-08-03 | Claude | Rebuilt scorer with two-tier semantics; forced `AI_PROVIDER=mock` | `tests/benchmarks/run_safety_benchmarks.py` |
| 2026-08-03 | Claude | New per-group privacy table + navigation table; manuscript text corrected | `tools/release/build_release_artifacts.py`, `medora_softwarex.tex` |
| 2026-08-03 | Claude | Backend unit 55 passed, smoke 34, ai_service 16; LaTeX 12 pages, 0 overfull, 0 undefined | `reports/current/*_final.out.log`, `latex_pass2_final.log` |
