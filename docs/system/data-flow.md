# System Data Flow

How data moves through the Medora system from user action to database and back.

---

## Services Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  React 19 client components  ←→  Supabase Realtime (slots) │
└──────────────────┬──────────────────────────────────────────┘
                   │  Server Actions (Next.js server process)
┌──────────────────▼──────────────────────────────────────────┐
│                    NEXT.JS (Frontend)                        │
│  App Router / Server Actions / RSC rendering                │
│  Supabase Auth session management                           │
└──────────────────┬──────────────────────────────────────────┘
                   │  HTTP + Bearer JWT
┌──────────────────▼──────────────────────────────────────────┐
│                 FASTAPI BACKEND                              │
│  Routes → Services → SQLAlchemy (async)                     │
│  Background: reminder_dispatcher, hold_expiry_loop          │
└──────────┬──────────────────────────┬───────────────────────┘
           │ asyncpg                  │ httpx
┌──────────▼──────────┐   ┌──────────▼──────────────────────┐
│   POSTGRESQL         │   │   EXTERNAL SERVICES             │
│   (Supabase)         │   │   ├─ Groq / Gemini / Cerebras   │
│   + RLS policies     │   │   ├─ Supabase Storage           │
│   + Realtime         │   │   ├─ SMTP (email)               │
└─────────────────────┘   │   ├─ Web Push (VAPID)            │
                           │   ├─ Google Calendar OAuth       │
                           │   └─ ai_service (OCR)           │
                           └─────────────────────────────────┘
```

---

## Request Path (Standard Mutation)

Example: Patient books an appointment.

```
1. Patient clicks "Book Appointment" in browser
   └─ Triggers Server Action: appointment-actions.ts#createAppointment()

2. Server Action (Next.js server)
   ├─ Gets Supabase session from cookie → extracts JWT
   └─ POST http://backend/appointment/ { ...data, Authorization: Bearer <jwt> }

3. FastAPI — CORSMiddleware → performance header middleware

4. Route: create_appointment()
   ├─ Depends(get_db)
   │   ├─ Opens AsyncSession (asyncpg)
   │   └─ set_config('request.jwt', token) → PostgreSQL applies RLS
   │
   ├─ Depends(get_current_user)
   │   ├─ verify_jwt(token) → JWKS cache hit (5 min TTL)
   │   └─ SELECT * FROM profiles WHERE id = <sub>
   │
   ├─ appointment_service.create_appointment(db, data, user)
   │   ├─ Validates slot availability
   │   ├─ INSERT INTO appointments { status: PENDING, hold_expires_at: ... }
   │   ├─ INSERT INTO reminders { appointment_id, due_at, ... }
   │   └─ notification_service.create_notification(to: doctor, type: new_appointment)
   │
   └─ Return AppointmentResponse

5. Server Action receives response
   ├─ revalidatePath('/patient/appointments')
   └─ Returns typed data to client component

