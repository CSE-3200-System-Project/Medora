# Medora SoftwareX — submission readiness ledger

**Verdict as of 2026-08-04: not submittable, but no blocker is scientific.** The OCR
accuracy claim was withdrawn (see §1, superseding the framing below, which described a
now-resolved state as of 2026-08-03) rather than completed, which removed the one
blocker that needed unautomatable human labelling work. What remains is exclusively
credential- and authorization-gated: a DOI/tag, CI verification receipts, provider
account metadata, and synthetic test credentials. See `response_to_revision.md` C5/C6
for the withdrawal and its rationale.

This file is the hand- and agent-maintained record of where the submission actually
stands. It is deliberately separate from two neighbours:

| File | Who writes it | What it is |
|---|---|---|
| `generated/prearchive_gate_status.md` | `build_prearchive_gate_status.py` | Machine-generated gate matrix. **Never hand-edit.** |
| `PRE_ZENODO_HANDOFF.md` | humans | The ordered 7-step release procedure |
| **this file** | humans and agents | Verified status, findings, and an append-only work log |

---

## 1. OCR accuracy: withdrawn, not blocked

**Superseded (2026-08-04).** The paragraph and table below described the state as of
2026-08-03, when `medora_softwarex.tex` still wrapped the A–H ablation table in
`\IfFileExists{generated/ocr_results.tex}` and the missing file rendered as a
placeholder. That is no longer the case: the manuscript now states plainly that the
OCR pipeline did not reach usable accuracy on handwritten Bangladeshi prescriptions,
reports no accuracy figure, and publishes no OCR results table. `medora_softwarex.tex`
no longer references `generated/ocr_results.tex` at all (grep confirms zero hits). This
is a stated negative result, not an unfinished claim, so it no longer gates the release.

The annotation, adjudication, and A–H ablation tooling described below remains in the
repository and functional for future work, but nothing downstream of it blocks this
submission. Historical detail, retained for that future work:

| Item | State (as of 2026-08-03, before the withdrawal) |
|---|---|
| Prescription images | 105 archived, 103 hash-unique (RX-0071, RX-0083 excluded as duplicates); the images themselves are no longer in this repository's history (see §9's Ethics note and `samples/DATA_USE_NOTICE.md`) |
| Provider response caches | 103 × 3 (`paddle_full`, `azure_full`, `azure_yolo`), immutable, hash-verified |
| GPT-assisted Rx-only drafts | 103/103, all `review_state: ai_assisted_unreviewed` — explicitly **not** ground truth |
| Composed prelabels | 103/103, all `adjudication.state: not_started`, `boxes: []` |
| `tests/benchmarks/annotations/` | does not exist — no human annotation has been saved |
| `ocr_corpus_manifest.json` | `frozen: false` |
| `ocr_gold_standard.jsonl` | absent — 0 of 103 adjudicated |
| A–H ablation | harness complete (`ocr_accuracy_benchmark.py`), never run |

Resuming this work would still require: the primary author correcting all 103 assisted
drafts; a *different* licensed clinician or pharmacist independently, blindly labelling
the same 103 images; an adjudicator resolving every disagreement; then freezing,
building the gold standard, and running the held-out benchmark once. See
`annotation_protocol.md` and `PRE_ZENODO_HANDOFF.md`. `tools/release/check_softwarex_release.py`
no longer requires any of this.

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
| M-C5 OCR evaluation transparency | **Withdrawn as a claim (2026-08-04)** | No accuracy figure is stated; 0/103 adjudicated labels; harness remains for future work |
| M-C6 OCR baselines + ablation | **Withdrawn as a claim (2026-08-04)** | Harness exists, never run; no attribution claim to make without an accuracy claim |
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
| M-M11 provider/model config | **Partly (2026-08-04)** | Azure region resolved to `eastus`; Groq/Vapi ZDR still unverified |
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
| 1 | OCR gold standard | primary author + licensed clinician/pharmacist + adjudicator | 103 primary corrections, 103 blinded independent labels, full adjudication, freeze, then one held-out A–H run. **Reviewer package now built** — see §8 |
| 2 | Licensed navigation review | licensed clinician | Sign off 30 fixtures. NAV-022/023 (Bengali paraphrases of red-flag presentations) need an explicit clinical decision — if either is an emergency, extend `EMERGENCY_PATTERNS` and clear the limitation |
| 3 | Provider/account metadata | Azure/Groq/Vapi account owner | Region confirmed as US; the **exact** Azure region string is still needed (the endpoint uses a custom subdomain and does not encode it). Groq/Vapi ZDR reported as "supposedly" not retaining — recorded as unverified until checked in each console |
| 4 | Corpus provenance + consent basis | authors | **Mostly closed 2026-08-04.** All 105 records classified (70 `public_dataset` from `roboflow-universe:jannat-nmkds/prescription-3xf5s` v1 CC BY 4.0, 35 `directly_collected` with verbal consent); that freeze blocker is cleared. Still open: the approval authority/date/reference marker, and the §9 decision on whether raw images may be archived publicly at all |
| 5 | Authenticated browser journeys | whoever provisions test accounts | Non-production synthetic patient/doctor/admin credentials, then Playwright without `E2E_ALLOW_SKIPS` |
| ~~6~~ | ~~Funding statement~~ | — | **Closed 2026-08-03.** Self-funded; the standard no-external-funding declaration is in the manuscript |
| — | Zenodo deposit/DOI | release manager | Deferred by request until 1–5 clear |

