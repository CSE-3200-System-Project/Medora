# Medora Backend PRD (Implementation-Current)

**Document Type:** Product Requirements + Technical Implementation PRD  
**Scope:** `backend/` (plus repository backend-adjacent service state)  
**Generated From Codebase Snapshot:** March 11, 2026  
**Status:** Implementation-aligned (based on current repository state)

## 1. Product Summary
Medora backend is a FastAPI + Supabase/PostgreSQL platform that supports healthcare data workflows for patients, doctors, and admins. It provides:
- Auth/account/profile foundations
- Structured onboarding persistence
- Doctor discovery and AI-assisted intent matching
- Appointment management with status workflows
- Consultation and prescription lifecycle
- Medication/test catalog search
- Notifications, reminders, and patient access controls
- Admin operations (verification, moderation, oversight)

## 2. Runtime Architecture
### Core service
- `backend/app/main.py` starts FastAPI and mounts routers:
  - `health`, `auth`, `profile`, `upload`, `admin`, `doctor`, `speciality`, `appointment`, `ai_doctor`, `medicine`, `medical_test`, `notification`, `patient_access`, `reminder`, `consultation`
- CORS allows localhost defaults and optional `ALLOWED_ORIGINS` extension.
- Optional ASR preloading on startup via `PRELOAD_WHISPER_ON_STARTUP=true`.

### Data and auth infrastructure
- PostgreSQL via Supabase + SQLAlchemy async engine (`asyncpg`)
- Supabase Auth used for user sign-up/sign-in/token verification in active auth routes
- Supabase Storage used by upload route
- Alembic migrations in `backend/alembic/versions`

### Container/deployment model
- Dockerfile + entrypoint script for DB wait/migrations/uvicorn startup
- `docker-compose.yaml` configures env injection, runtime settings, and restart/log behavior

## 3. Domain Model (Current Implemented Tables)
### Identity and user state
- `profiles`
  - role (`admin`, `doctor`, `patient`)
  - account status (`active`, `suspended`, `deleted`, `banned`)
  - verification status (`unverified`, `pending`, `verified`, `rejected`)
  - onboarding completion and audit timestamps

### Patient clinical profile
- `patient_profiles`
  - longitudinal onboarding fields (identity, address, conditions, meds, allergies, surgeries, hospitalizations, tests, family history, lifestyle, vaccinations, consent, emergency contacts)
  - JSON structures for repeated sets (medications, surgeries, medical tests, vaccinations, etc.)

### Doctor professional profile
- `doctor_profiles`
  - BMDC and credential data
  - specialization (`speciality_id` + legacy text)
  - practice location and geo coordinates
  - consultation setup (fees, available days, day-wise slots, appointment duration)
  - bio/preferences/telemedicine fields

### Scheduling and care workflows
- `appointments`
- `consultations`
- `prescriptions`
- `medication_prescriptions`
- `test_prescriptions`
- `surgery_recommendations`

### Supporting domains
- `specialities`
- `notifications`
- `reminders`
- `patient_access_logs`
- `patient_doctor_access`
- medicine catalog tables: `drugs`, `brands`, `medicine_search_index`
- medical test catalog table: `medicaltest`

## 4. API Surface (Current Implemented)
### Health
- `GET /health`

### Auth (`/auth`)
- `POST /signup/patient`
- `POST /signup/doctor`
- `POST /login`
- `POST /logout`
- `GET /me`
- `POST /forgot-password`

### Profile (`/profile`)
- `GET /verification-status`
- `PATCH /patient/onboarding`
- `PATCH /doctor/onboarding`
- `POST /complete-onboarding`
- `GET /patient/onboarding`
- `GET /doctor/onboarding`
- `GET /patient/profile`
- `GET /doctor/profile`
- `PATCH /doctor/update`
- `PATCH /doctor/schedule`

### Doctor (`/doctor`)
- `GET /search`
- `GET /{profile_id}`
- `GET /{profile_id}/slots`
- `POST /geocode-location/{doctor_id}`
- `POST /geocode-all-missing`
- plus debug endpoint `GET /testxyz`

### Specialities (`/specialities`)
- `GET /`

### Appointment (`/appointment`)
- `POST /`
- `GET /my-appointments`
- `GET /by-date/{date}`
- `PATCH /{appointment_id}`
- `GET /stats`
- `GET /upcoming`
- `GET /doctor/{doctor_id}/booked-slots`
- `GET /patient/previously-visited`
- `GET /patient/calendar`
- `GET /doctor/patients`
- `POST /sync-status`
- `GET /{appointment_id}/can-complete`
- `PATCH /{appointment_id}/complete`

### Consultation/Prescription (`/consultation`)
- consultation create/list/history/get/update/complete
- prescription create/list/delete
- patient prescription list/detail/accept/reject
- medical-history prescription feed

### AI (`/ai`)
- `POST /search` (LLM-assisted specialty extraction + doctor matching)
- `POST /normalize/voice` (Whisper-based ASR normalization)

### Medicine (`/medicine`)
- `GET /search`
- `GET /filters`
- `GET /{drug_id}`
- `GET /brand/{brand_id}`

### Medical test (`/medical-test`)
- `GET /search`
- `GET /all`
- `GET /count`
- `GET /{test_id}`

### Notifications (`/notifications`)
- list/unread-count/update/mark-read/mark-all-read/delete/clear-all

