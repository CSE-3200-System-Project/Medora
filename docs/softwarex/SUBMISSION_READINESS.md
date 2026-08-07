# Medora SoftwareX — submission readiness ledger

**Verdict as of 2026-08-08: everything closable without a licensed clinician or a
Zenodo deposit is closed.** All nine verification receipts pass at commit `f99079d`,
the gate matrix is 19 passed / 2 blocked / 1 deferred, and the release checker is down
to three failures that all trace to M-C8 and M-C1. See §13 and §15–§18. The paragraph
below is the 2026-08-04 verdict, kept for the history.

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
| M-M5 reproducible benchmark protocol | **Done for everything claimed** | Booking 30/30 at 2/10/50, safety reproduced, frontend Lighthouse executed and the defect it found fixed (§13), API latency executed at 155/155 with zero failures after three protocol defects were fixed (§15). OCR remains withdrawn, not pending |
| M-M6 propagation vs consistency | Done | Reported as separate outputs in `booking_results.json` |
| M-M7 offline cache | **Done, closed 2026-08-08** | `app/sw.ts` caches only same-origin static assets; `sensitive-browser-storage.spec.ts` enumerates cache contents. Authenticated journeys now run: 12 passed, 0 skipped, without `E2E_ALLOW_SKIPS` (§16) |
| M-M8 role/permission matrix | Done | `docs/ROLE_PERMISSION_MATRIX.md` + negative tests |
| M-M9 consent semantics | Done | Versioned grants, revocation, typed denials |
| M-M10 related work | Done | `tab:related-work`, 4 systems × 9 criteria |
| M-M11 provider/model config | **Done, closed 2026-08-08** | Azure region `eastus`; Groq and Vapi organization ZDR are not API-readable, so the manifest records the documented worst-case retention as operative and claims no ZDR (§17). `execution_date` set; no incomplete markers remain |
| M-M12 worked examples | Done | `worked_examples.json` + `test_softwarex_worked_examples.py` |

### Presentation

| Code | Verified status |
|---|---|
| M-P1 title/abstract | Done |
| M-P2 trust-boundary figures | Done — 3 diagrams plus 3 interface plates built by `tools/softwarex/build_ui_figures.py`; 6 figures is the journal maximum; build has zero overfull boxes |
| M-P3 length | Done — 2,989 words counted the Guide for Authors' way (captions included) against a 3,000 cap |
| M-P4 captions/terminology | Done |
| M-P5 generated result tables | Partly — booking and safety generated; OCR table withdrawn with the claim |
| M-P6 conclusion foregrounds limitations | Done |

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

Gate matrix is now **19 passed, 2 blocked, 1 deferred** (was 16/5/1). The two blocked
gates are both the licensed-clinician ones; the deferred one is the Zenodo deposit.

`tools/release/check_softwarex_release.py` is down from 17 failures to 3, and all three
trace to those same two external gates:

```
- release metadata contains RELEASE_PENDING      # M-C1: no DOI, URL, or archive hash yet
- missing generated artifact release_metadata.tex # M-C1: only written once metadata completes
- generated report did not pass: safety_results.json # M-C8: clinician_reviewed = 0
```

Two gate definitions were corrected while doing this, because both were asserting
something other than what they were named for. "Authenticated production-browser
journeys" was hard-coded `blocked` and now reads the recorded Playwright receipt.
"Approval citation and corpus freeze" was gated on the OCR manifest being frozen, which
would hold the release hostage to the claim that was withdrawn; it now passes on the
fact that no prescription image is archived, and reverts to requiring a real approval
citation if images are ever deposited.

### Environment restored 2026-08-08

The checkout arrived with no `frontend/node_modules`, no `backend/venv`, no
`ai_service/venv`, and Docker stopped, which blocked six of the nine receipts. All were
restored with the author's explicit authorization, which overrides the standing "never
create a virtual environment" rule for this session only.

Both venvs are on **Python 3.13**, not the 3.14 on `PATH`. `supabase 2.27.0` pulls
`storage3` which pulls `pyiceberg`, and `pyiceberg` has no cp314 wheel; its source build
fails. Anyone recreating these environments needs 3.13.

`ai_service/venv` additionally needs `tests/requirements-test.txt` — its own
requirements file carries no pytest, so the AI unit suite cannot run from a plain
install.

### What actually remains blocked

| Blocker | Who | Why no automation closes it |
|---|---|---|
| M-C8 licensed navigation review | licensed clinician | 30 fixtures need a clinical judgement. Explicitly out of scope for this session |
| M-C1 Zenodo deposit and DOI | release manager | `zenodo_doi`, `zenodo_url`, and `archive_sha256` cannot exist before the deposit |

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

## 13. Frontend Lighthouse measurement (2026-08-08) — executed, failed, fixed, re-measured

M-M5's frontend half had never been run. Running it exposed a real landing-page defect,
which is now fixed at root cause and re-measured. No Lighthouse figure appears in the
manuscript, so nothing the paper claims is affected either way.

