# AI System Architecture

Medora's AI layer has two distinct components:

1. **AI Orchestration Layer** — embedded in the main FastAPI backend. Handles all LLM calls (Groq/Gemini/Cerebras), the Chorui conversational assistant, voice transcription, and AI-assisted clinical features.
2. **OCR Microservice** — a separate FastAPI service (`ai_service/`) for prescription and medical report document intelligence.

---

## Part 1 — AI Orchestration Layer

### Location
`backend/app/services/ai_orchestrator.py` (core)
`backend/app/routes/ai_consultation.py` (endpoints)
`backend/app/services/chorui_*.py` (Chorui subsystem)

---

### Provider Abstraction (`ai_orchestrator.py`)

A single `AIOrchestrator` singleton handles all LLM calls. The provider is selected at startup from `settings.AI_PROVIDER` and never changes at runtime.

**Supported providers:** `groq`, `gemini`, `cerebras` (and any OpenAI-compatible endpoint).

Each call goes through the same pipeline:

```
Input data (dict or string)
  │
  ▼
_sanitize_structured_input()
  ├─ Recursively walks payload
  ├─ Strips PII keys (name, email, phone, nid, address, dob, etc.)
  ├─ Redacts emails, phone numbers (regex)
  ├─ Redacts name patterns ("Patient: <name>")
  └─ Hashes identifier tokens via anonymize_identifier_text()
  │
  ▼
_call_llm_json()
  ├─ Builds system + user prompt
  ├─ Forces JSON response mode
  ├─ Calls provider API with timeout + retry (settings.AI_PROVIDER_MAX_RETRIES)
  └─ Returns raw JSON string
  │
  ▼
Pydantic validation against output schema
  ├─ Success → validated_output
  └─ Failure → AIValidationError (logged, re-raised)
  │
  ▼
AIExecutionResult (stored in ai_interactions table)
  ├─ feature, prompt_version
  ├─ sanitized_input (PII-free)
  ├─ raw_output, validated_output
  ├─ validation_status ("ok" | "failed")
  ├─ latency_ms
  └─ provider
```

### AI Features (Orchestrator Methods)

| Method | Input | Output Schema | Use Case |
|---|---|---|---|
| `generate_patient_summary` | Structured patient data dict | `PatientSummaryOutput` | Doctor views patient before consultation |
| `structure_intake` | Raw symptom/complaint text | `StructuredIntakeOutput` | Chorui structures a patient's chief complaint |
| `generate_soap_notes` | Voice transcript string | `SOAPNotesOutput` | Doctor voice-to-SOAP conversion |
| `clinical_info_query` | Clinical question string | `ClinicalInfoOutput` | Doctor asks clinical reference question |
| `prescription_suggestions` | Patient + clinical context | `PrescriptionSuggestionsOutput` | AI-assisted prescription drafting |

### PII Handling

`ai_privacy.py` provides:
- `anonymize_identifier_text(text, token_namespace)` — replaces known identifier patterns with stable hashed tokens (e.g., `[anon:patient:a3f7b2]`)
- `pick_subject_token(user_id)` — stable pseudonymous token for the subject, used in OCR audit logs
- `_is_pii_key(key)` — checks field names against a keyword list (`name`, `email`, `phone`, `nid`, `address`, `dob`, `patient`, `doctor`, etc.)

**Nothing with a PII field name is ever sent to an AI provider.** All fields are replaced with `[redacted-<type>]` before the prompt is assembled.

### Consent Guard (`data_sharing_guard.py`)

Before building AI context for a doctor querying a patient, the guard:
1. Reads `health_data_consents` and `patient_data_sharing` for the target patient.
2. Filters the data dict to only include fields the patient has consented to share.
3. Prepends an `AI_RESTRICTION_NOTICE` to the AI prompt if certain fields were removed.

---

### Chorui Conversational Assistant

Chorui is a role-aware AI assistant embedded in both patient and doctor dashboards. Its primary function is **intent detection + frontend navigation**, with secondary support for clinical lookups.

#### Components

| File | Role |
|---|---|
| `chorui_intent_normalizer.py` | Maps raw user utterance → canonical intent string |
| `chorui_navigation_registry.py` | Immutable registry of `(intent, role, route, required_params)` tuples |
| `chorui_navigation_engine.py` | Resolves intent + role + params → `ChoruiNavigationEngineResult` |
| `ai_consultation.py` (routes) | HTTP endpoints for assistant interaction |
| `chorui_chat_messages` (DB) | Conversation history persistence |

