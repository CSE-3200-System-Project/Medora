# Medicine reference corpus

`Final_Medicine_Dataset.csv` (71,795 rows) is the consolidated Bangladesh medicine
reference described in the SoftwareX manuscript (`tab:corpus`) and loaded into the
`drugs`, `brands`, and `medicine_search_index` tables by
`backend/scripts/seed_medicine_reference.py`. See
[`../../samples/MEDICINE_CORPUS_NOTICE.md`](../../samples/MEDICINE_CORPUS_NOTICE.md) for
the corpus-level summary and [`PROVENANCE.md`](PROVENANCE.md) for exactly what each of the
five source datasets contributes to which output column.

## What is and isn't vendored here

`consolidate_datasets.py` is the deterministic build script that produces
`Final_Medicine_Dataset.csv` from five source datasets. The five raw source datasets
themselves (~280 MB combined) are **not** vendored in this repository — they are third-party
material, publicly available at the locations below, and running `consolidate_datasets.py`
requires downloading them into the sibling directories it expects
(`1_Assorted_Medicine_Dataset_of_Bangladesh/`, `2_All_medicine_data(20k)_Bangladesh/`,
`3_Medicines_Dataset/`, `4_Drug_Pharma_New_Dataset/`, `5_Medicinal_Products_in_Bangladesh/`).

| # | Source | Location | Licence |
|---|---|---|---|
| 1 | *Assorted Medicine Dataset of Bangladesh* — Ahmed Shahriar Sakib | [Kaggle](https://www.kaggle.com/discussions/general/311821) | CC0 1.0 |
| 2 | *All medicine and drug price data (20k) Bangladesh* — toriqulstu | [Kaggle](https://www.kaggle.com/datasets/toriqulstu/all-medicine-and-drug-price-data20k-bangladesh) | CC0 1.0 |
| 3 | *Medicines Dataset* — drowsyng | [Kaggle](https://www.kaggle.com/datasets/drowsyng/medicines-dataset) | Apache 2.0 |
| 4 | *Drug Pharma New Dataset* — Shuvo Kumar Basak | [Kaggle](https://www.kaggle.com/datasets/shuvokumarbasak2030/drug-pharma-new-dataset) | MIT |
| 5 | *Medicinal Products in Bangladesh* — M. M. Rahman, M. M. Khan, University of Dhaka | [Mendeley Data, DOI 10.17632/zhtvkny53n.1](https://doi.org/10.17632/zhtvkny53n.1) | CC BY 4.0 |

`Final_Medicine_Dataset.csv` — the deterministic *output* of that build — is vendored in
full, since it is what the platform actually loads and what the manuscript's counts refer
to.

## Reproducing the build

```bash
# after downloading the five source datasets into place (see table above)
python consolidate_datasets.py
```

The script is deterministic: the same five inputs always produce the same
`Final_Medicine_Dataset.csv`. See [`PROVENANCE.md`](PROVENANCE.md) for the full field-level
mapping from source to output column.

## Loading into the platform database

```bash
cd backend
venv\Scripts\python.exe -m alembic upgrade head
venv\Scripts\python.exe scripts\seed_medicine_reference.py
```

This resolves the 71,795 CSV rows into 7,389 `drugs` rows (keyed on generic name +
strength + dosage form), 67,001 `brands` rows, and 74,390 `medicine_search_index` terms —
see `PROVENANCE.md` for why the row counts differ from the CSV.

## Licence

`Final_Medicine_Dataset.csv` and this directory's data files are governed by
[`DATA_LICENSE.md`](DATA_LICENSE.md) (CC BY 4.0, consolidating five source licences), not
by the repository's root MIT `LICENSE`. `consolidate_datasets.py` itself — the
consolidation logic — is project-authored and remains MIT.
