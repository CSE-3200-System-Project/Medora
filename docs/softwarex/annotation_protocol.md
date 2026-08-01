# Medora prescription annotation protocol

## Roles and blinding

The 103 hash-unique prescriptions receive two independent labels. Reviewer A is a trained author who corrects machine-generated drafts. Reviewer B is a licensed clinician or pharmacist who labels from the image while blinded to Reviewer A and every model output. An adjudicator resolves every disagreement. Duplicate files remain in the public archive but are excluded from metrics by SHA-256.

The annotation server enforces interface blinding: the independent role cannot request prelabels or primary labels. Operational access to the repository still permits reading files, so Reviewer B must receive a clean working copy containing the manifest, images, tool, and an empty annotation directory.

## Transcription rules

1. Draw one `rx` box around the complete prescription area and a `line` box for each medication line. Coordinates are stored as fractions of the source image dimensions.
2. Transcribe visible text as written. Preserve spelling, punctuation, Bangla/Latin script, and line order. Use `[illegible]` only for an unreadable span; do not guess silently.
3. Enter one structured medication row per prescribed item: medicine, strength, dose, frequency, duration, route, quantity, and instructions.
4. Mark fields uncertain independently. Record omissions when a clinically expected field is not written; an omission is not an OCR error.
5. Do not expand abbreviations in raw transcription. A normalized field may contain the protocol-defined interpretation, but the source text remains unchanged.
6. Save reviewer notes only when they help adjudication. Do not add patient-identifying commentary.
7. Assign an opaque writer/template group such as `group-017` after visual comparison.
   Reuse it for prescriptions that share a writer or template, but never enter a
   person's name, clinic name, or another identifier in the group field.

## Adjudication and release gate

The adjudicator compares labels by field and text, records disagreement categories, and selects or enters the final value. Only records with `adjudication.state = "adjudicated"`, two distinct reviewer identifiers, a verified Reviewer B credential role, and no unresolved field enter the gold set. The benchmark loader fails closed when any condition is missing.

Report pre-adjudication character error rate, word error rate, and exact-field agreement between reviewers. AI prelabels are assistance, never ground truth. After adjudication, run `freeze_ocr_manifest.py` with the verified approval citation; it copies reviewed metadata into the manifest and recomputes a deterministic group-preserving 21/82 split. Evaluate the held-out test set once after thresholds are locked.
