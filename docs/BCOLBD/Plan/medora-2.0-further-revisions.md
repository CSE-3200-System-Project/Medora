# Medora 2.0 — Consolidated Change List

Everything from the strategy conversation, organised as edits you can make rather than concepts to re-read.

**Whitepaper due 16 Aug · Final round ~2 Sept · 10 pages max, TNR 12pt, single spacing, English**

---

# PART 1 — Today's edit list (time-boxed, then freeze)

Only edits that are pure writing with bounded scope. Anything needing new data, new code, or another person is out of scope for today.

| # | Edit | Time | Why |
|---|---|---|---|
| 1 | **AI methods/data/status table** | 60 min | Clearest direct miss against the guideline; answers "where's the AI" |
| 2 | **Four-status matrix** + moderate the abstract | 45 min | Removes built-vs-proposed ambiguity |
| 3 | **Deployment-aligned cost table** | 60 min | Final round explicitly asks for resource estimation against budget |
| 4 | **Subscription revenue model** | 60 min | Turns a list of four streams into one strategy |
| 5 | **অক্ষর positioning** (open, not monetised) | 20 min | Consistency with SoftwareX + stronger argument |
| 6 | **মায়া as admission gate**, marked planned | 20 min | Keeps the strongest argument without an unbacked claim |
| 7 | PDF metadata, filename, team name | 15 min | Free points, easy to forget |
| 8 | Page-count + compile check **after each insertion** | ongoing | You are at 8 pages; these edits add 1.5–2 |

**Not today:** endpoint evaluations, doctor interviews, অক্ষর API implementation, আরোহণ enforcement, any মায়া training run.

---

# PART 2 — Content blocks

## 2.1 AI methods table (highest priority)

Columns: **Task · Model/algorithm · Data source · Trained vs inference-only · Status · Evaluation · Safety boundary**

Rows to include:

| Task | Model / algorithm | Data | Trained? | Status | Eval | Safety boundary |
|---|---|---|---|---|---|---|
| Speech to notes | faster-whisper (local) | clinician dictation | inference | deployed | contract + auth | editable draft only |
| Live voice | Vapi (external) | live audio under separate grant | inference | deployed | contract + auth | resolves through same registry |
| Prescription region detection | YOLO (trained) | prescription images | **trained** | deployed | prototype | `authoritative_writeback=false` |
| Local OCR | PaddleOCR | prescription regions | inference | deployed | prototype | human confirmation required |
| Cloud OCR | Azure Document Intelligence | under separate grant | inference | deployed | prototype | separate consent grant |
| Generation / orchestration | Groq · Gemini · Cerebras · deterministic mock | consented, redacted payloads | inference | deployed | mock + live reported separately | schema-validated, no writeback |
| Medicine matching | trigram + edit distance | অক্ষর (74,390 terms) | classical | deployed | fixture | catalog-bounded |
| Specialty matching | exact + synonym + fuzzy + similarity | knowledge base | classical | deployed | 30 fixtures | navigation, not diagnosis |
| Intent normalisation | deterministic bilingual normaliser | 23 canonical intents | classical | deployed | navigation fixtures | registry-bounded |
| Emergency red-flag | keyword screen, pre-empts model | clinician-reviewed fixtures | rules | **measured** | 0 FN / 5 FP, n=30 | runs before model call |
| PHI redaction | pattern + gazetteer | bilingual corpus | rules | **measured** | 94.7% P / 75.5% R, n=134 | egress gate |
| **PHI span recognition** | **BanglaBERT / MuRIL token classification** | **synthesized bilingual corpus** | **trained** | **planned** | **span P/R/F1 vs 75.5% baseline** | **union ensemble with rules** |
| **Escalation-sensitivity gate (মায়া)** | **TigerLLM-1B LoRA** | **Bangla medical dialogue** | **trained** | **planned** | **Δ sensitivity vs clinician fixtures** | **admission gate before deployment** |

**Do not write "13 of 19 components are deterministic" in the AI category.** It invites 6/19 = 32%. Use instead:

> Medora runs seven model families across three modalities — speech, vision, and text. Perception and generation are learned. **Authority is deterministic.**

