# Data governance and processing boundaries

## Purpose-specific consent

Medora denies external processing unless an active, versioned grant matches the
subject, purpose, recipient/provider, requested scopes, policy version, and
validity window. The purposes are `clinical_sharing`, `external_text_ai`,
`cloud_document_ocr`, `external_live_audio`, and `research_export`. A grant records
creation, grant, expiry, revocation, actor, and audit metadata. Legacy booleans are
migrated only to their narrow existing meaning.

Revocation blocks later requests. It cannot recall material a recipient already
received; the interface and API state this limitation.

## Trust boundaries

- Paddle/YOLO OCR and faster-whisper run locally and need no external-processing grant.
- Azure document OCR requires `cloud_document_ocr` consent.
- Hosted text models require `external_text_ai` consent for the selected provider.
- Vapi requires `external_live_audio` consent before capture and on callback.
- Local mode does not fall back to cloud. Images are cropped locally before cloud
  OCR when a reliable prescription region is available.

Structured bilingual redaction covers configured names and addresses plus common
email, telephone, national/passport ID, account, and date patterns in Bengali and
Latin digits. Random correlation identifiers replace stable subject headers.
No redactor can recognize every unknown identifier or infer all indirect identity;
the curated privacy benchmark reports this residual risk instead of claiming anonymity.

## Retention and logs

Raw OCR text, transcripts, prompts, findings, and subject tokens are not logged by
default. Operational events contain a random request ID, provider, duration, result
category, and sanitized error class. Provider retention and regional processing are
external assumptions recorded per benchmark execution, not guaranteed by Medora.

The browser service worker caches versioned static/public assets only. Health-data
writes are never queued for background synchronization. Logout deletes Medora Cache
Storage, IndexedDB, session storage, and sensitive local-storage keys.

## Human authority

OCR is an unconfirmed draft until a person explicitly verifies it. Generated
summaries are read-only, cite source type/record/timestamp, expose conflicts and
missing evidence, and cannot write back automatically. Prescription acknowledgment
means receipt only, never clinical approval. Specialty search is navigation, not
diagnosis or triage; deterministic red flags direct users to emergency care before
any model call.