Protocol: production build, `next start` on `127.0.0.1:3000`, Lighthouse 12.6.1 with
simulated throttling, three runs per route per form factor, medians reported.
Chromium 151.0.7922.34 (the Playwright-managed build). Nothing was uploaded — see the
warning below. Raw reports in `tests/benchmarks/reports/current/lighthouse/`, summary
in `frontend_lighthouse_results.json`.

| Form factor | Route | Score | LCP ms | FCP ms | CLS | TBT ms | TTFB ms |
|---|---|---|---|---|---|---|---|
| mobile | `/` **before** | 0.72 | **12282** | 2114 | 0.0586 | 107 | 12.2 |
| mobile | `/` **after** | **0.91** | **2205** | 2205 | 0.0586 | 254 | 11.2 |
| mobile | `/login` | 0.98 | 1796 | 1796 | 0.0003 | 107 | 9.5 |
| mobile | `/selection` | 0.85 | 4046 | 1936 | 0.0001 | 86 | 7.7 |
| desktop | `/` | 0.99 | 965 | 491 | 0.0023 | 0 | 11.1 |
| desktop | `/login` | 0.99 | 927 | 487 | 0.0000 | 0 | 8.7 |
| desktop | `/selection` | 0.99 | 847 | 487 | 0.0000 | 0 | 8.0 |

Before the fix the landing page failed two of `lighthouserc.mobile.json`'s own
assertions: performance 0.72 against a 0.75 floor, and LCP 12.3 s against a 5.5 s
ceiling. `frontend_perf_guard.mjs` exited 1 with `lcp regressed by 28.79%`.

**Root cause.** The hero carousel auto-advances every 6,000 ms. Only slide 0 carried
`priority` and `loading="eager"`; slides 1–3 were lazy. Under mobile throttling the
trace runs past the first advance, so the browser attributed LCP to the slide-1 image
(`doctor-square`), which only began downloading at that moment. All three runs agreed
on the element and landed between 12.1 and 12.5 s. Desktop finishes before the first
advance and attributed LCP to the eager slide-0 image at about 0.9 s, which is why the
same page scored 0.99 there.

**The fix.** Below `lg` the rotating image is a 30%-opacity `aria-hidden` wash behind
the copy; rotating it communicates nothing the text does not. It is now pinned to the
one slide that is preloaded, so the measured element is the element the page actually
prioritises. The visible rotation continues in the desktop panel, and the text, CTAs,
and controls still rotate on mobile. Bandwidth is unchanged — the page now loads one
mobile background instead of four.

Two earlier attempts are worth recording because they did not work. Gating the
auto-advance on the `load` event changed nothing: `document.readyState` is already
`complete` when the component hydrates, so the gate opened immediately (mobile scored
0.69–0.70, marginally worse). Preloading the next slide would not have helped either —
a swap to an already-cached image still registers a new, later LCP candidate.

After the fix: mobile `/` 0.90/0.91/0.93 across three runs, LCP 2,205 ms, and
`frontend_perf_guard.mjs` passes with mean score 0.913, LCP 2,702 ms, CLS 0.0196, and
TTFB 11.2 ms against a baseline of 0.78 / 4,700 ms / 0.02 / 100 ms.

**Do not run `npm run perf:lhci:mobile` or `:desktop` as written.** Both
`lighthouserc.*.json` set `upload.target: temporary-public-storage`, which publishes
the report and its full-page screenshots to a public Google-hosted URL. Neither route
measured here is authenticated, so nothing sensitive left this machine, but the
setting will do the wrong thing the moment anyone points it at a signed-in page.

Two workarounds were needed and are recorded so the run is reproducible. No Chrome is
installed on this machine; the Playwright-managed Chromium works when passed as
`CHROME_PATH`. And `chrome-launcher` raises `EPERM` deleting its temporary Chrome
profile under `%TEMP%`, which kills Node and aborts `lhci autorun` before it collects
anything — the crash lands strictly after the report file is written, so
`tests/performance/frontend_lighthouse_benchmark.mjs` spawns one run at a time and
judges each by whether its report appeared rather than by the exit code.

`frontend_perf_guard.mjs` also averages every report in its directory together, across
routes and form factors, and takes a mean rather than a median. It is only meaningful
pointed at one form factor at a time. The new script reports medians per route.

## 15. API latency benchmark (2026-08-08) — executed for the first time

`tests/performance/api_latency_benchmark.py` had never been run. Running it against a
local backend on the production database exposed three protocol defects that would have
made any published number meaningless, all fixed in the script:

| Defect | Effect | Fix |
|---|---|---|
| Every booking targeted the same date and slot | At most one request per run could be created, so 59 of 60 measured the 400 rejection path at a p95 of 8.8 s | Each request claims its own future day |
| 60 requests were sent to `/ai/search`, which is limited to 20 per 60 s | 40 of 60 measured the rate limiter's 429 | Clamped to the documented budget, and the clamp is recorded in the report |
| The upload fixture was a 1x1 PNG that Pillow rejects as truncated | Every OCR request answered 502; the timing described the rejection | A valid 64x64 greyscale PNG built from `zlib`/`struct`, no new dependency |

