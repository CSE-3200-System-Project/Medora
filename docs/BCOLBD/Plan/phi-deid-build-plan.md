# Bangla Clinical PHI De-identification — Build Plan

**Goal:** replace/augment the rule-based bilingual redactor with a trained span recognizer.
**Baseline to beat:** 94.7% precision / **75.5% recall** on the existing 134-case bilingual set.
**Total effort:** ~4 working days. Training itself is ~30 minutes.
**Schedule:** start 17 Aug (after whitepaper submission). Done well before 2 Sept.

---

## Why this and not something else

- It is the only trained component that fixes a **published weakness** rather than adding a new one.
- Token classification converges fast on small data — highest probability of a working result per hour spent.
- No real patient data required; synthesis is legitimate and citable (PHICON, Yue & Zhou 2020).
- No Bangla clinical de-identification system exists in the literature. All prior work (i2b2, Philter, NeuroNER) is English. Bangla medical NLP resources that do exist — Bangla-MedER, BanglaMedNER, BanNERD — annotate *clinical* entities (drug, disease, organ) and explicitly strip PII, so they cannot be used for this task.
- It simultaneously fixes লক্ষণ axis D, which currently rests on 4 cases.

**Naming:** do **not** create a sixth artifact. This is an upgrade to the existing bilingual redactor component, evaluated on লক্ষণ axis C. Five names is already at the limit.

---

## Day 1 — Data synthesis (the only slow part)

### Entity schema (BIO tagging)

| Tag | Covers |
|---|---|
| `NAME` | patient, guardian, relative names |
| `DOCTOR` | clinician names, with title variants (ডাঃ / Dr. / ড. ) |
| `PHONE` | `01XXXXXXXXX`, `+8801XXXXXXXXX`, `০১XXXXXXXXX` |
| `NID` | 10 / 13 / 17-digit national ID |
| `ADDRESS` | division, district, upazila, village, road, house |
| `DATE` | DOB, visit date; Bangla and Arabic numerals |
| `AGE` | when ≥ 90, which is identifying under HIPAA-style rules |
| `HOSPITAL` | facility names |
| `EMAIL` | standard |
| `MRN` | internal record identifiers |

### Slot filler sources

| Slot | Source | Target size |
|---|---|---|
| Given + family names | Bangladeshi name lists; generate **Bangla, English, romanized** for each | 500+ each |
| Phone | Generated from real operator prefixes (013–019) | programmatic |
| NID | Pattern-generated, never real | programmatic |
| Address | 8 divisions, 64 districts, 495 upazilas — public administrative data | full hierarchy |
| Dates | Both numeral systems, 6+ format variants | programmatic |
| Hospitals | Public facility list | 200+ |

### Templates

Write **60–100 sentence frames** drawn from your actual traffic shapes: consultation messages, appointment requests, prescription text, report headers, chat turns to Chorui.

Each frame is instantiated in **three scripts**:
1. Bangla — `রোগী {NAME}, বয়স {AGE}, {ADDRESS} থেকে এসেছেন। মোবাইল {PHONE}।`
2. English — `Patient {NAME}, age {AGE}, from {ADDRESS}. Mobile {PHONE}.`
3. Romanized — `Patient {NAME}, boyosh {AGE}, {ADDRESS} theke eshechen. Mobile {PHONE}.`

**Target: 8,000–15,000 labeled sentences.** More is not better than more *varied*.

### Critical details

- **Include hard negatives.** Medical terms that look like names, place names that are also common words, drug names from অক্ষর that must *not* be redacted. Without these the model over-redacts and destroys precision.
- **Vary PHI density.** Some sentences with zero PHI, some with five. A model trained only on PHI-rich text hallucinates entities in clean text.
- **Hold out your real 134 cases entirely.** They are the test set. Never train on them, never tune on them.
- Emit CoNLL or JSONL with character offsets so span-level scoring is exact.

---

## Day 2 — Training

### Candidates

