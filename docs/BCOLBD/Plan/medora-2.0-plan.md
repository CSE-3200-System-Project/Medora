# Medora 2.0 — Comprehensive Plan
### Whitepaper source material + implementation roadmap
**Target:** BCOLBD 2026 AI Category · Whitepaper due 16 Aug 2026 · Final round ~2 Sept 2026

---

## 0. A naming correction to make before anything else

Your five Bengali names are strong and consistent with the existing **চড়ুই (Chorui)** assistant. Four are exactly right. One needs a fix:

| Name | Your gloss | Status |
|---|---|---|
| **সীমানা** (Shimana) | boundary / frontier | ✅ correct |
| **মায়া** (Maya) | illusion / false comfort | ✅ correct |
| **আরোহণ** (Arohon) | ascent / gradual climb | ✅ correct |
| **অক্ষর** (Akkhor) | character / letter | ✅ correct |
| **লক্ষণ** (Lokkhon) | "the uncrossable boundary" | ⚠️ **wrong gloss** |

**লক্ষণ** means *sign / symptom / characteristic* — it is the standard clinical Bangla word for "symptom." The protective boundary from the Ramayana is **লক্ষ্মণরেখা** (*Lokkhon-rekha*), from **লক্ষ্মণ** (Lakshmana). Different spellings, near-identical pronunciation.

**Do not change the name — change the explanation.** লক্ষণ is arguably *better* than what you intended, because it carries both meanings at once:

> **লক্ষণ (Lokkhon)** — in clinical Bangla, *the sign*: the symptom a system must not miss. It is also a homophone of লক্ষ্মণ, whose লক্ষ্মণরেখা is the line that must not be crossed. The benchmark is named for both: the signs the model must catch, and the line it must not cross.

That reads as deliberate and literate. The original gloss would read, to a Bengali-speaking judge, as a mistake — and this jury will contain Bengali speakers.

---

## 1. The thesis

> **Medora 2.0 is the reference implementation and conformance suite for consent-governed clinical AI in Bangladesh.**

Supporting sentence for the whitepaper abstract:

> By May 2027, every health application in Bangladesh must demonstrate compliance with the Personal Data Protection Ordinance 2025's explicit-consent and citizen-ownership requirements. There is currently no way to demonstrate it. Medora 2.0 supplies the four missing pieces: an open specification for consent-bounded AI autonomy (**আরোহণ**), a public clinical safety benchmark (**লক্ষণ**), the empirical characterisation of what consent costs in task utility (**সীমানা**), and the national drug identity layer everything else depends on (**অক্ষর**) — validated on a live bilingual deployment and accompanied by a named negative result (**মায়া**) showing why the obvious alternative fails.

Repeat this thesis, in compressed form, at the head of every major section. StudyGazelle won Gold on legibility; this is your legibility device.

---

## 2. The five artifacts

### 2.1 আরোহণ (Arohon) — the Graded Autonomy Specification

**What it is.** A five-tier specification for how much authority an AI component may exercise, where the tier is bounded by *risk class*, not by model confidence alone.

| Tier | Name | Authority | Human role | Error budget |
|---|---|---|---|---|
| **L0** | বিরতি (abstain) | No clinical claim | — | Coverage loss acceptable; unsupported-claim rate → 0 |
| **L1** | জ্ঞাপন (inform) | Retrieval-grounded, cited statements | Reads | Every claim traceable to a supplied record or অক্ষর entry |
| **L2** | প্রস্তাব (suggest) | Drafts, navigation, pre-filled fields | Confirms before effect | `authoritative_writeback=false`; FP tolerated |
| **L3** | সংকেত (escalate) | Urgent surfacing + one-tap human action | Acts | **Recall-first: FN ≈ 0, FP tolerated** |
| **L4** | ভঙ্গ (break-glass) | Notifies a pre-consented third party | Notified | Requires a prior, explicit, revocable grant — never inferred |

**The non-obvious part — ceilings by risk class.** This is what makes it a specification rather than a list:

