# Medicine corpus licence and redistribution scope

The `LICENSE` file at the root of this repository is the MIT License. **It applies to the
code in this repository and to nothing else.** It does not apply to the data in this
directory, which is third-party material held under five separate licences. A blanket MIT
grant over datasets this project did not create was the defect this file corrects.

## Source licences

All five sources carry a licence permitting redistribution. Licence tags for sources 1–4
were read from their Kaggle dataset pages; source 5 is verified from its Mendeley record.

| # | Source | Licence | Obligation on redistribution |
|---|---|---|---|
| 1 | *Assorted Medicine Dataset of Bangladesh* — ahmedshahriarsakib, Kaggle | CC0 1.0 (public domain dedication) | None required; credited here as good practice |
| 2 | *All medicine and drug price data (20k) Bangladesh* — toriqulstu, Kaggle | CC0 1.0 (public domain dedication) | None required; not emitted into the corpus in any case |
| 3 | *Medicines Dataset* — drowsyng, Kaggle | Apache License 2.0 | Retain the licence notice, attribute, and state that changes were made |
| 4 | *Drug Pharma New Dataset* — shuvokumarbasak2030, Kaggle | MIT License | Retain the copyright and permission notice |
| 5 | *Medicinal Products in Bangladesh* — Rahman & Khan, University of Dhaka, Mendeley Data, DOI [10.17632/zhtvkny53n.1](https://doi.org/10.17632/zhtvkny53n.1) | CC BY 4.0 | Attribute the authors and the licence |

## Licence of the consolidated corpus

`Final_Medicine_Dataset.csv` is a collective work derived from all five sources. It is
offered under **CC BY 4.0**, which is the most restrictive term in the set and therefore
satisfies the others: CC0 imposes no condition, and the Apache-2.0 and MIT obligations are
attribution-and-notice requirements discharged by the `NOTICE` section below travelling
with any copy. Each source continues to be governed by its own licence for anyone
extracting that source's contribution separately.

`consolidate_datasets.py`, the schema, and the normalization and matching logic are
project-authored and remain **MIT**.

Changes were made to source 3 material, as Apache 2.0 requires stating: generic names were
normalized and matched against the Bangladesh backbone, and only the resulting
generic-to-indication mapping was retained. Source 3's pricing and URL columns were
discarded.

## NOTICE — carry this with any redistribution

> This work incorporates data from:
>
> - *Medicinal Products in Bangladesh: A Dataset of Generic and Brand Names, Dosage
>   Strengths, and Manufacturers* by Md Mahmudur Rahman and Md M. Khan, University of
>   Dhaka, Mendeley Data V1, DOI 10.17632/zhtvkny53n.1, licensed under CC BY 4.0.
> - *Drug Pharma New Dataset* by Shuvo Kumar Basak, Kaggle, licensed under the MIT License.
> - *Medicines Dataset* by drowsyng, Kaggle, licensed under the Apache License 2.0.
>   Modified: generic names normalized and mapped to the Bangladesh backbone; pricing and
>   URL fields removed.
> - *Assorted Medicine Dataset of Bangladesh* by Ahmed Shahriar Sakib, Kaggle, CC0 1.0.
> - *All medicine and drug price data (20k) Bangladesh* by toriqulstu, Kaggle, CC0 1.0.

## Provenance caveats that a licence does not resolve

Two caveats survive the licensing question and belong in any scientific use of this corpus.
They are limitations to disclose, not barriers to redistribution.

**Sources 1 and 3 are website scrapes.** Source 1's uploader states this directly, and
1,199 rows of its `generic.csv` carry `medex.com.bd` monograph links. Source 3 carries
8,002 rows of `www.netmeds.com` URLs. Both uploaders applied their chosen licence tags to
material they gathered from third-party sites rather than authored. The practical exposure
is low: what this corpus retains from them is short factual strings — a generic name and an
indication phrase such as "Hypertension" — and facts of that kind attract thin protection
at most. The original scraping may nonetheless have breached those sites' terms of use.
That is a matter between the uploaders and the site operators; it does not transfer to
downstream users of a published dataset, but it is why the corpus should not be described
as authoritative or officially sourced.

**Source 3 is Indian data used in a Bangladesh reference.** Netmeds serves the Indian
market. Its indication text was written for a different regulatory and clinical context,
and it reaches this corpus through generic-name matching. This is a validity problem, not a
legal one, and it is the stronger reason for caution: the `common_uses` column is search
metadata, carries a disclaimer on every row, and must not be presented or reused as
indication guidance.

## Deposit checklist

- [x] Licence recorded for all five sources.
- [x] Aggregate licence determined (CC BY 4.0) and compatibility with CC0 / Apache-2.0 /
      MIT stated.
- [x] `NOTICE` text prepared for redistribution.
- [x] Apache-2.0 statement-of-changes recorded.
- [ ] Carry the `NOTICE` into the deposit metadata, not only into this file.
- [ ] Confirm the deposited README repeats the `common_uses` limitation, so a downstream
      user cannot reach the column without meeting the caveat.