A fourth problem was environmental rather than a defect: `AI_OCR_SERVICE_URL` points at
`medora-ai-ocr.…eastasia.azurecontainerapps.io`, which no longer resolves
(`getaddrinfo failed`). The benchmark ran with it overridden to the local
`ai_service` on `127.0.0.1:8001`. **That deployment being gone is worth someone's
attention independently of this benchmark.**

Final run: 155 requests, **zero failures**, 60 iterations at concurrency 10, medians and
p95 in milliseconds.

| Endpoint | n | errors | p50 | p95 | p99 | rps |
|---|---|---|---|---|---|---|
| `POST /appointment/` | 60 | 0 | 5106 | 7928 | 9638 | 1.8 |
| `POST /ai/search` | 20 | 0 | 662 | 917 | 925 | 12.8 |
| `POST /upload/prescription/extract` | 15 | 0 | 1284 | 2501 | 2511 | 3.0 |
| `GET /health` | 60 | 0 | 12 | 40 | 43 | 549.5 |

The booking figure is the one that matters and it is poor: a p50 of 5.1 s and 1.8
requests per second on the create path. This is the architecture `CLAUDE.md` already
describes rather than a new discovery — a transaction-mode pgBouncer forcing `NullPool`
so every request opens a fresh TCP, TLS, and auth round trip, against a database in
ap-south-1 from a client elsewhere, with the endpoint's queries issued sequentially.
`/health`, which touches none of that, answers in 12 ms.

No latency figure appears in the manuscript and none is being added.

## 16. M-M7 authenticated browser journeys (2026-08-08) — closed

`tests/e2e/provision_synthetic_accounts.py` creates one patient, doctor, and admin
account through the GoTrue admin API with matching `profiles`, `patient_profiles`, and
`doctor_profiles` rows, and writes the credentials to `tests/e2e/.env.e2e.local`, which
`.gitignore` already excludes. It has a `--delete` path; the accounts are real rows in
the real project and should not outlive the verification they exist for.

**Result: 12 passed, 0 skipped, exit 0, without `E2E_ALLOW_SKIPS`.** Previously 6
passed and 6 skipped.

The six journeys had never executed, and every one of them was broken:

| Defect | Detail |
|---|---|
| `getByLabel(/Password/i)` matched two elements | The "Show password" toggle carries that accessible name, so login failed in strict mode before any spec body ran |
| Login was never asserted | `loginIfCredentials` waited for `networkidle` and returned. A failed sign-in would have run every spec as an anonymous visitor and passed on whatever the login page rendered. It now asserts the URL leaves `/login` |
| The onboarding wizard overlaid every patient page | Fixed in the provisioner: the synthetic patient is created with `onboarding_completed` true, which the `?mode=edit` onboarding spec is unaffected by |
| The find-doctor spec clicked the AI-mode toggle unconditionally | AI mode is now the default, so the click turned it *off*. It now enters the mode only if the entry button is present |
| Three selectors were stale | The concern field's placeholder, the extracted-text assertion, and a `Cardiology|Arefin` match that resolved to three elements |

The prescription assertion is now stronger than it was: instead of looking for the raw
string, it asserts the structured medication fields and the "Medicine Review (Human
Approval)" panel with its approve control — which is the human-in-the-loop behaviour the
manuscript claims for the extraction path.

Run serialized (`--workers=1`). Twelve parallel sign-ins of one account hit GoTrue's
rate limit and failed intermittently.

## 17. M-M11 provider retention (2026-08-08) — closed conservatively

Neither provider exposes its organization Zero Data Retention flag to an API, so the
manifest now records the **worse** case as operative rather than an unverified
favourable one, and records exactly how that was established.

- **Vapi.** `GET /assistant` with the private key returns HTTP 200 and three assistants,
  every one with `compliancePlan` and `artifactPlan` null, so nothing at assistant scope
  reduces retention. `GET /org`, `GET /org/{id}`, and `GET /org/me` return HTTP 401 for
  both the private and the public key. The documented pay-as-you-go retention (14 days
  for calls, 30 for chats) is therefore the operative figure and no ZDR is claimed.
- **Groq.** No organization-settings endpoint exists. The published default — inference
  not retained, inputs and outputs loggable for up to 30 days for reliability and abuse
  handling — is the operative figure and no ZDR is claimed.

An early probe returned HTTP 403 with Cloudflare error 1010 for every Vapi path, which
is a blocked client fingerprint rather than an authorization answer; a normal
`User-Agent` header was needed before the real 200/401 responses appeared. The earlier
"403, so the API cannot establish it" reading was wrong.

