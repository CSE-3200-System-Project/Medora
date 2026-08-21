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

Every call also passes through Arohon (`backend/app/core/arohon.py`). The endpoint's
declared tier is capped by the deterministic risk class, and the resolved tier, risk
class, ceiling decision, and correlation ID are written to `ai_interactions`. Candidate
provider/model identities additionally require a current passing Maya report; the
already-shipped identities are explicitly grandfathered incumbents, not claimed Maya
results.

Redaction covers known patient/clinician fields and common email, telephone, address,
national/passport ID, account, and date patterns. It reduces disclosure but cannot
guarantee anonymity or remove unknown and indirect identifiers.

`PHI_NER_ENABLED` optionally adds a local ONNX token-classification pass before those
rules. The deployed result is the union: either system may redact a span. The flag is off
by default and no model weights ship yet; missing/corrupt artifacts preserve the rules
baseline. `tools/phi_ner/` contains the reproducible 12,000-row corpus generator, training
and licence gates, and rules/model/union evaluator.

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

The Maya harness in `experiments/maya/` consumes recorded outputs rather than calling a
provider itself. It evaluates first-sentence escalation on seven clinician-reviewed red
flags, 28 benign controls, and a separate agency rubric for the one reviewed self-harm
case. The admission report is accepted only when the retained response files and gate datasets
still match their hashes and the runtime can re-derive every population, score, paired delta, and
gate check. No tuned-model result is present until those response files and the corpus licence
review exist.