## 2.2 Four-status scheme

Replace binary solid/dashed everywhere with:

| Status | Meaning |
|---|---|
| `deployed` | running in the live system |
| `measured` | deployed **and** has a reported metric with n |
| `specified` | design complete, not implemented |
| `planned` | protocol defined, not yet run |

Apply to F2 (constellation), the AI methods table, and a status column in Table 5.

**Abstract:** change "reference implementation and conformance plan" to:

> Medora 2.0 combines a deployed clinical platform foundation with a staged conformance and evaluation plan.

## 2.3 Revenue — subscription model

**অক্ষর stays free. State the reason as strategy:**

> অক্ষর remains permanently open. It is not a revenue stream; it is the reason Medora's clinical features are correct and the reason other Bangladeshi health software can be correct too. Medora monetises the platform built on top of it, not the reference itself.

**Doctors pay. Patients never do.** In an economy where 79.3% of health spending is out-of-pocket, charging patients is commercially wrong and ethically indefensible. The free patient tier is also the growth engine — patients bring doctors.

| Tier | Who | Price/month | Includes |
|---|---|---|---|
| Patient | everyone | **free, permanently** | records, booking, reminders, Chorui, consent controls |
| Chamber | solo practitioner | ~1,200 BDT (~$10) | intake, speech-to-notes, source-linked histories, prescription drafts |
| Clinic | 5+ seats | ~900 BDT/seat | + shared scheduling, admin dashboard, multi-doctor records |
| Institution | hospital / NGO | annual, quoted | on-premise, local inference, no external egress |

**Anchor the price out loud:** a private chamber consultation in Bangladesh runs ~500–1,500 BDT. Chamber tier costs *one consultation per month*. This makes the number defensible rather than arbitrary.

**Value proposition is time, not AI.** Structured intake arrives before the patient sits down; dictation replaces writing; prescription fields pre-fill. Two minutes saved across thirty patients is an hour a day.

**First buyer, named:** private chamber physicians in Khulna. Local access via KUET. Pilot cohort → convert a fraction to paid → clinics in year two.

**Unit economics:** because most of the request path is deterministic, marginal infrastructure cost per active doctor is low single-digit dollars against a ~$10 price. Show cost-per-doctor beside price in the cost table.

**Risk to name in the register:** software adoption among Bangladeshi private practitioners is low; the incumbent is paper plus WhatsApp, which costs nothing. Mitigation: free patient tier creates pull; per-consultation time saving is the wedge.

## 2.4 Cost table — line items, not rates

Name the actual configured provider, or label alternatives explicitly.

| Line item | 1k users | 10k | 100k |
|---|---|---|---|
| Backend containers | | | |
| PostgreSQL | | | |
| Object storage | | | |
| OCR (local + cloud split) | | | |
| Audio / speech | | | |
| Egress | | | |
| Monitoring | | | |
| Support | | | |
| Contingency (~20%) | | | |
| **Total** | | | |
| **Cost per paying doctor** | | | |

Add a "with caching + batch" column. Note that determinism keeps marginal token cost low.

## 2.5 মায়া — admission gate framing, `planned`

> **মায়া — escalation-sensitivity admission gate (planned).** Before any generative model is granted a role in Medora, it must pass an escalation-sensitivity check. Web teleconsultation corpora are produced by patients who self-selected as non-urgent and therefore systematically encode reassurance; we hypothesise that supervised fine-tuning on such corpora transfers this prior and degrades emergency escalation sensitivity — a failure invisible to standard generation metrics. The gate fine-tunes a candidate model (TigerLLM-1B under LoRA on a Bangla medical dialogue corpus) and measures the change in escalation sensitivity against the clinician-reviewed red-flag fixtures used in v1, with benign controls for verbosity and bootstrap confidence intervals. Anticipated challenges include translation artefacts in the source corpus, corpus licensing constraints, and the limited size of the adjudicated fixture set. A model that degrades on this gate is not deployed in an escalation-bearing role — which is the empirical test of whether escalation authority belongs outside the model.

