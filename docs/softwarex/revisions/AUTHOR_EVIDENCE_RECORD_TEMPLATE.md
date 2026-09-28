# SoftwareX author evidence record (template)

Complete only the rows relevant to claims retained in the revised paper. Keep signed
consent forms, patient records, credentials, and private source-account exports in the
authors' controlled storage; do not commit them here. Commit an approved, de-identified
summary and stable hashes/links only.

## Medicine-reference content review

This records the scope of the reported qualified-doctor review. It does not grant source
redistribution rights and does not, by itself, establish regulator concordance.

- Review date:
- Reviewer role/qualification (publicly safe description; reviewer identity may be held
  separately with permission):
- Review method and whether review was independent/blinded:
- Exact consolidated CSV SHA-256 and row count reviewed:
- Exact input sources/versions and retrieval dates reviewed:
- Fields, records, sample size, and coverage checked:
- Source-credibility check versus row-content validation (state which):
- Discrepancies found, how resolved, and unresolved limitations:
- Bounded conclusion that the paper may state:
- Reviewer confirmation/attestation location (controlled storage; do not include signature
  image unless authorized):

## Source rights and provenance decision

For each source actually present in the consolidated corpus, record the evidence separately
from the clinical-content review.

| Source and exact version | Retrieval date + file hash | Upstream source / terms checked | Permission or licence evidence and attribution | Public redistribution decision | Reviewer/authority + date |
| --- | --- | --- | --- | --- | --- |
| MedEx-derived source | | | | pending / cleared / excluded | |
| MedEasy-derived source | | | | pending / cleared / excluded | |
| Netmeds-derived source | | | | pending / cleared / excluded | |
| Claimed DGDA source | | | | pending / cleared / excluded | |
| Mendeley Data | | | | pending / cleared / excluded | |
| OpenDataBay lineage, if actually used | | | | pending / cleared / excluded | |
| Other source (name it) | | | | pending / cleared / excluded | |

Do not use a Kaggle uploader's licence label as the sole evidence that upstream site
content can be republished. A doctor can confirm content within the review scope; source
terms/permissions require separate author or institutional confirmation.

## Prescription detector source, consent, and distribution decision

- Original public Roboflow project URL and exact version:
- Author workspace project/version and export metadata (retain private export in controlled
  storage; publish only an approved summary):
- Evidence establishing lineage between those versions:
- Dataset licence/terms for the exact version, attribution, and any restrictions:
- Friend/family contribution count, consent scope (research, training, publication, public
  redistribution), and de-identification process:
- Ethics/institutional determination, authority, date, reference, and scope:
- Training/validation/test split and whether any test examples informed model selection:
- ONNX SHA-256, embedded licence, and decision: `include` / `exclude`:
- If excluded, confirm the manuscript and release no longer imply that the detector is
  distributed or its accuracy is established:

## SoftwareX bilingual privacy-evaluation evidence

The generated candidate is synthetic and provisional. Do not call it independently
validated until the following evidence is complete.

- Candidate dataset path/version and SHA-256 reviewed:
- Independent reviewer A role/language competence and annotation date:
- Independent reviewer B role/language competence and annotation date:
- Confirmation both annotators were blinded to system outputs and each other's labels:
- Exact-set agreement summary and validation errors:
- Adjudicator role/date and disagreement resolution reference:
- Any cases rewritten/replaced after language review; final case/span counts:
- Final adjudicated dataset SHA-256 (frozen before evaluation):
- Exact system/redactor version and source hash evaluated:
- Final run date/command and report hash:
- TP/FN by identifier class and language; benign-control false-redaction counts/rates:
- Confidence-interval method and unit of resampling (or reason no interval is justified):
- Confirmation no tuning/selection was performed against this final evaluation set:
- Bounded manuscript claim and synthetic-to-real limitation:

## Paper/release confirmation

- Claims retained that this evidence supports:
- Claims withdrawn or narrowed:
- Exact manuscript revision/commit:
- Public artifacts cleared for release (paths and hashes):
- Artifacts withheld (paths and reasons):
- Author completing record/date:
