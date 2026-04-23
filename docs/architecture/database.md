# Database Design

Medora uses **PostgreSQL via Supabase** with async SQLAlchemy 2.x (asyncpg driver). Row-Level Security (RLS) policies are enforced at the database layer using the request JWT set per-session via `set_config('request.jwt', token)`.

All models are in `backend/app/db/models/`. 25 model files, 40+ SQLAlchemy mapped classes.

---

## Schema Layers

### Layer 1 — Identity

#### `profiles`
Base identity record. One row per user regardless of role.

| Column | Type | Notes |
|---|---|---|
| `id` | String PK | Supabase Auth UUID |
| `role` | Enum | `admin`, `doctor`, `patient` |
| `status` | Enum | `active`, `suspended`, `deleted`, `banned` |
| `verification_status` | Enum | `unverified`, `pending`, `verified`, `rejected` |
| `first_name`, `last_name` | String | |
| `email`, `phone` | String | nullable |
| `onboarding_completed` | Boolean | gate for home access |
| `verified_at` | DateTime | set when admin verifies |
| `ban_reason`, `banned_at`, `banned_by` | | admin moderation fields |
| `delete_reason` | Text | nullable |

#### `doctor_profiles`
One-to-one with `profiles`. PK is `profile_id` (FK → `profiles.id`).

Key columns grouped by onboarding step:
- **Step 1 (Identity):** `title`, `gender`, `date_of_birth`, `profile_photo_url`, `nid_number`
- **Step 2 (Credentials):** `bmdc_number` (unique), `bmdc_document_url`, `bmdc_verified`, `qualifications`, `degree`, `education` (JSON array of `{degree, institution, year, country}`)
- **Step 3 (Specialization):** `speciality_id` (FK → `specialities.id`), `sub_specializations` (JSON), `services` (JSON)
- **Step 4 (Experience):** `years_of_experience`, `work_experience` (JSON array of `{position, hospital, from_year, to_year, current}`)
- **Step 5 (Practice):** `hospital_name`, `hospital_address`, `hospital_city`, `chamber_name`, `chamber_address`, `hospital_latitude/longitude`, `chamber_latitude/longitude`, `consultation_mode`
- **Step 6 (Fees/Schedule):** `consultation_fee`, `follow_up_fee`, `visiting_hours` (JSON), `google_calendar_enabled`, `google_calendar_id`

#### `patient_profiles`
One-to-one with `profiles`. PK is `profile_id`.

Key columns grouped by onboarding step:
- **Step 1 (Identity):** `date_of_birth`, `gender`, `profile_photo_url`, `nid_number`
- **Step 2 (Address/Physical):** `address`, `city`, `district`, `height`, `weight`, `blood_group`, `marital_status`, `occupation`
- **Step 3 (Conditions):** `has_conditions` (bool), `conditions` (JSON structured list), individual boolean flags for 13 common chronic conditions (`has_diabetes`, `has_hypertension`, etc.), `chronic_conditions_notes`
- **Step 4 (Medications/Allergies):** `taking_meds`, `medications` (JSON), `has_allergies`, `allergies` (JSON)
- **Step 5 (Surgical/Family):** `has_surgeries`, `surgeries` (JSON), `has_family_history`, `family_history` (JSON)

---

### Layer 2 — Scheduling

#### `specialities`
Static reference table: `id` (int PK), `name`, `display_name`, `icon`.

#### `doctor_availability`
Slot templates per doctor. Defines which days/times a doctor is available. Used by `slot_service.py` to generate bookable slots.

#### `doctor_locations`
Multi-location support. One doctor can have multiple named locations with address, coordinates, and working hours. FK → `doctor_profiles.profile_id`.

#### `appointments`
Central booking record.

