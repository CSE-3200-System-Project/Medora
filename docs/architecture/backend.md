# Backend Architecture

Medora's backend is a **FastAPI** application using **async SQLAlchemy 2.x** with PostgreSQL (hosted on Supabase). All endpoints are async. Authentication is JWT-based via Supabase, with Row-Level Security (RLS) enforced at the database layer.

**Entry point:** `backend/app/main.py`

---

## Stack

| Tool | Purpose |
|---|---|
| FastAPI 0.95+ | HTTP framework, async routing |
| SQLAlchemy 2.x (asyncpg) | Async ORM + raw query execution |
| Alembic | Schema migrations (58 files) |
| Supabase | Hosted PostgreSQL + Auth |
| Pydantic v2 | Request/response schema validation |
| python-jose | JWT decoding |
| httpx | Async HTTP client (AI providers, JWKS fetch) |
| faster-whisper | Local ASR model for voice transcription |
| pywebpush | Web push notifications (VAPID) |
| google-auth-oauthlib | Google Calendar OAuth |

---

## Startup Lifecycle (`main.py`)

On startup the app runs three initialization steps, then launches two background tasks:

1. **Whisper preload** — loads the Faster-Whisper ASR model into memory (configurable via `PRELOAD_WHISPER_ON_STARTUP`). Avoids cold-start latency on the first voice request.
2. **Schema compatibility self-heal** — runs idempotent `ALTER TABLE IF EXISTS` / `CREATE INDEX IF NOT EXISTS` statements to repair known drift between Alembic migrations and long-lived dev databases. Covers `appointments.hold_expires_at` and `appointment_reschedule_requests` response columns, and `health_data_consents.share_medical_tests`.
3. **Reminder dispatcher start** — launches the async reminder loop (see Services).

**Background tasks (run until shutdown):**
- `_run_hold_expiry_loop` — expires stale soft-hold appointments every 60 seconds (configurable via `APPOINTMENT_HOLD_SWEEP_INTERVAL_SECONDS`).
- `reminder_dispatcher` — checks due reminders on a configurable interval and dispatches email/push/in-app notifications.

---

## Route Modules

26 route files, registered in `main.py` with prefixes. All under `/backend/app/routes/`.

| Prefix | Module | Responsibility |
|---|---|---|
| `/health` | `health.py` | Health check |
| `/auth` | `auth.py` | Signup (patient/doctor), login, logout, `/me`, forgot/reset password |
| `/profile` | `profile.py` | Profile CRUD, onboarding steps, verification status, AI access prefs |
| `/upload` | `upload.py` | File upload to Supabase Storage |
| `/admin` | `admin.py` | Doctor verification/rejection, user management, audit log, stats |
| `/doctor` | `doctor.py` | Doctor search, public profile, slot availability, geocoding |
| `/doctor/actions` | `doctor_actions.py` | Doctor action audit trail (completed tasks, lab reviews, etc.) |
| `/specialities` | `speciality.py` | Medical specialty list and search |
| `/appointment` | `appointment.py` | Appointment CRUD, status transitions, slot index, stats, calendar |
| `/availability` | `availability.py` | Weekly schedule templates, exceptions, overrides |
| `/reschedule` | `reschedule.py` | Reschedule request workflow |
| `/consultation` | `consultation.py` | Consultation CRUD, prescription creation, draft snapshots |
| `/consultation` | `consultation_ai.py` | AI-assisted context endpoints (mounted on same prefix) |
| `/ai` | `ai_doctor.py` | `/ai/search` — specialty extraction + doctor ranking |
| `/ai` | `ai_consultation.py` | Chorui assistant, voice-to-notes, patient summary, SOAP, clinical query |
| `/medicine` | `medicine.py` | Medicine search, filters, detail by drug/brand |
| `/medical-test` | `medical_test.py` | Medical test CRUD and results |
| `/medical-reports` | `medical_report.py` | Report upload, OCR trigger, list, detail |
| `/health-metrics` | `health_metrics.py` | Health readings CRUD, today summary, trends |
| `/health-data` | `health_data_consent.py` | Granular consent per data type |
| `/notifications` | `notification.py` | In-app notifications, VAPID push subscribe/unsubscribe |
| `/reminders` | `reminder.py` | Reminder CRUD, timezone-aware scheduling |
| `/patient` | `patient_dashboard.py` | Aggregated patient home data endpoint |
| `/patient-access` | `patient_access.py` | Doctor-patient access log + permission check |
| `/patient-data-sharing` | `patient_data_sharing.py` | Per-doctor data sharing preferences |
| `/oauth` | `oauth.py` | Google Calendar OAuth token exchange and refresh |

---

## Authentication & Dependency Injection (`app/core/`)

### JWT Verification (`security.py`)

```
Request arrives with: Authorization: Bearer <supabase_jwt>

Primary path:
  1. Decode header → extract kid + alg
  2. Fetch JWKS from Supabase (cached 5 min in-process)
  3. Verify signature with matching key
  4. Check audience="authenticated", issuer=<SUPABASE_URL>/auth/v1

Fallback path (if JWKS fails):
  1. Call supabase.auth.get_user(token)
  2. Return minimal payload {sub, email, email_confirmed_at}
```

### Dependency Chain (`dependencies.py`)

```python
get_db(authorization)
  # Opens AsyncSession
  # Sets request.jwt via set_config() for PostgreSQL RLS enforcement
  # Yields session

get_current_user(authorization, db)
  # Calls verify_jwt(token)
  # Fetches Profile from DB by sub (user UUID)
  # Returns Profile object

require_doctor(profile)
  # Asserts profile.role == "doctor"
  # Asserts profile.verification_status == "verified"
  # Returns profile
```

### Route-Level Auth Patterns

- Most routes use `Depends(get_current_user)` — any authenticated user.
- Doctor-only endpoints use `Depends(require_doctor)` — verified doctors only.
- Admin endpoints define their own `require_admin` check inside `admin.py`.
- Chorui/AI endpoints use `get_current_user_token` from `auth.py` (returns raw JWT payload alongside profile).

---

## Services Layer (`app/services/`)

19 service modules. Routes delegate all business logic here.

### AI & Language

| Service | Responsibility |
|---|---|
| `ai_orchestrator.py` | Central LLM interface: provider-agnostic (Groq/Gemini/Cerebras), PII sanitization, Pydantic output validation, latency logging. Exposes: `generate_patient_summary`, `structure_intake`, `generate_soap_notes`, `clinical_info_query`, `prescription_suggestions` |
| `asr.py` | Faster-Whisper wrapper for voice transcription. Model preloaded on startup. |
| `chorui_intent_normalizer.py` | Maps raw user utterances to canonical intent strings |
| `chorui_navigation_engine.py` | Resolves canonical intents to frontend routes, handles missing params, role-aware routing, fallback suggestions |
| `chorui_navigation_registry.py` | Immutable tuple of `ChoruiRouteRegistryEntry` objects (intent → route → required params). Admin routes are explicitly excluded. |
| `medical_knowledge.py` | Clinical reference lookups and condition/symptom knowledge base |
| `specialty_matching.py` | Semantic matching of patient needs to doctor specialty IDs |

### Business Logic

| Service | Responsibility |
|---|---|
| `appointment_service.py` | Appointment lifecycle, soft-hold expiry (`expire_pending_holds`), status transitions |
| `availability_service.py` | Slot generation, conflict detection |
| `slot_service.py` | High-performance slot time calculations |
| `doctor_action_service.py` | Action logging and audit trail |

### Infrastructure & Integrations

