# Identifier redaction workflow

Purpose: produce a redistributable prescription image set whose direct identifiers have
been destroyed, so the corpus can be archived without relying on informal consent for
permanent worldwide publication.

## Two design decisions worth understanding before you start

**Opaque fill, not blur.** Blurring text is not a de-identification control. Gaussian
blur is linear and partially invertible by deconvolution, and for a constrained
character set a blurred name can be recovered by rendering candidates and matching.
Pixelation fails the same way at usable block sizes. `apply_redactions.py` writes solid
black rectangles, which destroy the pixels outright.

**Identifier fields only — do not blank the non-Rx area.** It is tempting to use YOLO to
find the Rx region and blank everything else, since that is automatic and thorough. It
would also invalidate the A–H ablation. Configurations A and B are full-image OCR
baselines; if the published images are mostly blank outside the Rx region, those
baselines face an artificially easy page, the measured contribution of region detection
collapses toward zero, and the reported accuracy stops generalizing to real cluttered
prescriptions. Preserve the letterhead block, the vitals area, the layout, everything —
cover only the fields that identify a person.

## Steps

### 1. Mark identifiers

```powershell
python tools/redaction/redact_server.py
```

Opens `http://127.0.0.1:8790`. For each image, drag a box over every identifier. Pick the
active category from the checklist on the right (or press `0`–`9`), click a box to remove
it, press `z` to undo.

An image cannot be saved until **every** identifier category is either boxed or
explicitly ticked *not present*. That is deliberate: silence is the failure mode that
publishes someone's name, so absence has to be asserted rather than assumed.

Marks are stored as normalized 0–1 coordinates in `tests/benchmarks/redaction_marks/`,
bound to the source hash, and are safe to commit — they contain no image data.

Categories: patient name, patient id, patient contact, patient address, doctor name,
doctor registration, doctor contact, clinic letterhead, signature, date, other.

### 2. Apply

```powershell
python tools/redaction/apply_redactions.py --check   # readiness only
python tools/redaction/apply_redactions.py
```

Writes `samples_redacted/RX-####.<ext>` and
`tests/benchmarks/reports/redaction_report.json`. Originals are never modified. EXIF is
dropped on re-encode, because camera metadata carries device, timestamp, and sometimes
GPS. The applier refuses to proceed if any image lacks marks, if marks were made against
a different image, or if a redacted output is byte-identical to its original.

### 3. Regenerate everything downstream

Redaction changes every source hash, and the entire cached evidence chain was computed
against the originals:

| Artifact | Why it breaks |
|---|---|
| `datasets/ocr_corpus_manifest.json` | 105 `sha256` values |
| `cache/ocr/{paddle_full,azure_full,azure_yolo}/*.json` | 309 files keyed by source hash |
| `provider_cache/<sha256>/` | 311 files |
| `prelabels/RX-*.json` | `source_sha256` and hash-bound `assisted_from` |
| `datasets/gpt_vision_drafts*.jsonl` | `source_sha256` per record |
| reviewer package | manifest hashes |

Regenerate in this order:

```powershell
python tests/benchmarks/generate_ocr_manifest.py          # against samples_redacted/
python tools/ocr_annotation/generate_prelabels.py         # re-runs the providers
python tools/ocr_annotation/build_reviewer_package.py --zip
```

Re-running the two Azure configurations is 206 pages — roughly USD 0.30 at
`prebuilt-read` rates. PaddleOCR and YOLO are local.

This is a reproducibility gain, not just cost. Today the caches describe images that
would not be published under a de-identified release. Afterwards, the evaluated artifact
and the deposited artifact are the same bytes.

## What redaction does and does not achieve

It removes marked **direct identifiers**. It does **not** make the corpus anonymous:

- handwriting remains and is quasi-biometric
- letterhead layout, dates, and medication combinations can still support
  re-identification
- an identifier missed during marking stays in the published image permanently

Manuscript and notice language must stay bounded accordingly — "direct identifiers
removed by irreversible redaction", never "anonymized". The same discipline already
applies to the text redaction claims in `ai_privacy.py`.