Gate matrix is now **16 passed, 5 blocked, 1 deferred**.

## 8. Independent reviewer package

`tools/ocr_annotation/build_reviewer_package.py` assembles a self-contained, blinded
package that a licensed clinician can run without the repository, a toolchain, or any
setup beyond installing Python.

```powershell
python tools/ocr_annotation/build_reviewer_package.py --zip
```

Produces `dist/medora-rx-review/` (and a 144 MB zip — share via a link, not email)
containing: the 103 metric-eligible images renamed to their record identifiers, a
manifest of `id`/`image`/`source_sha256` only, a stdlib-only loopback server, a static
web page, start scripts for Windows and macOS/Linux, and reviewer instructions.

Blinding is enforced at build time, not by policy. The builder refuses to emit a package
whose manifest exposes `difficulty`, `split`, `writer_or_template_group`, `language`,
`script`, `image_quality`, or provenance, and refuses to ship any file whose name
contains `prelabel`, `gpt_vision`, `candidate_output`, `primary.json`, or `adjudication`.
Images are renamed on copy because the original filenames (`Easy-1.jpeg`, `Hard33.jpg`)
encode the difficulty stratum — the pre-existing tool served them at URLs that revealed
it.

The reviewer transcribes the **Rx section only**; the interface states the include and
exclude lists explicitly and asks for `[illegible]` rather than a guess. Work autosaves
per record and resumes at the first unsaved one. On finishing, a single JSON file is
downloaded and returned to the author.

```powershell
python tools/ocr_annotation/import_independent_review.py review.json --check
python tools/ocr_annotation/import_independent_review.py review.json
```

The importer applies every check `build_ocr_gold_standard.py` will later enforce —
source-hash match, eligible credential role, reviewer distinct from the primary, no
assisted provenance, complete coverage — so a bad bundle fails on arrival rather than at
the release gate. Verified end to end: reviewer validation rejects an ineligible
credential role and a missing attestation, `assisted_from` is stripped server-side, the
source hash is stamped from the manifest rather than trusted from the page, original
filenames and path traversal both 404.

## 10. Redaction path (built 2026-08-03)

The authors chose to de-identify the images rather than rely on informal consent for
permanent publication. Tooling is in `tools/redaction/`; see its README for the full
workflow and the regeneration chain.

Two design decisions are load-bearing:

**Opaque fill, not blur.** Blur is not a de-identification control — it is linear and
partially invertible by deconvolution, and a blurred name over a constrained character
set can be recovered by rendering candidates and matching. `apply_redactions.py` writes
solid black and verifies the output is not byte-identical to the original.

**Identifier fields only.** Blanking everything outside the Rx region would be automatic
and thorough, and would destroy M-C6. Configurations A and B are full-image OCR
baselines; against a mostly-blank page they face an artificially easy task, the measured
contribution of YOLO region detection collapses toward zero, and the reported accuracy
stops generalizing. Layout clutter is preserved deliberately.

Completeness is enforced, not trusted: an image cannot be saved until every one of the
eleven identifier categories is either boxed or explicitly declared absent, because
silence is the failure mode that publishes a real name.

Verified: out-of-range boxes rejected, incomplete checklists rejected, marks bound to the
source hash, opaque black confirmed pixel-wise, byte-identical output refused.

