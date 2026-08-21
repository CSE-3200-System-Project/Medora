# Bangla Clinical PHI Span Recogniser

A learned token-classification model that finds personal identifiers in Bangla, English and
romanised Banglish clinical text, deployed as the second half of a union ensemble with
Medora's existing rule-based redactor.

This directory ships the corpus generator, the training script, the evaluator, and the
feature-flagged runtime integration. **It does not ship weights.** Training needs a GPU
session and a licence review that are out of band from this repository; the code, the
corpus and the gate are complete and runnable today, and `evaluate.py` reports the model
and union rows as `unavailable` rather than inventing them.

## What is here

| File | Role |
|---|---|
| `fillers.py` | Slot material — names, geography, facilities, generated identifiers, hard negatives |
| `templates.py` | 49 sentence meanings (35 PHI-bearing, 14 clean), each realised in three scripts |
| `generate_corpus.py` | Builds the labelled corpus; enforces holdout exclusion and pool disjointness |
| `train.py` | MuRIL / XLM-R / BanglaBERT fine-tuning, recall-first threshold, ONNX export |
| `evaluate.py` | Rules vs model vs union over two held-out populations, with bootstrap intervals |
| `corpus/manifest.json` | Counts, seed, coverage and exclusion statistics for the last build |
| `corpus/phi_corpus_sample.jsonl` | A committed 300-row head of the corpus, for reading |
| `reports/phi_ner_eval.json` | Machine-readable evaluation output |

Runtime lives in [`backend/app/core/phi_ner.py`](../../backend/app/core/phi_ner.py) and is
wired into `redact_pii_text` in `backend/app/core/ai_privacy.py`.

## Rebuilding the corpus

```powershell
python tools/phi_ner/generate_corpus.py                # 12,000 sentences, seed 20260822
python tools/phi_ner/generate_corpus.py --emit-conll   # add a whitespace-token CoNLL view
```

The full splits are build artifacts and are not committed — the generator plus the recorded
seed reproduce them byte-for-byte. `corpus/manifest.json` and a 300-row sample are committed
so a reviewer can see what the generator emits without running it.

Last build: **12,000 sentences** — 10,560 train (18,566 tagged spans, 2,112 with no PHI at
all) and 1,440 dev (2,507 spans, 288 with none), across ten labels and 147 realised frames
(49 meanings × 3 scripts). Six sentences were discarded for colliding with a held-out
identifier.

Ten labels: `NAME`, `DOCTOR`, `PHONE`, `NID`, `ADDRESS`, `DATE`, `AGE`, `HOSPITAL`, `EMAIL`,
`MRN`. Character offsets are the gold standard; the BIO view is derived from them.

Three design decisions worth knowing before you extend it:

- **`AGE` is only tagged at 90 and above**, which is the threshold at which age becomes
  identifying under HIPAA-style rules. Ages below 90 appear in the same frames untagged, so
  the model has to learn the threshold rather than "a number after the word age".
- **`DOCTOR` tags the name, not the title.** `ডাঃ` and `Dr.` survive redaction. Removing
  them discloses nothing and destroys the clinical sense of the sentence, and it matches
  what the rule layer already does, so the two systems agree on span boundaries.
- **Hard negatives are drawn from the shipped Akkhor medicine reference**, not copied into
  this directory. A de-identifier that redacts medication names has failed at the thing the
  summary exists to carry.

## Training

```powershell
python tools/phi_ner/train.py --list-models
python tools/phi_ner/train.py --model muril --seeds 3     # ~20-40 min per seed on a T4
```

Requires `torch` and `transformers`, which are deliberately absent from
`backend/requirements.txt`: the service never trains. The smaller inference-only runtime,
`onnxruntime` plus the Rust `tokenizers` library, is pinned in both backend requirement files
so the feature can be enabled in a clean deployment without bringing the training stack into
the service image.

| Model | Licence | Status |
|---|---|---|
| `google/muril-base-cased` | Apache-2.0 | Deployable. Pretrained on transliterated Indic text — the romanised case. |
| `xlm-roberta-base` | MIT | Deployable. Multilingual control; if it matches MuRIL, Indic pretraining is not what carried the result. |
| `csebuetnlp/banglabert` | CC BY-NC-SA 4.0 | **Research comparator only.** `assert_export_allowed` refuses to export it. |

