# Medicine corpus files available for SoftwareX review

**Historical inventory, not the prospective v2 builder specification.** The schema/linkage
discrepancy below describes the old adjacent generator and 71,795-row snapshot. The new
builder now verifies all 46,614 emitted rows against hashed source records. Its exact
inputs, changes and exclusions are in `MEDICINE_REVISION_REBUILD.md` and
`../generated/medicine_v2_full_build_manifest.json`; S1 uses `medicine.csv`, and S3
indication prose is excluded. The old snapshot's undocumented generation is not
retrospectively asserted to be reproducible.

Read-only inventory of the author-controlled source folder `Medora-Datasets/Medicine`,
checked 28 September 2026. These hashes identify the exact local bytes available at that
time; they do not prove upstream authorization, clinical correctness, currency, or that a
source was used in a particular historic application build. No medicine rows are copied
into this manifest.

The row counts are parsed CSV data-record counts (header excluded). Source counts overlap
and must not be summed as unique products. `Final_Medicine_Dataset.csv` is the consolidated
output recorded as 71,795 rows in the existing provenance note.

| Build role | Local file (relative to `Medora-Datasets/Medicine`) | Rows | Bytes | SHA-256 |
|---|---|---:|---:|---|
| Source 1: generic/indication mapping | `1_Assorted_Medicine_Dataset_of_Bangladesh/generic.csv` | 1,711 | 8,519,440 | `d87406bd0e1765fd3740912edd09d7df355e0cd8bcaa9482da9d2c47063e8046` |
| Source 2: pricing input (not emitted in final CSV) | `2_All_medicine_data(20k)_Bangladesh/all_medicine_and_drug_price_data(20k)_Bangladesh.csv` | 19,957 | 2,321,177 | `14a6743b607516105870c52925f06f1d54ec12b72c169fcc3eb754b143da0b0c` |
| Source 3: search/indication input | `3_Medicines_Dataset/medicines.csv` | 23,939 | 240,232,659 | `d2efadab6cfba2b5f713126c7b5dbccffd4698dee8fd2ffb795bbe7ba28c433e` |
| Source 4: allopathic expansion input | `4_Drug_Pharma_New_Dataset/Drug_Database_5_Data Concatenation.csv` | 53,584 | 5,371,449 | `81e3257da9e3735fefbb39ee0c12dbb516826e9b6dc4866d0d14e567acbc4613` |
| Source 5: Bangladesh medicine backbone | `5_Medicinal_Products_in_Bangladesh/Medicinal Products in Bangladesh A Dataset of Generic and Brand Names, Dosages, and Manufacturers.csv` | 21,361 | 2,177,882 | `293036d5c24268c6526df4ae9ba59e3d80f40380b79bdf40859c83419b52a8fd` |
| Consolidated output | `Final_Medicine_Dataset.csv` | 71,795 | 22,318,819 | `476a0acfc76c4722a164c309937331c9e2bbb7f3a88babedc1628343ad59b0cc` |

The original adjacent `consolidate_datasets.py` named these five inputs. The directory also contains other raw,
modified, spreadsheet, split-copy and source files; they are not silently treated as extra
independent sources or as evidence of validation. The code's source-1 `medicine.csv` file
was present locally but was not named as an input by that original script.

**Important reproducibility discrepancy:** the locally inventoried final CSV has header
`drug_key,generic_name,strength,dosage_form,brand_name,manufacturer,usage_type,country_code,common_uses,medicine_type,common_uses_disclaimer`.
The original adjacent `consolidate_datasets.py` instead selected output columns including `brand_id`,
`drug_id`, `unit`, `unit_size`, `price`, and `data_source`. Their schemas do not match.
Although the counts and hashes above identify the available files, this script/output pair
does not yet prove which transformation generated the 71,795-row CSV. Its header also lacks
a per-row source field, so a source-stratified audit cannot be mapped back from that output
without recovering the actual generator or another provenance map. Do not claim a verified
rebuild or source-specific sample from these files until this linkage is resolved.

## Evidence still missing for the review

- Contemporaneous source versions/retrieval dates and archived licence/terms pages for the
  exact five files. A current local hash cannot reconstruct those historical records.
- A dated record of the reported doctor's qualifications/role, corpus version(s), whether
  the doctor checked source credibility or medicine rows, fields/sample/coverage, method,
  discrepancies and bounded conclusion. Keep private contact/consent material out of the
  public package.
- The requested machine-assisted corpus checks and stratified manual sample review for
  identity, generic/brand/strength/form/manufacturer, duplicates and current/obsolete
  status; plus an authoritative comparison if available, or an explicit limitation.
- Written rights/permission decision for the source-derived data intended for the public
  capsule/archive. A doctor's content review and platform licence labels do not establish
  third-party redistribution authority.

Raw source inputs and the new candidate remain in controlled local folders until permissions
are documented. The historical consolidated CSV was already tracked in this repository;
that fact does not establish clearance for a new capsule/archive. This inventory does not
publish raw records or fabricate historical source/review evidence.