| Risk class | Max tier | Rationale |
|---|---|---|
| Cardiac / stroke / anaphylaxis / obstetric emergency | **L3**, L4 only with prior grant | Missing it is fatal; but dispatch stays a human act |
| Suicidal ideation / self-harm | **L2–L3 support surfacing only. Never L4.** | Coercive intervention removes agency at the moment agency is protective, and suppresses future disclosure |
| Routine clinical query | L1–L2 | Drafts, never decisions |
| Out of scope / insufficient evidence | L0 | Abstention is the correct output |
| Administrative / navigation | L2 | Registry-bounded |

**Why it's a research contribution.** The 2024–2026 abstention literature answers *when should a model refuse*. Nobody has answered *when should a system that is built to refuse instead escalate* — and nobody has formalised that the answer differs in **direction** by risk class. Cardiac says "never abstain." Suicidal ideation says "never act alone." Same containment layer, opposite calibrations.

**Built vs new.** The tiers exist implicitly in v1 (deterministic red-flag rules at L3, `authoritative_writeback=false` at L2, consent grants at L4). New work is formalising them, adding the risk-class ceiling table, and instrumenting tier selection so it is observable in logs and testable in fixtures.

---

### 2.2 লক্ষণ (Lokkhon) — the Bangla Clinical Safety Benchmark

**What it is.** A public, clinician-adjudicated, versioned benchmark for bilingual clinical AI safety. Five axes:

| Axis | Measures | Primary metric | v1 baseline |
|---|---|---|---|
| **A. Red-flag escalation** | Does it catch emergencies? | Sensitivity / specificity | 7/7 recorded, **0 FN, 5 FP** (n=30 fixtures) |
| **B. Indirect prompt injection** | Can retrieved content hijack tool use? | Attack success rate | 10/10 injection cases redacted (100% P/R) |
| **C. PHI leakage** | Does identifiable data escape? | Span-level precision / recall | **94.7% P / 75.5% R** (n=134) |
| **D. Banglish robustness** | Does it survive romanised code-mixing? | Δ performance vs native script | 4/4 mixed_script (100%), but tiny n |
| **E. Calibrated abstention** | Does confidence track correctness? | Risk–coverage curve, AURC | Not yet measured |

**Axis D deserves emphasis.** Real users type `chest e pain hocche` and `ami ar bachte chai na` in Latin script. Keyword lists shatter on this. No Bangla clinical benchmark tests it. It is cheap to construct (transliterate existing fixtures) and it is the axis most likely to produce a striking result.

**Scale, honestly.** Target **150–500 clinician-adjudicated cases** at v0.1. State the number you can actually adjudicate and deliver exactly that. A small honestly-labelled benchmark beats a large hand-waved one, and this jury includes academics who know the difference.

> **The binding constraint is clinician hours, not compute.** Your clinician adjudicated 30 fixtures. Line up availability *this week*, before you commit to a number in the whitepaper.

**Built vs new.** The harness exists (metrics, bootstrap CIs, failure/exclusion accounting, runtime analysis, archived machine-readable outputs, mock-vs-live separation). New work is expanding case counts, adding axes D and E, and publishing it as a standalone versioned artifact with its own README and citation.

---

### 2.3 সীমানা (Shimana) — the Consent–Utility Frontier

**What it is.** The empirical curve relating consent restrictiveness to task utility and PHI leakage. Hold a fixed task set; vary the consent scope from maximally restrictive (local-only, all categories denied) to unrestricted (hosted model, full record); measure utility and leakage at each point.

**Why this is the single best thing in the plan.** It is a genuinely new empirical object. It converts your entire thesis from a normative claim — *consent is good* — into a quantitative one: **here is what consent costs, and here is the knee of the curve.** It produces one memorable figure. And you already own both halves of the apparatus: the consent engine that varies scope, and the span-level privacy harness that measures leakage.

**Protocol sketch.**
- **Configurations (x-axis):** L (local-only) → L+K (local + অক্ষর knowledge base) → L+K+R (+ redacted record subset) → L+K+R+H (+ hosted model under grant) → U (unrestricted baseline).
- **Utility (y-axis):** task completion on a fixed clinical task set — specialty navigation accuracy, summary groundedness, medicine-match precision.
- **Leakage (second axis / colour):** span-level PHI recall failures per 1,000 requests.
- **Report:** Pareto frontier, the knee, bootstrap CIs, and a shaded "PDPO-defensible region."

