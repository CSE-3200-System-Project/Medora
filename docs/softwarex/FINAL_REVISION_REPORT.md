# SoftwareX revision readiness report

Checked 29 September 2026 for SOFTX-D-26-01036. The full 32-item reviewer map is
in `response_to_revision.md`. This report concerns SoftwareX only; competition
work is reused where relevant but no new competition task is requested.

## Paper and evidence now represented

The two working TeX entry points use the teacher-revised submission as their
baseline and preserve four authors and CRediT, six figures, twelve tables,
historical results and newer bounded SoftwareX-relevant evidence. Figure 4
shows authentic English/Bengali interface context, not an isolated score crop.
The old clinical-style health score is now a transparent stored-record-coverage
measure. Privacy, navigation, booking, consent-scope and detector results are
separated by data population and by archival versus fresh execution; no
clinical-effectiveness or current national-register claim is made.

The historical deployed medicine database had 7,389 drugs and 67,001 brands.
The separate **public S4/S5 reconstruction** has 44,226 rows, 4,994 drug
identities, 49,220 search terms and 45,135 source-row links. All released rows
and field attributions were checked against hashed raw inputs. S4's local file
was byte-matched to the Kaggle version-1 archive and its publisher MIT
declaration is documented; S5's publisher CC BY 4.0 licence, authors and DOI
are documented. S1/S2 contributions are not in the selected public output.
The new reconstruction is not a retrospective repair of the old CSV's lineage
and the shared production database has not been reseeded.

A qualified physician's author-supplied note records four candidate sources
and approximately 100 targeted identity checks, with most mappings appearing
reasonable and duplicates/missing strengths noted. This is neither a random
sample accuracy estimate nor whole-corpus clinical certification. The public
summary does not identify the physician.

The authors report verbal research-use consent for original prescription
images, processing in a private Roboflow workspace and otherwise local file
storage, with no image-file upload to Colab or public Google Drive. Images
remain private and are excluded from the capsule/archive. No formal
institutional ethics review was obtained; supervisor reassurance is not called
committee approval or exemption. Approved derived detector weights are
documented with PT/ONNX hashes, corrected sanitized training recipe and
AGPL/corresponding-source terms; no OCR/detector accuracy unsupported by a
gold-standard test is claimed.

The capsule has a headless source/input preflight, 26 focused fixture tests,
archived-observation verification, current mock/rule safety scoring and 90
fresh-slot native PostgreSQL 16 booking trials. Selected profiles run exact
S4/S5 medicine reconstruction and approved detector diagnostics; a separate
MuRIL profile can rerun the six reported privacy rows if its exact inference
assets are approved for publication. Historical hosted-provider consent
aggregates remain archival because paired outputs are unavailable; the capsule
does not claim a fresh live-provider evaluation. The Linux local run is a
preparation check, not a Code Ocean platform receipt.

## Reviewer closure map

| Reviewer | Revision response | Still needed for final submission |
| --- | --- | --- |
| 1 | Claim limits, privacy/navigation statistics, physician-scoped medicine evidence, detector provenance, dashboard redesign, threat/ethics wording, booking protocol, authentic figures | Author approval, exact release, final Code Ocean run and artifact binding |
| 2 | Figure readability, bounded legal/interoperability discussion, consent-enforcement details, DOI/reference fixes | Final author/editorial approval; no unclaimed FHIR conformance implementation |
| 3 | Quantitative fixture/component results, uncertainty, residual-risk wording, literature, S4/S5 provenance, bounded reproducibility | Final platform run/citation, identical release identity and response page references |

## Remaining sequence

1. Authors approve the final wording and figures, obtain a reader-accessible
   Code Ocean capsule/version and reserve the **new** Zenodo DOI. No more
   source-permission emails, doctor rows, prescription-image upload or optional
   216-case review study are required for the selected limited claims.
2. Freeze the v1.0.3 candidate, run exact-source tests, upload and execute the
   capsule, then validate its downloaded output manifest. If inputs or
   environment change, rerun it on the new candidate.
3. Publish the matching GitHub tag/release and Zenodo version; download the
   deposited archive and verify tag, commit, DOI, file hashes and capsule
   linkage. The existing v1.0.2 archive is immutable and is **not** reused as
   the new release.
4. Compile/check the final PDF, insert the actual links, update response page
   references and upload the Overleaf/submission package.

See `FINAL_HUMAN_GATES.md` for the exact author/platform handoff. The journal,
not the repository checks, decides whether the response closes conditional
acceptance.