| Model | Size | Why |
|---|---|---|
| `csebuetnlp/banglabert` | ~110M | ELECTRA-base, strongest Bangla encoder, BUET provenance |
| `google/muril-base-cased` | ~236M | **Pretrained on transliterated Indic text** — the romanized/Banglish case |
| `xlm-roberta-base` | ~278M | Multilingual control baseline |

Train all three. It costs one afternoon and gives you a comparison table, which is worth more in the paper than a single number.

### Config

```
task            token classification (BIO), optional CRF head
max_length      256
batch_size      16–32
learning_rate   3e-5 (ELECTRA), 2e-5 (MuRIL / XLM-R)
epochs          3–5
warmup          10%
eval            per epoch on a synthetic dev split
seed            fixed and recorded; run 3 seeds
```

**Runtime: 20–40 minutes per model on a free Colab T4.** Overnight on CPU if no GPU.

### The decision that matters

Tune the classification threshold **for recall, not F1.** Under-redaction is a disclosure; over-redaction costs only utility. Your current false-redaction rate is 3.2%, which is ample headroom. State this as a deliberate, principled choice in the paper — it shows you understand the asymmetry of the task.

---

## Day 3 — Evaluation

Run on the held-out 134-case set. Report:

| Metric | Baseline (rules) | Target |
|---|---|---|
| Span precision | 94.7% | ≥ 90% acceptable if recall rises sharply |
| **Span recall** | **75.5%** | **≥ 88%** |
| F1 | — | report |
| False-redaction rate | 3.2% | ≤ 6% acceptable |
| CPU latency (ms/request) | — | must be reported — the component runs locally |

**Report three systems, not one:**
1. Rules only (baseline)
2. Model only
3. **Union ensemble** — redact if *either* fires

The union is what you ship. It should give the highest recall and is the honest deployment configuration.

Use your existing bootstrap CI tooling. With n=134, confidence intervals will be wide — report them rather than hiding them. Reference point: English de-identification SOTA on i2b2 sits above F1 95%. A first Bangla system in the high 80s is both a real improvement and a publishable first.

---

## Day 4 — Integration and packaging

- Wire the ensemble into the existing redactor path behind a feature flag.
- Export ONNX or quantized weights for CPU inference inside the FastAPI trust boundary.
- Add regression fixtures so the redactor cannot silently degrade.
- Publish the synthetic corpus and generation script — **the generator is as much a contribution as the model**, since it lets anyone rebuild the corpus without touching patient data.
- Add to লক্ষণ axis C and axis D as a versioned result.

---

## What this gives you

**For the finals (40 pts: technical documentation + code + inference model):**
A trained model with weights, a manifest, an eval CSV, a reproducible training script, and a synthetic corpus with its generator. This is a much better answer to "deployment-ready inference model" than a merged LLM checkpoint, because it is small, runs on CPU, and has a measured improvement attached.

**For the AI-depth question:**
Two trained models telling opposite stories —

> **মায়া:** fine-tuning a *generator* on a clinical dialogue corpus made it measurably **less safe**.
> **This model:** fine-tuning a *discriminator* on a privacy task made the system measurably **safer**.

That contrast is an empirical claim about where learning belongs in a clinical system, which is exactly what আরোহণ specifies. Stronger than either result alone.

**For publication:**
A Bangla clinical de-identification corpus + model + baseline is a resource paper with no incumbent. LREC-COLING, an ACL resource track, or a data descriptor venue.

---

## Risks

| Risk | Mitigation |
|---|---|
| Synthetic-to-real gap — model works on templates, fails on real text | Vary templates aggressively; include hard negatives; the 134 real cases are the honest test |
| Over-redaction destroys utility | Report false-redaction rate alongside recall; union ensemble is threshold-tunable |
| n=134 too small for confident claims | Report CIs; state the limitation; expand the eval set if clinician time allows |
| Romanized coverage still weak | MuRIL specifically; report per-script breakdown so the weakness is visible |

---

## Today (15 Aug) — do none of this

Finish the whitepaper. Use the proposal paragraph. The build starts 17 August.