6. Client component re-renders with fresh data
   └─ Supabase Realtime pushes slot update to other subscribed clients
      (other patients viewing same doctor's slots see the booked slot removed)
```

---

## Request Path (AI Feature)

Example: Doctor requests patient summary.

```
1. Doctor opens consultation page → AI summary panel loads
   └─ Server Action: ai-consultation-actions.ts#getPatientSummary(patientId)

2. Server Action → GET http://backend/ai/patient-summary?patient_id=<id>

3. FastAPI — ai_consultation.py: get_patient_summary()
   ├─ get_current_user → verified doctor profile
   │
   ├─ check_doctor_patient_access(db, doctor_id, patient_id)
   │   └─ Verifies appointment or consultation relationship exists
   │   └─ Logs access to patient_access table
   │
   ├─ get_sharing_permissions(db, patient_id, doctor_id)
   │   └─ Reads health_data_consents + patient_data_sharing
   │   └─ Returns SharingPermissions { allowed_categories: [...] }
   │
   ├─ Builds patient_data dict from DB (appointments, prescriptions, conditions)
   │
   ├─ filter_extended_context(patient_data, permissions)
   │   └─ Strips disallowed categories
   │
   ├─ ai_orchestrator.generate_patient_summary(patient_data)
   │   ├─ _sanitize_structured_input() → strips PII field names + patterns
   │   ├─ _call_llm_json(system_prompt, user_prompt)
   │   │   └─ httpx POST to Groq/Gemini/Cerebras API (timeout + retries)
   │   └─ Pydantic validation → PatientSummaryOutput
   │
   ├─ INSERT INTO ai_interactions { feature, sanitized_input, validated_output, latency_ms }
   │
   └─ Return AIDoctorPatientSummaryResponse

4. Server Action returns structured summary to client component
```

---

## OCR Data Path

Example: Patient uploads a lab report.

```
1. Patient uploads image on /patient/medical-reports
   └─ Server Action: medical-report-actions.ts#uploadMedicalReport(file)

2. Server Action
   ├─ file-storage-actions.ts: uploads to Supabase Storage → gets image_url
   └─ POST http://backend/medical-reports/upload { image_url, report_type }

3. FastAPI — medical_report.py: upload_medical_report()
   ├─ _require_user_ai_consent_for_report_ocr(db, user_id)
   │   └─ Checks health_data_consents for OCR consent
   │
   ├─ Calls ai_service:
   │   POST http://ai_service/ocr/medical-report
   │   Headers: X-Medora-Subject-Token: <anonymized_token>
   │   Body: { image_url }
   │   │
   │   └─ ai_service pipeline:
   │       normalize_input → Azure Document Intelligence → parse_medical_report()
   │       Fallback: PaddleOCR if Azure fails
   │       Returns: { tests: [...], raw_text, meta }
   │
   ├─ INSERT INTO medical_reports { patient_id, image_url, raw_text, ocr_engine }
   ├─ INSERT INTO medical_tests (one per extracted test result)
   │
   └─ Return MedicalReportUploadResponse { report_id, tests_extracted }

4. Client shows parsed test results inline
```

---

## Background Data Flows

### Reminder Dispatch Loop

```
reminder_dispatcher (asyncio Task, launched at startup)
  │
  Every REMINDER_DISPATCH_INTERVAL_SECONDS (min 300s):
  │
  ├─ SELECT reminders WHERE status='pending' AND due_at <= now() + lookahead_window
  │
  ├─ For each reminder:
  │   ├─ delivery_method = push  → push_service.send_push_to_user(user_id, payload)
  │   │                            └─ Reads WebPushSubscription for user → VAPID push
  │   ├─ delivery_method = email → email_service.send_appointment_reminder_email()
  │   └─ delivery_method = in_app → notification_service.create_notification()
  │
  ├─ UPDATE reminder SET status='sent', sent_at=now()
  └─ Exponential backoff on provider failure; max interval 30 min
```

### Appointment Hold Expiry Loop

```
_run_hold_expiry_loop (asyncio Task, launched at startup)
  │
  Every APPOINTMENT_HOLD_SWEEP_INTERVAL_SECONDS (default: 60s):
  │
  ├─ appointment_service.expire_pending_holds(db)
  │   └─ UPDATE appointments
  │      SET status='CANCELLED'
  │      WHERE status='PENDING' AND hold_expires_at < now()
  │
  └─ Logs count of expired holds
```

---

## Authentication Data Flow

```
Frontend login:
  1. supabase.auth.signInWithPassword(email, password)
     └─ Supabase Auth returns { access_token, refresh_token }
  2. Token stored in Supabase JS client (cookie/localStorage managed by library)

Per-request (Server Action):
  1. supabase.auth.getSession() → access_token from cookie
  2. fetch(backendUrl, { headers: { Authorization: `Bearer ${token}` } })

Backend JWT verification:
  1. jwt.get_unverified_header(token) → { kid, alg }
  2. JWKS fetch from SUPABASE_URL/auth/v1/.well-known/jwks.json (cached 5 min)
  3. jwt.decode(token, key, algorithms=[alg], audience="authenticated")
  4. Fallback: supabase.auth.get_user(token) if JWKS fails
  5. Profile lookup: SELECT * FROM profiles WHERE id = payload["sub"]

RLS enforcement:
  1. set_config('request.jwt', token) executed on AsyncSession before any query
  2. PostgreSQL RLS policies read current_setting('request.jwt') to filter rows
```

---

## Data Isolation & Privacy

| Mechanism | Scope | Where |
|---|---|---|
| PostgreSQL RLS | Row-level, all tables | Supabase database policies |
| JWT role check | `require_doctor`, `require_admin` | `dependencies.py` |
| Verification gate | Doctors must be `verified` | `require_doctor` dependency |
| Consent filtering | AI data per patient consent | `data_sharing_guard.py` |
| PII sanitization | Before every LLM call | `ai_orchestrator._sanitize_*` |
| Access logging | Every doctor→patient data read | `patient_access` table |
| Anonymized AI logs | Sanitized input only | `ai_interactions` table |
| OCR subject token | Pseudonymous, 80 char max | `ai_service` X-Medora-Subject-Token |