**Why this framing:** the result is a property of a third-party corpus and base model, not a confession about Medora. Whichever way it points, you are reporting the gate working. There is no embarrassing outcome.

**Cut মায়া only** if you exceed 10 pages — it is the one artifact with no v1 foundation.

---

# PART 3 — Positioning reference

## 3.1 Thesis

> Medora 2.0 is the reference implementation and staged conformance plan for consent-governed clinical AI in Bangladesh.

Anchor claim: **by 2027, every Bangladeshi health application must demonstrate PDPO-compliant consent handling, and none currently can.**

## 3.2 The five artifacts

| Name | Function | Status |
|---|---|---|
| **আরোহণ** (Arohon) — the ascent | L0–L4 graded authority spec with risk-class ceilings | specified; L2/L3 partially deployed |
| **লক্ষণ** (Lokkhon) — the sign | 5-axis bilingual clinical safety benchmark | measured (A–C), planned (D–E) |
| **সীমানা** (Shimana) — the frontier | consent–utility curve | planned |
| **মায়া** (Maya) — the illusion | escalation-sensitivity admission gate | planned |
| **অক্ষর** (Akkhor) — the character | Bangladesh drug identity layer | deployed |

**Naming correction — use this gloss:**

> **লক্ষণ (Lokkhon)** — in clinical Bangla, *the sign*: the symptom a system must not miss. It is also a homophone of লক্ষ্মণ, whose লক্ষ্মণরেখা is the line that must not be crossed. The benchmark is named for both.

(লক্ষণ = symptom. The Ramayana boundary is লক্ষ্মণরেখা. The original "uncrossable boundary" gloss was wrong and Bengali-speaking judges would notice.)

**Latin-first everywhere:** `Arohon (আরোহণ)` in headings and figure labels, so a font failure never breaks the paper. Verify Kalpurush is embedded in the PDF.

## 3.3 আরোহণ — the tiers and the ceilings

| Tier | Authority | Human role | Error budget |
|---|---|---|---|
| L0 abstain | no clinical claim | — | unsupported-claim rate → 0 |
| L1 inform | grounded, cited statements | reads | every claim traceable |
| L2 suggest | drafts, navigation, pre-fill | confirms | `authoritative_writeback=false` |
| L3 escalate | urgent surfacing + one-tap human action | acts | **recall-first: FN ≈ 0** |
| L4 break-glass | notifies pre-consented third party | notified | prior explicit grant, never inferred |

**Ceilings by risk class — this asymmetry is the contribution:**

| Risk class | Max tier | Why |
|---|---|---|
| Cardiac / stroke / anaphylaxis | L3 (L4 only with prior grant) | missing it is fatal; dispatch stays a human act |
| **Suicidal ideation / self-harm** | **L3 support only. L4 permanently prohibited.** | coercive intervention removes agency and suppresses disclosure |
| Routine clinical | L1–L2 | drafts, never decisions |
| Out of scope | L0 | abstention is correct |

## 3.4 The anchor feature — the refusal contrast

Two utterances, same detector, opposite behaviour:

1. `বুকে ব্যথা, শ্বাস নিতে কষ্ট হচ্ছে` → escalates hard. Full-screen bilingual takeover, one-tap 999, cancellable countdown.
2. `আমি আর বাঁচতে চাই না` → detects, and **refuses to escalate autonomously.** Surfaces support, keeps the person in control, shows on screen it will not act without them.

> Every AI company is racing to make their systems more capable. We built one that knows when to be less.

Use in: §4 worked traces · F3 (ceiling line visible) · first 60s of the demo video · pitch opener.

**Hard constraints:** PWAs cannot autodial and shouldn't. One-tap with a cancellable countdown. Never describe the AI as providing counselling — it is a bridge to human help. Never surface method information. Helpline registry must be time-aware and health-checked (Kaan Pete Roi 09612-119911 operates 3PM–3AM, not 24/7; Shastho Batayon 16263 is in reported financial distress — no single hard-coded dependency).

---

# PART 4 — Figures

