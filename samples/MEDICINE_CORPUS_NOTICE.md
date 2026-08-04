# Medicine reference corpus — provenance and licence notice

Medora's medicine reference layer consolidates five independently published datasets
covering the Bangladesh pharmaceutical market. It is built by a deterministic script,
[`data/medicine_reference/consolidate_datasets.py`](../data/medicine_reference/consolidate_datasets.py),
from five source datasets that are not vendored in this repository (see
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

Offered under **CC BY 4.0**, the most restrictive term among the five sources and therefore
compatible with all of them. The consolidation script and schema are project-authored and
remain MIT. Per Apache 2.0's statement-of-changes requirement: source 3's generic names
were normalized and matched against the Bangladesh backbone, only the generic-to-indication
mapping was retained, and its pricing and URL fields were discarded.

Any redistribution must carry the `NOTICE` block in `Medicine/DATA_LICENSE.md`, which
credits all five sources with their licences.

## Limitations

- **Two sources are website scrapes.** Source 1 is a scrape of `medex.com.bd` (declared by
  its uploader); source 3 is a scrape of `www.netmeds.com`. Their licence tags permit
  redistribution, but neither uploader authored the material. The corpus is therefore a
  consolidation of community-published scrapes plus one academic dataset, and must not be
  described as authoritative, official, or regulator-sourced.
- **`common_uses` is search metadata, not indication guidance.** It derives partly from an
  Indian pharmacy catalogue reaching a Bangladesh reference through generic-name matching,
  written for a different regulatory context. It has had no clinical review and carries a
  disclaimer on every row.
- No source has been validated against the DGDA register or any regulatory authority.
- Contradictions between sources for the same brand are resolved by normalization rules in
  the build script, not by manual or expert review.
- Coverage reflects the collection dates of the five sources. It is not a current or
  complete register of medicines available in Bangladesh.