`execution_date` is set to 2026-08-08 and no incomplete-marker string remains in the
manifest.

## 14. A production dependency vulnerability had reappeared (2026-08-08)

The gate matrix records "Combined reported production vulnerabilities: 0". That had
stopped being true. `npm audit --omit=dev` reported `dompurify <=3.4.12`, moderate,
GHSA-55q2-fjhq-7xh7 — an IN\_PLACE hook removal leaves a detached subtree executable,
causing XSS. It reaches the bundle through `html2pdf.js` → `jspdf`.

Fixed by pinning `dompurify` to `3.4.13` in `frontend/package.json`'s existing
`overrides` block, which is how `postcss`, `sharp`, and `tmp` are already pinned here.
`npm audit fix` was tried first and rejected: run with `--omit=dev` it prunes
`@playwright/test`, `playwright`, `playwright-core`, and `fsevents` out of the
lockfile, which would leave `npm ci` unable to install the dev toolchain the lint,
build, and Lighthouse steps depend on.

Verified after the change: `npm ci` 0, `npm run lint` 0, `npm run build` 0,
`npm audit --omit=dev` reports 0 vulnerabilities, and the installed tree resolves
`dompurify 3.4.13`.

## 18. Azure deployment and cost (2026-08-08)

### The OCR service had been broken since deployment

`AI_OCR_SERVICE_URL` in `backend/.env` pointed at
`medora-ai-ocr.proudbay-b42fc45b.eastasia.azurecontainerapps.io`, a Container Apps
environment that no longer exists. The live service is `medora-ai-service` in
`medora-rg-us`, eastus. The local file is corrected.

Fixing the URL exposed the real fault. The deployed service answered `/health` with 200
and every OCR call with 500:

```
RuntimeError: Missing AZURE_OCR_ENDPOINT or AZURE_OCR_KEY in environment.
```

`AZURE_OCR_KEY` was wired correctly as a secret reference. `AZURE_OCR_ENDPOINT` was set
to the **empty string**. It now holds
`https://medora-prescription-ocr-ai.cognitiveservices.azure.com/`, and a direct call
returns 200 with `azure_prebuilt-read` in about 150 ms. Cloud OCR works for the first
time in this deployment.

**One defect remains and it should not be papered over.** The deployed service serves
`processing_mode=cloud` but returns 500 for `local` and `auto`:

```
RuntimeError: PDX has already been initialized. Reinitialization is not supported.
```

`/upload/prescription/extract` defaults `processing_mode` to `local`
(`upload.py:577`), so the default path through the deployed backend still fails. The
tempting fix, changing that default to `cloud`, would send prescription images to Azure
when the caller asked for on-device processing, which is exactly the separation M-C2
exists to guarantee. The correct fix is in the AI service's PaddleOCR initialisation and
needs a rebuild and redeploy. Failing loudly is the right behaviour until then.

Separately, `AI_OCR_CONNECT_TIMEOUT_SECONDS` (default 45 s) replaces a hard-coded 5 s
connect timeout. With the service scaled to zero a cold start takes about 24 s, so the
old value turned every first request into a 502 while the 180 s read timeout sat unused.

### Where the money was going

Month to date, eight days in:

| Line | Cost |
|---|---|
| `medora-ai-service` idle memory | $6.28 |
| `medora-ai-service` idle vCPU | $3.14 |
| `medora-backend` idle memory | $4.70 |
| `medora-backend` idle vCPU | $2.35 |
| **all four idle lines** | **$16.47** |
| all active usage, both apps | $0.07 |
| Container Registry (Basic, flat) | $1.11 |

**99.6% of Container Apps spend was idle capacity.** Both apps ran `minReplicas: 1`, so
3.5 vCPU and 7 GiB were billed around the clock to serve $0.07 of work. That is roughly
$66 a month against a one-time Azure for Students credit.

Both apps are now `minReplicas: 0`. Cold start measured after the change: backend about
1 s, AI service 24.2 s, both under 1 s warm. A budget named `medora-monthly-guard` is
set at $15 a month with alerts at 50%, 80%, 100% actual and 100% forecast.

The database has 33 accounts, 56 appointments, and **zero upcoming appointments**, so
the background loops the backend runs (reminder dispatch, hold expiry, auto-complete)
have nothing to process while it is scaled down. That is what makes scale-to-zero safe
here, and it stops being safe the moment there is a real booking in the future.

### Thirteen secrets are stored in plaintext on the backend container app

`az containerapp show` returns these as literal values rather than secret references:

```
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, SUPABASE_KEY, GROQ_API_KEY,
GEMINI_API_KEY, CEREBRAS_CLOUD_API_KEY, VAPI_API_KEY, VAPI_PUBLIC_KEY,
PATIENT_REF_HASH_SECRET, AI_ID_HASH_SECRET, GOOGLE_CLIENT_SECRET, SMTP_PASSWORD,
ADMIN_PASSWORD
```

