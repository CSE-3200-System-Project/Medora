# Task — Implement the BCOLBD whitepaper's specified/planned commitments in code

**Source of truth:** `docs/BCOLBD/Whitepaper/medora_bcolbd_whitepaper.tex`, plus
`docs/BCOLBD/Plan/{medora-2.0-master-plan,medora-2.0-further-revisions,phi-deid-build-plan,governance-oversight-build-plan}.md`.

**Goal:** every claim the whitepaper marks `specified` or `planned` becomes real code, wired through
backend → database → frontend, with tests and machine-readable evidence. Claims already marked
`deployed`/`measured` are left alone except where a phase explicitly extends them.

---

## Gap analysis (verified against code, not docs)

| Whitepaper claim | Status in repo today | Evidence |
|---|---|---|
| Arohon `AutonomyTier` L0–L4, `RiskClass`, ceilings, tier logged with correlation ID | **absent** — no match for `AutonomyTier`/`RiskClass`/`arohon` anywhere | grep over `backend/ frontend/ tests/` |
| Risk classes (cardiac / stroke / anaphylaxis / obstetric / self-harm) separated | **absent** — one boolean `detect_emergency_red_flags` lumps self-harm with cardiac | `backend/app/routes/ai_doctor.py:78` |
| L3 emergency takeover UI, one-tap action, cancellable countdown, dismissal logged as FP | **absent** — only a text `safetyMessage` banner | `frontend/components/doctor/pages/patient-find-doctor-client.tsx:430` |
| Self-harm path: supportive text, time-aware helpline registry, L4 prohibited | **absent** | — |
| Akkhor public API (`/v1/drugs`, `/brands`, `/search`, `/resolve`, versioned, provenance) | **partial** — internal `/medicine/*` only; data loaded (7,389 / 67,001 / 74,390 rows) | `backend/app/routes/medicine.py`, supabase `list_tables` |
| Lokkhon as a versioned standalone benchmark (schema, runner, RELEASE.md, citation) | **partial** — `tests/benchmarks/run_safety_benchmarks.py` exists, no package/version/release | `tests/benchmarks/` |
| Lokkhon axis D expansion (n=4) and axis E (calibrated abstention, risk–coverage) | **absent** | `run_safety_benchmarks.py` |
| Shimana sweep | **partial** — `run_shimana_sweep.py` + `shimana_results.json` exist; no reporter/CI/knee/figure regen | `tests/benchmarks/` |
| Maya admission gate | **absent** | — |
| Learned PHI span recogniser + union ensemble behind feature flag + ONNX | **absent** (rules-only redactor is measured) | `backend/app/core/ai_privacy.py` |
| Stewardship layer: `AdminTier`, `Permission`, scoped `require_admin`, admin audit, two-person rule, break-glass, DSAR | **absent** — flat `role == ADMIN` | `backend/app/routes/admin.py:26`, `enums.py` |
| Patient "who accessed my data" timeline | **shipped** | `backend/app/routes/patient_access.py:493,579` |

---

## Phasing

Each phase is independently shippable, ends green, and is committed separately.
Blast radius is stated per phase. No phase bundles a refactor.

### Phase 1 — Arohon policy core (backend, no behaviour change) — DONE (7f32cd7)
- [x] `enums.py`: add `AutonomyTier` (L0–L4) and `RiskClass` (cardiac, stroke, anaphylaxis, obstetric, self_harm, routine, out_of_scope). Single-source rule, per convention.
- [x] New `backend/app/core/arohon.py`: immutable ceiling table (risk class → max tier), `TierDecision` dataclass, `resolve_tier(requested, risk_class, consent_ok, correlation_id)`. Self-harm ceiling L3, L4 structurally unreachable (not a config value).
- [x] New `backend/app/services/risk_classifier.py`: split the existing red-flag patterns into labelled classes. `detect_emergency_red_flags()` keeps its exact current truth table (delegates to the classifier) so the measured 30-fixture navigation result cannot move.
- [x] Unit tests: ceiling matrix, self-harm L4 refusal, classifier class assignment, byte-identical boolean parity with today's detector on all 30 navigation fixtures.
- **Touches:** 2 new files, `enums.py`, `ai_doctor.py` (one function body). No DB, no API shape change.

