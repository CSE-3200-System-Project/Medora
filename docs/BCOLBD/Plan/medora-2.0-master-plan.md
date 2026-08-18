# Medora 2.0 — Master Plan v2
### Whitepaper production guide + parallel implementation track
**BCOLBD 2026 AI Category** · Whitepaper due 16 Aug 2026 · Final round ~2 Sept 2026
**Format (settled):** 10 pages max excluding appendices · Times New Roman 12pt · single spacing · English

---

# PART A — Answering your question: where did v1 go?

**It didn't go anywhere. It is roughly 70 of the 100 rubric points.**

The five Bengali-named artifacts are a *narrative frame*, not a replacement. v1 is the *evidence*. Every one of the five is built on something already shipped and measured. Here is the honest accounting:

| Rubric criterion | Pts | Share carried by **v1 (shipped)** | Share carried by **2.0 (new)** |
|---|---|---|---|
| Vision & Problem Statement | 30 | ~50% — the problem, the live deployment, the bilingual reality | ~50% — the containment thesis, the regulatory frame |
| Use Case & Existing Solutions | 10 | **~100%** — comparison vs OpenMRS/Bahmni/GNU Health, live URL | — |
| Risks & Challenges | 20 | **~85%** — consent engine, redaction, RLS hardening, withdrawn OCR claim | ~15% — মায়া, লক্ষণ axes D/E |
| Architecture & Infrastructure | 30 | **~85%** — the entire stack, 21 endpoints, 19 components, reliability layer | ~15% — আরোহণ formalisation |
| Revenue & Distribution | 10 | ~40% — অক্ষর already exists | ~60% — the compliance-infrastructure model |

**So: ~70% of your score is already earned work.** The 2.0 layer exists to solve exactly one problem — that a judge reading v1 cold sees "healthcare platform with OCR" instead of "AI research contribution." The five names make the existing work *legible*. They do not replace it.

## A.1 The v1 asset inventory — every number you own

Print this. Every claim in the whitepaper should trace to a row here.

**Scale and surface**
| Asset | Value |
|---|---|
| User-facing AI endpoints | 21 (9 groups) |
| AI/ML components | 19 — **13 deterministic, 6 inference** |
| Chorui canonical intents | 23, via 24 registry entries (11 patient / 11 clinician / 2 shared) |
| Live deployment | medorahealth.vercel.app (Vercel + Azure Container Apps) |
| Licence / citation | MIT, CITATION.cff, reproducibility docs, benchmark protocols, release gates |

**অক্ষর — the drug identity layer**
| Artifact | Count |
|---|---|
| Consolidated source rows (5 datasets) | 71,795 |
| Canonical drugs (generic × strength × form) | 7,389 |
| Brand entries | 67,001 |
| Search-index terms (trigram) | 74,390 |
| Distinct generic names | 5,242 |
| Distinct brand names | 52,117 |

**লক্ষণ — measured baselines**
| Axis | Result | n |
|---|---|---|
| A. Red-flag escalation | **0 false negatives, 5 false positives**; 7/7 emergency recorded | 30 fixtures, clinician-reviewed |
| B. Injection resistance | 100% precision / 100% recall | 10 cases |
| C. PHI leakage | **94.7% P / 75.5% R**, 3.2% false redaction | 134 cases |
| D. Mixed script | 100% P / R | 4 cases (too small — expand) |
| E. Calibrated abstention | not yet measured | — |
| Summary groundedness | 12 fixtures, all accounted | 12 |

**Architecture components to name explicitly**
Consent guard · bilingual redactor · patient pseudonymiser · processing-consent service · Chorui intent normalizer · route registry · navigation engine · specialty matcher · medical knowledge base · emergency red-flag rules · faster-whisper (local) · Vapi (external) · dosage matcher · medicine fuzzy matcher · YOLO region detector · PaddleOCR (local) · Azure Document Intelligence (external) · report/prescription parsers · AI orchestrator (Groq / Gemini / Cerebras / mock).

