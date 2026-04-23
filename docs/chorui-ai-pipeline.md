# Chorui AI Pipeline

> For the full AI system architecture including OCR, see [architecture/ai-system.md](./architecture/ai-system.md).
> For end-to-end AI flows, see [workflows/ai-flows.md](./workflows/ai-flows.md).

---

## What Chorui Is

Chorui is Medora's role-aware conversational assistant embedded in patient and doctor dashboards. Its primary function is **intent detection + frontend navigation**. Secondarily it supports clinical queries and patient data summaries for doctors.

**Core principle:** assistive intelligence only. Chorui does not diagnose, prescribe, or issue autonomous clinical decisions.

---

## Architecture (Current)

### Frontend
- Patient page: `frontend/app/(home)/patient/chorui-ai/page.tsx`
- Doctor page: `frontend/app/(home)/doctor/chorui-ai/page.tsx`
- Chat UI: `frontend/components/ai/` (Chorui components)

### Backend
- Routes: `backend/app/routes/ai_consultation.py`
  - `POST /ai/chorui/assistant` — main assistant message
  - `GET /ai/chorui/conversations` — list threads
  - `GET /ai/chorui/conversations/{id}` — full history
  - `DELETE /ai/chorui/conversations/{id}` — delete thread
  - `POST /ai/chorui/intake/save` — save structured intake

- Intent normalization: `backend/app/services/chorui_intent_normalizer.py`
- Navigation engine: `backend/app/services/chorui_navigation_engine.py`
- Route registry: `backend/app/services/chorui_navigation_registry.py`
- Access auditing: `backend/app/routes/patient_access.py`

### Data
- `chorui_chat_messages` — conversation history with `conversation_id`, `user_id`, `patient_id`, `sender`, `role_context`, `intent`, `structured_data`, `context_mode`, `ip`, `ua`
- `ai_interactions` — LLM call audit log (sanitized input, validated output, latency, provider)

---

## Request Lifecycle

```
POST /ai/chorui/assistant
  Body: { message, conversation_id, role_context: "patient" | "doctor", patient_id? }

1. get_current_user_token() → verify JWT → load Profile

2. For doctor-patient context:
   check_doctor_patient_access(doctor_id, patient_id)
     └─ Validates appointment or consultation relationship
     └─ Logs view_ai_query to patient_access table

3. Load conversation history from chorui_chat_messages WHERE conversation_id = ?

4. Assemble role-aware context (PII-filtered, consent-gated):
   - Patient mode: own appointments, prescriptions, conditions, allergies
   - Doctor mode: target patient data filtered by patient consent

5. normalize_chorui_navigation_intent(message)
   └─ Returns canonical_intent string

6. resolve_chorui_navigation_engine(intent, role, params)
   └─ Registry lookup → ChoruiNavigationEngineResult:
      { action, route, confidence, missing_params, suggestions }

7. Persist user + assistant turns to chorui_chat_messages

8. Return ChoruiAssistantResponse:
   { reply, action, route, conversation_id, structured_data, context_mode }
```

---

## Navigation Registry

The registry (`chorui_navigation_registry.py`) is an immutable tuple of typed entries. Each entry:

```python
ChoruiRouteRegistryEntry(
    canonical_intent = "appointments",
    role = "patient",            # "patient" | "doctor" | "shared"
    route = "/patient/appointments",
    requires_params = [],        # e.g. ["patient_id"] for dynamic routes
    fallback_route = None,       # safe fallback if params missing
    enabled = True,
)
```

**Governance (enforced in code):**
- Admin routes are never registered
- Each intent maps to one enabled entry per role scope
- Dynamic intents must declare `requires_params` and `fallback_route`

**Patient intents:** `go_home`, `find_doctor`, `appointments`, `medical_history`, `prescriptions`, `chorui_ai`, `find_medicine`, `privacy`, `profile`, `reminders`, `analytics`, `notifications`, `appointment_detail`, `doctor_detail`

**Doctor intents:** `go_home`, `patients`, `appointments`, `schedule`, `analytics`, `chorui_ai`, `find_medicine`, `profile`, `patient_detail` (dynamic), `patient_consultation` (dynamic)

---

## Security & Safety Controls

| Control | Where |
|---|---|
| Role-scoped context resolution | ai_consultation.py |
| Doctor-patient access validation | patient_access.py |
| Patient consent filtering | data_sharing_guard.py |
| PII sanitization before LLM | ai_orchestrator._sanitize_*() |
| No autonomous diagnosis/prescribing | System prompt guardrails |
| Conversation ownership validation | conversation_id scoped to user_id |
| Access audit logging | patient_access table |
| AI input audit log | ai_interactions table (sanitized) |

---

## Configuration (backend/app/core/config.py)

| Setting | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | LLM provider: groq / gemini / cerebras |
| `AI_PROVIDER_TIMEOUT_SECONDS` | `30` | Per-call timeout |
| `AI_PROVIDER_MAX_RETRIES` | `2` | Retry count on provider failure |
| `CHORUI_ACTIVE_PATIENT_LOOKBACK_DAYS` | `180` | Window for active patient list |
| `PRELOAD_WHISPER_ON_STARTUP` | `true` | Pre-load ASR model at startup |

---

## Current Status

**Implemented:**
- Unified assistant routes with role-aware context
- Intent normalization + navigation engine + registry
- Doctor AI query audit and patient-facing access history
- Consent-gated data filtering for all AI features
- Persistent conversation history in database
- Safety guardrails for clinical autonomy
- Conversation ownership security
- Full AI interaction audit trail

**Endpoints remain stable** — `patient-summary`, `clinical-info`, `voice-to-notes`, `prescription-explainer` all active alongside Chorui assistant.