**Not yet run.** Marking 105 images is author work, roughly 2–3 hours. Afterwards every
source hash changes and the whole cached chain — manifest, 309 provider-cache files, 311
provider_cache entries, 103 prelabels, GPT drafts, reviewer package — must be regenerated.
Re-running the two Azure configurations is 206 pages, about USD 0.30. That is a
reproducibility gain: today the caches describe images that would not be published under
a de-identified release; afterwards the evaluated and deposited artifacts are the same
bytes.

## 11. Blocked on session restart

`.mcp.json` configures the Supabase MCP server, but Claude Code binds MCP servers at
session start and the file was created mid-session, so its tools were unavailable. After
a restart, the synthetic patient/doctor/admin accounts for the authenticated Playwright
journeys (gate 5) can be provisioned.

## 12. Critical: the Supabase anon key grants full read/write on all patient data

Found 2026-08-04 while connecting the Supabase MCP server to provision E2E accounts.
This is a live production exposure and it also contradicts a claim the manuscript makes.

**The finding.** Row-level security is disabled on all 50 tables in `public`, *and* the
`anon` role holds `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` on every one of them.
Verified directly against `information_schema.role_table_grants` for `profiles`,
`patient_profiles`, `prescriptions`, `medical_reports`, `consultations`,
`health_data_consents`, and `appointments`.

The anon key is not a secret. `frontend/lib/use-realtime-slots.ts` builds a browser-side
client from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so it ships in
the client bundle by design — that is the one sanctioned direct-to-Supabase path. The
consequence is that anyone who loads the site can call the PostgREST Data API with that
key and read or modify every prescription, medical report, and consent record in the
database.

**Why the existing evidence missed it.** `CLAUDE.md` documents that the backend bypasses
RLS deliberately — it connects as a password-authenticated asyncpg user, so RLS would
never apply to it, and each route owns its authorization. That reasoning is sound *for
the FastAPI path*. It does not cover the second path into the same database, which the
anon key opens. The security suite and `docs/ROLE_PERMISSION_MATRIX.md` (M-M8) exercise
authorization through FastAPI only, so a caller bypassing FastAPI entirely was never
tested.

**Manuscript impact.** M-M8 and the security-test evidence describe an authorization
model that a direct Data API call defeats. Nothing should be submitted describing the
role/permission matrix as enforced until this is closed or the claim is narrowed.

**Realtime was already inert.** The `supabase_realtime` publication contains no tables,
so `postgres_changes` on `appointments` has never delivered an event — the slot hook has
been a silent no-op since it was written. That removed the only reason to keep the
grants: closing the hole breaks nothing that currently works.

**The fix**, written as Alembic revision `sec_001`
(`backend/alembic/versions/sec_001_restrict_anon_data_plane.py`):

1. `REVOKE ALL` on all tables and sequences in `public` from `anon` and `authenticated`,
   plus `ALTER DEFAULT PRIVILEGES` under both owning roles so new tables do not inherit
   the grants again.
2. `ENABLE ROW LEVEL SECURITY` on all 50 tables with **no** policies — an independent
   second barrier, so a future `GRANT` cannot silently reopen the hole. The backend is
   unaffected: it connects as `postgres`, which holds `rolbypassrls` and owns the tables.
3. A new `slot_change_events` table — `(doctor_id, appointment_date, changed_at)`, no
   PHI — maintained by an `AFTER INSERT/UPDATE/DELETE` trigger on `appointments`, with a
   `SELECT`-only policy for `anon`/`authenticated` and membership in the realtime
   publication. `use-realtime-slots.ts` now subscribes to it.

This keeps the one sanctioned browser→Supabase path and makes realtime work for the
first time, without any patient row entering the stream. Verified safe before writing:
no `.from()` or `.rpc()` call exists anywhere in the frontend, and the only other
supabase-js uses are two auth flows (`auth/confirm/route.ts`,
`reset-password-client.tsx`) which run against the `auth` schema and GoTrue, not
`public` grants. Backend unit 55, ai\_service 16, and `tsc --noEmit` all pass after the
change.

**Status: applied 2026-08-04.** Verified against the live database after the run:

| Check | Before | After |
|---|---|---|
| `anon`/`authenticated` table grants in `public` | 700 | **2** (`slot_change_events:SELECT`) |
| Tables without row-level security | 50 | **0 of 51** |
| Tables in the `supabase_realtime` publication | 0 (inert) | `slot_change_events` |
| Alembic head | `softwarex_003` | `sec_002` |

