# SoftwareX revision: final author and platform gates

This handoff is only for SOFTX-D-26-01036. No BCOLBD work, 216-case privacy
study, two-reviewer study, whole-corpus physician audit, or public release of
prescription images is required for the limited claims in the revised paper.

## Prepared in the repository

- The teacher-first manuscript and companion Overleaf source agree; four authors,
  six figures, twelve tables, authentic bilingual UI captures and the bounded
  experimental results are retained. The unchanged original submission is in
  `submission-history/`.
- The public medicine reconstruction uses only S4 Kaggle version 1 (publisher-
  declared MIT) and S5 Mendeley version 1 (CC BY 4.0). It has **44,226 rows,
  4,994 drug identities, 49,220 search terms and 45,135 source-row links**.
  Raw S4 bytes were matched to the publisher's version-1 archive. The selected
  build and field/row lineage passed structural verification. S1/S2 contributions
  were excluded by rebuilding from the two selected inputs, not by relabeling
  merged records. See `revisions/PUBLIC_CORPUS_RELEASE_BASIS.md` and
  `data/medicine_reference/PUBLIC_SOURCE_NOTICES.md`. No permission email is
  needed for this selected publisher-licence profile.
- The physician's approximately 100 targeted source/identity checks are recorded
  without their identity. They are not a row-by-row accuracy certificate.
- The authors report verbal research-use image consent, private Roboflow
  processing, otherwise local original files, and no image-file upload to Colab
  or public Google Drive. Images and identifiable exports remain private. **No
  formal institutional ethics review was obtained**; no approval or exemption
  number is asserted. The recorded author/institution decision permits derived
  detector weights, accompanied by AGPL/corresponding-source notices.
- The capsule runner checks source/data hashes before execution, reruns current
  fixture safety and fresh isolated PostgreSQL booking trials, and has optional
  approved detector and licensed-public medicine profiles. It distinguishes
  archived hosted-provider results from rerun evidence. No live keys or private
  images are needed. See `CODE_OCEAN_CAPSULE.md` and
  `CAPSULE_RESULT_COVERAGE.md`.
- The production/shared Supabase medicine tables were not reseeded: deployed
  historical counts in the paper are deliberately separate from the new public
  reconstruction. Do not use the destructive seed writer against that database.

## What authors must do

1. Approve the exact public wording on the limited physician review, absence of
   formal ethics review, private-image handling, and S4/S5 publisher-licence
   selection. Inspect the final compiled figure framing and four-author CRediT.
   If the editor requests an institutional policy determination, provide an
   actual authorized one; do not invent it.
2. In the author-owned Code Ocean account, upload the final commit-bound bundle
   using `CODE_OCEAN_CAPSULE.md`, configure its supported environment, and run
   **Reproducible Run**. Return the reader-accessible capsule/version URL, run ID,
   downloaded `/results` manifest and outputs (and DOI if one is minted).
3. Reserve/publish a new Zenodo version DOI under concept DOI
   `10.5281/zenodo.21844459`; do not reuse v1.0.2 DOI
   `10.5281/zenodo.21846125`. Push the same GitHub source tag and have the exact
   released archive downloaded back for the identity/hash check. GitHub/Zenodo
   credentials remain with the authors.
4. Approve and submit the final compiled manuscript and point-by-point response
   after their actual capsule and archive links/page references are inserted.

## Agent actions after those identifiers are supplied

Bind the real capsule/version and reserved Zenodo DOI to the v1.0.3 candidate;
rerun the full release gate and package from the immutable tag; record the Code
Ocean and downloaded-Zenodo receipts; rebuild the Overleaf upload ZIP; and check
all paper/response citations and pages. A source or environment change after the
capsule run requires a new run. An old capsule URL, DOI, or synthetic result must
not be presented as the final platform receipt.