Anyone with Reader on the subscription can read all of them, and they appear in
Resource Manager deployment history. `medora-ai-service` does this correctly with
`secretRef`, and the backend already has a secret store holding `admin-password`, so
the mechanism exists and is unused.

Two of these matter beyond the usual: `SUPABASE_JWT_SECRET` allows forging a token for
any user, and `PATIENT_REF_HASH_SECRET` plus `AI_ID_HASH_SECRET` are what make
`core/patient_reference.py` pseudonymous. With those secrets in hand the mapping from
pseudonym back to patient UUID is a brute-force over a known space, which weakens a
property the manuscript relies on.

**Moving them to secret references is not sufficient. They have been readable and should
be rotated first**, then stored as references. This has not been done: rotating live
credentials is the account owner's call, not something to do to a running system
unasked.

## 19. Deposit metadata drift, and a database audit (2026-08-08)

### CITATION.cff and codemeta.json still described the pre-reframe software

The manuscript was retitled on 2026-08-04 and its keywords were rewritten, but the two
machine-readable metadata files were never updated with it. They still carried the old
title, an abstract about "human-reviewed prescription digitization", and
`prescription OCR` as a keyword. `build_zenodo_deposit.py` reads `CITATION.cff`, so the
deposition record inherited all of it and advertised a capability this release
explicitly withdraws.

Both files now match the manuscript exactly: the title from `\title`, the six keywords
from `\begin{keyword}`, and a description condensed from the abstract that leads with
the consent-gated assistive-AI layer and the 7,389-drug, 67,001-brand medicine
reference. Zero OCR terms remain in the generated deposition. The manuscript's own
self-citation (`\bibitem{medorasw}`) already used the new title, which is how the drift
stayed invisible.

### Database audit

Run through the `postgres` role directly. The Supabase MCP server needs an interactive
OAuth that a non-interactive session cannot complete; direct asyncpg access is a
superset of what it offers anyway.

**Security holds.** 51 tables, 0 without row-level security, 2 grants to
`anon`/`authenticated` (the PHI-free slot feed). `sec_001` and `sec_002` are intact. No
`SECURITY DEFINER` function has a mutable `search_path`.

**The database was two migrations behind its own head.** Alembic reported `sec_002`
while the head was `med_001`. The medicine tables existed anyway, because they were
loaded out of band before that revision was written, so `med_001` would have aborted on
`relation "drugs" already exists` and every index it also creates was silently absent.
`med_001` now detects that case and creates only the indexes. `alembic upgrade head`
runs clean, and the head is `perf_fk_001`.

**Seventeen foreign keys had no supporting index.** An unindexed foreign key makes joins
across it scan, and makes every parent DELETE scan the whole child table to prove
nothing still references the row. Two belonged to `med_001`; the other fifteen are in a
new revision, `perf_fk_001`. The count is now zero.

**Statistics had never been collected on the medicine tables.** `pg_stat_user_tables`
reported `n_live_tup = 0` and a null `last_analyze` for `drugs` (7,389 rows), `brands`
(67,001), and `medicine_search_index` (74,390). `ANALYZE` fixed the estimates.

It did **not** make the search faster, and the guess that it would was wrong. A
representative brand lookup measured 152.0 ms before and 152.2 ms after, and `EXPLAIN
ANALYZE` shows why: the query already used the trigram index and executed in 0.29 ms.
The other 151 ms is the round trip to a database in ap-south-1. That is the constraint
`CLAUDE.md` already names, now with a number against a real query. Correct statistics
still matter for planning other queries; they were not the bottleneck here.

**`medicine_staging` is dead weight.** 71,795 rows and 24 MB, referenced nowhere in the
repository, no ORM model, no grants. It is the raw CSV load table left behind by the
corpus build and is fully reproducible from
`data/medicine_reference/Final_Medicine_Dataset.csv`, whose row count the release gate
already pins at 71,795. Dropping it would halve the medicine footprint and remove a
table that a fresh deployment would otherwise inherit from a schema dump. **Not
dropped**: it holds data, and reproducibility from the CSV is an argument for dropping
it, not authorisation to.

`pg_trgm` is installed in `public` rather than a dedicated schema, which Supabase's
linter flags. Moving it would invalidate the trigram index that the medicine search
depends on, so it stays.

## 20. Enum drift, and the v1.0.0 deposit (2026-08-08)

### v1.0.0 is deposited

Version DOI `10.5281/zenodo.21844460`, concept DOI `10.5281/zenodo.21844459`, record at
`https://zenodo.org/records/21844460`, from tag `v1.0.0` at commit `73a1cce`. The
deposited file is GitHub's own `Medora-v1.0.0.zip`, SHA-256
`5c32252edfc602cf85af265cac21446c48cf16478c72c4b38289286d5f5c31bc`, so the deposit came
through the GitHub integration rather than `build_zenodo_deposit.py`.

The published record's title is already correct. Its keyword list is a mix of the old
and new sets and still carries `appointment coordination`. That archive's `CITATION.cff`
also predates the metadata correction, which is why v1.0.1 exists.