The threshold is tuned for **recall, not F1**. Under-redaction is a disclosure;
over-redaction costs utility only, and the rule baseline runs at a 2.4% false-redaction rate,
so there is headroom to spend. `train.py` selects the recall-maximising threshold whose dev
over-redaction stays within `--over-redaction-cap` (default 6%) and records the whole sweep.
If no threshold meets the cap it says so instead of quietly reverting to an F1-optimal point.

## Evaluation, and the finding that changed it

```powershell
python tools/phi_ner/evaluate.py --per-script
```

The build plan assumed a single held-out population: the 134-case bilingual set the
published baseline (94.7% precision / 75.5% recall at v1.0.2) was measured on. That
assumption no longer holds.

**The 134-case set is saturated.** The rule-based redactor has since been extended *against
that set*, and now scores:

| system | precision | recall | F1 | over-redaction |
|---|---|---|---|---|
| rules | 0.969 | **1.000** | 0.984 | 0.024 |

A population where the baseline is already perfect cannot separate three systems — every row
would read 1.000 and the comparison would say nothing. It is still reported, for continuity
with the published number, and `evaluate.py` marks it `saturated_by_rules` from the
measurement rather than from a comment, so the label disappears by itself if a future change
moves the rules off 1.000.

**The discriminating population is the novel-identifier probe**
(`tests/benchmarks/datasets/pii_holdout_cases.jsonl`, n=36 spans): identifiers the rules were
never written against.

| system | precision | recall | F1 | over-redaction |
|---|---|---|---|---|
| rules | 1.000 | **0.750** | 0.857 | 0.000 |

Every one of the nine misses is an unlabelled, previously-unseen personal name — six English,
three Bangla. Structured, labelled, honorific-cued and obfuscated identifiers all generalise
at 100%. That residual is exactly what a learned span recogniser addresses and exactly what a
gazetteer cannot, which is the argument for building this component, now stated as a
measurement instead of an expectation.

Note that 0.750 and the published 0.755 are close enough to be mistaken for each other. They
are different populations measuring different things and should never be compared directly.

Both populations are excluded from training by construction: `generate_corpus.py` reads the
identifier strings from both files and discards any generated sentence containing one. The
last build discarded six.

## Deployment

Off by default.

```
PHI_NER_ENABLED=false          # union pass runs only when true
PHI_NER_MODEL_DIR=             # defaults to tools/phi_ner/artifacts/deploy
PHI_NER_THRESHOLD=              # leave blank; use the admitted bundle threshold
```

An exported bundle is not deployable until `evaluate.py --admit-bundle` writes an
`admission.json` that binds its threshold, commercial-use licence, model/tokenizer/label hashes,
dataset hashes, and passing novel-probe metrics. Runtime revalidates that evidence and falls back
to rules if it is missing, stale, overridden, or corrupt.

With the flag clear, `redact_pii_text` is byte-for-byte the function whose numbers are
published — asserted over both scored populations in
[`tests/unit/backend/test_phi_ner.py`](../../tests/unit/backend/test_phi_ner.py).

With the flag set, the learned pass runs **before** the rules (its character offsets are
computed against the incoming text, and a rule substitution would invalidate them), and a
span is redacted if either system claims it. Spans overlapping an existing `[redacted-...]`
placeholder are dropped, so redaction stays idempotent.

Every failure mode degrades toward the rules, never away from them: flag set with no bundle,
a corrupt bundle, a graph with unexpected inputs, or a session that dies mid-request all log
once and leave the shipped rule-based redaction running. Inference is `onnxruntime` on the
CPU execution provider inside the FastAPI process — text about to be de-identified is never
sent anywhere to find out what to remove.

## Limitations

- **No weights yet.** Every number above is the rule baseline. The model and union columns
  are empty and marked `unavailable`, not estimated.
- **n is small.** 36 identifier spans in the discriminating population. Bootstrap intervals
  are reported next to every rate and they are wide; the fix is clinician time to expand the
  set, not narrower rounding.
- **Synthetic-to-real gap.** The corpus is templated. Frames are drawn from Medora's actual
  traffic shapes and hard negatives are aggressive, but the honest test remains the held-out
  real-shaped cases, which is why they are held out.
- **Upazila coverage is partial** — a named subset, not all 495. Stated in the manifest.
- **Romanised coverage is the weakest axis** by construction. `--per-script` reports the
  breakdown so the weakness stays visible rather than averaging away.