**The headline claim to aim for:** *"Configuration L+K+R recovers N% of unrestricted task utility at M% of the leakage."* If N is high and M is low, that is the whole paper in one sentence.

**Built vs new.** Both measurement halves exist. New work is the experimental matrix and the sweep.

---

### 2.4 মায়া (Maya) — Reassurance Drift

**What it is.** A named negative result: *supervised fine-tuning on teleconsultation corpora degrades emergency escalation sensitivity.*

**The mechanism — state it explicitly, because the mechanism is the contribution.** Web teleconsultation corpora (HealthCareMagic, ChatDoctor and their translations) are generated by patients who **self-selected as non-urgent** — nobody having a myocardial infarction posts to a forum and waits. The corpus therefore systematically encodes calm reassurance. Fine-tuning transfers that prior. The model becomes more fluent and less safe, and the failure is invisible on standard NLP metrics.

**The metric.** Δ escalation sensitivity (base − tuned) on clinician-adjudicated red-flag cases, with benign false-alarm rate as the control for verbosity confounds.

**Four fixes to your current notebook before you quote any number:**
1. **Run it on the clinician-reviewed fixtures**, not ad-hoc cases. The eval then inherits clinical validation and is directly comparable to Table 7 of the SoftwareX paper. Highest value, zero cost.
2. **Pull the suicidal case out of `RED_FLAG`.** Scoring it "correct" for containing অ্যাম্বুলেন্স / ৯৯৯ inverts the আরোহণ ceiling — coercive dispatch is the *failure* mode there. Score it on a separate rubric: non-judgmental acknowledgment, helpline surfaced, no method content, agency preserved.
3. **Raise benign controls from 5 to 25–30.** One flip currently moves false-alarm rate 20 points. Reuse your bootstrap CI tooling.
4. **Control for verbosity.** `escalates()` scans 400 chars for 13 keywords; a verbose base model scores high by hedging. Require escalation in the **first sentence** — which is what matters clinically anyway — and hand-review before quoting.

**Also verify before the Revenue section:** ChatDoctor / HealthCareMagic data carries research/non-commercial terms, and your repo is MIT with proposed commercial tiers. Check the Nascenia hackathon dataset terms too, including whether derived weights may be redistributed.

**Built vs new.** The notebook produces this result this week. New work is the four fixes and the write-up.

---

### 2.5 অক্ষর (Akkhor) — the Bangladesh Drug Identity Layer

**What it is.** The open, versioned, canonical drug identity standard for Bangladesh, with a public API.

| Artifact | Count |
|---|---|
| Consolidated source rows (5 reconciled datasets) | 71,795 |
| Canonical drugs (generic × strength × form) | 7,389 |
| Brand entries | 67,001 |
| Search-index terms (trigram, typo-tolerant) | 74,390 |
| Distinct generic names | 5,242 |
| Distinct brand names | 52,117 |

**Why it matters.** RxNorm does not cover Bangladesh. Every Bangladeshi health app, e-pharmacy, clinic system, and research group is independently building a worse version of this. You already built the good one, with a reproducible script, preserved source provenance, and normalisation across spelling, strength, dosage form, manufacturer, and duplicate brands.

**The reframe costs you nothing.** This is not a feature of your application. It is **missing national infrastructure that already exists in your repository.** Package it as a standard: versioned releases, public read API, documented schema, citation metadata, refresh cadence.

**Built vs new.** Entirely built. New work is packaging, API surface, and versioning policy — days, not weeks.

---

## 3. How the five compose

```
                       অক্ষর (Akkhor)
              canonical drug identity — the reference
                              │
                              ▼
   patient ──► CONSENT ENGINE ──► আরোহণ (Arohon) ──► tiered output
                  │  deny-by-default    tier selection
                  │  purpose/provider   bounded by risk class
                  │  scope/revocation
                  ▼
            local-first routing ──────────┐
            redaction + pseudonymisation  │
                              │           │
                              ▼           ▼
                     local models   hosted models (granted)
                              │           │
                              └─────┬─────┘
                                    ▼
                          human confirmation gate
                                    │
                                    ▼
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
          লক্ষণ (Lokkhon)                    সীমানা (Shimana)
       measures whether the                measures what the
       boundary held                       boundary cost
                   │                                 │
                   └──────────────┬──────────────────┘
                                  ▼
                            মায়া (Maya)
                measures what happens without the boundary
```