### Eleven enum members raised on write, and nothing caught it

Comparing `app/db/models/enums.py` against `pg_enum` on the live database found members
the code can produce that the type would reject:

| Enum | Members the database rejected |
|---|---|
| `SurgeryUrgency` | `routine`, `urgent`, `emergency`, `elective` |
| `DurationUnit` | `years`, `ongoing`, `as_needed` |
| `TestUrgency` | `routine`, `emergency` |
| `ConsultationStatus` | `cancelled` |
| `MedicineType` | `patch` |

`surgeryurgency` held only `immediate` and `scheduled`, so every surgery-urgency value
the API accepts except `scheduled` would have failed at insert with
`InvalidTextRepresentationError`, surfacing as a 500. Two labels also existed with no
member able to read them: `medicinetype.powder` and `surgeryurgency.immediate`.

Revision `enum_sync_001` adds the eleven labels; the two orphans are now members. The
count in both directions is zero.

**Why the test suite was green.** `tests/conftest.py` builds the integration schema with
`Base.metadata.create_all`, which generates the enum types from the same models it is
checking, so the types always match there by construction. Only a real database can see
this. That is the same defect class as the vacuous grant test in §12 and D1 in §3.
`tools/release/check_enum_sync.py` now performs the comparison against a real database
and exits 2 on any mismatch.

A related hazard worth knowing: this schema stores `userrole`, `accountstatus`,
`verificationstatus`, and `reviewmoderationstatus` by member **name** (upper case), and
every other enum by **value** (lower case). The checker accepts either, but anyone
writing raw SQL has to know which convention a given type follows.

### Two profiles have no `auth.users` row

Referential integrity is otherwise clean: no invalid constraints, no orphaned foreign
key values anywhere in the schema.

- `51c2a39e-...` is an `active`, `verified`, BMDC-verified **doctor** whose auth user no
  longer exists. It appears among the 20 doctors patients can browse. It has zero
  availability rows and zero appointments, so nothing can actually be booked with it,
  but a listed doctor who cannot sign in is still wrong. The email on it is an author's.
- `admin` is a profile whose primary key is the literal string `admin` rather than a
  UUID. It is the row that forced `sec_002` to widen `slot_change_events.doctor_id`. It
  is an `active` ADMIN with no email and no auth user, and **308 unread notifications**
  are addressed to it, which nobody can read.

Neither is touched. One is an author's own account and the other is a sentinel the
application may rely on; deleting either is a decision for the authors, not a cleanup.

`medicine_staging` also remains: 71,795 rows and 24 MB, referenced nowhere in the
repository, reproducible from the CSV whose row count the release gate already pins.

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
  This bites immediately: committing `verification.json` itself advances HEAD and
  invalidates what was just written. All nine were therefore re-recorded at `20cc7d3`
  after that commit, and `verification.json` plus `release_metadata.json` are left
  **modified in the working tree on purpose**. Committing them is the release manager's
  last step, after which the nine must be recorded once more on that final commit.
- Two synthetic accounts sets exist in the live project (`medora.e2e.*@example.com`).
  They are what the Playwright receipt was recorded against, so they should outlive
  this session and be removed with
  `provision_synthetic_accounts.py --delete` once the release is deposited. The 120
  appointments the two latency runs created have been deleted; the synthetic patient
  holds zero appointments and zero consultations.
- Integration and security were **re-run under Docker on 2026-08-03** against this
  session's backend changes: 14 passed. No longer stale.
- `LICENSE.txt` was removed on 2026-08-03 and restored on 2026-08-07: the Guide for
  Authors requires the repository to carry `README.md` and `LICENSE.txt` by name.
