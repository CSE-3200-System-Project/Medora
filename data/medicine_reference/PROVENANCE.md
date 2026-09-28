# Medicine corpus provenance

## Historical evidence versus prospective rebuild

The preserved 71,795-row CSV has SHA-256
`476a0acfc76c4722a164c309937331c9e2bbb7f3a88babedc1628343ad59b0cc` and eleven seed
columns. The former `consolidate_datasets.py` selected a different fourteen-column
schema, so it did not establish this CSV's lineage. That script remains in Git history;
the entry point now delegates to the explicit, non-overwriting revision builder.
No retrospective per-row attribution is invented for the historical CSV.

`rebuild_corpus.py` fixes prospective source-to-output linkage from the author-controlled
files. The manifest binds builder hash, profile, source paths/URLs/versions/hashes/counts
and output hashes. Historical retrieval dates and unofficial snapshot versions remain
unknown where not supplied.

## Source roles in medicine-reference-v2

| ID | Local input | Contribution |
| --- | --- | --- |
| S5 | Mendeley Data V1, 21,361 records | Generic, brand, strength, form and manufacturer; sole input to `mendeley-public` |
| S1 | Assorted Bangladesh medicine.csv, 21,714 records | Explicit identity/type; no monograph or indication text |
| S2 | Bangladesh price dataset, 19,957 records | Explicit identity fields; no prices emitted |
| S4 | Community claimed-DGDA concatenation, 53,584 records | Identity and DAR in attribution; conservative trailing strength splits |
| S3 | Indian medicines.csv, 23,939 records | Hashed/count-inventoried; no contribution to the new CSV |

These are local counts, not regulator-certified coverage. Rights evidence is separate in
DATA_LICENSE.md. Other XLSX/CSV copies and old split outputs are not independent inputs.

## Row and field lineage

`source_refs` contains source_id:record_number, counting CSV data records from one,
not physical lines. `record_id` hashes the normalized generic/strength/form/brand/
manufacturer tuple. Input hashes make references resolvable to exact bytes.

Row provenance records output row number, stable ID, selected source of every field,
all contributors' original values and named changes. Whitespace is collapsed and case
folding is used for matching. Bracket contents, manufacturer suffixes, units and form
distinctions are retained. Duplicate display values prefer S5, S1, S2 then S4.
Absent medicine type is filled only from an explicit agreeing contributor; conflicts
are quarantined.

The drug key retains generic, strength and form. BD denotes source collection context,
not current regulatory verification. The usage label means search-only reference.
Common-use fields are empty: no indication/treatment assertion is made. Quarantine
retains contradictory mappings and unparseable S4 records with reasons. Change-report
set differences are changes, not independently established errors or corrections.

## Validation boundary

Automated checks verify input/output hashes, all row IDs and contributors' original
values, seed keys, duplicates and projected table counts. Independent builds from the
same inputs must have identical hashes. These checks do not establish national-market
completeness, clinical correctness, current registration or obsolescence. DGDA was
unavailable in this revision pass; no successful official concordance is claimed.

Record the reported doctor's review with its actual date, qualification, scope and
conclusion. Do not retrospectively relabel source review as a whole-row audit. The
prepared 30-case risk/source-balanced spot-check is descriptive, not a population
accuracy estimate. See the revision handoff for the low-burden workflow.