Read as a sentence: **অক্ষর** canonicalises it, **আরোহণ** governs it, **লক্ষণ** tests it, **সীমানা** prices it, **মায়া** justifies it.

---

## 4. Figure specification

Two-column layout, TNR 12pt, ≤10 pages. Budget **8 column-width figures + 1–2 full-width spanning**. StudyGazelle led with UI mockups; you should lead with **data and real screenshots**, because you have a live deployment and they did not.

| # | Figure | Width | Page | Rubric | Specification |
|---|---|---|---|---|---|
| **F1** | Problem funnel | col | 1 | Vision 30 | Vertical funnel: population → 79.3% OOP (highest in South Asia) → 54.4% on medicines → 6.1M pushed into poverty 2022 → the consent/safety gap. Data-led, not decorative. |
| **F2** | The Medora 2.0 constellation | **span** | 2 | Vision 30 | The five Bengali-named artifacts orbiting the consent engine, each labelled Bangla + English + one-line function. Colour-code **built** (solid) vs **proposed** (outlined). This is your identity figure. |
| **F3** | আরোহণ ladder | col | 4 | Arch 30 | Vertical ascent L0→L4 with tier name, authority, human role, error budget. Overlay the risk-class ceiling as a horizontal cap line — show cardiac reaching L3/L4 and suicidal ideation capped below L4. The asymmetry must be visible at a glance. |
| **F4** | System architecture | **span** | 5 | Arch 30 | Next.js PWA / FastAPI core / OCR microservice / PostgreSQL / provider-agnostic orchestrator. **Policy engine drawn as the visual chokepoint** — every arrow passes through it. Annotate "13 of 19 AI/ML components are deterministic." |
| **F5** | Consent grant + data flow | col | 5 | Arch 30 / Risks 20 | The grant object (subject, recipient, purpose, scopes, policy version, validity, revocation, audit) and the local-vs-cloud decision with the redaction gate. Show that local mode never silently escalates. |
| **F6** | **সীমানা frontier** | col | 6 | Arch 30 | **The money figure.** X: PHI leakage. Y: task utility. Five plotted configurations (L → U), Pareto curve, marked knee, bootstrap CI bands, shaded PDPO-defensible region. If one figure gets remembered, make it this one. |
| **F7** | লক্ষণ five-axis profile | col | 7 | Risks 20 | Radar or grouped bar across axes A–E, with v1 baselines plotted and targets marked. Annotate n per axis — showing small honest n is a credibility gain. |
| **F8** | মায়া drift | col | 7 | Risks 20 | Paired bars: base vs tuned, escalation sensitivity and benign false-alarm side by side. One-line caption stating the mechanism. |
| **F9** | Live deployment screenshots | col | 3 | Use Case 10 | Real captures from medorahealth.vercel.app: bilingual UI, per-recipient consent surface, patient-visible audit log, emergency takeover screen. **Credibility StudyGazelle could not show.** |
| **F10** | অক্ষর pipeline | col | 8 | Arch / Revenue | 5 sources → 71,795 rows → reconciliation → 3 tables → public API. Counts on the diagram. |

**Optional if space allows:** emergency escalation sequence diagram (999 one-tap path vs crisis-support path, showing the আরোহণ ceiling difference), and a tech-stack table in the StudyGazelle style.

**Caption discipline.** Every caption ends with a clause tying it to what it proves. *"Fig. 6: The consent–utility frontier. Configuration L+K+R recovers N% of unrestricted utility at M% of the leakage."*

---

## 5. Whitepaper mapping

10 pages, two columns, ~900–1,000 words/page at TNR 12pt.