| # | Figure | Width | Page | Notes |
|---|---|---|---|---|
| F1 | Problem funnel | col | 1 | 79.3% OOP → 54.4% medicines → 6.1M into poverty → consent gap |
| F2 | Constellation | span | 2 | Five artifacts, **four-status colour coding** |
| F3 | আরোহণ ascent | col | 4 | Ceiling lines crossing the ascent — asymmetry visible without reading |
| F4 | System architecture | span | 5 | Every arrow through the policy engine |
| F5 | Consent grant + flow | col | 5 | Grant fields + local/cloud decision + redaction gate |
| F6 | সীমানা frontier | col | 6 | Label "illustrative — measurement in progress" if unrun. **Never invent data points.** |
| F7 | লক্ষণ profile | col | 7 | **n annotated on every axis** |
| F9 | Live screenshots | col | 3 | Real captures — the credibility StudyGazelle lacked |
| F10 | অক্ষর pipeline | col | 9 | 5 sources → 71,795 rows → 3 tables |

Every caption ends with the claim it supports.

---

# PART 5 — Post-submission implementation

## 5.1 Sprints

| Dates | Work | Rationale |
|---|---|---|
| 17–20 Aug | **PHI de-identification model** | Only item fixing a published weakness *and* answering AI-depth |
| 21–24 Aug | **Read-tool registry + আরোহণ on 3 endpoints** | Turns the title claim into a config file |
| 25–28 Aug | **মায়া gate run + সীমানা on 2 endpoints** | Cheap, and মায়া carries the argument |
| 29 Aug–2 Sept | **Demo video, deck, Q&A rehearsal** | 50 points. Do not let engineering eat these days. |

**If something slips, মায়া and সীমানা slip before the PHI model and the registry.**

## 5.2 PHI de-identification — the plan

**Baseline:** 94.7% P / **75.5% R**, n=134.
**Gap confirmed:** no Bangla clinical de-identification system exists. All prior work (i2b2, Philter, NeuroNER) is English. Bangla-MedER / BanglaMedNER / BanNERD annotate clinical entities and strip PII, so they cannot be used for this.

**Day 1 — data synthesis (the only slow part).** Tags: NAME, DOCTOR, PHONE, NID, ADDRESS, DATE, AGE, HOSPITAL, EMAIL, MRN. Fillers from Bangladeshi name lists, 013–019 phone prefixes, NID patterns, 8 divisions / 64 districts / 495 upazilas, dates in both numeral systems. 60–100 sentence frames from *your own schema and traffic shapes*, each in three scripts (Bangla, English, romanized). Target 8,000–15,000 sentences. **Include hard negatives** (medical terms that look like names, অক্ষর drug names that must not be redacted) and vary PHI density.

*The Kaggle `prasad22/healthcare-dataset` is tabular Faker output — a table, not free text, with no span-finding task in it. Use it only as a field checklist, not as training data.*

**Day 2 — training.** `csebuetnlp/banglabert`, `google/muril-base-cased` (pretrained on transliterated Indic text — the Banglish case), `xlm-roberta-base` as control. Token classification, BIO, optional CRF head. max_len 256, batch 16–32, lr 3e-5 / 2e-5, 3–5 epochs, 3 seeds. **20–40 minutes per model on a free T4.**

**Day 3 — evaluation.** Held-out 134 cases. Report **three systems**: rules only, model only, **union ensemble** (ship this). Span P/R/F1, false-redaction rate, CPU latency, bootstrap CIs.

**Tune for recall, not F1** — under-redaction is a disclosure, over-redaction costs only utility, and the 3.2% false-redaction rate is headroom. **Union recall is bounded below by 75.5%**, so it cannot get worse.

**Day 4 — integration.** Feature-flagged into the redactor path, ONNX/quantised for CPU inference inside the trust boundary, regression fixtures, publish corpus + generator.

**Risk:** the 134-case set was written independently of the patterns. Have someone who did *not* write the rules write the templates, or the model inherits the same blind spots.

## 5.3 Read-tool registry — the Chorui upgrade

**Current design (correct, but limited):** Chorui *navigates*. Intent normaliser → 23 canonical intents → immutable registry (24 entries: 11 patient, 11 clinician, 2 shared) → route. The model produces a route, not a fact. Summarisation grounds on backend-attached sources with citations bound to supplied records.

