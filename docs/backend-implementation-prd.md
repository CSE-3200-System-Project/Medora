# Backend Implementation Reference

> **Current as of:** April 2026 scan of actual code.
> For detailed architecture, see [architecture/backend.md](./architecture/backend.md).
> For all endpoints, see [api/routes.md](./api/routes.md).

---

## Stack

- **FastAPI** (async, 0.95+) + **uvicorn**
- **SQLAlchemy 2.x** async ORM, **asyncpg** driver
- **PostgreSQL** via Supabase (RLS enforced)
- **Alembic** — 58 migration files
- **Pydantic v2** — request/response schemas
- **Supabase Auth** — JWT issuance and verification
- **Faster-Whisper** — local ASR (voice transcription)
- **python-jose** — JWT decoding, JWKS-based verification
- **pywebpush** — VAPID push notifications
- **google-auth-oauthlib** — Google Calendar OAuth

---

## Service Boundaries

| Service | Location | How called |
|---|---|---|
| Main backend | `backend/` | Next.js Server Actions (HTTP) |
| OCR microservice | `ai_service/` | Backend calls it via httpx |
| Supabase Auth | Supabase hosted | Backend verifies JWT locally via JWKS |
| LLM providers | Groq / Gemini / Cerebras | Backend via httpx, `AI_PROVIDER` env |
| Supabase Storage | Supabase hosted | Backend upload route + ai_service |

---

## Route Modules (26 files)

All in `backend/app/routes/`. Registered in `main.py`:

```
/health          health.py
/auth            auth.py
/profile         profile.py
/upload          upload.py
/admin           admin.py
/doctor          doctor.py
/doctor/actions  doctor_actions.py
/specialities    speciality.py
/appointment     appointment.py
/availability    availability.py
/reschedule      reschedule.py
/consultation    consultation.py + consultation_ai.py
/ai              ai_doctor.py + ai_consultation.py
/medicine        medicine.py
/medical-test    medical_test.py
/medical-reports medical_report.py
/health-metrics  health_metrics.py
/health-data     health_data_consent.py
/notifications   notification.py
/reminders       reminder.py
/patient         patient_dashboard.py
/patient-access  patient_access.py
/patient-data-sharing  patient_data_sharing.py
/oauth           oauth.py
```

---

## Domain Model (Current Tables)

**Identity:** `profiles`, `doctor_profiles`, `patient_profiles`

**Scheduling:** `specialities`, `doctor_availability`, `doctor_locations`, `appointments`, `appointment_reschedule_requests`, `appointment_audit`

**Clinical:** `consultations`, `consultation_drafts`, `prescriptions`, `medication_prescriptions`, `test_prescriptions`, `surgery_recommendations`

**Medical data:** `medical_reports`, `medical_tests`, `health_metrics`, `medicines` (Drug), `brands`, `medicine_search_index`

**Access/consent:** `patient_access`, `patient_data_sharing`, `health_data_consents`

**AI:** `ai_interactions`, `chorui_chat_messages`

**Notifications:** `notifications`, `reminders`

**Infrastructure:** `oauth_tokens`, `media_files`, `doctor_action`

---

## Startup Lifecycle

On app start (`main.py` lifespan):
1. Whisper ASR model preloaded (`PRELOAD_WHISPER_ON_STARTUP=true`)
2. Schema self-heal: idempotent ALTER TABLE for known drift in dev databases
3. Reminder dispatcher async loop started
4. Hold expiry loop started (sweeps every 60s)

On shutdown: both loops stopped cleanly via asyncio Event.

---

## Auth Flow

```
JWT in Authorization header
  → verify_jwt(): JWKS cache lookup (5 min TTL) → fallback to supabase.auth.get_user()
  → get_current_user(): SELECT FROM profiles WHERE id = sub
  → set_config('request.jwt', token): enables PostgreSQL RLS
```

Role guards:
- `require_doctor`: `role == "doctor"` AND `verification_status == "verified"`
- `require_admin`: defined inline in `admin.py`

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_DATABASE_URL` | asyncpg connection string |
| `SUPABASE_URL` | Supabase project URL (JWKS endpoint) |
| `SUPABASE_KEY` | Supabase service role key |
| `AI_PROVIDER` | `groq` / `gemini` / `cerebras` |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | LLM provider keys |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_CLAIMS_EMAIL` | Push notifications |
| `SMTP_*` | Email delivery |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (extends localhost default) |
| `PRELOAD_WHISPER_ON_STARTUP` | `true` / `false` |
| `APPOINTMENT_HOLD_SWEEP_INTERVAL_SECONDS` | Default: 60 |
| `REMINDER_DISPATCH_INTERVAL_SECONDS` | Default: 300 |
| `REMINDER_DISPATCH_ENABLED` | `true` / `false` |
| `FRONTEND_URL` | Used in password reset email links |

---

## Design Decisions

- **Async-first:** FastAPI + asyncpg for IO-heavy medical workflows. No sync blocking calls.
- **RLS at DB layer:** Supabase PostgreSQL policies filter rows by `request.jwt` — defense-in-depth on top of FastAPI auth.
- **Service layer:** routes never contain business logic directly; all delegated to `services/`.
- **AI provider abstraction:** Single `AIOrchestrator` singleton; swap providers via env var without code changes.
- **Schema self-heal:** idempotent ALTER TABLE on startup prevents breakage from migration drift in long-lived dev databases.
- **Soft-hold expiry:** prevents double-booking without requiring a distributed lock.
- **PII-free AI logs:** `sanitized_input` stored in `ai_interactions`, never raw patient data.
