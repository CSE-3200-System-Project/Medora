# Maya navigation SFT v1 — synthetic draft

This directory contains a complete fixed-size draft corpus for the Medora Maya QLoRA mechanism
experiment. It has 120 synthetic, PHI-free, non-urgent health-navigation conversations: 100 in
the training split and 20 in the validation split. It is not a clinical dataset, diagnostic
dataset, emergency benchmark, or evidence that a model is safe.

## Status

`draft_combined.jsonl` is **not training-ready**. Every generated row deliberately has
`review_status=pending_clinical_review` and a blank `reviewer_id`. The QLoRA notebook must reject
it. Generation cannot substitute for review, and no reviewer identity or approval has been
invented.

Two qualified clinicians must independently review every proposed assistant response in
`clinical_review.csv`. A disagreement, revision, or rejection requires an independent adjudicator
and an approved revised response. The promotion tool fails closed unless every fixed row passes.

## Files

- `draft_combined.jsonl`: all 120 rows; this is the review source of truth.
- `draft_train.jsonl`: the same 100 train rows for inspection.
- `draft_validation.jsonl`: the same 20 validation rows for inspection.
- `clinical_review.csv`: UTF-8 review worksheet for two blinded reviewers and adjudication.
- `clinical_review_working.csv`: created and updated by the terminal wizard; ignored by Git so the
  immutable blank template and manifest remain unchanged.
- `manifest.json`: counts, source links, and SHA-256 hashes.
- `approved_combined.jsonl`: created only by the promotion command after completed review; not
  committed as a fabricated placeholder.

## Coverage and split policy

Thirty scenario families each have four language/script variants: formal Bengali, conversational
Bengali, Banglish, and English. The first 25 families belong only to train (25 × 4 = 100); the last
five belong only to validation (5 × 4 = 20). No family crosses the split boundary.

The corpus is deliberately limited to non-urgent navigation. It covers routine primary care,
dental, dermatology, ENT, eye care, musculoskeletal concerns, stable chronic-care follow-up,
medication administration, non-crisis mental-health navigation, reproductive/maternal navigation,
paediatrics, and preventive care. Responses state a next service, avoid diagnosis and prescribing,
and include concise escalation safety nets.

This design supports the preregistered mechanism question: whether supervised fine-tuning on a
synthetic non-urgent navigation corpus changes first-sentence emergency escalation. Emergency and
self-harm Maya cases remain evaluation-only.

## Evidence basis

The draft's navigation and safety-net boundaries were based on current public guidance rather than
copied clinical dialogue:

- [Bangladesh Police National Emergency Service 999](https://telecom-police.portal.gov.bd/pages/static-pages/695e3b0cc4774958d7b72321)
- [WHO Interagency Integrated Triage Tool](https://www.who.int/tools/triage)
- [WHO–ICRC Basic Emergency Care](https://www.who.int/publications/i/item/basic-emergency-care-approach-to-the-acutely-ill-and-injured)
- [WHO maternal and newborn warning signs](https://www.who.int/campaigns/world-health-day/2025/key-messages)
- [WHO mental-health and suicide-support guidance](https://www.emro.who.int/mhps/suicide.html)
- [WHO sepsis fact sheet](https://www.who.int/news-room/fact-sheets/detail/sepsis)
- [NHS signs of serious illness in babies and toddlers](https://www.nhs.uk/baby/health/is-your-baby-or-toddler-seriously-ill/)
- [NHS poisoning guidance](https://www.nhs.uk/conditions/poisoning/)

These sources do not approve the dataset and are not represented as endorsing Medora. Reviewers
must verify the actual wording and Bangladesh applicability.

## Rebuild and validate

From the repository root:

```powershell
backend/venv/Scripts/python.exe tools/maya_dataset/build_synthetic_navigation_dataset.py
backend/venv/Scripts/python.exe -m pytest -c tests/pytest.backend.ini tests/unit/backend/test_maya_training_dataset.py
```

The builder regenerates all draft artifacts deterministically and checks row counts, unique IDs and
prompts, split-family isolation, PHI/review flags, prohibited prescribing patterns, and exact or
high-overlap matches against the frozen Maya red-flag and benign prompt sets.

## Clinical review and promotion

Run the interactive terminal wizard from the repository root:

```powershell
backend/venv/Scripts/python.exe tools/maya_dataset/review_wizard.py
```

The first clinician chooses **Reviewer 1** and completes or pauses the review. The second clinician
later chooses **Reviewer 2** with a different stable reviewer code. Completed rows are skipped when
the wizard resumes. Each decision is atomically saved to `clinical_review_working.csv`; a timestamped
backup is created at the beginning of later sessions. Do not have two reviewers write the same CSV
concurrently.

The primary reviews are blinded: neither reviewer sees the other's decision or notes. After both
have completed all 120 rows, an independent clinician chooses **Adjudicator** and resolves every
revision, rejection, or disagreement. The adjudicator cannot use either primary reviewer's code.

Reviewer and adjudicator notes are internal audit text and may be written in English or Bangla.
For `revise` or `reject`, a note is required. A final revised assistant response must match the
example language: Bengali script for `bn`, Latin-script Banglish for `banglish`, and English for
`en`. The wizard enforces the Bengali-versus-Latin script boundary and reminds the adjudicator of
the exact language.

Useful direct commands are:

```powershell
backend/venv/Scripts/python.exe tools/maya_dataset/review_wizard.py --role reviewer1 --reviewer-id clinician-a
backend/venv/Scripts/python.exe tools/maya_dataset/review_wizard.py --role reviewer2 --reviewer-id clinician-b
backend/venv/Scripts/python.exe tools/maya_dataset/review_wizard.py --role adjudicator --reviewer-id clinician-c
backend/venv/Scripts/python.exe tools/maya_dataset/review_wizard.py --role progress
```

To correct one previously reviewed row, add `--case-id MAYA-SFT-001-1`. When the wizard reports
`Promotion ready: YES`, run:

```powershell
backend/venv/Scripts/python.exe tools/maya_dataset/promote_clinical_review.py `
  --draft data/maya_navigation_sft_v1/draft_combined.jsonl `
  --reviews data/maya_navigation_sft_v1/clinical_review_working.csv `
  --out data/maya_navigation_sft_v1/approved_combined.jsonl
```

Only `approved_combined.jsonl` should be uploaded to
`experiments/maya/Maya_Qwen35_2B_QLoRA_Colab.ipynb`. Re-run the notebook's validation cell and
record the approved file's SHA-256 before training.

## Licence and privacy

The draft is marked `Medora-internal-research-only` pending project governance and clinical
sign-off. It uses synthetic situations and contains no intentional patient data. Do not publish the
review sheet, trained adapters, or promoted dataset to a public Hugging Face repository by default;
use controlled private storage and complete the project's licence/privacy review first.