**The gap:** Chorui can open a screen but cannot answer "what are Dr. Rahman's Thursday chamber hours?"

**The fix — you have a registry for *where you can go*; add one for *what you can ask*:**

```
tool: doctor.chamber_hours
  role:         patient
  relationship: care_relationship_required
  consent:      scope=provider_schedule
  fields:       [day, start, end, location]   # projection, not the row
  tier:         L1 (inform)
  audit:        true
```

**Values are rendered, explanations are generated.** For facts, the model emits intent + slots only; the backend executes, re-authorises independently, and renders from a fixed template. Model outputs `{{doctor.chamber_hours}}`; backend substitutes. **It cannot invent a chamber time because it never sees one.** For prose, keep pseudonymised grounded generation.

Plus: field-level projection (not category-level), independent re-authorisation on every tool call, extended injection fixtures (cross-patient access, clinician without care relationship, injected text inside a record attempting a tool call), and every tool read logged to the patient audit view.

**This makes আরোহণ executable rather than abstract** — reads are L1, writes stay L2, and the tier is declared in config.

## 5.4 Clarification to keep straight

Redaction runs on **one plane only: egress.** Storage (PostgreSQL) keeps full identifiers. Authorisation operates on real identities. Only the payload to an external provider is redacted and pseudonymised.

> The model is a stateless language processor, never a copy of the database.

## 5.5 Small local models (optional, strengthens local-first)

Detection tier — small encoders, not generative: BanglaBERT, BanglishBERT, MuRIL (transliteration-aware), XLM-R as control. Retrieval: `multilingual-e5-small`. Translation: BanglaT5 / NLLB-200-distilled-600M.

**TigerLLM caveat:** continually pretrained on Bangla-TextBook — 163 NCTB textbooks, Grades 6–12, ~9.9M tokens. Excellent Bangla fluency, **zero clinical grounding**. Use for phrasing clinician-authored templates, never for clinical content or escalation judgement. Say this explicitly in the paper — it reads as sophistication.

**Never let the fine-tuned model invent a drug name.** Names come from অক্ষর by retrieval; the model only phrases.

---

# PART 6 — Claims discipline

## 6.1 Say

- "Seven model families across three modalities. Perception and generation are learned; **authority is deterministic**."
- "0 false negatives, 5 false positives on clinician-reviewed emergency fixtures."
- "A pre-release audit found anonymous database grants with RLS disabled; the release revokes them, enables RLS, and **verifies the absence of access with negative tests**."
- "We withdrew the prescription OCR accuracy claim because our own harness showed the pipeline was not clinically usable."
- "Booking holds at 2, 10, and 50 concurrent attempts with unique commit and outbox propagation."

## 6.2 Never say

- That Medora diagnoses (it navigates)
- Any OCR accuracy number
- That the AI provides counselling
- That FHIR mapping exists
- That মায়া or সীমানা have been run
- "13 of 19 components are deterministic" — in the AI category

## 6.3 Compliance checklist

- [ ] ≤10 pages excluding appendices — **re-check after every insertion**
- [ ] TNR 12pt, single spacing, throughout including captions
- [ ] English; Latin-first naming; Kalpurush embedded
- [ ] Two columns; spanning only for F2, F4, risk table
- [ ] Project + team name on cover; PDF metadata set
- [ ] Every number traceable to an archived machine-readable output
- [ ] Status (`deployed`/`measured`/`specified`/`planned`) unambiguous everywhere
- [ ] SoftwareX disclosure line present
- [ ] Every figure caption ends with the claim it supports
- [ ] Fonts embedded, ≤20 MB
- [ ] **Compiles cleanly.** Verify the final PDF opens.

## 6.4 Final-round prep (do not defer)

Four questions to rehearse to 15 seconds each:
1. Is this AI or a platform?
2. What have you actually trained?
3. What happens when detection is wrong?
4. Who pays, and how do you know?

Plus: 3–5 informal conversations with Khulna chamber physicians during the finalist window — converts the subscription model from hypothesis to evidence.
