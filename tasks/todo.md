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

### Phase 5 — Lokkhon as a versioned benchmark package
- [ ] `benchmark/lokkhon/`: case JSON schema, runner entry point wrapping the existing harness (no re-implementation), bootstrap CI reporter, `RELEASE.md`, `CITATION.cff`, `v0.1` tag of results.
- [ ] Axis D expansion: transliterate existing Bengali fixtures to romanised form via a scripted, reviewable generator (raises n from 4).
- [ ] Axis E: calibrated abstention — risk–coverage curve over the summary/navigation fixtures, emitted machine-readable.
- [ ] Emit `lokkhon_v0.1.json` with n printed beside every metric.
- **Touches:** new top-level `benchmark/` tree; `tests/benchmarks/` scripts imported, not moved.

### Phase 6 — Shimana reporter and frontier output
- [ ] Reporter emitting paired results, bootstrap CIs, non-dominated set, knee estimate (whitepaper §Shimana names all four).
- [ ] Regenerate `shimana_results.json` and a figure-ready CSV that reproduces the paper's frontier.
- **Touches:** 1 new reporter script under `tests/benchmarks/`.

### Phase 7 — Learned PHI span recogniser (build + gate; training is a separate run)
- [ ] `tools/phi_ner/generate_corpus.py`: 8k–15k BIO-tagged Bengali/English/romanised sentences, 10 tags, hard negatives (Akkhor drug names must NOT redact), varied PHI density, char offsets, JSONL.
- [ ] `tools/phi_ner/train.py`: MuRIL + XLM-R token classification, 3 seeds, recall-first threshold. BanglaBERT research-comparator only (non-commercial licence — must not enter the deployment path).
- [ ] `tools/phi_ner/evaluate.py`: rules / model / union on the untouched 134-case holdout; span P/R/F1, over-redaction, CPU latency, bootstrap CIs.
- [ ] `backend/app/core/ai_privacy.py`: union ensemble behind `PHI_NER_ENABLED` feature flag + ONNX CPU inference inside the trust boundary; flag default off.
- [ ] Regression fixtures so the redactor cannot silently degrade.
- **Blocked-on-run:** actual training needs a GPU session and licence review. Code, corpus, and gate ship; the weights are a follow-up run. Stated explicitly, not hidden.

### Phase 8 — Maya admission gate harness
- [ ] `experiments/maya/`: gate runner scoring first-sentence escalation sensitivity on the clinician-reviewed red-flag set + 25–30 benign controls, separate agency-preserving rubric for self-harm cases, bootstrap CIs.
- [ ] Gate is a hard admission check any candidate generative model must pass before `AI_PROVIDER` may point at it.
- **Blocked-on-run:** LoRA training + corpus licence review are out of band. Harness + protocol ship.

### Phase 9 — Stewardship layer, thin slice (finalist-feasible)
- [ ] `enums.py`: `AdminTier`, `Permission`.
- [ ] `require_admin(perm=...)` scope-injecting dependency returning `ScopedAdminContext`; super-admin unbounded so today's ~50 endpoints behave identically.
- [ ] Alembic: `admin_roles`, `admin_scopes`, `admin_action_audit`.
- [ ] Two-person rule on destructive actions (ban / delete); break-glass elevation logged as Arohon L4.
- [ ] Admin audit explorer (read-only, scoped) + negative tests asserting cross-scope denial.
- **Deferred (post-competition, per the governance plan):** `organizations`, `doctor_organizations`, fuzzy backfill, DSAR queue. These are correctly labelled "proposed" in the paper and stay that way.

### Phase 10 — Docs, claim map, evidence sync
- [ ] Update `docs/BCOLBD/Whitepaper/claim-evidence-map.md`: every claim's status moves only when its evidence exists.
- [ ] Update `docs/INDEX.md`, `docs/architecture/*` for the new modules.
- [ ] Regenerate benchmark reports; `README.md` status table reflects reality.
- [ ] Review section in this file.

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
_(filled in as phases complete)_
