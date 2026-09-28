# Revision-only medicine rebuild and low-burden review

## Prepared artifacts

The author's selected publication direction is **multi-source corpus, after documenting
source permissions**. The Mendeley-only profile is an available alternative, not a selected
replacement. No shared Supabase database or historical evidence was overwritten.

| Snapshot | CSV rows | Projected drugs | Projected brands | Search terms |
| --- | ---: | ---: | ---: | ---: |
| Historical application snapshot | 71,795 | 7,389 | 67,001 | 74,390 |
| Revision multi-source candidate | 46,614 | 6,153 | 46,614 | 52,767 |
| Mendeley-only alternative | 20,445 | 2,875 | 20,445 | 23,320 |

These are software/seed projection counts, not completeness or clinical validation.
The lower candidate counts result from conservative exclusions/deduplication, not an
assertion that every excluded source row is erroneous or obsolete.

Current selected candidate:
`dist/softwarex-medicine-v2-full-finalized/Final_Medicine_Dataset.csv`, SHA-256
`84539c102b313833e10108576e5b346611882d796f2e562db61226d63e1a548d`.
All 46,614 output rows and 72,969 contributor references have verified source linkage.
Manifests, quality/change reports, per-row original values and transformations, quarantine
and a 30-case review packet are alongside it. Aggregate evidence is in
`docs/softwarex/generated/medicine_v2_full_*.json`.

The old generator/output mismatch is not retrospectively repaired by inventing provenance.
The new deterministic builder fixes linkage prospectively. The historical CSV remains
identified and separate until the final candidate is accepted and a reference-preserving
database/release migration is performed.

## What the actual review requests

Reviewer 1 comment 5 asks for an explanation of how completeness, duplication, obsolete
products, generic–brand mapping, strengths, forms and manufacturers were validated. It
says a statistically meaningful manual audit **or** authoritative/current comparison would
strengthen the contribution. It does **not** prescribe a 383-row audit, two doctors or
row-by-row clinician approval. Reviewer 3 asks for merged-data preparation/validation detail.

The 30-case packet is a low-burden **descriptive spot-check**, not the statistically
representative population audit suggested by the reviewer. We must not claim whole-corpus
accuracy from it. Automated checks address structural duplication, linkage, identity
conflicts and missing fields. National completeness/current registration/obsolescence remain
unestablished unless actually checked against a current authoritative reference.

## Minimal existing-review record: about 10–15 minutes

If the doctor already reviewed the source suitability, ask them to confirm one short note:
qualification/role, review date, source IDs/versions, what they actually checked, any concerns,
and the limited conclusion. A source review is useful evidence, but not a retroactive
validation of all medicine rows. Do not ask them to sign an invented result or claim an
institutional/regulatory certification.

## Optional bounded content spot-check: approximately 40–70 minutes

1. Authors prepare the source/current-reference links and organize the packet. This
   non-clinical lookup work need not consume doctor time. An unavailable/not-found official
   entry is marked unknown, not automatically obsolete.
2. Give the doctor only `dist/softwarex-medicine-v2-full-finalized/reviewer/` privately.
   Open `OPEN_ME.html`, load `doctor_review_bundle.json`, and use a reviewer code.
3. For each of 30 cases, check generic–brand identity, strength and dosage form against
   the supplied evidence/trusted reference. Click **Acceptable**, **Discrepancy** or
   **Cannot assess**. Only the latter two need a short reason. Reference/currentness fields
   are available; missing currentness checks must remain missing.
4. Export the JSON; authors retain the qualification/date/scope note separately. No cloud
   upload, account or second reviewer is required by this workflow.
5. Bind the real export to the frozen corpus:

```powershell
backend/venv/Scripts/python.exe tools/softwarex/summarize_medicine_review.py dist/softwarex-medicine-v2-full-finalized/doctor_review_bundle.json <actual-review-export.json> --output dist/medicine-review-summary.json
```

Estimate: 30 cases × 1–2 minutes plus 10 minutes for the note. Difficult/unresolved cases
may take longer; choose Cannot assess rather than forcing the reviewer to resolve them.
Five flagged cases plus source-balanced deterministic selections are prepared. Report N,
actual verdict counts and scope; do not extrapolate population accuracy or invent a narrow
confidence interval. If strong whole-corpus accuracy claims are retained, this lightweight
packet is insufficient and a suitable validation study would be needed.

## Separate publication-permission task

See `data/medicine_reference/SOURCE_PERMISSION_RECORD.json`. The new corpus contains
identity facts from S1/S2/S4/S5, not Netmeds indication prose. Keep private evidence of
applicable licence/authorization and publish an approved summary. The doctor's expertise
is not needed for this rights record and their clinical review does not grant it.

After permissions and any real review corrections are recorded, freeze the chosen CSV,
provenance, manifest and attribution notices together. Update the paper counts and release
tests for that exact accepted version, then run Code Ocean and create the new GitHub/Zenodo
archive. Do not silently relabel the historical runtime measurements as measurements of
the rebuilt corpus.