| Service | Responsibility |
|---|---|
| `reminder_dispatcher.py` | Async background loop: evaluates due-window, dispatches reminders via email/push/in-app, exponential backoff on errors |
| `notification_service.py` | Creates in-app notification records, triggers push dispatch |
| `push_service.py` | Web Push via VAPID using pywebpush |
| `email_service.py` | SMTP email (appointment reminders, auth emails) with template rendering |
| `google_calendar_service.py` | OAuth-based Google Calendar event creation and sync |
| `geocoding.py` | Address text → lat/lng coordinates |

---

## Core Modules (`app/core/`)

| File | Responsibility |
|---|---|
| `config.py` | All settings via Pydantic BaseSettings: Supabase URLs, AI keys, SMTP, VAPID, Google OAuth, reminder intervals, OCR config |
| `security.py` | JWT verification with JWKS cache + Supabase fallback |
| `dependencies.py` | `get_db`, `get_current_user`, `require_doctor` FastAPI dependencies |
| `ai_privacy.py` | PII anonymization: email/phone redaction, identifier hashing, name pattern removal |
| `data_sharing_guard.py` | Reads patient consent records and filters data sent to AI based on sharing permissions |
| `patient_reference.py` | Stable patient ID obfuscation for AI logs (no raw UUIDs in AI input) |
| `http_cache.py` | HTTP cache-control header helpers |
| `avatar_defaults.py` | Role-based deterministic avatar URL generation |

---

## Schemas (`app/schemas/`)

21 Pydantic v2 schema files. Strict request/response contracts for all endpoints.

Key schemas:
- `ai_orchestrator.py` — `ChoruiAssistantRequest/Response`, `AIClinicalQueryRequest`, `AIVoiceToNotesRequest/Response`, `AIDoctorPatientSummaryResponse`, `ChoruiConversationHistoryResponse`, `ChoruiNavigationAction`
- `appointment.py` — `AppointmentCreate`, `AppointmentUpdate`, `AppointmentResponse`
- `consultation.py` — `ConsultationRequest`, `PrescriptionRequest` with medication/test/surgery variants
- `doctor.py` — `DoctorProfileUpdate`, `DoctorSearchResponse`, `AppointmentSlotsResponse`
- `patient.py` — `PatientProfileUpdate`
- `onboarding.py` — Step-by-step onboarding request bodies

---

## Middleware

1. **CORSMiddleware** — allows `localhost:3000` + `ALLOWED_ORIGINS` env list, credentials included.
2. **Performance headers middleware** — injects `X-Response-Time` and `Server-Timing` headers on every response.

---

## Request Lifecycle (Full Path)

```
Client (browser/Next.js Server Action)
  │
  ├─ POST /appointment/  { Authorization: Bearer <jwt> }
  │
  ▼
FastAPI app
  ├─ CORSMiddleware
  ├─ Performance header middleware (start timer)
  │
  ▼
Route handler: create_appointment()
  ├─ Depends(get_db)
  │     └─ Opens AsyncSession
  │     └─ set_config('request.jwt', token) → enables PostgreSQL RLS
  │
  ├─ Depends(get_current_user)
  │     └─ verify_jwt(token) → JWKS lookup or Supabase fallback
  │     └─ SELECT * FROM profiles WHERE id = <sub>
  │
  ├─ Business logic (appointment_service.py)
  │     └─ INSERT INTO appointments ...
  │     └─ RLS policies filter/allow based on request.jwt
  │
  └─ Return AppointmentResponse
       └─ Middleware: set X-Response-Time header
```

---

## Database Connection (`app/db/`)

- `session.py` — async SQLAlchemy engine using `asyncpg` driver, `AsyncSessionLocal` factory
- `base.py` — declarative base class shared by all models
- `supabase.py` — Supabase Python client (used for auth fallback and RLS context)

**Migrations:** 58 Alembic files in `backend/alembic/versions/`. Schema evolution covers initial schema, onboarding fields, specialties, AI tables, health data consent, consultation drafts, doctor actions, admin approval, Chorui permissions, and performance indexes.
