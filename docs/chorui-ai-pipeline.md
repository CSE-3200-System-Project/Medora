# Chorui AI Pipeline

## 1) Product Goal

Chorui AI is Medora's secure healthcare assistant for two role-scoped workflows:

- Patient mode: understands and summarizes the patient's own records.
- Doctor mode: supports active-patient workflows and patient-specific context when access is authorized.

Core principle: assistive intelligence only. Chorui does not perform autonomous diagnosis or prescribing.

## 2) High-Level Architecture

### Frontend

- Doctor page: `frontend/app/(home)/doctor/chorui-ai/page.tsx`
- Main chat UI: `frontend/components/ai/ChoruiChat.tsx`
- Chat state + API orchestration: `frontend/hooks/useChoruiChat.ts`
- Shared contracts/types: `frontend/types/ai.ts`

### Backend

- Primary route: `backend/app/routes/ai_consultation.py`

  - `POST /ai/assistant-chat`
  - `POST /ai/intake-structure` (compat path routed to same assistant behavior)
  - `POST /ai/intake/save`

- Access policy and auditing: `backend/app/routes/patient_access.py`

  - `GET /patient-access/my-ai-access-history`

- Runtime controls: `backend/app/core/config.py`

- Conversation persistence model: `backend/app/db/models/chorui_chat.py`

  - `chorui_chat_messages` table for patient and doctor chat turns

### Shared Data Sources

- `profiles` (`Profile`) for role and identity metadata.
- `patient_profiles` (`PatientProfile`) for conditions, meds, allergies, history.
- `appointments` (`Appointment`) for active and upcoming care relationships.
- `patient_access_logs` (`PatientAccessLog`) for transparency and compliance.
- `chorui_chat_messages` (`ChoruiChatMessage`) for conversation memory and follow-up intent continuity.

## 3) Request Lifecycle (Assistant Chat)

1. Frontend submits user message + role context + optional patient id.
2. Backend authenticates via bearer token (`get_current_user_token`).
3. Backend resolves role and context mode:

   - `patient-self`
   - `doctor-general`
   - `doctor-patient` (requires doctor-patient access check)

4. For doctor-patient context, access event is logged as `view_ai_query`.
5. Backend resolves/validates conversation ownership (`conversation_id`) and scope.
6. Backend classifies intent, and for short follow-ups can reuse the last non-general intent from DB history.
7. User turn is persisted to `chorui_chat_messages` with role context and intent metadata.
8. Authorized record data is transformed into response-safe summaries.
9. Safety guardrails block restricted autonomous-medical requests.
10. Assistant turn is persisted with structured payload metadata.
11. Response returns:

- natural-language reply
- conversation id for continuity
- structured data (`symptoms`, `conditions`, `duration`, `severity`)
- context mode for UI transparency

## 4) Persistent Chat-Memory Architecture

### Storage Model

- Table: `chorui_chat_messages`
- Persisted fields:

  - `conversation_id`
  - `user_id`
  - `patient_id` (nullable; populated for patient-self or doctor-patient context)
  - `role_context` (`patient`/`doctor`)
  - `sender` (`user`/`assistant`)
  - `message_text`
  - `intent`
  - `structured_data` (assistant-side metadata)
  - `context_mode`
  - request trace (`ip_address`, `user_agent`)
  - `created_at`

### Conversation Security Rules

- Conversation ownership is validated against `user_id`.
- If a provided `conversation_id` belongs to another user, access is denied.
- If role context or patient scope changes, server automatically rotates to a new conversation id.
- Doctor patient-context still requires access control checks before data retrieval.

### Context Robustness Rules

- Current turn is stored even when model flow later degrades.
- Short follow-up prompts can inherit previous intent for continuity.
- Recent intent topics can be surfaced in strict-local fallback guidance.

## 5) Current Intelligence Capabilities

### Patient-Self Queries

- Medications
- Conditions
- Allergies
- Risk flags
- Surgeries/hospitalization history
- Upcoming appointments
- Full record snapshot summary

### Doctor Queries

- Active patient list (time-window bound)
- Upcoming 7-day schedule
- Patient-specific medications/conditions/allergies/risk flags/history/appointments (authorized context only)
- Patient snapshot summary (authorized context only)

## 6) Security and Safety Controls

### Data Scope and Access Controls

- Strict role-based context resolution.
- Doctor patient-context requires relationship/access validation.
- Active patient listing constrained to active statuses + lookback window.
- Patient-visible AI access history for transparency.
- Conversation ownership validation prevents cross-user chat-thread reuse.

### PHI / Provider Safety

- Chorui assistant path supports strict local retrieval behavior.
- Local mode can operate without external provider keys.
- Response paths use authorized internal DB reads, not broad unbounded search.

### Clinical Safety

- Explicit no-autonomous-decision guard:

  - diagnosis confirmation
  - prescribing/dosage requests
  - emergency-treatment instructions

- Responses consistently route users back to licensed clinicians for treatment decisions.

### Abuse/Robustness Guardrails

- Pagination bounds on history endpoints (`limit`/`offset`).
- Narrower AI access log filtering to exact event type.
- Reduced N+1 query behavior on AI history retrieval.
- Server-side persisted chat turns improve resilience when client-side history is incomplete.

## 7) Reliability and Operational Behavior

- Deterministic local intent handling for core record questions.
- Graceful fallback messaging in strict-local non-matching queries.
- Structured response shape kept stable for frontend rendering.
- Conversation id returned on every assistant response to ensure robust thread continuity.
- Existing orchestration endpoints (`patient-summary`, `clinical-info`, `voice-to-notes`) remain available for advanced doctor workflows.

## 8) Configuration Knobs

In `backend/app/core/config.py`:

- `CHORUI_PRIVACY_MODE` (default: `strict_local`)
- `CHORUI_ACTIVE_PATIENT_LOOKBACK_DAYS` (default: `180`)
- `GROQ_API_KEY` optional (strict-local compatibility)

## 9) How It Is Going (Status)

### Completed

- Unified assistant routes and role-aware context behavior.
- Strict local retrieval-first capability for key medical-record intents.
- Doctor AI query audit event (`view_ai_query`) and patient-facing AI access history endpoint.
- Expanded intent coverage (allergies, risks, history, schedule/appointments, summaries).
- Safety gating for autonomous diagnosis/prescription-style requests.
- Persistent DB chat memory for patient and doctor Chorui sessions.
- Conversation continuity and follow-up intent inference using stored turns.

### In Progress / Next Hardening Steps

- Add automated tests for:

  - strict-local no-provider behavior
  - full authorization matrix
  - intent-response consistency

- Add optional UI panel for patients to review AI-specific doctor access history directly.
- Add telemetry counters for intent distribution, fallback rate, and latency percentile.

## 10) Showcase Narrative (What Makes Chorui Stand Out)

- Trust-first architecture with role-scoped retrieval and patient-visible transparency.
- Practical, high-signal answers directly from records rather than generic chatbot responses.
- Clinical safety posture that assists care while avoiding unsafe autonomous decisions.
- Reliability through deterministic intent handlers and explicit fallback behavior.
- Durable chat memory and server-enforced conversation security for production readiness.

## 11) Non-Regression Guarantee

The enhancements preserve existing features and security posture while adding:

- broader retrieval intents,
- stronger safety controls,
- better endpoint performance/constraints,
- durable conversation persistence for contextual continuity,
- and clearer system documentation for internal and external showcase use.