### Phase 2 — Arohon instrumentation (backend + DB + Alembic) — DONE (9f02eb0)
- [x] Alembic revision: `ai_interactions.autonomy_tier`, `.risk_class`, `.correlation_id`, `.tier_ceiling_applied` (all nullable, `server_default` where needed) + index on `correlation_id`.
- [x] Mirror in `app/db/models/ai_interaction.py`. Apply via Alembic; verify with supabase MCP.
- [x] `ai_orchestrator._execute`: accept a declared tier + risk class, return the resolved decision in `AIExecutionResult`, log it.
- [x] Every one of the 21 AI endpoints declares its intended tier (constant per endpoint; a table in `arohon.py`, not branching in routes).
- [x] Startup self-heal block in `main.py` gets the matching `ALTER TABLE IF EXISTS` lines (repo convention for drifted dev DBs).
- [x] Fixtures asserting tier selection per endpoint; contract test that no endpoint ships without a declared tier.
- **Touches:** 1 migration, 1 model, orchestrator, a tier map, 21 one-line route declarations.

### Phase 3 — Arohon L3 emergency + crisis UI (frontend + i18n + backend) — DONE
- [x] Backend returns `risk_class` + `autonomy_tier` + `helplines[]` on the navigation/consultation emergency path.
- [x] New `backend/app/services/helpline_registry.py`: time-aware registry (Kaan Pete Roi 09612-119911 15:00–03:00; 999; Shastho Batayon 16263 flagged unreliable), health-check field, no single hard dependency.
- [x] Frontend `components/safety/emergency-takeover.tsx`: full-screen bilingual takeover, one-tap emergency action, 10s cancellable countdown, no autodial, mock number in demo mode.
- [x] Frontend `components/safety/crisis-support.tsx`: self-harm path — clinician-authored supportive copy, time-aware helplines, explicit on-screen "will not act without you", no method content, no autonomous notification.
- [x] Dismissal posts a labelled false-positive event to the backend, stored for Lokkhon axis A.
- [x] All strings in `frontend/i18n/messages/{en,bn}/*.json`. lucide-react icons only. 44×44 targets. CSS-variable Tailwind only.
- **Touches:** 2 new frontend components + 1 server action, 1 new backend service, 1 route response extension, i18n files.

### Phase 4 — Akkhor public API + versioned release — DONE
- [x] `backend/app/routes/akkhor.py` mounted at `/v1/akkhor`: `GET /drugs`, `/drugs/{id}`, `/brands`, `/search`, `/resolve`. Uses the canonical `PaginationParams`/`Page[T]` contract — no hand-rolled skip/take.
- [x] Provenance fields surfaced per row (source dataset), release id `akkhor-2026.08`, `GET /v1/akkhor/version` returning the six counts regenerated from the DB, not transcribed.
- [x] Rate limit via existing `core/rate_limit.py`. Public/unauthenticated read, no PHI in scope.
- [x] `packages/akkhor/README.md` + schema doc + CC BY 4.0 restatement.
- [x] Contract tests: counts match the live tables; pagination envelope conformance.
- **Touches:** 1 new route module, 1 schema module, main.py router include, docs.

### Phase 5 — Lokkhon as a versioned benchmark package — DONE
- [x] `benchmark/lokkhon/`: case JSON schema, runner entry point wrapping the existing harness (no re-implementation), bootstrap CI reporter, `RELEASE.md`, `CITATION.cff`, `v0.1` tag of results.
- [x] Axis D expansion: transliterate existing Bengali fixtures to romanised form via a scripted, reviewable generator (raises n from 4).
- [x] Axis E: calibrated abstention — risk–coverage curve over the summary/navigation fixtures, emitted machine-readable.
- [x] Emit `lokkhon_v0.1.json` with n printed beside every metric.
- **Touches:** new top-level `benchmark/` tree; `tests/benchmarks/` scripts imported, not moved.