#### Intent → Navigation Flow

```
User message → POST /ai/chorui/assistant
  │
  ├─ Load conversation history (last N messages from chorui_chat_messages)
  ├─ Assemble role-aware context (patient self-data or doctor-patient data)
  │     └─ data_sharing_guard filters what's visible to AI
  │
  ▼
chorui_intent_normalizer.normalize_chorui_navigation_intent(message)
  └─ Returns: canonical_intent (e.g. "appointments", "find_doctor", "patient_summary")
  │
  ▼
chorui_navigation_engine.resolve_chorui_navigation_engine(intent, role, params)
  ├─ Looks up intent in _CHORUI_ROUTE_REGISTRY
  ├─ Checks required_params → if missing: action="clarify", missing_params=[...]
  ├─ Checks role scope (patient vs doctor)
  ├─ Returns ChoruiNavigationEngineResult:
  │     action: "navigate" | "clarify" | "suggest" | "undo" | "none"
  │     route: "/patient/appointments" (or None if clarification needed)
  │     confidence: float
  │     missing_params: list
  │     suggestions: list of fallback routes
  │     fallback: ChoruiNavigationEngineFallback
  │
  ▼
If action == "navigate" → return route to frontend
If action == "clarify"  → ask user for missing_params
If action == "suggest"  → show suggestions list
```

#### Navigation Registry

The registry (`chorui_navigation_registry.py`) is a static tuple of `ChoruiRouteRegistryEntry` objects. Each entry has:
- `canonical_intent` — unique string key
- `role` — `"patient"`, `"doctor"`, or `"shared"`
- `route` — frontend path (may contain `{id}` placeholders for dynamic routes)
- `requires_params` — list of param names needed to resolve dynamic routes
- `fallback_route` — safe fallback if params are missing
- `enabled` — boolean gate

**Governance rules (enforced by code):**
- Admin routes are never registered
- Each intent maps to one enabled entry per role scope
- Dynamic intents must declare `requires_params` and a `fallback_route`

#### Patient intent examples:
`go_home`, `find_doctor`, `appointments`, `medical_history`, `prescriptions`, `chorui_ai`, `find_medicine`, `privacy`, `profile`, `reminders`, `analytics`, `notifications`

#### Doctor intent examples:
`go_home`, `patients`, `appointments`, `schedule`, `analytics`, `chorui_ai`, `patient_detail` (dynamic: requires `patient_id`)

#### Chorui API Endpoints (`/ai/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/ai/chorui/assistant` | POST | Main assistant message + navigation resolution |
| `/ai/chorui/conversations` | GET | List conversation threads |
| `/ai/chorui/conversations/{id}` | GET | Full conversation history |
| `/ai/chorui/conversations/{id}` | DELETE | Delete conversation |
| `/ai/chorui/intake/save` | POST | Save structured intake from Chorui |
| `/ai/patient-summary` | GET | Patient summary for doctor |
| `/ai/patient-summary-patient-view` | GET | Simplified summary for patient |
| `/ai/clinical-info` | POST | Clinical reference query |
| `/ai/normalize/voice` | POST | Voice → text (Faster-Whisper ASR) |
| `/ai/voice-to-notes` | POST | Voice transcript → SOAP notes |
| `/ai/prescription-explainer` | GET | Explain a prescription to patient |
| `/ai/search` | POST | AI doctor search (specialty extraction + ranking) |

---

### Voice Transcription (`asr.py`)

Uses **Faster-Whisper** (quantized CTranslate2 model) running locally.

- Model is preloaded on startup (`PRELOAD_WHISPER_ON_STARTUP=true`)
- `POST /ai/normalize/voice` accepts audio file upload → returns transcript text
- `POST /ai/voice-to-notes` accepts transcript or audio → returns structured SOAP notes via orchestrator

---

## Part 2 — OCR Microservice (`ai_service/`)

A standalone FastAPI service for document intelligence. Deployed independently of the main backend.

**Entry point:** `ai_service/app/main.py`

### Endpoints

#### `POST /ocr/prescription`
Extracts medications from a prescription image or PDF.