**Reliability and hardening**
Idempotency-Key · row + advisory locks · active-slot uniqueness constraint · appointment + audit + replay + outbox committed together · post-commit event publication · PostgreSQL authoritative · reconnection recovery · anonymous DB grants revoked · row-level security enabled · trigger-maintained change feed · negative tests verifying all of it.

**Honest non-claims (state these — they earn credibility)**
No diagnosis; specialty search is navigation · OCR accuracy claim withdrawn · not clinically validated, not a medical device · FHIR mapping is future work · prescription images excluded from public release for consent/ethics reasons.

## A.2 How each artifact maps onto v1

| Artifact | Built in v1 | New in 2.0 |
|---|---|---|
| **আরোহণ** | Red-flag rules (L3), `authoritative_writeback=false` (L2), consent grants (L4), route registry | Formal tier spec, risk-class ceilings, tier selection instrumented and testable |
| **লক্ষণ** | Harness, bootstrap CIs, failure/exclusion accounting, mock-vs-live separation, clinician adjudication of 30 fixtures | Expanded n, axes D and E, published as standalone versioned benchmark |
| **সীমানা** | Consent engine varies scope; privacy harness measures leakage | The experimental sweep connecting them |
| **মায়া** | — | The ablation (notebook exists) |
| **অক্ষর** | Entirely built | Packaging: public API, versioning, schema docs |

---

# PART B — Document specification

## B.1 Two-column setup

The rules constrain page count, font, size, spacing, language. They are **silent on column count**, and the 2024 Gold winner used two columns.

**Keep body text at TNR 12pt.** Do not drop to 10pt for typographic comfort — font size is explicitly specified and format compliance is the one pass/fail gate.

- **Word:** Layout → Columns → Two. Margins 0.75". Gutter 0.3". Column width ≈ 3.25".
- **LaTeX:** `\documentclass[12pt,twocolumn,a4paper]{article}` + `\usepackage{times}` (or `newtxtext`) + `\usepackage{geometry}`. Do **not** start from IEEEtran — it defaults to 10pt and you'll fight it.
- Figures: `figure` (column width) by default; `figure*` for the two spanning figures.
- Tables that must span: `table*`.

## B.2 The real word budget — read this before drafting

At TNR 12pt in a 3.25" column you get ~8 words per line, ~46 lines per column, ~92 lines per page → **~735 words/page of pure text.** With figures and tables occupying ~35% of the area:

> **Total body text: ~4,800–5,200 words across 10 pages.**

That is *tight*. It is roughly a 5,000-word paper with 10 figures. Every sentence must earn its place. Draft to budget, not to completion, or you will spend 15 August cutting instead of polishing.

**Per-section word budget:**

| Section | Pages | Words | Rubric |
|---|---|---|---|
| 1. Abstract + problem | 1 | 480 | Vision 30 |
| 2. Vision & objectives | 1 | 520 | Vision 30 |
| 3. Use case & existing solutions | 1 | 400 (+table) | Use Case 10 |
| 4. আরোহণ specification | 1 | 500 | Arch 30 |
| 5. Architecture & infrastructure | 1 | 520 | Arch 30 |
| 6. সীমানা method | 1 | 480 | Arch 30 |
| 7. লক্ষণ + মায়া | 1 | 500 | Risks 20 |
| 8. Risk register | 1 | 250 (+table) | Risks 20 |
| 9. অক্ষর + revenue | 1 | 450 (+tables) | Revenue 10 |
| 10. Roadmap, team, conclusion | 1 | 420 | all |

---

# PART C — Section-by-section writing guide

For each section: **purpose · evidence to cite · figure · draft opening · traps.**

---

### §1 — Abstract and problem statement (p.1, 480 words)

**Purpose.** Land the thesis and the quantified problem within 30 seconds of reading.

