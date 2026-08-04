# Medicine corpus provenance

This directory builds `Final_Medicine_Dataset.csv` (71,795 rows) by consolidating five
independently published source datasets. This file records where every field comes from,
what is verified, and what is not. It is the companion to `DATA_LICENSE.md`, which states
what may and may not be redistributed.

Nothing here is original data collection. The contribution of this project is the
consolidation schema, the normalization and matching logic in `consolidate_datasets.py`,
and the resulting identity resolution — not the underlying records.

## Sources

| # | Directory | Title / publisher | Rows | Licence |
|---|---|---|---|---|
| 1 | `1_Assorted_Medicine_Dataset_of_Bangladesh` | *Assorted Medicine Dataset of Bangladesh* — ahmedshahriarsakib, Kaggle | 1,711 generic / 21,714 medicine | CC0 1.0 |
| 2 | `2_All_medicine_data(20k)_Bangladesh` | *All medicine and drug price data (20k) Bangladesh* — toriqulstu, Kaggle | 19,957 | CC0 1.0 |
| 3 | `3_Medicines_Dataset` | *Medicines Dataset* — drowsyng, Kaggle | 23,939 | Apache 2.0 |
| 4 | `4_Drug_Pharma_New_Dataset` | *Drug Pharma New Dataset* — shuvokumarbasak2030, Kaggle | 53,584 | MIT |
| 5 | `5_Medicinal_Products_in_Bangladesh` | *Medicinal Products in Bangladesh: A Dataset of Generic and Brand Names, Dosage Strengths, and Manufacturers* — M. M. Rahman, M. M. Khan, University of Dhaka; Mendeley Data | 21,361 | CC BY 4.0 |

All five permit redistribution. Source 5 is verified from the Mendeley record: DOI
[10.17632/zhtvkny53n.1](https://doi.org/10.17632/zhtvkny53n.1), published 18 September
2024. Licence tags for sources 1–4 were read from their Kaggle dataset pages.
`DATA_LICENSE.md` states the aggregate licence, the compatibility reasoning, and the
`NOTICE` text that must travel with any copy.

## Provenance caveats

Two sources are website scrapes. This does not block redistribution — both carry
permissive licence tags, and what the corpus retains from them is short factual text — but
it bounds what the corpus may be claimed to be.

**Source 1 is a scrape of MedEx.** The uploader states this directly in
`1_Assorted_Medicine_Dataset_of_Bangladesh/info.md` ("MEDEX SCRAPED DATASET OF
BANGLADESH"), and 1,199 rows of `generic.csv` carry a `monograph link` pointing at
`medex.com.bd`.

**Source 3 is a scrape of Netmeds.** 8,002 rows of `medicines.csv` carry `disease_url` and
`med_url` values pointing at `www.netmeds.com`, an Indian online pharmacy.

Neither uploader authored the material they licensed. The consequence is not a
redistribution barrier but a provenance one: this corpus is a consolidation of
community-published scrapes and one academic dataset, and it must not be described as
authoritative, official, or regulator-sourced.

Source 3 carries a second, independent problem that no licence resolves. It is Indian
pharmacy data populating indication text for a Bangladesh medicine reference. Even where a
row matches on generic name, the indication text was written for a different market and
regulatory context. `common_uses` is search metadata and nothing more.

## What each source contributes to the output

`consolidate_datasets.py` builds four layers. Their mapping onto the eleven output columns:

| Output column | Layer | Derived from |
|---|---|---|
| `drug_key`, `generic_name`, `strength`, `dosage_form` | 1 — canonical drug identity | Source 5 (backbone) |
| `brand_name`, `manufacturer` | 2 — brand registry | Source 5 (backbone) + source 4 (Allopathic expansion) |
| `medicine_type` | 2 | Sources 4, 5 |
| `common_uses` | 4 — disease mapping | **Sources 3 and 1** |
| `usage_type`, `country_code`, `common_uses_disclaimer` | — | Constants emitted by the build script |

Source 2 supplies a pricing layer (layer 3) that the script computes but does not emit.
`Final_Medicine_Dataset.csv` has no price column, so no pricing data from source 2 reaches
the platform. It is retained in this directory only for reproducibility of the build.

Layer 4 is marked "non-authoritative, for search only" in the script's own header, and the
build stamps every row with `common_uses_disclaimer` reading *"This information is for
general awareness only and does not replace professional medical advice."*

## Composition of the consolidated output

| Property | Value |
|---|---|
| Rows | 71,795 |
| Unique generic names | 5,242 |
| Unique brand names | 52,117 |
| Distinct `common_uses` values | 4,405 |
| Manufacturer coverage | 100% |
| `country_code` | `BD` for all rows |

As loaded into the platform database, the same corpus resolves to 7,389 canonical `drugs`
rows (keyed on generic + strength + dosage form), 67,001 `brands` rows, and 74,390
`medicine_search_index` terms. The row counts differ from the CSV because `drug_key`
collapses brand duplicates and the search index carries both generic and brand terms.

## Reproducing the build

```bash
python consolidate_datasets.py
```

The script reads the five source directories in place and writes `Final_Medicine_Dataset.csv`.
It is deterministic: the same inputs produce the same output. `medicine_part_{1..4}.csv` are
size-split copies of that output for transport, not separate data.

## What is not established

- No source dataset has been validated against the DGDA register or any other regulatory
  authority. Source 4 carries a `DAR` (drug administration registration) column that
  suggests regulatory origin, but this project has not verified those numbers.
- Indication text has no clinical review. It is search metadata.
- No attempt has been made to detect or reconcile contradictions between sources where the
  same brand appears in more than one.
- Duplicate and near-duplicate brand entries across sources 4 and 5 are resolved by the
  normalization rules in the build script, not by manual review.