**Input** (one of):
- `file` — multipart file upload
- `image_url` — URL to download
- `image_file` — base64-encoded image

**Pipeline:**
```
Input bytes
  │
  ▼
input_normalization.normalize_input_to_image_bytes()
  └─ PDF → image conversion, format validation, size limit enforcement
  │
  ▼
OCRPipeline.run() — selects pipeline by settings.MODEL_TYPE:
  ├─ "read"   → Azure Document Intelligence read API
  ├─ "custom" → YOLO detection + Azure/Paddle OCR on crops
  └─ "llm"    → LLM-based extraction (experimental)
  │
  ▼ (for "custom" pipeline)
yolo.detect_regions()
  └─ YOLO model detects table/text regions → list of BoundingBox crops
  │
  ▼
azure_ocr.AzureReadClient.read_lines()  (primary)
  └─ Fallback: PaddleOCR PP-OCRv4-mobile
  │
  ▼
parser.parse_prescription()
  └─ Extracts medication entries from OCR lines:
     medicine_name, dosage, frequency, meal_instruction, duration
  │
  ▼
matcher.match_medicines()
  └─ RapidFuzz fuzzy matching against brands/generics in Supabase DB
     Threshold: configurable, returns best-match brand + drug
  │
  ▼
OCRResponse {
  medications: [...],
  raw_text: "...",
  meta: { model, processing_time_ms, detected_regions, ocr_line_count,
          yolo_avg_confidence, ocr_avg_confidence, medicine_vocab_size }
}
```

**Debug mode** (`?debug=true`): returns internal YOLO region crops and raw OCR lines alongside the parsed result.

#### `POST /ocr/medical-report`
Extracts structured lab test results from a medical report image/PDF.

**Pipeline:**
```
Input bytes → normalize_input_to_image_bytes()
  │
  ▼
Primary: AzureReadClient.read_lines_and_tables()
  └─ Returns OCR lines + table cells (for structured reports)
  │
  Fallback (Azure fails):
  └─ PaddleOCR PP-OCRv4-mobile → OCR lines only
  │
  ▼
report_parser.parse_medical_report(ocr_lines, tables)
  └─ Parses structured test results:
     test_name, value, unit, reference_range
  │
  ▼
ReportOCRResponse {
  tests: [{ test_name, value, unit, reference_range }],
  raw_text: "...",
  meta: { model, processing_time_ms, ocr_engine, line_count, tests_extracted }
}
```

#### `GET /health`
Returns: `{ status, service, model_type, disable_medicine_matching, yolo_model_path }`

### Configuration (`ai_service/app/config.py`)

Key settings:
- `MODEL_TYPE` — `read`, `custom`, or `llm`
- `YOLO_MODEL_PATH` — path to YOLO weights file
- `DISABLE_MEDICINE_MATCHING` — skips fuzzy DB lookup if true
- `AZURE_OCR_TIMEOUT_SECONDS` — timeout for Azure calls
- `OCR_MAX_UPLOAD_BYTES` — max input size (enforced before pipeline)
- `OCR_LOG_FULL_TEXT` / `OCR_LOG_MAX_CHARS` — controls log verbosity

### Privacy in OCR

Each OCR request accepts an `X-Medora-Subject-Token` header (or `subject_token` in body). This pseudonymous token identifies the subject in logs without exposing the real user ID. Token is truncated to 80 chars.

---

## AI System Summary

| Concern | Implementation |
|---|---|
| Provider switching | `AI_PROVIDER` env var: groq / gemini / cerebras |
| PII before LLM | Regex redaction + field-name filtering in `ai_privacy.py` |
| Consent enforcement | `data_sharing_guard.py` filters patient data before AI context |
| Output correctness | Pydantic validation on every LLM response |
| Audit trail | Every call logged to `ai_interactions` table |
| Navigation intent | `chorui_intent_normalizer` → `chorui_navigation_engine` → frontend route |
| Conversation memory | `chorui_chat_messages` DB table, loaded per conversation_id |
| OCR (prescriptions) | YOLO + Azure Document Intelligence + RapidFuzz medicine matching |
| OCR (lab reports) | Azure Document Intelligence (tables) + PaddleOCR fallback |
| Voice ASR | Faster-Whisper (local), preloaded on startup |
| Admin routes in Chorui | Explicitly excluded from registry by governance rules |