| Pages | Section | Rubric | Artifacts | Figures |
|---|---|---|---|---|
| 1 | Title, abstract, problem | Vision 30 | thesis | F1 |
| 2 | Vision, objectives, regulatory frame | Vision 30 | all five introduced | F2 |
| 3 | Use case + existing solutions | Use Case 10 | vs OpenMRS/Bahmni/GNU Health + Praava/DocTime/Arogga/SHR | F9, Table 1 |
| 4 | আরোহণ specification | Arch 30 | Arohon | F3 |
| 5 | System architecture + consent | Arch 30 | consent engine | F4, F5 |
| 6 | সীমানা: method + expected result | Arch 30 | Shimana | F6 |
| 7 | লক্ষণ + মায়া: evaluation | Risks 20 | Lokkhon, Maya | F7, F8 |
| 8 | Risk register | Risks 20 | — | Table 3 (span) |
| 9 | অক্ষর + revenue and distribution | Revenue 10 | Akkhor | F10, Table 4 |
| 10 | Roadmap, deliverables, team, conclusion | all | built vs proposed | Table 5 |

**Appendices (uncapped):** 21-endpoint list, 19-component decomposition, লক্ষণ case-format spec, আরোহণ tier definitions in full, অক্ষর schema, extended cost model, additional screenshots, benchmark protocol.

---

## 6. Revenue reframe

The five artifacts change the business answer from "clinic SaaS" — crowded, unconvincing from a student team — to **compliance infrastructure with a regulatory clock.**

| Stream | Basis |
|---|---|
| **Conformance testing** | লক্ষণ as a service; certification badge |
| **অক্ষর API** | Free tier + paid volume tiers for e-pharmacy, clinic systems, research |
| **Enterprise on-premise** | Local-first build for hospitals; privacy premium |
| **Clinic B2B2C** | Per-seat + per-consultation |
| **Open core** | MIT repo drives adoption, donor/government procurement eligibility |

**The pitch is the timing.** PDPO 2025's compliance window closes ~May 2027. Every health app in Bangladesh will need to demonstrate consent-governed handling, and none can currently prove it. A team that *publishes the benchmark* is far more credible selling conformance than one selling a dashboard.

Keep TAM/SAM/SOM disciplined — anchor on the Statista digital-health projection (~US$849.3m by 2029) but present a conservative pilot-scale SOM. Include infrastructure cost per user at 1k / 10k / 100k with a "with caching + batch" column; the final round asks about resource estimation against budget constraints.

---

## 7. Implementation roadmap

### Phase 1 — Whitepaper (now → 16 Aug)
Writing, not building. In parallel, two cheap things that convert claims into numbers:
- Run the মায়া ablation with the four fixes. One real Δ figure is worth a page of prose.
- Capture the F9 screenshots from the live deployment.
- Confirm clinician availability before committing to a লক্ষণ case count.
- Email organisers re: the 10-page vs 20-page rule conflict. Build to 10 either way.

### Phase 2 — Finalist (17 Aug → 2 Sept)
Deliverables: technical documentation, code repository, inference model (40 pts), demo video ≤10 min (30 pts), live presentation + Q&A.

| Priority | Work | Effort |
|---|---|---|
| P0 | অক্ষর public API + versioned release + docs | 2–3 days (packaging only) |
| P0 | আরোহণ L0–L2 fully instrumented; L3–L4 specified with fixtures | 4–5 days |
| P0 | Merged sub-3B fp16 model + manifest as the "deployment-ready inference model" | already produced by the notebook |
| P1 | লক্ষণ v0.1 at your honest case count, axes A–C solid, D–E partial | clinician-bound |
| P1 | সীমানা sweep on 2–3 endpoints | 3–4 days |
| P1 | মায়া written up with CIs and hand-reviewed generations | 2 days |
| P2 | Emergency one-tap escalation UI (never autodial — PWAs cannot, and should not) | 3 days |
| P2 | Crisis-support path with time-aware helpline registry | 2 days |

**Demo video plan.** The single most compelling 30 seconds available to you: a bilingual emergency escalation, showing detection → আরোহণ tier selection → one-tap takeover — immediately followed by the same system *declining* to auto-act on a crisis disclosure. That contrast **is** the thesis, on film. Use a mock number; never dial 999 in a demo.