| Column | Type | Notes |
|---|---|---|
| `id` | String PK | UUID |
| `doctor_id` | FK → `doctor_profiles.profile_id` | |
| `patient_id` | FK → `patient_profiles.profile_id` | |
| `status` | Enum | 12 values (see below) |
| `appointment_date` | DateTime(tz) | |
| `slot_time` | Time | nullable, specific slot |
| `duration_minutes` | Integer | default 30 |
| `reason` | String | chief reason for visit |
| `notes` | Text | nullable |
| `doctor_location_id` | FK → `doctor_locations.id` | nullable |
| `location_name` | String | denormalized for display |
| `cancellation_reason_key` | String | from reason catalog |
| `cancellation_reason_note` | Text | free-text addendum |
| `cancelled_by_id` | FK → `profiles.id` | |
| `cancelled_at` | DateTime | |
| `hold_expires_at` | DateTime(tz) | soft-hold TTL, swept every 60s |
| `google_event_id` | String | Google Calendar event ID |

**Index:** `(doctor_id, appointment_date)` for slot queries.

**Appointment statuses (12 total):**
```
PENDING                     # Initial state
PENDING_ADMIN_REVIEW        # Awaiting admin approval
PENDING_DOCTOR_CONFIRMATION # Awaiting doctor confirmation
PENDING_PATIENT_CONFIRMATION # Awaiting patient confirmation
CONFIRMED                   # Booking confirmed
RESCHEDULE_REQUESTED        # Reschedule in progress
CANCEL_REQUESTED            # Cancellation pending
COMPLETED                   # Visit completed
CANCELLED                   # Generic cancelled
CANCELLED_BY_PATIENT        # Patient cancelled
CANCELLED_BY_DOCTOR         # Doctor cancelled
NO_SHOW                     # Patient did not attend
```

#### `appointment_reschedule_requests`
Reschedule workflow record. Tracks who requested, who responded, response note, and expiry.

#### `appointment_audit`
Immutable append-only log of all appointment status transitions.

---

### Layer 3 — Clinical

#### `consultations`
Doctor-patient session. Links to an appointment and contains a draft pointer.

| Column | Notes |
|---|---|
| `doctor_id`, `patient_id` | FKs to role profiles |
| `appointment_id` | FK → `appointments.id`, nullable |
| `draft_id` | FK → `consultation_drafts.id` (one-to-one, nullable) |
| `chief_complaint`, `diagnosis`, `notes` | Text fields |
| `status` | `open`, `completed`, `cancelled` |
| `consultation_date`, `completed_at` | Timestamps |

#### `consultation_drafts`
Auto-saved JSON payload snapshot of the in-progress consultation editor. Swapped out on each auto-save; the consultation holds a pointer (`draft_id`).

#### `prescriptions`
Parent record per prescription issued in a consultation.

| Column | Notes |
|---|---|
| `consultation_id` | FK → `consultations.id` |
| `doctor_id`, `patient_id` | Denormalized FKs |
| `type` | `medication`, `test`, `surgery` |
| `status` | `pending`, `accepted`, `rejected` |
| `rendered_prescription_html` | Persisted HTML for print/PDF |
| `rendered_prescription_snapshot` | Immutable JSON snapshot at send time |
| `added_to_history` | Boolean — flagged when added to patient medical history |

#### `medication_prescriptions`
Child of `prescriptions`. Full dosage schedule per medication.

| Column | Notes |
|---|---|
| `medicine_name`, `generic_name` | |
| `medicine_type` | Enum: tablet, capsule, syrup, injection, drops, inhaler, cream, gel, patch, etc. |
| `strength` | e.g. "500mg" |
| `dose_morning/afternoon/evening/night` | Boolean + amount per slot |
| `dosage_type` | `pattern` (morning/afternoon/etc.) or `frequency` |
| `dosage_pattern`, `frequency_text` | Human-readable fallback labels |
| `duration_value` + `duration_unit` | Enum: days, weeks, months, years, ongoing, as_needed |
| `meal_instruction` | before_meal, after_meal, with_meal, empty_stomach, any_time |
| `start_date`, `end_date`, `quantity`, `refills` | |

#### `test_prescriptions`
Child of `prescriptions`. Lab/imaging orders.

| Column | Notes |
|---|---|
| `test_name`, `test_type` | Blood, Imaging, Urine, etc. |
| `urgency` | normal, routine, urgent, emergency |
| `instructions` | e.g. "Fasting required" |
| `preferred_lab`, `expected_date` | |

