# AI and OCR trust boundaries

Medora separates local OCR/speech processing from external document, text, and live-
audio providers. The core backend authenticates the actor, applies role/ownership or
care-relationship rules, and requires a matching purpose-specific grant before any
external call.

## Text generation

`backend/app/services/ai_orchestrator.py` supports a deterministic mock and configured
hosted providers. Hosted calls require an active `external_text_ai` grant for the
named provider and scopes. Structured input is recursively sanitized using bilingual
redaction from `backend/app/core/ai_privacy.py`; request headers carry a random
correlation ID, never a stable subject token. Pydantic validates structured output.

Redaction covers known patient/clinician fields and common email, telephone, address,
national/passport ID, account, and date patterns. It reduces disclosure but cannot
guarantee anonymity or remove unknown and indirect identifiers.

Generated patient summaries are read-only. Every item carries source type, record ID,
timestamp, and conflict/missing state. The model cannot write the summary back.
Specialty search is navigation-only, and deterministic emergency rules run before a
model request.

## Document images

`ai_service/` exposes local and cloud modes. Local PaddleOCR/YOLO processing does not
require external consent and never escalates to Azure. Cloud mode requires an active
`cloud_document_ocr` grant. Where reliable regions exist, Medora crops locally before
the provider call. All output includes mode, provider, confidence, review warnings,
and `authoritative_writeback=false`; a person must explicitly verify it.

## Audio

Local faster-whisper does not require external-processing consent. Vapi is a distinct
external boundary and requires `external_live_audio` consent before capture and again
when Medora processes callbacks. Local mode never becomes Vapi mode automatically.

## Logs and reproducibility

Raw prompts, transcripts, OCR text, findings, and subject tokens are disabled in logs
by default. Operational logs contain sanitized event metadata, duration, provider,
random correlation ID, and error category. The versioned provider manifest records
the exact model/API/region/timeout/retry/retention assumptions for each frozen run.