Two defects were found while applying it, both fixed:

**`sec_001` first attempt failed** on `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`
— a managed project's `postgres` role is not a member of `supabase_admin`, so it raises
`insufficient_privilege`. Alembic uses transactional DDL, so the run rolled back
completely and left nothing half-applied (confirmed: 700 grants still present, head
unchanged). The statement is now per-role with an `insufficient_privilege` handler;
clearing `postgres` is what matters because Alembic creates every application table as
`postgres`.

**`sec_002` fixes a type mismatch that would have broken bookings.**
`slot_change_events.doctor_id` was declared `uuid`, but `appointments.doctor_id` is
`character varying`. PL/pgSQL coerced it on every write, which holds only while every
identifier parses as a UUID — and `public.profiles` already contains a row with
`id = 'admin'`. The failure would have surfaced as appointment inserts aborting in
production. The column now matches, and the trigger additionally traps its own errors:
the change feed is a progressive enhancement and must never be able to fail the booking
that fired it.

This was caught by exercising the trigger, not by reading it. The test ran inside a
transaction terminated with `RAISE EXCEPTION`, so it proved the feed populates (0 → 17
rows, carrying only `doctor_id` and a date) without persisting anything.

### The first version of the security test was vacuous

`tests/security/test_database_grants.py` initially asserted "no grants to `anon`" against
the shared fixture. `tests/conftest.py:163` builds the test schema with
`Base.metadata.create_all` on a stock `postgres:16-alpine`, so Alembic never runs there
and the platform roles `anon` and `authenticated` **do not exist**. Three of the five
tests passed for the wrong reason — there was no `anon` to hold a grant. Only the RLS
test failed, and it failed honestly, because `create_all` does not apply the migration.

This is the same defect class as D1/D1b in §3: a check that cannot fail, reported as
evidence. The module now reconstructs the vulnerable state explicitly — creates the two
roles, grants them everything, leaves RLS off — asserts that the exposure was actually
reproduced, then applies the lockdown and checks the invariants. A fixture-level
assertion guards against it decaying back into a vacuous pass.

**Proven to bite.** Deleting the `REVOKE` statement and neutering the RLS loop turns
three of the five tests red; restoring them turns them green. Five invariants are
covered: no write access for browser roles, `slot_change_events` the only readable
table, RLS on every table, the feed's column set frozen, and the `doctor_id` type
matching `appointments` (the `sec_002` regression).

Integration and security now run **19 tests**, up from 14. The pass count pinned in
`build_prearchive_gate_status.py` was updated to match; it had briefly reported
`not_passed` because the gate asserts an exact count.

## 9. Open ethics decision — raw image redistribution

The corpus mixes prescriptions collected directly from the authors, their families, and
neighbours with a subset from a public research dataset. There is **no institutional
ethics committee review**; the consent basis is direct personal agreement.

Consent for use in a student project is not the same as informed consent for permanent,
worldwide, irrevocable publication of a named person's medical prescription. The
manuscript, `samples/DATA_USE_NOTICE.md`, and the manifest now state this rather than
implying formal authorization. Before any deposit the authors must choose one of:

1. documented consent from each depicted individual covering permanent public archiving;
2. deposit de-identified Rx-region crops and annotations only, withholding full images;
3. controlled access rather than open download.

Option 2 is the lowest-risk path and costs little: the gold standard is the
transcription, not the photograph. `freeze_ocr_manifest.py` now refuses to freeze while
any record's provenance is unclassified.

---

## 5. Artifacts that must not be cited — resolved 2026-08-03

All of these read as results but were not measurements. Each is now either corrected at
source or marked so it cannot be mistaken for evidence in the archive.

| Artifact | Problem | Resolution |
|---|---|---|
| `reports/sample/api_performance.json`, `ocr_accuracy_report.json` | Hand-authored; "79% exact OCR match", 1180.4 ms p95, round `15:00:00Z` timestamps, no internal marker | `_notice` + `_synthetic: true` prepended to each |
| `reports/sample/benchmark_summary.md` | Only "(Sample)" in the title | Explicit do-not-cite banner added |
| `reports/current/regression_guard_report.json` | `violations: []` was vacuous — the guard read `p95_ms` from a file lacking the key and defaulted to 0.0, so it could never fire | Guard now **exits 2** when either input lacks `p95_ms` (`tests/scripts/benchmark_regression_guard.py`); the vacuous report is deleted |
| `reports/current/benchmark_summary.md` | "Violations: 0" with all four data sections silently omitted | `build_human_report.py` now names every absent input under "Sections not reported"; the regenerated summary states plainly that nothing was executed |
| `docs/defense/06_PROFESSOR_QNA.md` G4 | Claimed 1.8 s LCP against a measured 4.2–4.5 s | Correction block added citing `frontend/.lighthouseci/` and the 4700 ms baseline |
| `docs/defense/06_PROFESSOR_QNA.md` G3 | Claimed 380 ms p95 under 120 rps; no Locust or k6 output has ever existed | Correction block added |