#### `surgery_recommendations`
Child of `prescriptions`. Surgical procedure recommendations.

| Column | Notes |
|---|---|
| `procedure_name`, `procedure_type` | Major, Minor, Diagnostic |
| `urgency` | scheduled, routine, urgent, emergency, elective |
| `estimated_cost_min/max` | Float range |
| `pre_op_instructions`, `preferred_facility` | |

---

### Layer 4 — Medical Data

#### `medical_reports`
Uploaded lab/report images. OCR results stored inline.

| Column | Notes |
|---|---|
| `patient_id` | FK |
| `image_url` | Supabase Storage URL |
| `raw_text` | Full OCR text output |
| `ocr_engine` | `azure` or `paddleocr` |
| `line_count` | Number of OCR lines extracted |
| `test_results` | Relationship → `medical_tests` |

#### `medical_tests`
Structured test results parsed from OCR output.

| Column | Notes |
|---|---|
| `report_id` | FK → `medical_reports.id` |
| `test_name`, `value`, `unit`, `reference_range` | Parsed fields |

#### `health_metrics`
Continuous health readings.

| Column | Notes |
|---|---|
| `user_id` | FK → `profiles.id` |
| `metric_type` | Enum: steps, sleep_hours, sleep_minutes, heart_rate, blood_pressure_systolic/diastolic, weight, blood_sugar |
| `value` | Float |
| `unit` | String |
| `source` | `manual` or `device` |
| `recorded_at` | DateTime |

#### `medicines` (Drug) / `brands` / `medicine_search_index`
Medicine reference database.
- `medicines`: generic drug with `generic_name`, `description`, `routes`
- `brands`: trade names linked to a `Drug`, with `manufacturer`
- `medicine_search_index`: denormalized lookup table for fast full-text search

---

### Layer 5 — Access Control & Consent

#### `patient_access`
Append-only log of every doctor-patient data access.

| Column | Notes |
|---|---|
| `doctor_id`, `patient_id` | FKs |
| `access_type` | Enum (view, consultation, etc.) |
| `accessed_at` | Timestamp |
| `ip`, `ua` | Audit metadata |

#### `patient_data_sharing`
Per-doctor data sharing preferences set by the patient.

| Column | Notes |
|---|---|
| `patient_id`, `shared_with_id` | FKs |
| `data_types` | JSON array of allowed data categories |
| `shared_at`, `expires_at` | |

#### `health_data_consents`
Granular consent per data type (medications, allergies, test results, etc.).

| Column | Notes |
|---|---|
| `user_id` | FK |
| `data_type` | Specific category (string key) |
| `allowed` | Boolean |
| `share_medical_tests` | Boolean (added via schema compatibility patch) |
| `consented_at` | Timestamp |

---

### Layer 6 — AI & Notifications

#### `ai_interactions`
Audit log for every LLM call made through `ai_orchestrator.py`.

| Column | Notes |
|---|---|
| `feature` | e.g. "patient_summary", "soap_notes" |
| `prompt_version` | e.g. "v1" |
| `sanitized_input` | JSON — PII stripped before storage |
| `raw_output` | JSON — raw LLM response |
| `validated_output` | JSON — Pydantic-validated result |
| `validation_status` | "ok" or "failed" |
| `latency_ms` | Integer |
| `provider` | "groq", "gemini", "cerebras" |

#### `chorui_chat_messages`
Chorui conversation history.

| Column | Notes |
|---|---|
| `conversation_id` | Groups messages into a thread |
| `user_id` | Sender's profile ID |
| `patient_id` | Target patient (for doctor-context queries) |
| `sender` | "user" or "assistant" |
| `role_context` | "patient" or "doctor" |
| `intent` | Detected Chorui intent |
| `structured_data` | JSON — parsed navigation result |
| `context_mode` | How context was assembled |
| `ip`, `ua` | Audit metadata |
| `created_at` | |

**Index:** `conversation_id`, `user_id`, `created_at`

#### `notifications`

| Column | Notes |
|---|---|
| `to_user_id` | FK → `profiles.id` |
| `type` | NotificationType enum |
| `status` | Delivery status |
| `delivery_method` | in_app, push, email |
| `read_at` | Nullable timestamp |