- §5's two evidence paths are gone. `docs/defense/06_PROFESSOR_QNA.md` was deleted with
  the rest of `docs/defense/` in 5a36a5a8, and `frontend/.lighthouseci/` has never been
  committed. The corrections §5 records were real; the files that carried them are not
  in the tree any more, and §13 now supersedes the LCP one with a measured figure.
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
| 2026-08-07 | Claude | Added five interface figure plates (bilingual locales, consent + audit surface, patient/clinician assistive AI, mobile viewports, prescription composition against the medicine reference), built deterministically rather than hand-cropped | `tools/softwarex/build_ui_figures.py`, `docs/softwarex/figures-ui/` |
| 2026-08-07 | Claude | Template compliance: keywords 7 → 6, abstract trimmed toward the "ca. 100 words" guidance, Ethics moved out of the numbered §1–§5 body into an unnumbered declaration, software self-citation added, related-work table given an in-text reference | `medora_softwarex.tex` |
| 2026-08-07 | Claude | Covered the demonstration account's telephone and email with opaque fill in the prescription figure; the pseudonymous patient reference is retained deliberately | `build_ui_figures.py` `REDACTIONS` |
| 2026-08-07 | Claude | Rebuilt: 21 pages, 2,996 words, zero overfull boxes, zero undefined references or citations | `medora_softwarex.pdf`, `medora_softwarex.log` |
| 2026-08-07 | Claude | **The length rule we were using was the wrong one.** The Guide for Authors counts captions toward the 3,000 words and caps figures at six; the template excludes floats and mentions no figure cap. Measured the Guide's way the manuscript was 3,557 words with 9 figures | SoftwareX Guide for Authors |
| 2026-08-07 | Claude | Cut to 2,989 words and 6 figures: dropped the booking-timeline diagram, the prescription screenshot, and the mobile plate; compressed every caption; removed Motivation/Conclusions repetition. No claim, number, or limitation removed | `medora_softwarex.tex`, `build_release_artifacts.py` |
| 2026-08-07 | Claude | Release gate rewritten to count the Guide's way (expands `\input`, counts captions, excludes the two metadata tables) and to fail above 6 figures | `check_softwarex_release.py` |
| 2026-08-07 | Claude | Humanizer pass over the manuscript prose: em dashes removed, copula-avoidance and trailing participles rewritten, signposting and duplicated enumerations cut | `medora_softwarex.tex` |
| 2026-08-07 | Claude | **Repository defect**: `.gitignore` line 82 was an unanchored `softwarex/`, which matches at any depth and silently ignored all of `docs/softwarex`. The chorui figure and every interface PNG were uncommittable, so a fresh clone could not build the manuscript. Anchored to the repo root | `.gitignore` |
| 2026-08-07 | Claude | Restored `LICENSE.txt`; the Guide for Authors requires the repository to carry `README.md` and `LICENSE.txt` by name | repo root |
| 2026-08-07 | Claude | Added two phone viewports as panels inside the consent and assistive-AI figures, so responsiveness is shown without spending a figure against the 6-figure cap. Consent panel (c) is the same screen as (a) | `medora_softwarex.tex` |
| 2026-08-07 | Claude | Stated reminder delivery accurately after reading the code: a background dispatcher writes in-app notifications and email; web push exists but stays off unless VAPID keys are configured | `reminder_dispatcher.py`, `email_service.py`, `push_service.py` |
| 2026-08-07 | Claude | Final state: 2,995 words counted the Guide's way, 6 figures, 18 pages, zero overfull boxes, zero undefined references. Zero em dashes and zero flagged AI-writing patterns in the body | `medora_softwarex.pdf` |
| 2026-08-08 | Claude | Restored `frontend/node_modules` with `npm ci`; lint, production build, and bundle budget all re-run clean on this checkout | `frontend_lint_20260808.out.log`, `frontend_build_20260808.log`, `frontend_bundle_budget_20260808.log` |
| 2026-08-08 | Claude | Recompiled the manuscript independently: 18 pages, zero overfull boxes, zero undefined references or citations. Confirms the 2026-08-07 claim | `latex_pass2_20260808.log` |
| 2026-08-08 | Claude | **Executed the frontend Lighthouse benchmark for the first time.** Mobile `/` scores 0.72 with a 12.3 s LCP and fails two of the config's own assertions; the perf guard exits 1 at +28.79% LCP. Root cause is the hero carousel advancing onto a lazily-loaded slide inside the LCP window. Not fixed — see §13 | `frontend_lighthouse_results.json`, `frontend_lighthouse_benchmark.mjs` |
| 2026-08-08 | Claude | **Production dependency vulnerability had reappeared**: `dompurify <=3.4.12`, moderate XSS, via `html2pdf.js`/`jspdf`. Pinned to 3.4.13 in `overrides`; audit back to 0. `npm audit fix` was rejected because it prunes the dev toolchain out of the lockfile | `frontend/package.json`, §14 |
| 2026-08-08 | Claude | Confirmed M-M11 cannot be closed by API: `GET https://api.vapi.ai/org` with the project key returns HTTP 403, so the organization ZDR setting is only readable in the console | `provider_manifest.json` |
| 2026-08-08 | Claude | Recorded that `backend/venv`, `ai_service/venv`, and the Docker daemon were absent on this checkout | §4 |
| 2026-08-08 | author + Claude | Rebuilt both venvs on Python 3.13 with explicit authorization. 3.14 cannot be used: `supabase` → `storage3` → `pyiceberg` has no cp314 wheel and its source build fails | `backend/venv`, `ai_service/venv` |
| 2026-08-08 | Claude | **Fixed the landing-page LCP defect** the Lighthouse run exposed: the mobile hero wash is pinned to the preloaded slide instead of rotating onto lazy images. Mobile `/` 0.72 → 0.91, LCP 12,282 → 2,205 ms, perf guard now passes | `components/landing/hero-carousel.tsx`, §13 |
| 2026-08-08 | author + Claude | **M-M7 closed.** Provisioned synthetic patient/doctor/admin accounts and fixed five defects in journeys that had never executed, including a login helper that never asserted it had logged in. Playwright 12 passed, 0 skipped, no `E2E_ALLOW_SKIPS` | `tests/e2e/provision_synthetic_accounts.py`, `_helpers.ts`, §16 |
| 2026-08-08 | Claude | **API latency benchmark executed for the first time.** Three protocol defects fixed (same-slot bookings, exceeding the `/ai/search` rate limit, a 1x1 PNG Pillow rejects). Final run 155/155 with zero failures | `api_latency_benchmark.py`, §15 |
| 2026-08-08 | Claude | Found `AI_OCR_SERVICE_URL` points at an Azure Container App that no longer resolves; the benchmark ran against the local `ai_service` instead | `backend/.env`, §15 |
| 2026-08-08 | Claude | **M-M11 closed conservatively.** Vapi `GET /assistant` 200 with all three `compliancePlan`/`artifactPlan` null; org endpoints 401 for both keys; Groq has no such endpoint. Manifest now asserts documented worst-case retention and claims no ZDR | `provider_manifest.json`, §17 |
| 2026-08-08 | Claude | Wrote down the clean-container procedure, which had only ever existed in a shell history | `tools/release/validate_clean_containers.sh` |
| 2026-08-08 | Claude | Suites re-run on this checkout: backend unit 62 (was 55), ai\_service 16, integration+security 29 (was 19), booking 30/30 at 2/10/50, safety 0.947/0.755 unchanged, frontend lint and build clean, manuscript 18 pages / 2,995 words / 6 figures / 0 overfull / 0 undefined | `reports/current/*_20260808.*` |
| 2026-08-08 | Claude | Committed `f99079d` and recorded **all nine verification receipts on that exact commit**, every one passing | `generated/verification.json` |
| 2026-08-08 | Claude | Wrote `release_metadata.json` with the real commit and date, and recorded the approval citation as not applicable because no prescription image is archived | `docs/softwarex/release_metadata.json` |
| 2026-08-08 | Claude | Corrected two gate definitions that asserted the wrong thing: the browser-journey gate was hard-coded blocked, and the approval gate was tied to the withdrawn OCR freeze | `build_prearchive_gate_status.py` |
| 2026-08-08 | Claude | Gate matrix 16/5/1 → **19 passed, 2 blocked, 1 deferred**; release checker 17 failures → 3, all of them M-C8 or M-C1 | `prearchive_gate_status.json` |
| 2026-08-08 | Claude | Built the Zenodo deposit path: archive from the verified commit, SHA-256, deposition record from `CITATION.cff`. Only the authenticated upload remains | `tools/release/build_zenodo_deposit.py` |
| 2026-08-08 | Claude | `explanation.md` claimed M5, M7, and M11 were open and listed four remaining gates. Rewritten against the current state; humanizer pass over both it and the manuscript returns zero hits | `explanation.md` |
| 2026-08-08 | author + Claude | **Repaired the deployed OCR service.** `AZURE_OCR_ENDPOINT` was an empty string, so every call 500'd. Cloud OCR now answers 200 in about 150 ms. `local` mode still fails on a Paddle re-initialisation error | §18 |
| 2026-08-08 | Claude | Replaced a hard-coded 5 s OCR connect timeout with `AI_OCR_CONNECT_TIMEOUT_SECONDS` (45 s); a scale-to-zero cold start takes 24 s and was returning 502 | `config.py`, `upload.py` |
| 2026-08-08 | author + Claude | **Cut Azure spend by about 93%.** 99.6% of Container Apps cost was idle replicas at `minReplicas: 1` serving $0.07 of work. Both apps now scale to zero; a $15/month budget with four alert thresholds is in place | §18 |
| 2026-08-08 | Claude | Found 13 secrets stored as plaintext env vars on the backend container app, including the JWT secret and both pseudonymisation secrets. Reported for rotation; not touched | §18 |
| 2026-08-08 | Claude | Rewrote `run_benchmarks.sh` to report a per-step outcome and exit non-zero on failure. It immediately exposed that four steps could never have run: two were hidden by `\|\| true`, `realtime_slot_consistency_benchmark.py` was never passed its required `--slots`, and several scripts failed on `No module named 'tests'` because the root was not on `PYTHONPATH` | `run_benchmarks.sh` |
| 2026-08-08 | Claude | Database concurrency benchmark executed for the first time: 500 operations at concurrency 80 gave **449 failures (89.8%)**, the pooler refusing connections. Corroborates the architecture note in `CLAUDE.md` | `reports/current/db_benchmark.json` |
| 2026-08-08 | Claude | The selection page's above-the-fold image was `loading="lazy"` with `fetchPriority="low"`. Mobile 0.85 → 0.96, LCP 4,046 → 2,087 ms | `app/(auth)/selection/page.tsx` |
| 2026-08-08 | Claude | `tests/e2e` production dependency audit: 0 vulnerabilities | `reports/current/e2e_npm_audit_20260808.json` |