Still unexecuted, and now honestly reported as such: Locust, k6, `api_latency_benchmark`,
`db_concurrency_benchmark`, `ocr_pipeline_benchmark`, `chaos_recovery_test`. Note that
`run_benchmarks.sh` swallows two of its eleven steps with `|| true`, which is why their
absence went unnoticed.

## 6. Known staleness

- `record_verification.py` resets all nine named receipts whenever HEAD changes, so every
  check must be re-recorded on the final release commit regardless of what passes now.
- Integration and security were **re-run under Docker on 2026-08-03** against this
  session's backend changes: 14 passed. No longer stale.
- `LICENSE.txt` (a byte-identical duplicate of `LICENSE`) has been removed.
- The `DATA_LICENSE.md` path in `response_to_revision.md` C9 now points at
  `tests/benchmarks/DATA_LICENSE.md`, where the file actually lives.
- `.gitattributes` marks captured logs `-whitespace` so `git diff --check` stays clean
  without editing recorded tool output.

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
| 2026-08-03 | Claude | Started Docker; re-ran integration + security fresh against the changed backend — 14 passed | `reports/current/backend_integration_security_final.out.log` |
| 2026-08-03 | Claude | Fixed `benchmark_regression_guard.py` to exit 2 on a missing `p95_ms` instead of defaulting to 0.0; deleted the vacuous report | `tests/scripts/benchmark_regression_guard.py` |
| 2026-08-03 | Claude | `build_human_report.py` now names unexecuted benchmarks instead of silently omitting them | `reports/current/benchmark_summary.md` |
| 2026-08-03 | Claude | Marked synthetic sample fixtures; corrected the 1.8 s LCP and 380 ms p95 claims in the defence doc | `reports/sample/*`, `docs/defense/06_PROFESSOR_QNA.md` |
| 2026-08-03 | Claude | Removed duplicate `LICENSE.txt`; fixed `DATA_LICENSE.md` path in C9; added `.gitattributes` | repo root, `response_to_revision.md` |
| 2026-08-03 | Claude | Frontend lint and production build re-run clean; all 15 automatable gates pass on fresh evidence | `frontend_lint_final.out.log`, `frontend_build_final.log`, `prearchive_gate_status.md` |
| 2026-08-03 | Claude | Funding gate closed — self-funded, standard no-external-funding declaration | `medora_softwarex.tex` Funding section |
| 2026-08-03 | Claude | Ethics section rewritten for the true mixed provenance; no IRB stated plainly; redistribution treated as an open decision | `medora_softwarex.tex`, `samples/DATA_USE_NOTICE.md` |
| 2026-08-03 | Claude | Reset the inaccurate uniform `provenance` string; added `provenance_reviewed`, a classifier CLI, and a freeze guard | `classify_corpus_provenance.py`, `freeze_ocr_manifest.py` |
| 2026-08-03 | Claude | Built and verified the blinded independent-reviewer package and its importer | `build_reviewer_package.py`, `import_independent_review.py`, `reviewer_app/` |
| 2026-08-03 | Claude | Found all 4,462 cached OCR lines have `bbox: null`, so redaction regions cannot be derived from cache | `cache/ocr/azure_full/*.json` |
| 2026-08-03 | Claude | Built and verified the identifier redaction tool (opaque fill, enforced checklist) | `tools/redaction/` |
| 2026-08-04 | Claude | Resolved the Azure region to `eastus` without an API call — endpoint CNAME chain terminates in `eastus-01.azure-api.net` / `eastus.cloudapp.azure.com`, corroborating the account owner | `tests/benchmarks/provider_manifest.json` |
| 2026-08-04 | Claude | Narrowed redaction scope to patient identifiers + patient photo per author decision; retained prescriber/clinic fields are recorded as `published_deliberately` rather than declared absent | `tools/redaction/redact_server.py` |
| 2026-08-04 | Claude | Provenance classifier now requires an explicit consent basis and dataset licence, and writes `redistribution_basis` per record | `tests/benchmarks/classify_corpus_provenance.py` |
| 2026-08-04 | Claude | Corrected the corpus consent basis: the manifest asserted "written approval confirmed by authors" on all 105 records; the authors confirm consent was **verbal** | `classify_corpus_provenance.py`, manifest pending reclassification |
| 2026-08-04 | Claude | Identified the upstream public dataset: Roboflow Universe `jannat-nmkds/prescription-3xf5s` v1, 213 images, CC BY 4.0 | user-supplied dataset page |
| 2026-08-04 | Claude | **Critical**: `anon` holds full DML on all 50 `public` tables with RLS disabled, and the anon key ships to the browser — see §12 | `information_schema.role_table_grants`, `frontend/lib/use-realtime-slots.ts` |
| 2026-08-04 | Claude | Found `supabase_realtime` publication empty — the slot hook has never delivered an event, so closing the grants breaks nothing | `pg_publication_tables` |
| 2026-08-04 | Claude | Wrote `sec_001`: revoke anon/authenticated DML, RLS on all 50 tables, PHI-free `slot_change_events` feed + trigger; repointed the hook. **Not yet applied — DDL denied by the session classifier** | `backend/alembic/versions/sec_001_restrict_anon_data_plane.py`, `app/db/models/slot_change_event.py`, `frontend/lib/use-realtime-slots.ts` |
| 2026-08-04 | Claude | Classified all 105 records: 70 `public_dataset`, 35 `directly_collected`/verbal. Discriminator is the Roboflow export's fixed 640×640 output; the two sets fall in contiguous ingestion blocks | `ocr_corpus_manifest.json` `provenance_classification` |
| 2026-08-04 | Claude | CC BY 4.0 attribution for `jannat-nmkds/prescription-3xf5s` v1 added; recorded that a licence is not a consent basis | `samples/DATA_USE_NOTICE.md`, `medora_softwarex.tex` |
| 2026-08-04 | Claude | NAV-022/023 recorded as `expected_label_basis: author_assigned_demonstration`; licensed review still outstanding and the gate still blocked | `generate_safety_datasets.py`, `symptom_navigation_cases.jsonl` |
| 2026-08-04 | Claude | Manuscript: provenance/consent rewritten, redaction + attribution stated, second-door authorization hazard reported. 13 pages, 2,944 words, 0 overfull, 0 undefined | `medora_softwarex.tex`, `latex` passes |
| 2026-08-04 | Claude | Re-ran safety benchmarks (0.947/0.755 unchanged); backend unit 55, ai\_service 16, frontend `tsc --noEmit` clean | `reports/current/safety_results.json` |
| 2026-08-04 | author + Claude | Applied `sec_001`; first attempt failed on `supabase_admin` default privileges and rolled back cleanly. Per-role handler added | `sec_001_restrict_anon_data_plane.py` |
| 2026-08-04 | Claude | `sec_002`: `slot_change_events.doctor_id` was `uuid` against a varchar `appointments.doctor_id` — would have aborted booking writes. Type matched; trigger now traps its own errors | `sec_002_fix_slot_feed_types.py` |
| 2026-08-04 | Claude | Verified live: 700 → 2 anon grants, RLS on 51/51, realtime publishes only the PHI-free feed, backend boots through full lifespan (`/health` 200), trigger fires 0 → 17 in an aborted transaction | live DB queries |
| 2026-08-04 | Claude | Added `tests/security/test_database_grants.py`; first version was **vacuous** (no `anon` role exists in the `create_all` fixture). Rewrote it to reproduce the exposure, then lock down; proven to bite | `tests/security/test_database_grants.py` |
| 2026-08-04 | Claude | Full suites re-run on fresh evidence after `sec_002`: backend unit 55, smoke 34, ai\_service 16, integration+security **19** (was 14) | `reports/current/*_final.out.log` |
| 2026-08-04 | Claude | Updated the integration gate's pinned pass count 14 → 19 | `tools/release/build_prearchive_gate_status.py` |
| 2026-08-04 | Claude | Reset the admin password for `medora0631@gmail.com` at the author's request; bcrypt verified. Note: no account named `medoraadmin` exists | `auth.users` |