#### `reminders`

| Column | Notes |
|---|---|
| `appointment_id` | FK → `appointments.id` |
| `due_at` | UTC datetime to send |
| `timezone` | User's timezone string |
| `reminder_type` | ReminderType enum |
| `status` | pending, sent, failed |
| `delivery_method` | push, email, in_app |
| `sent_at` | Nullable |

---

### Layer 7 — Infrastructure

#### `oauth_tokens`
Google OAuth tokens per user. Stores `access_token`, `refresh_token`, `expires_at`, `provider`.

#### `media_files`
File metadata for Supabase Storage uploads: `url`, `content_type`, `size`, `mimetype`, `uploaded_by`.

#### `doctor_action` (via `doctor_action.py`)
Audit trail for doctor workflow actions (appointment completion, prescription issuance, lab review, manual tasks). Has `action_type`, `priority`, `status`, `due_at`.

---

## Key Relationships (Summary)

```
profiles (1) ──── (1) doctor_profiles ──── (many) doctor_locations
                                      ──── (many) doctor_availability
                                      ──── (many) appointments
                                      ──── (many) consultations

profiles (1) ──── (1) patient_profiles ──── (many) appointments
                                       ──── (many) consultations
                                       ──── (many) health_metrics
                                       ──── (many) medical_reports ──── (many) medical_tests
                                       ──── (many) health_data_consents
                                       ──── (many) patient_data_sharing

appointments (1) ──── (0..1) consultations
consultations (1) ──── (0..1) consultation_drafts [draft_id FK]
consultations (1) ──── (many) prescriptions
prescriptions (1) ──── (many) medication_prescriptions
              (1) ──── (many) test_prescriptions
              (1) ──── (many) surgery_recommendations

profiles (1) ──── (many) chorui_chat_messages
profiles (1) ──── (many) ai_interactions
profiles (1) ──── (many) notifications
profiles (1) ──── (many) reminders (via appointment)
```

---

## Indexes

Performance indexes defined across models:

| Index | Table | Columns |
|---|---|---|
| `ix_appointments_doctor_date` | appointments | `(doctor_id, appointment_date)` |
| `ix_appointments_hold_expires_at` | appointments | `hold_expires_at` |
| `ix_chorui_chat_messages_*` | chorui_chat_messages | `conversation_id`, `user_id`, `created_at` |
| `ix_ai_interactions_*` | ai_interactions | `feature`, `provider`, `validation_status` |
| `ix_appointment_reschedule_requests_responded_by_id` | appointment_reschedule_requests | `responded_by_id` |

---

## Enums Reference

All enums defined in `backend/app/db/models/enums.py`.

| Enum | Values |
|---|---|
| `UserRole` | admin, doctor, patient |
| `VerificationStatus` | unverified, pending, verified, rejected |
| `AccountStatus` | active, suspended, deleted, banned |
| `ConsultationStatus` | open, completed, cancelled |
| `PrescriptionType` | medication, test, surgery |
| `PrescriptionStatus` | pending, accepted, rejected |
| `MedicineType` | tablet, capsule, syrup, injection, drops, inhaler, cream, ointment, gel, patch, suppository, other |
| `MealInstruction` | before_meal, after_meal, with_meal, empty_stomach, any_time |
| `DurationUnit` | days, weeks, months, years, ongoing, as_needed |
| `DosageType` | pattern, frequency |
| `TestUrgency` | normal, routine, urgent, emergency |
| `SurgeryUrgency` | scheduled, routine, urgent, emergency, elective |
| `HealthMetricType` | steps, sleep_hours, sleep_minutes, heart_rate, blood_pressure_systolic/diastolic, weight, blood_sugar |
| `DoctorActionType` | appointment_completed, prescription_issued, consultation_completed, lab_review, patient_message, manual_task |
| `AppointmentStatus` | 12 values (see appointments section) |
| `RescheduleRequestStatus` | pending, accepted, rejected |
| `DayOfWeek` | 0–6 (Monday–Sunday) |
