# Medicine reference corpus — provenance and licence notice

The counts and source roles below describe the **historical application snapshot**, not a
verified reproduction of its undocumented original transformation. The prospective v2
multi-source builder now emits 46,614 identity-only rows with per-row/field provenance,
change records and hashed inputs; it excludes S3 Indian indication prose. Historical
runtime and database records remain unchanged. See
[`revision rebuild`](../docs/softwarex/revisions/MEDICINE_REVISION_REBUILD.md).

The prospective deterministic build entry point is
[`data/medicine_reference/consolidate_datasets.py`](../data/medicine_reference/consolidate_datasets.py),
which inventories five source datasets that are not vendored in this repository (see
[`data/medicine_reference/README.md`](../data/medicine_reference/README.md) for their
locations). Full provenance is in
[`data/medicine_reference/PROVENANCE.md`](../data/medicine_reference/PROVENANCE.md); the
licence analysis is in
[`data/medicine_reference/DATA_LICENSE.md`](../data/medicine_reference/DATA_LICENSE.md).

## What the corpus is

| Property | Value |
|---|---|
| Consolidated rows | 71,795 |
| Canonical drugs (generic + strength + dosage form) | 7,389 |
| Brand entries | 67,001 |
| Search-index terms | 74,390 |
| Unique generic names | 5,242 |
| Unique brand names | 52,117 |
| Market | Bangladesh (`country_code = BD` on every row) |

It supports medicine search and autocomplete, brand-to-generic identity resolution,
patient medication linking, prescription composition, and fuzzy matching of recognised
prescription text. It is a reference layer, not clinical decision support: no dosage logic,
no interaction checking, no effectiveness ranking. Those are explicit non-goals of its
specification.

## Sources and licences

The following table records platform-declared licences only. It does not verify that
uploaders had authority to license material scraped from upstream websites.

| # | Source | Licence |
|---|---|---|
| 1 | *Assorted Medicine Dataset of Bangladesh* — Ahmed Shahriar Sakib, Kaggle | CC0 1.0 |
| 2 | *All medicine and drug price data (20k) Bangladesh* — toriqulstu, Kaggle | CC0 1.0 |
| 3 | *Medicines Dataset* — drowsyng, Kaggle | Apache 2.0 |
| 4 | *Drug Pharma New Dataset* — Shuvo Kumar Basak, Kaggle | MIT |
| 5 | *Medicinal Products in Bangladesh* — M. M. Rahman and M. M. Khan, University of Dhaka, Mendeley Data V1, DOI [10.17632/zhtvkny53n.1](https://doi.org/10.17632/zhtvkny53n.1) | CC BY 4.0 |

Source 5 is the backbone: canonical drug identity and the base brand registry derive from
it. Source 4 supplies brand expansion. Sources 1 and 3 supply the indication layer. Source
2's pricing layer is computed by the build but deliberately not emitted — the corpus
contains no price column.

## Licence of the consolidated corpus

The aggregate's upstream permission chain is unresolved, so it is not cleared for public
redistribution pending author/institution review or removal of uncleared contributions. Do
not infer aggregate CC BY 4.0 permission from source 5's licence. The consolidation script
and schema are project-authored code. Source 3's generic names were normalized and matched
against the Bangladesh backbone; only the generic-to-indication mapping was retained, and
its pricing and URL fields were discarded. See
[`data/medicine_reference/DATA_LICENSE.md`](../data/medicine_reference/DATA_LICENSE.md)
before any distribution.

## Limitations

- **Scraped-source clearance is unresolved.** Source 1 is identified as a scrape of
  `medex.com.bd`; source 3 is identified as a scrape of `www.netmeds.com`. Platform licence
  tags do not establish upstream permission. Do not describe the corpus as authoritative,
  official, or regulator-sourced.
- **`common_uses` is search metadata, not indication guidance.** It derives partly from an
  Indian pharmacy catalogue reaching a Bangladesh reference through generic-name matching,
  written for a different regulatory context. It carries a disclaimer on every row. Authors
  report qualified-doctor review of sources; its method and scope are not documented here.
- No DGDA concordance audit is documented.
- Source conflicts are resolved by normalization rules; a conflict-level adjudication record
  is not included.
- Coverage reflects the collection dates of the five sources. It is not a current or
  complete register of medicines available in Bangladesh.