### Phase 6 — Shimana reporter and frontier output — DONE
- [x] Reporter emitting paired results, bootstrap CIs, non-dominated set, knee estimate (whitepaper §Shimana names all four).
- [x] Regenerate `shimana_results.json` and a figure-ready CSV that reproduces the paper's frontier.
- **Touches:** 1 new reporter script under `tests/benchmarks/`.

### Phase 7 — Learned PHI span recogniser (build + gate; training is a separate run) — DONE
- [x] `tools/phi_ner/generate_corpus.py` (+ `fillers.py`, `templates.py`): 12,000 BIO-tagged Bengali/English/romanised sentences, 10 tags, hard negatives (Akkhor drug names loaded from the shipped reference and asserted un-tagged), varied PHI density (2,400 sentences with no PHI), char offsets, JSONL. Train/dev draw from **disjoint filler pools**, so dev measures unseen names rather than memorisation.
- [x] `tools/phi_ner/train.py`: MuRIL + XLM-R token classification, 3 seeds, recall-first threshold sweep with an over-redaction cap. BanglaBERT is a registered research comparator whose export path raises `LicenceViolation` — the licence is enforced in code, not prose.
- [x] `tools/phi_ner/evaluate.py`: rules / model / union, span P/R/F1, over-redaction, CPU latency, bootstrap CIs. Scores through the deployed harness's `score_privacy_case` rather than a second copy of the scoring logic.
- [x] `backend/app/core/phi_ner.py` + `ai_privacy.py`: union ensemble behind `PHI_NER_ENABLED` + ONNX CPU inference inside the trust boundary; flag default off; every failure mode degrades to rules.
- [x] Regression fixtures: flag-off byte-identity over both scored populations, union catches what rules miss, idempotence, placeholder protection, offset mechanics, fail-closed loading, licence/export gate, evidence-bound admission, corpus determinism and holdout exclusion.
- **Blocked-on-run, as planned:** the registered training run still requires expansion to the planned 500+ name pools, all 495 upazilas and 60–100 base frames, publication of the generated full corpus as a checksummed release asset, a GPU session, and licence review. The current reproducible 12,000-row corpus is a runnable minimum, and the code and gate ship; weights remain a follow-up. `evaluate.py` marks model and union rows `unavailable` rather than estimating them.
- **Finding that contradicts the build plan.** The plan assumed one held-out population, the 134-case set carrying the published 94.7% / 75.5% baseline. That set is now **saturated**: the rules were extended against it and score **1.000 recall** there, so it cannot separate three systems. The discriminating population is the novel-identifier probe (`pii_holdout_cases.jsonl`), where the rules score **0.750** and *every one of the nine misses is an unlabelled, previously-unseen personal name*. The evaluator reports both, derives the `saturated` label from the measurement rather than a comment, and the README warns that 0.750 and the published 0.755 measure different things and must not be compared.
- **Two extensions this forced.** The probe now declares benign spans as well as identifier spans (a recall probe with nothing to preserve cannot notice a system that redacts everything) and is scored in the harness case shape; and the corpus generator excludes identifiers from *both* holdout files, discarding six colliding sentences in the last build.
- **Deferred to Phase 10:** folding the probe into Lokkhon axis C. The released `lokkhon_v0.1.json` is a versioned artifact and is not edited in place; the axis C saturation belongs in a v0.2 alongside the trained model's numbers.

### Phase 8 — Maya admission gate harness — DONE
- [x] `experiments/maya/`: deterministic gate runner scores first-sentence escalation sensitivity on all seven licensed-clinician-reviewed red flags plus 28 benign controls, with paired bootstrap CIs, verbosity controls, and a separate agency-preserving self-harm rubric.
- [x] Candidate provider/model identities are refused during orchestrator construction unless a passing, identity- and dataset-bound report is supplied. The three already-shipped live model identities are explicitly labelled incumbents rather than retroactively claimed as measured; changing one makes it a candidate. The deterministic mock is exempt.
- [x] Regression tests pin population integrity, first-sentence timing, self-harm agency, pass/fail thresholds, response/dataset integrity, derived-row validation, stale-evidence rejection, and incumbent/candidate boundaries.
- **Blocked-on-run, as planned:** LoRA training + corpus licence review and recorded provider generations are out of band. No Maya outcome is claimed; the harness and hard candidate gate ship.