### Patient access (`/patient-access`)
- doctor fetch of patient with access tracking
- patient access history
- patient doctor-access list
- revoke/restore doctor access

### Reminders (`/reminders`)
- create/list/get/update/delete/toggle

### Admin (`/admin`)
- `GET /test`
- `GET /pending-doctors`
- `POST /verify-doctor/{doctor_id}`
- `GET /doctors`
- `GET /stats`
- `GET /patients`
- `GET /appointments`
- `GET /schedule-review`
- `POST /schedule-review/fix`
- `POST /users/{user_id}/ban`
- `POST /users/{user_id}/unban`

## 5. Functional Requirements Implemented (By Domain)
### Identity, onboarding, and verification
- Dual-role signup (patient/doctor)
- Role profile bootstrapping
- Verification-state based access flow
- Comprehensive onboarding persistence for both roles

### Discovery and matching
- Public doctor search with filters (speciality/city/consultation mode/query)
- Doctor profile details and slot generation
- AI-assisted specialty extraction and doctor retrieval
- Voice input normalization for AI search support

### Clinical operations
- Appointment booking and lifecycle transitions
- Consultation lifecycle (open/complete/cancel)
- Typed prescriptions (medication, test, surgery)
- Patient approval/rejection of prescriptions

### Patient safety and continuity
- Notification center
- Medication/test reminders
- Patient-controlled doctor access and audit logs

### Administrative controls
- Doctor verification workflow
- Platform stats and operational lists
- User moderation (ban/unban)
- Schedule data review and normalization support

## 6. Technology Stack and Dependencies
### Backend libraries (`backend/requirements.txt`)
- `fastapi>=0.95.0`
- `fastapi[standard]>=0.95.0`
- `uvicorn[standard]>=0.20.0`
- `SQLAlchemy>=2.0`
- `alembic>=1.8`
- `asyncpg>=0.27`
- `pydantic>=2.0`
- `pydantic-settings>=0.1.0`
- `supabase>=1.0.0`
- `httpx>=0.23.0`
- `python-multipart>=0.0.6`
- `python-jose[cryptography]>=3.3.0`
- `passlib[bcrypt]>=1.7.4`
- `psycopg2-binary>=2.9.6`
- `email-validator>=1.3.1`
- `cryptography>=40.0.0`
- `python-dotenv>=1.0.0`
- `typing-extensions>=4.5.0`
- `pytest>=7.0.0`
- `faster-whisper>=1.0.0`
- `numpy>=1.24.0`
- `groq>=0.1.0`

## 7. Configuration and Environment Contract
Observed required runtime keys:
- `SUPABASE_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GROQ_API_KEY`
- `ALLOWED_ORIGINS` (optional extension)
- `FRONTEND_URL` (forgot-password redirect)
- `PRELOAD_WHISPER_ON_STARTUP` (optional)
- container/runtime controls: `PORT`, `RELOAD`, `WAIT_FOR_DB`, `RUN_MIGRATIONS`, `UVICORN_WORKERS`

## 8. Design Choices and Tradeoffs
- **Async-first API + ORM:** improves concurrency for IO-heavy operations.
- **Structured JSON fields in profiles:** rapid schema evolution for onboarding complexity, with tradeoff of heavier validation and query complexity.
- **Supabase Auth + DB combo:** fast integration path; auth and domain data remain split.
- **Route-domain segmentation:** clear functional separation (`appointment`, `consultation`, `patient_access`, etc.).
- **AI orchestration in core backend:** enables single API surface today, but increases service weight and operational coupling.

## 9. Current Gaps, Risks, and Notes
- Admin password check is hardcoded (`admin123`) in route code; `settings` value is not used there.
- Frontend push-subscription hook expects VAPID endpoints not present in current backend notification router.
- `core/security.py` uses `settings.SUPABASE_JWT_SECRET`, but this key is not declared in `core/config.py`; active routes mostly rely on Supabase `get_user` token verification path.
- Legacy/debug artifacts exist (for example debug route names and file writes in doctor route), indicating production-hardening work still needed.
- Repository-level `ai_service/` and `stt_service/` directories are present but currently not implemented as active standalone services in this snapshot.

## 10. Backend-Adjacent Service State (Whole-Project View)
- `ai_service/`: directory exists, no active implementation files in current snapshot.
- `stt_service/`: directory exists, no active implementation files in current snapshot.
- Current AI and ASR capabilities are implemented inside `backend/app/routes/ai_doctor.py` + `backend/app/services/asr.py`.

## 11. Acceptance Criteria for “Current Backend PRD”
This document is considered accurate to current implementation if:
- Router list and endpoint map match `backend/app/routes`
- Model inventory matches `backend/app/db/models`
- Dependency list matches `backend/requirements.txt`
- Runtime/container behavior matches `Dockerfile`, `docker-compose.yaml`, and `entrypoint.sh`

---

## Appendix A: Main Pydantic Schema Domains
- `auth.py`: signup/login payloads
- `onboarding.py`: patient/doctor onboarding field models
- `doctor.py`: doctor search/detail/slot responses
- `appointment.py`: appointment create/update/response
- `consultation.py`: consultation + prescription model graph
- `notification.py`: notification CRUD/list models
- `reminder.py`: reminder CRUD/list models
- `ai_search.py`: AI doctor search request/response
- `voice.py`: ASR response/error
- `medicine.py`: medicine search/detail/filter responses
- `medical_test.py`: medical test search/detail responses
- `speciality.py`: speciality list models