**Draft opening:**
> Health spending in Bangladesh is 79.3% out-of-pocket — the highest in South Asia — with 54.4% of that going to medicines, and out-of-pocket costs pushed an estimated 6.1 million people into poverty in 2022. Large language models could narrow the guidance gap, but two constraints now bind: the Personal Data Protection Ordinance 2025 establishes citizens as owners of their personal data and requires explicit consent before collection, storage, transfer, or use; and WHO's 2024 guidance on large multi-modal models warns specifically against consumer-facing deployment in under-resourced settings without governance. The unsolved problem is therefore not *can a model answer a clinical question in Bangla* — it is **what infrastructure permits a general-purpose model to be used on patient data at all.**
>
> Medora 2.0 answers that with five artifacts, built on a system already deployed at medorahealth.vercel.app and described in a manuscript under review at SoftwareX.

**Evidence:** OOP 79.3% / medicines 54.4% / 6.1M poverty / PDPO 2025 / WHO LMM 2024.
**Figure:** F1 problem funnel.
**Traps:** Do not open "Medora is a healthcare platform." Do not list features. Do not use the word "innovative" — demonstrate it instead.

---

### §2 — Vision, scope, objectives (p.2, 520 words)

**Purpose.** Introduce all five artifacts and state what the project will produce.

**Structure:** thesis restated (60w) → the five artifacts, ~70w each (350w) → scope boundary and objectives (110w).

**Naming block to include verbatim:**
> **লক্ষণ (Lokkhon)** — in clinical Bangla, *the sign*: the symptom a system must not miss. It is also a homophone of লক্ষ্মণ, whose লক্ষ্মণরেখা is the line that must not be crossed. The benchmark is named for both.

Then: **সীমানা** the frontier · **মায়া** the comforting illusion · **আরোহণ** the deliberate ascent · **অক্ষর** the canonical identity.

**Figure:** F2 constellation — solid outlines for built, dashed for proposed.
**Trap:** Do not let the Bangla naming read as decoration. Each gloss must state the technical function in the same sentence.

---

### §3 — Use case and existing solutions (p.3, 400 words + table)

**Purpose.** 10 points, cheaply won, and the easiest place to look thorough.

**Table 1 axes:** consent granularity · local-first inference · bilingual redaction · abstention · published evaluation · Bangladesh medicine coverage · live deployment.
**Rows:** OpenMRS · Bahmni · GNU Health · Praava · DocTime · Arogga · national SHR/OpenMRS+ · **Medora**.

**Draft claim:**
> The national Shared Health Record deployment is a record store, not a governance layer; Bangladeshi commercial platforms are cloud-first consultation and e-pharmacy services. None combine purpose- and provider-specific consent grants, local-first routing that never silently escalates, and published safety evaluation.

**Figure:** F9 live screenshots — bilingual UI, per-recipient consent surface, patient-visible audit log, emergency takeover.
**Trap:** Don't just list competitors. Show the empty matrix cell only you fill.

---

### §4 — আরোহণ specification (p.4, 500 words)

**Purpose.** The architectural contribution. This is where you stop looking like an app.

**Content:** the L0–L4 table (tier · authority · human role · error budget), then the risk-class ceiling table, then two worked traces.

**The paragraph that carries the section:**
> Existing work on selective prediction asks when a model should refuse. আরোহণ asks the harder question: when should a system built to refuse instead escalate — and it answers that the direction differs by risk class. A cardiac presentation must never abstain; a disclosure of suicidal ideation must never act autonomously. In v1 this asymmetry was already measurable: emergency fixtures recorded zero false negatives against five false positives, a ratio that is correct clinically and would be unacceptable for any autonomous action. আরোহণ formalises that intuition as a specification with per-tier error budgets.

**Worked trace 1 (cardiac):** detect → risk class *cardiac* → ceiling L3 → full-screen bilingual takeover, one-tap 999, 10s cancellable countdown, dismissal logged as a false positive into লক্ষণ.
**Worked trace 2 (crisis):** detect → risk class *self-harm* → **ceiling L3, L4 permanently prohibited** → clinician-authored template, time-aware helpline registry, no method content, no autonomous notification. Notification only if a prior revocable grant exists.