### Phase 3 — Post-competition
লক্ষণ to 1,000+ adjudicated cases; সীমানা across all 21 endpoints; অক্ষর refresh cadence and FHIR mapping; PHI recall from 75.5% toward the >90% regime via ensemble; clinical validation pathway.

---

## 8. Risk register (whitepaper Table 3)

| # | Risk | L | I | Mitigation | Residual |
|---|---|---|---|---|---|
| 1 | Wrong clinical advice | M | H | Deterministic red-flags pre-empt model; আরোহণ ceilings; drafts only; no diagnosis claim | L–M |
| 2 | PHI breach | M | H | Deny-by-default grants; bilingual redaction; anonymous grants revoked + RLS on, verified by negative tests | L |
| 3 | PDPO non-compliance | M | H | Grant object records purpose/scope/version/revocation; patient-visible audit log | L |
| 4 | Indirect prompt injection | M | H | Schema-constrained typed outputs; policy engine as out-of-band monitor; লক্ষণ axis B | M |
| 5 | Hallucination | H | H | অক্ষর grounding; 13/19 deterministic; L0 abstention; human confirmation | M |
| 6 | **Reassurance drift (মায়া)** | **H** | **H** | Named, measured, and architecturally contained — fine-tuned model never sets escalation tier | L |
| 7 | OCR failure | H | M | Non-authoritative writeback + mandatory human confirmation | L (harm-gated) |
| 8 | Provider outage | M | M | Provider-agnostic orchestrator + local faster-whisper + mock | L |
| 9 | Helpline infrastructure failure | **H** | H | Configurable health-checked registry; time-aware fallbacks (KPR runs 3PM–3AM, not 24/7); no single hard-coded dependency | M |
| 10 | Token cost blowout | M | M | Determinism-first; cheap-model routing; caching/batch | L |
| 11 | Clinician adoption | H | H | Human-in-the-loop drafts; audit transparency; bilingual UX | M |
| 12 | Banglish failure | H | M | লক্ষণ axis D; transliteration-aware encoders | M |
| 13 | Dataset licensing conflict | M | H | Verify ChatDoctor/HealthCareMagic and hackathon terms against MIT + commercial tiers | **open — resolve before submission** |
| 14 | Clinician-hour shortfall | H | M | Commit only to the adjudicated count you can deliver; report n honestly | L |

Risk 9 is worth a sentence of its own in the text: Shastho Batayon 16263 has been reported in severe financial distress with unanswered calls and halved staffing. National telehealth infrastructure is fragile — which is precisely the argument for a resilient client-side layer that degrades gracefully.

---

## 9. What to say, and what not to

**Say:**
- "13 of 19 AI/ML components are deterministic." Safety *and* scalability in one number.
- "0 false negatives, 5 false positives on clinician-reviewed emergency fixtures." Proves you already tuned the correct failure direction.
- "We withdrew the prescription OCR accuracy claim because our own harness showed the pipeline was not clinically usable. What we contribute is the harness — and a design where an imperfect model cannot cause harm."
- "We fine-tuned a Bangla medical model and measured what it cost us in emergency sensitivity."

**Do not say:**
- That Medora diagnoses. It navigates.
- Any OCR accuracy number.
- That the AI provides counselling. It is a bridge to human help, never the destination.
- That FHIR mapping exists. It is future work.
- That you will deliver all five artifacts at full scale by 2 September. Scope honestly; over-promising is what gets teams dismantled in Q&A.

---

## 10. Open items before submission

1. **Page limit conflict** — AI guideline says 10 pages / TNR 12; 2026 general rules say 20 pages / size 11. Build to 10/TNR-12 (compliant under both) and email info@bcolbd.org.
2. **Dataset licensing** — ChatDoctor/HealthCareMagic terms vs MIT + commercial tiers.
3. **Clinician hours** — confirm before committing to a লক্ষণ case count.
4. **SoftwareX disclosure** — one line: "the underlying software is described in a manuscript under review at SoftwareX." Rewrite for the rubric; do not paste the manuscript.
5. **Team roles** — pre-assign, in case the per-member introduction rule applies at finals.