### Phase 9 — Stewardship layer, thin slice (finalist-feasible) — DONE
- [x] `enums.py`: single-source `AdminTier` and `Permission` vocabularies.
- [x] `require_admin(perm=...)` returns a `ScopedAdminContext`. The migration backfills every existing admin as an explicit super-admin; later admin profiles without a role row fail closed. Function/facility/org roles require both permission and a matching direct-resource scope, while only explicit super-admins are unbounded.
- [x] Alembic + ORM: `admin_roles`, generic direct-resource `admin_scopes`, and durable `admin_action_audit` evidence, with deny-by-default RLS posture and indexes.
- [x] Patient, doctor, review, appointment, reschedule, and cancellation reads/writes enforce their direct resource scopes. Ban and soft-delete paths (including bulk) stage a 24-hour approval request and require a different administrator; generic patient replacement rejects moderation/status fields so it cannot bypass this workflow.
- [x] Time-boxed break-glass grants expand one exact resource scope for at most 60 minutes, are logged as `L4_break_glass`, and notify affected subjects. `/admin/governance/audit` is a canonical, paginated, read-only and scope-filtered privileged-action explorer, surfaced alongside appointment events in the admin UI.
- [x] Governance and security tests pin cross-scope list/mutation behavior, explicit super-admin behavior, fail-closed provisioning, patient-replacement protection, self-approval refusal, second-admin completion, and approval mismatch rejection; backend OpenAPI exposes both governance endpoints.
- **Deferred (post-competition, per the governance plan):** `organizations`, `doctor_organizations`, fuzzy backfill, DSAR queue, delegated grants, comprehensive audit rows for every non-destructive legacy admin mutation, and a combined patient-access/AI-interaction compliance explorer. These are correctly labelled "proposed" and stay that way.

### Phase 10 — Docs, claim map, evidence sync — DONE
- [x] Update `docs/BCOLBD/Whitepaper/claim-evidence-map.md`: every claim's status moves only when its evidence exists.
- [x] Update `docs/INDEX.md`, `docs/architecture/*` for the new modules.
- [x] Regenerate benchmark reports; `README.md` status table reflects reality.
- [x] Add the executable PHI-training, Maya-experiment, staging, canary, sign-off, and rollback runbook at `docs/BCOLBD/Plan/phase-7-10-operational-runbook.md`.
- [x] Review section in this file.

---

## Non-negotiables carried into every phase
- No new Python venvs. Activate `backend/venv` / `ai_service/venv`.
- Root-cause only, minimal blast radius, no bundled refactors.
- Assistive only: no diagnosis, no prescribing, no autonomous medical decision. Arohon L3 surfaces and offers; it never dispatches.
- No emojis in UI; lucide-react vector icons.
- camelCase frontend / snake_case backend, converted explicitly in the Server Action payload.
- New list endpoints use `app/core/pagination.py`.
- Every number published must be regenerable from a machine-readable output, never transcribed.

## Review
- Phase 7 ships a deterministic training/evaluation path and fail-closed union runtime, but no learned-model score: GPU training and licence review remain external prerequisites. The original 134-case PHI set is saturated at 1.000 rule recall; the independent novel-name probe is the discriminating baseline at 0.750 recall.
- Phase 8 ships the Maya recorded-response gate and blocks unmeasured candidate model identities. It does not claim a Maya pass until licensed training and provider generations produce a current, dataset-bound report.
- Phase 9 delivers the finalist-feasible thin slice: explicit fail-closed admin provisioning, scoped permissions across patient/doctor/review/appointment operations, two-person destructive actions, notifying bounded break-glass, and privileged-action audit exploration. Organization membership, fuzzy backfill, DSAR workflow, delegated grants, and a combined patient-access/AI-interaction compliance explorer remain proposed.
- Phase 10 synchronizes the claim map, architecture/API indexes, README status, and regenerated machine-readable safety, PHI, and Shimana reports. Lokkhon v0.2 remains withheld until learned PHI metrics exist rather than rewriting the released v0.1 artifact.
