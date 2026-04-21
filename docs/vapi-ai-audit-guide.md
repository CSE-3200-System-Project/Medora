# Vapi + AI Workflow Audit Guide

This guide documents the full Medora integration for:

- Vapi voice access in Chorui assistant
- Vapi-driven AI doctor search
- Patient prescription text and voice summary flow
- 15-minute reminders for appointments and patient reminder schedules

This is written for engineering audit and production readiness review.

## 1) Scope and Objectives

Implemented outcomes:

- Reused existing FastAPI AI routes instead of introducing a new parallel AI service.
- Added Vapi custom-tool webhook handling for:
  - Chorui assistant requests
  - AI doctor search requests
  - Prescription summary voice requests
- Added subtle speaking/listening voice UI cues in frontend voice components.
- Added plain-language prescription summary text with medication schedule and quantity details.
- Added 15-minute lead-time reminders with email support for:
  - Appointment reminders (patient and doctor)
  - Reminder items (medication and non-medication reminder items)

## 2) Environment Variables

### Backend (`backend/.env`)

Required/optional values for this integration:

```env
# Vapi
VAPI_PUBLIC_KEY=
VAPI_ASSISTANT_ID=
VAPI_API_KEY=
VAPI_TOOL_SHARED_SECRET=

# Reminder lead window
REMINDER_LEAD_MINUTES=15
```

Notes:

- `VAPI_TOOL_SHARED_SECRET` is optional but strongly recommended.
- If set, incoming tool webhooks must include `x-vapi-tool-secret` with matching value.
- `REMINDER_LEAD_MINUTES` controls how early reminders are dispatched.

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
NEXT_PUBLIC_VAPI_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_DOCTOR_SEARCH_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_PRESCRIPTION_ASSISTANT_ID=
```

Notes:

- If dedicated assistant IDs are not set, flows fall back to `NEXT_PUBLIC_VAPI_ASSISTANT_ID`.

## 3) Backend Endpoints and Purpose

### A) Chorui Vapi tool webhook

- Method: `POST`
- Path: `/ai/vapi/tools/chorui`
- File: `backend/app/routes/ai_consultation.py`

Purpose:

- Parses Vapi tool calls from request payload.
- Validates shared secret when configured.
- Extracts and verifies session token.
- Reuses existing Chorui assistant pipeline (`_run_chorui_assistant`).
- Supports prescription voice summary tool names in the same webhook.

Supported tool names:

- `ask_chorui`
- `chorui_assistant`
- `chorui_chat`
- `summarize_prescription`
- `explain_prescription`

### B) Doctor search Vapi tool webhook

- Method: `POST`
- Path: `/ai/vapi/tools/doctor-search`
- File: `backend/app/routes/ai_doctor.py`

Purpose:

- Handles Vapi tool payloads for AI doctor search voice flow.
- Extracts user text + optional location and user coordinates.
- Passes through existing `ai_doctor_search` route logic.
- Returns spoken summary for top doctor matches.

Supported tool names:

- `search_doctors_ai`
- `find_doctor`
- `ai_doctor_search`

### C) Patient prescription summary API

- Method: `GET`
- Path: `/ai/patient-prescription-summary?prescription_id=<id>`
- File: `backend/app/routes/ai_consultation.py`

Purpose:

- Builds assistant-safe prescription explanation for patient role only.
- Returns:
  - structured summary JSON
  - `plain_text_summary`
  - highlight points and cautions

## 4) Frontend Integration Points

### Chorui voice control

- File: `frontend/components/ai/chorui-vapi-voice-control.tsx`
- Embedded in: `frontend/components/ai/ChoruiChat.tsx`

Behavior:

- Starts/stops Vapi call.
- Sends role context, patient context, and session token metadata.
- Shows subtle speaking indicator when assistant speech starts.

### AI doctor search voice assistant

- File: `frontend/components/doctor/ai-search-vapi-assistant.tsx`
- Integrated in: `frontend/components/doctor/search-filters.tsx`

Behavior:

- Captures user transcript from Vapi events.
- Feeds transcript into AI prompt input.
- Passes location, consultation mode, and optional user coordinates.
- Shows speaking/listening state indicator.

### Patient prescription voice summary

- File: `frontend/components/ai/prescription-vapi-voice-summary.tsx`
- Integrated in: `frontend/components/screens/pages/home/patient/home-patient-prescriptions-id-client.tsx`

Behavior:

- Starts dedicated or fallback Vapi assistant for prescription explanation.
- Sends `prescription_id` in metadata and variable values.
- Displays speaking cue while assistant is talking.

## 5) Prescription Summary Enhancements

Backend response model update:

- File: `backend/app/schemas/ai_orchestrator.py`
- Added field: `plain_text_summary: str`

Backend summary enrichment:

- File: `backend/app/routes/ai_consultation.py`
- Medication plan now includes:
  - medicine name
  - schedule/frequency wording
  - quantity
  - duration
  - meal instruction
  - special instructions

Frontend rendering update:

- File: `frontend/components/screens/pages/home/patient/home-patient-prescriptions-id-client.tsx`
- Displays:
  - brief plain-language summary
  - medication names and schedule list
  - quantity where available
  - optional voice summary control

## 6) Reminder and Email Lead-Time Logic

Main dispatcher updates:

- File: `backend/app/services/reminder_dispatcher.py`

Changes:

- Added appointment reminder dispatch loop integrated into existing dispatcher cycle.
- Lead-time scheduling uses `REMINDER_LEAD_MINUTES`.
- Reminder slots are evaluated as:
  - actual slot time for logging
  - notify time = slot time - lead window for dispatch decision
- Added notification dedupe checks for appointment reminders.
- Added push + email dispatch for appointment reminders.
- Added email dispatch for item reminders.

Email service updates:

- File: `backend/app/services/email_service.py`

Changes:

- Added shared email send helper.
- Added appointment reminder email builder.
- Added item reminder email builder.

## 7) Security and Access Controls

Implemented controls:

- Optional shared secret validation for Vapi tool webhooks.
- JWT-based session token extraction from tool args/metadata/headers.
- Token verification before protected AI operations.
- Role checks for patient-only prescription summary access.
- Existing doctor-patient and privacy guardrails are preserved.

Operational recommendation:

- Always set `VAPI_TOOL_SHARED_SECRET` in production.
- Restrict Vapi tool endpoint access at network edge if possible.
- Log and monitor webhook auth failures.

## 8) Audit Checklist

### Configuration

- [ ] Backend env contains Vapi vars and `REMINDER_LEAD_MINUTES`.
- [ ] Frontend env contains Vapi public key and assistant IDs.
- [ ] Vapi tool definitions point to correct backend URLs.
- [ ] Vapi tool request header includes `x-vapi-tool-secret` when enabled.

### Functional checks

- [ ] Chorui voice starts, receives transcript, and returns AI response.
- [ ] Doctor search voice returns top doctor options and urgency wording.
- [ ] Prescription page shows plain text summary and medication schedule list.
- [ ] Prescription voice summary can start and respond for valid patient prescription.
- [ ] Appointment reminders trigger for both patient and doctor 15 minutes before appointment.
- [ ] Reminder items trigger lead-time notifications and emails.

### Validation commands used

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run lint -- components/doctor/ai-search-vapi-assistant.tsx components/doctor/search-filters.tsx components/doctor/pages/patient-find-doctor-client.tsx components/ai/chorui-vapi-voice-control.tsx components/ai/prescription-vapi-voice-summary.tsx components/screens/pages/home/patient/home-patient-prescriptions-id-client.tsx lib/ai-consultation-actions.ts
```

Backend diagnostics:

- Verified no editor diagnostics on changed backend files:
  - `backend/app/routes/ai_consultation.py`
  - `backend/app/routes/ai_doctor.py`
  - `backend/app/services/reminder_dispatcher.py`
  - `backend/app/services/email_service.py`
  - `backend/app/schemas/ai_orchestrator.py`

## 9) Non-Diagnostic Safety Boundary

This integration is assistive. It does not generate autonomous diagnosis or treatment decisions. The assistant outputs are informational and must remain subordinate to licensed clinician judgment.
