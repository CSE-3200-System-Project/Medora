# Public medicine corpus: source and licence basis

Checked 29 September 2026 for the SoftwareX revision. The authors authorize
excluding conflicting or unresolved inputs instead of waiting for new permission
emails. This note records publisher evidence and the selected release boundary;
it is not an institutional legal clearance or official-register authentication.

## Selected profile: S4 and S5 only

Use S4 plus S5 for the public identity-only reconstruction. Their publisher
licences provide a documented reuse basis; no contrary redistribution restriction
was established for these sources in this check. Do not require a new email merely
because a dataset has a public licence. Keep source-specific notices and make no
DGDA, contributor or physician endorsement claim.

| Source | Verified publisher record | Public reuse record |
| --- | --- | --- |
| S4 | *Drug Pharma New Dataset*, Shuvo Kumar Basak-4004.o (`shuvokumarbasak2030`), Kaggle dataset version 1, published 28 February 2025; licence declaration **MIT**. | Preserve the dataset title, uploader name, URL, version, verified local file hash and full MIT permission/disclaimer. Dataset origin in DGDA is **uploader-reported**, not independently authenticated. |
| S5 | *Medicinal Products in Bangladesh - A Dataset of Generic and Brand Names, Dosage Strengths, and Manufacturers*, Md Mahmudur Rahman and Md M KHAN (2024), Mendeley Data version 1, published 18 September 2024, DOI `10.17632/zhtvkny53n.1`; **Creative Commons Attribution 4.0 International (CC BY 4.0)**. | Credit both contributors, dataset title, version and DOI; link the CC BY 4.0 licence and describe the changes. No endorsement claim. |

Sources: [S4 publisher API](https://www.kaggle.com/api/v1/datasets/view/shuvokumarbasak2030/drug-pharma-new-dataset),
[S4 dataset page](https://www.kaggle.com/datasets/shuvokumarbasak2030/drug-pharma-new-dataset),
[MIT licence](https://opensource.org/license/mit),
[S5 publisher page](https://data.mendeley.com/datasets/zhtvkny53n/1),
[S5 DOI](https://doi.org/10.17632/zhtvkny53n.1),
[CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en).
The S5 licence and contributors were verified in both visible publisher text and
the publisher's structured metadata. MIT has no numbered licence version; the
**dataset**, not MIT itself, is version 1.

### S4 byte-level version linkage

The [Kaggle version-1 download](https://www.kaggle.com/api/v1/datasets/download/shuvokumarbasak2030/drug-pharma-new-dataset?datasetVersionNumber=1)
was fetched in memory on 29 September 2026. Its two entries
`dgda_drug_database_data/Drug_Database_5_Data Concatenation.csv` and
`dgda_drug_database_data/csv_all_drug_file/Drug_Database_5_Data Concatenation.csv`
both contain 5,371,449 bytes with SHA-256:

`81e3257da9e3735fefbb39ee0c12dbb516826e9b6dc4866d0d14e567acbc4613`.

This exactly matches the local S4 input recorded in the existing build manifest.
Its content can therefore be linked to Kaggle dataset version 1. The historical
date of the authors' original download is still unknown. No `LICENSE` or `NOTICE`
file was present in that downloaded archive: retain the verified publisher MIT
declaration, source attribution and MIT permission/disclaimer; do not invent an
original copyright year, copyright notice or upstream authorization letter.

The local S5 input is identified by SHA-256
`293036d5c24268c6526df4ae9ba59e3d80f40380b79bdf40859c83419b52a8fd`
and the Mendeley v1 citation in the existing manifest. This check reverified its
publisher licence; it did not independently redownload and compare S5 file bytes.

## Excluded inputs

- **S1:** uploader declares CC0, but explicitly scraped MedEx and [current MedEx
  terms](https://medex.com.bd/terms-of-use) contain distribution/extraction
  restrictions. Exclude S1 without declaring its factual fields unlawful or
  treating current terms as proof of the historical collection conditions.
- **S2:** uploader declares CC0, but exact origin and collection chain are not
  established; a description of MedEasy services does not verify row origin.
  Exclude S2 under the authors' conservative release choice, not because a fresh
  email is automatically required for every CC0 dataset.
- **S3:** remains excluded: Indian-market indication prose is outside this
  identity-only Bangladesh reference rebuild.
- **Private prescription images:** unrelated to medicine input rights; never
  include them in the public corpus, capsule or archive.

The S1/S2 exclusions remove their **contributions**, not just their names from a
combined CSV. Rebuild from S4/S5 inputs only; an identity may remain where it has
independent S4/S5 support. Do not retain a field solely populated from S1/S2 and
then relabel its provenance.

## Packaging and manuscript conditions

1. Include S4/S5 attribution, licence notices, raw-input hashes, deterministic
   reconstruction code, field/row provenance, quality/quarantine reports and a
   change notice: whitespace normalization, conservative identity
   deduplication/conflict handling, missing fields retained as unknown, and no
   copied prices or indication prose. Do not silently relicense third-party
   material under Medora's code licence.
2. Compute new counts from this profile. Distinguish these public-release counts
   from historical deployed/runtime counts and the earlier local multi-source
   candidate. Do not describe the old candidate as the new public dataset.
3. Validate that every emitted row and field contribution comes from S4/S5 and
   that the clean reconstruction reproduces all packaged output hashes.
4. Describe the corpus as an attributed medicine identity/search reference,
   not a verified current national registration list, therapeutic reference or
   clinical decision system. Physician review of a targeted sample does not
   establish complete row-level accuracy or confer redistribution rights.
5. Freeze the selected data assets and notices with the final source commit;
   reference that same version in Code Ocean, GitHub and the new Zenodo archive.

No new permission-email response is a dependency for this selected S4/S5 profile.
If new contradictory source evidence is received before publication, reassess
that specific input rather than treating this note as an unconditional guarantee.
