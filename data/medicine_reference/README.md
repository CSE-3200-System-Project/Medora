# Medicine reference: historical snapshot and revision rebuild

The root `Final_Medicine_Dataset.csv` is the historical application snapshot, not
the output of the revision builder. It has 71,795 rows, SHA-256
`476a0acfc76c4722a164c309937331c9e2bbb7f3a88babedc1628343ad59b0cc`, and projects to
7,389 drugs, 67,001 brands and 74,390 search terms. Its original source-to-row lineage
cannot be recovered by rerunning the incompatible old script. It is preserved for
historical evidence; it has not been silently replaced or reseeded into Supabase.

## Verified prospective rebuild

`rebuild_corpus.py` produces `medicine-reference-v2` in a new, empty directory.
The eleven seed columns are retained, with stable `record_id` and `source_refs` appended.
Every row has JSONL provenance identifying the hashed input file, one-based CSV record,
original field value and transformation. Exact normalized identities are deduplicated
without stripping substance names or guessing manufacturer equivalence.

Two profiles are prepared:

- `full-local`: Bangladesh identity fields from S5, S1, S2 and conservatively parsed S4.
  S3 is inventoried but excluded: Indian indications do not validate Bangladesh products.
  Multi-source redistribution rights are not cleared by the build.
- `mendeley-public`: Rahman and Khan's Mendeley Data V1, DOI
  [10.17632/zhtvkny53n.1](https://data.mendeley.com/datasets/zhtvkny53n/1), CC BY 4.0,
  with attribution and explicit changes. This is the prepared public-data alternative.

Neither profile emits prices, invented common uses, or unvalidated clinical indications.
Missing medicine type is not inferred. Contradictory brand/manufacturer mappings,
conflicting types and ambiguous S4 generic/strength strings are quarantined. Unknown
strengths remain flagged. Exclusion does not prove a product is invalid or obsolete.

```powershell
backend/venv/Scripts/python.exe data/medicine_reference/rebuild_corpus.py --source-root F:/CODE/System-Project/Medora-Datasets/Medicine --output dist/my-new-medicine-build --profile full-local --previous data/medicine_reference/Final_Medicine_Dataset.csv
backend/venv/Scripts/python.exe tools/softwarex/verify_medicine_build.py dist/my-new-medicine-build --source-root F:/CODE/System-Project/Medora-Datasets/Medicine
```

Use `--profile mendeley-public` for the public alternative. Raw sources remain in
author-controlled storage. Unsupplied historical download dates are unknown, not today's
inspection date. Outputs include CSV, row provenance, quarantine, manifests, quality/change
reports and a frozen 30-case doctor spot-check bundle/CSV/protocol. Large local/private
outputs live in ignored `dist/`; approved aggregate manifests live in
`docs/softwarex/generated/`.

See [PROVENANCE.md](PROVENANCE.md), [DATA_LICENSE.md](DATA_LICENSE.md),
[UPDATE_POLICY.md](UPDATE_POLICY.md) and the
[revision handoff](../../docs/softwarex/revisions/MEDICINE_REVISION_REBUILD.md).

## Seed compatibility without changing the live database

```powershell
backend/venv/Scripts/python.exe backend/scripts/seed_medicine_reference.py --csv dist/my-new-medicine-build/Final_Medicine_Dataset.csv --dry-run
```

Use only the dry-run before final selection and migration planning. The existing seed
writer deletes reference tables. Do not run it against a shared database with patient/
clinician links. A live update needs a reference-preserving migration, not blind replacement.
