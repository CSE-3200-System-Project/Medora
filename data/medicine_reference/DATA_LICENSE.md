# Medicine corpus licence and redistribution scope

The project code licence does not automatically cover the third-party medicine data in
this directory.

**Current distributed CSV (cleared 28-29 September 2026).** `Final_Medicine_Dataset.csv`
is the `licensed-public` reconstruction: 44,226 rows from S4 (publisher-declared MIT) and
S5 (CC BY 4.0) only, SHA-256
`9dcf59f339679f3b0f7256e3cfd76ffc0839601511fbc16255c4c3d54ee9cf66`. No S1, S2 or S3
record, price or indication prose is included. The S4/S5 notices, attribution and changes
are in [PUBLIC_SOURCE_NOTICES.md](PUBLIC_SOURCE_NOTICES.md); the decision is in
`SOURCE_PERMISSION_RECORD.json`. This is a publisher-licence basis, not a legal opinion
or official DGDA authentication.

The sections below record the rights review of all five inventoried sources. Their holds
apply to any future build that reintroduces S1, S2 or S3, not to the distributed CSV.

## Source declarations and current evidence

The following records describe platform declarations and uploader statements. They do not
independently confirm that an uploader had authority to license material extracted from
another service.

| # | Source | Platform declaration | Current release status |
|---|---|---|---|
| 1 | *Assorted Medicine Dataset of Bangladesh* — ahmedshahriarsakib, Kaggle | CC0 1.0 | Uploader identifies MedEx scraping. MedEx terms restrict extraction/reuse absent permission; permission evidence is not in this repository. |
| 2 | *All medicine and drug price data (20k) Bangladesh* — toriqulstu, Kaggle | CC0 1.0 | Kaggle description identifies MedEasy; method, source snapshot and upstream permission are undocumented. |
| 3 | *Medicines Dataset* — drowsyng, Kaggle | Apache 2.0 | Uploader identifies Netmeds scraping. Netmeds terms restrict extraction/database reuse; permission evidence is not in this repository. |
| 4 | *Drug Pharma New Dataset* — shuvokumarbasak2030, Kaggle | MIT | Uploader asserts DGDA origin, but an official versioned export, row-level validation and upstream redistribution permission are undocumented. |
| 5 | *Medicinal Products in Bangladesh* — Rahman & Khan, Mendeley Data, DOI [10.17632/zhtvkny53n.1](https://doi.org/10.17632/zhtvkny53n.1) | CC BY 4.0 | Preserve attribution and changes; this does not establish rights for the other contributions. |

The supplied OpenDataBay listing identifies itself as derived from source 1 and is not an
independent source. The supplied prescription word-segment dataset is not an input to this
five-source corpus build and does not establish the detector's training-data rights.

## Consolidated corpus and source limitations

### Revision rebuild decision (28 September 2026)

The author selects multi-source public distribution **after documenting source
permissions**. The prepared v2 build uses identity fields from sources 1, 2, 4 and 5;
source 3 is inventoried but excluded. It emits no MedEx/Netmeds monograph or indication
prose and no prices. This reduces the distribution scope but does not manufacture
missing upstream authorization. See SOURCE_PERMISSION_RECORD.json and the request draft
in docs/softwarex/revisions/MEDICINE_PERMISSION_REQUEST.md. Netmeds permission is not a
task for this new output because no source-3 record or prose is emitted.

The separately prepared Mendeley-only alternative preserves its CC BY 4.0 attribution
and records changes; it is not the author's selected replacement. Do not label the full
multi-source candidate CC BY 4.0 solely because source 5 uses that licence.

The earlier historical snapshot combined contributions from all five sources and is no
longer the distributed CSV. For any such multi-source build, do not assume that labelling
the aggregate CC BY 4.0 clears each contribution: source-level terms and
rights may impose separate conditions, and a platform licence label is not proof of
permission from a scraped-site operator. Resolve upstream permission before redistribution.

The MedEx and Netmeds lineages require specific author/institution review and any required
permission before their derived records are included in a public artifact. Source 2's exact
collection method/upstream permission and source 4's claimed DGDA provenance also need
documentary confirmation. Preserve the Mendeley attribution and record changes for source 5.

Source 3 is Indian pharmacy data used in a Bangladesh reference. Its indication text is not
Bangladesh regulatory validation. Keep `common_uses` described as non-authoritative search
metadata, not treatment or indication advice.

`consolidate_datasets.py`, the schema, and project-authored normalization/matching logic
remain project code under the root code licence. That does not license the source-derived
records.

## Evidence required before distribution

- Archive exact source versions, URLs, retrieval dates, file lists and SHA-256 hashes.
- Preserve source-page licence/terms snapshots, attribution/change notices, and permission
  correspondence; obtain institutional/legal review where needed.
- Confirm the distribution decision for the consolidated CSV and any source-derived data in
  the Code Ocean capsule/archive.
- Keep any medicine-domain review record separate: a qualified doctor's review may support
  content-validity claims only to the extent its date, qualification/role, dataset versions,
  fields, sample/coverage, method, discrepancies and conclusions are documented. It does
  not by itself establish upstream redistribution rights.