**Figure:** F3 — the ascent with the ceiling cap line drawn across it. The asymmetry must be visible without reading.
**Traps:** No autodial (PWAs cannot, and shouldn't). Never describe the AI as providing counselling — it is a bridge, not a destination.

---

### §5 — Architecture and infrastructure (p.5, 520 words)

**Purpose.** 30 points. Your strongest existing material — this section is ~85% v1.

**Content:** the stack (Next.js PWA / FastAPI core / FastAPI OCR service / PostgreSQL) · provider-agnostic orchestrator with sanitisation, correlation IDs, schema validation · consent-guard → redactor → pseudonymiser chain · local vs external boundaries · reliability layer · release hardening · scale and cost.

**The sentence that does double duty:**
> Thirteen of nineteen AI/ML components are deterministic. This is simultaneously a safety property — most safety-critical logic is inspectable and testable rather than sampled — and a scalability property, since the majority of the request path costs no inference tokens at all.

**Also state:** appointment creation commits appointment, audit entry, replay result, and outbox event in one transaction with idempotency keys, row and advisory locks, and an active-slot uniqueness constraint; events publish post-commit with PostgreSQL authoritative. And: a pre-release audit found anonymous database grants with row-level security disabled; the release revokes them, enables RLS, restricts subscriptions to a trigger-maintained change feed, and verifies all three with negative tests.

That last item is unusually strong — it shows you audit yourself and test the *absence* of access. Very few student submissions can say it.

**Figures:** F4 architecture (spanning, policy engine as chokepoint) + F5 consent grant / data flow.
**Trap:** Don't draw a microservice box diagram. Draw the *control flow*, with every arrow passing through the policy engine.

---

### §6 — সীমানা method and expected result (p.6, 480 words)

**Purpose.** The novel empirical object. Your cover figure lives here.

**Content:** research question · five configurations · utility metrics · leakage metric · expected shape.

> **RQ:** What does consent cost? For a fixed clinical task set, how does task utility trade against measured PHI leakage as consent scope varies from local-only to unrestricted?
>
> **Configurations:** L (local only) → L+K (+ অক্ষর knowledge base) → L+K+R (+ redacted record subset) → L+K+R+H (+ hosted model under grant) → U (unrestricted, no consent enforcement).
>
> **Utility:** specialty-navigation accuracy, summary groundedness, medicine-match precision — all three already instrumented in v1.
> **Leakage:** span-level PHI recall failures per 1,000 requests, using the existing 134-case harness (94.7% P / 75.5% R baseline).

**Target headline:** *"Configuration L+K+R recovers N% of unrestricted task utility at M% of the leakage."*

**Figure:** F6 — the frontier. X leakage, Y utility, five points, Pareto curve, marked knee, bootstrap CI bands, shaded PDPO-defensible region.
**Trap:** If the sweep isn't complete by 16 Aug, present it as protocol + expected shape with the axes and configurations fully specified, and label the figure "illustrative — measurement in progress." Judges accept declared protocol; they do not accept invented data points.

---

### §7 — লক্ষণ and মায়া (p.7, 500 words)

**Purpose.** Evaluation credibility, and the negative result that justifies everything.

**লক্ষণ (280w):** five axes with v1 baselines and n for each. Then the honesty paragraph:
> We publish n alongside every metric. Axis D currently rests on four cases and axis E is unmeasured; both are stated as limitations rather than omitted. Prescription OCR accuracy is withdrawn entirely as a claim, because our own harness showed the handwriting pipeline was not clinically usable. What we contribute is the harness — and an architecture in which an imperfect extractor cannot cause harm, since every OCR row is marked non-authoritative and gated behind mandatory human confirmation.

**মায়া (220w):** mechanism first, then result.
> Web teleconsultation corpora are generated by patients who self-selected as non-urgent — nobody experiencing a myocardial infarction posts to a forum and waits. Such corpora systematically encode calm reassurance, and supervised fine-tuning transfers that prior. We fine-tuned TigerLLM-1B on a Bangla medical dialogue corpus and measured the change in emergency escalation sensitivity against clinician-adjudicated red-flag fixtures, with benign controls for verbosity. [Result.] The model became more fluent and less safe — a failure invisible to standard NLP metrics, and the direct empirical case for an escalation layer external to the model.

**Figures:** F7 five-axis profile with n annotated · F8 paired base-vs-tuned bars.
**Trap:** Do not quote a মায়া number until you have run it on the clinician fixtures with expanded benign controls and hand-reviewed the generations.

---

### §8 — Risk register (p.8, 250 words + spanning table)

**Purpose.** 20 points that most teams leave on the table by writing three paragraphs.

**Lead sentence:**
> We treat risk as an engineering artifact. Of the fourteen risks below, eleven have mitigations already shipped and verified by automated tests; the remaining three are the explicit subject of the 2.0 research plan.

Use the 14-row table from the previous plan. Give risk 9 (helpline infrastructure fragility — Shastho Batayon 16263's reported financial distress and unanswered calls) its own sentence, because it argues for a resilient client-side layer rather than against you.

**Trap:** Do not soften residual risk to look good. A register where everything is "Low" reads as unserious.

---

### §9 — অক্ষর and revenue (p.9, 450 words + tables)

**অক্ষর (200w):** RxNorm does not cover Bangladesh. Present the six counts. Frame it as national infrastructure you already built and are now releasing as a versioned standard with a public API.

**Revenue (250w):** the compliance-infrastructure model — conformance testing (লক্ষণ as a service), অক্ষর API tiers, enterprise on-premise, clinic B2B2C, open core underneath.

**The pitch is the clock:**
> The Personal Data Protection Ordinance's compliance window closes in 2027. Every health application, clinic chain, and e-pharmacy in Bangladesh will need to demonstrate consent-governed data handling, and none currently can. Demand for conformance infrastructure is created by regulation, not by marketing.

**Table 4:** infrastructure cost per user at 1k / 10k / 100k, with a "with caching + batch" column. Ground in real per-unit rates (Azure Container Apps free tier: 180k vCPU-s, 360k GiB-s, 2M requests/month; Groq from ~$0.05/M input tokens; Gemini Flash ~$0.10–0.50/M). Note that determinism keeps marginal AI cost low.

**Figure:** F10 অক্ষর pipeline.
**Trap:** Keep SOM conservative. Discipline scores better than a large TAM.

---

### §10 — Roadmap, deliverables, team, conclusion (p.10, 420 words)

**Content:** Table 5 (built vs proposed, explicit) · final-round deliverable commitments · per-member roles · one-paragraph close restating the thesis.

**Closing paragraph:**
> Medora 2.0 does not propose a better clinical model. It proposes the infrastructure that determines whether any clinical model may be used at all — a specification for graded autonomy, a benchmark that tests whether the boundary held, a frontier that prices what the boundary cost, a drug identity layer that grounds it, and a negative result explaining why the alternative fails. Four of the five rest on a system that is already deployed, already tested, and already honest about what it cannot yet do.

---

# PART D — Figure production specs

Produce as SVG or PDF vector. Consistent palette, consistent 9–10pt sans-serif labels. Bangla names appear in Bengali script with English gloss beneath.

| # | Figure | Width | Page | Production notes |
|---|---|---|---|---|
| F1 | Problem funnel | col | 1 | Four descending bands with the numbers *in* the bands. Data-led. |
| F2 | Medora 2.0 constellation | **span** | 2 | Five artifacts around the consent engine. **Solid = built, dashed = proposed.** Identity figure. |
| F3 | আরোহণ ascent | col | 4 | L0→L4 rising. Horizontal ceiling lines per risk class crossing the ascent. Cardiac reaches L3/L4; self-harm capped below L4. |
| F4 | System architecture | **span** | 5 | Every arrow through the policy engine. Annotate "13/19 deterministic". Mark the Medora trust boundary and the three external recipients. |
| F5 | Consent grant + flow | col | 5 | The grant object fields + local/cloud decision + redaction gate. |
| F6 | **সীমানা frontier** | col | 6 | X leakage, Y utility, 5 points, Pareto curve, knee marked, CI bands, shaded defensible region. **The cover figure.** |
| F7 | লক্ষণ profile | col | 7 | Radar or grouped bars, axes A–E, **n annotated on each axis**. |
| F8 | মায়া drift | col | 7 | Paired bars base vs tuned: escalation sensitivity + benign false alarm. |
| F9 | Live screenshots | col | 3 | Four real captures. Your credibility advantage. |
| F10 | অক্ষর pipeline | col | 9 | 5 sources → 71,795 rows → 3 tables → API. Counts on the diagram. |

**Tables:** T1 comparison matrix (§3) · T2 আরোহণ tiers + ceilings (§4) · T3 risk register, spanning (§8) · T4 cost model (§9) · T5 built vs proposed (§10).

**Caption rule:** every caption ends with the claim it supports. *"Fig. 6: Configuration L+K+R recovers N% of unrestricted utility at M% of the leakage."*

---

# PART E — Parallel implementation track

Two people on the whitepaper, the rest on code, from today.

## E.1 Now → 16 Aug (runs *alongside* writing)

| Owner | Task | Why it's urgent |
|---|---|---|
| Eng | Capture F9 screenshots from live deployment | Blocks §3 |
| ML | Run মায়া with the four fixes (clinician fixtures, suicidal case separated, 25–30 benign controls, first-sentence escalation rule) | A real Δ number turns §7 from proposal into result |
| Lead | Confirm clinician availability + case count | Blocks the লক্ষণ number you commit to in §7 |
| Business | Verify ChatDoctor/HealthCareMagic + hackathon dataset licence terms | Blocks §9 |
| Eng | Freeze v1 counts from archived machine-readable outputs | Every number must be regenerable, not transcribed |

## E.2 17 Aug → 2 Sept — finalist sprints

Final round scoring: technical documentation + repo + inference model **40** · demo video **30** · presentation + Q&A **20+**.

**Sprint 1 (17–22 Aug) — make the artifacts real**

| P | Work | Detail |
|---|---|---|
| P0 | **অক্ষর public API** | `/v1/drugs`, `/v1/brands`, `/v1/search`, `/v1/resolve`. Versioned release `akkhor-2026.08`. Schema docs, provenance fields, rate limits. Packaging only — the data exists. |
| P0 | **আরোহণ instrumentation** | `AutonomyTier` enum L0–L4; `RiskClass` enum; ceiling table as config; every AI endpoint declares its tier; tier logged with correlation ID; fixtures assert tier selection. |
| P0 | **Inference artifact** | Merged sub-3B fp16 + `manifest.json` + adapter + eval CSV, runnable from the repo, plus deterministic mock mode so judges can run offline. |
| P1 | লক্ষণ repo skeleton | `/benchmark` with case schema, runner, bootstrap CI reporter, versioned release, README + citation. |

**Sprint 2 (23–28 Aug) — measure**

| P | Work | Detail |
|---|---|---|
| P0 | **সীমানা sweep** | Config matrix L → U across 2–3 endpoints. Utility + leakage per config. Emit machine-readable results that regenerate F6. |
| P0 | **লক্ষণ v0.1** | Adjudicated cases at your honest count. Axes A–C solid; D expanded by transliterating existing fixtures; E via risk–coverage curve. |
| P1 | **আরোহণ L3 UI** | Full-screen bilingual takeover, one-tap 999, 10s cancellable countdown, location to clipboard, dismissal logged as FP into লক্ষণ. **Never autodial.** |
| P1 | **Crisis path** | Clinician-authored templates, time-aware helpline registry with health checks and fallbacks (KPR 09612-119911 runs 3PM–3AM, not 24/7), consent-gated notification only, no method content. |

**Sprint 3 (29 Aug – 2 Sept) — package**

| P | Work |
|---|---|
| P0 | Technical documentation: architecture, algorithms, preprocessing, training, validation |
| P0 | Repo hygiene: README, quickstart, reproducibility, CITATION.cff, licence audit |
| P0 | **Demo video ≤10 min** |
| P1 | Presentation deck + per-member role introductions + Q&A rehearsal |

## E.3 Demo video — the 30-point shot

The strongest 60 seconds available to you is a **contrast**:

1. Bangla input: *"বুকে ব্যথা, শ্বাস নিতে কষ্ট হচ্ছে"* → detection → risk class → **L3** → full-screen takeover, one-tap 999, countdown. Show the tier badge on screen.
2. Immediately after: *"আমি আর বাঁচতে চাই না"* → detection → risk class self-harm → **ceiling L3, L4 refused** → supportive template + helpline, and an explicit on-screen indication that the system **will not** act autonomously.

That contrast *is* the thesis, on film, in under a minute. Nobody else will have it.

Then: consent surface + audit log (30s) · অক্ষর API call (30s) · সীমানা figure walkthrough (60s) · মায়া result (45s) · architecture (60s) · live booking under concurrency (30s).

**Use a mock number. Never dial 999 in a demo.**

## E.4 Repo structure for the finalist submission

```
medora/
├── apps/            web (Next.js PWA) · api (FastAPI) · ocr (FastAPI)
├── packages/
│   ├── arohon/      tier + risk-class spec, ceiling config, selector
│   ├── akkhor/      build script, schema, public API, versioned release
│   └── consent/     grant model, guard, redactor, pseudonymiser
├── benchmark/
│   └── lokkhon/     cases/ runner/ reporters/ RELEASE.md
├── experiments/
│   ├── shimana/     config matrix, sweep, results/
│   └── maya/        SFT notebook, eval, results/
├── models/          merged fp16, adapter, manifest.json
└── docs/            architecture, reproducibility, CITATION.cff, LICENSE
```

Each of `arohon`, `akkhor`, `lokkhon` gets its own README and version. That is what makes a judge read "infrastructure" rather than "app."

---

# PART F — Schedule to 16 Aug

**14 Aug (today)**
- Lock title and thesis · set up the two-column template and verify TNR 12pt renders · draft §1 and §2 to word budget.
- Parallel: screenshots captured · মায়া run started · clinician contacted · licence check.

**15 Aug**
- Morning: §4 আরোহণ, §5 architecture (your strongest 60 points).
- Afternoon: §6 সীমানা, §7 লক্ষণ + মায়া.
- Evening: §8 risk table, §9 revenue + cost table, §3 comparison matrix.
- Parallel: F2, F3, F4, F5, F6 drafted.

**16 Aug**
- Morning: §10 + all captions + figure finalisation.
- Midday: cut to 10 pages. Cut prose, never figures.
- Afternoon: two independent reviewers score against the rubric; fix the lowest section.
- **Submit with ≥6 hours to spare.**

**Team split:** Lead → §1, §2, §4, §5, integration. Research → §6, §7, মায়া. Business → §3, §9, risk table. Eng → all figures, screenshots, number verification.

---

# PART G — Final compliance checklist

- [ ] ≤10 pages excluding appendices
- [ ] Times New Roman **12pt**, single line spacing, throughout including captions
- [ ] English only
- [ ] Two columns; spanning figures used only for F2 and F4 and the risk table
- [ ] Project name + team + members on the cover
- [ ] Every number traceable to an archived machine-readable output
- [ ] No OCR accuracy figure anywhere
- [ ] No claim that the system diagnoses
- [ ] No claim that the AI provides counselling
- [ ] FHIR stated as future work
- [ ] SoftwareX disclosure line present
- [ ] Built vs proposed unambiguous in Table 5
- [ ] Every figure caption ends with the claim it supports
- [ ] PDF exports with fonts embedded; ≤20 MB
