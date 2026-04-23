
---

# Database Design (Full Structured Version)

Medora uses PostgreSQL via Supabase with async SQLAlchemy 2.x. Row-Level Security is enforced using JWT context injection .

All tables belong to a single logical schema and are grouped into layers.

---

# Schema Layers

---

## Layer 1 — Identity

### `profiles`

Base identity table.

**Columns**

* id (PK, UUID)
* role (enum)
* status (enum)
* verification_status (enum)
* first_name
* last_name
* email
* phone
* onboarding_completed
* verified_at
* ban_reason
* banned_at
* banned_by (FK → profiles.id)
* delete_reason

**Relationships**

* 1:1 → doctor_profiles
* 1:1 → patient_profiles
* 1:N → notifications
* 1:N → ai_interactions
* 1:N → chorui_chat_messages
* 1:N → health_metrics
* 1:N → patient_access
* 1:N → health_data_consents

---

### `doctor_profiles`

**PK/FK**

* profile_id (PK, FK → profiles.id)

**Columns**

* title, gender, date_of_birth
* profile_photo_url, nid_number
* bmdc_number (unique)
* bmdc_document_url, bmdc_verified
* qualifications, degree
* education (JSON)
* speciality_id (FK → specialities.id)
* sub_specializations (JSON)
* services (JSON)
* years_of_experience
* work_experience (JSON)
* hospital_name, hospital_address, hospital_city
* chamber_name, chamber_address
* hospital_latitude, hospital_longitude
* chamber_latitude, chamber_longitude
* consultation_mode
* consultation_fee, follow_up_fee
* visiting_hours (JSON)
* google_calendar_enabled
* google_calendar_id

**Relationships**

* profiles (1) ↔ (1) doctor_profiles
* doctor_profiles (1) → (N) doctor_locations
* doctor_profiles (1) → (N) doctor_availability
* doctor_profiles (1) → (N) appointments
* doctor_profiles (1) → (N) consultations
* doctor_profiles (1) → (N) doctor_action

---

### `patient_profiles`

**PK/FK**

* profile_id (PK, FK → profiles.id)

**Columns**

* date_of_birth, gender, profile_photo_url, nid_number
* address, city, district
* height, weight, blood_group
* marital_status, occupation
* has_conditions (bool)
* conditions (JSON)
* chronic flags (has_diabetes, etc.)
* chronic_conditions_notes
* taking_meds, medications (JSON)
* has_allergies, allergies (JSON)
* has_surgeries, surgeries (JSON)
* has_family_history, family_history (JSON)

**Relationships**

* profiles (1) ↔ (1) patient_profiles
* patient_profiles (1) → (N) appointments
* patient_profiles (1) → (N) consultations
* patient_profiles (1) → (N) medical_reports
* patient_profiles (1) → (N) patient_data_sharing

---

### `oauth_tokens`

**Columns**

* id (PK)
* user_id (FK → profiles.id)
* provider
* access_token
* refresh_token
* expires_at

---

## Layer 2 — Scheduling

### `specialities`

**Columns**

* id (PK)
* name
* display_name
* icon

---

### `doctor_locations`

**Columns**

* id (PK)
* doctor_id (FK → doctor_profiles.profile_id)
* name
* address
* latitude
* longitude
* working_hours (JSON)

**Relationship**

* doctor_profiles (1) → (N) doctor_locations

---

### `doctor_availability`

**Columns**

* id (PK)
* doctor_id (FK)
* day_of_week
* start_time
* end_time

**Relationship**

* doctor_profiles (1) → (N) doctor_availability

---

### `doctor_schedule_overrides`

Temporary overrides

**Columns**

* id (PK)
* doctor_id (FK)
* date
* start_time
* end_time
* is_available

---

### `doctor_exceptions`

Leave/holiday system

**Columns**

* id (PK)
* doctor_id (FK)
* start_date
* end_date
* reason

---

### `appointments`

**Columns**

* id (PK)
* doctor_id (FK)
* patient_id (FK)
* status (enum)
* appointment_date
* slot_time
* duration_minutes
* reason
* notes
* doctor_location_id (FK)
* location_name
* cancellation_reason_key
* cancellation_reason_note
* cancelled_by_id (FK → profiles.id)
* cancelled_at
* hold_expires_at
* google_event_id

**Relationships**

* doctor_profiles (1) → (N) appointments
* patient_profiles (1) → (N) appointments

---

### `appointment_reschedule_requests`

**Columns**

* id (PK)
* appointment_id (FK)
* requested_by_id (FK)
* responded_by_id (FK)
* status
* response_note
* expires_at

---

### `appointment_cancellation_requests`

**Columns**

* id (PK)
* appointment_id (FK)
* requested_by_id
* reason
* status

---

### `appointment_audit`

**Columns**

* id (PK)
* appointment_id (FK)
* previous_status
* new_status
* changed_by_id (FK)
* changed_at

---

## Layer 3 — Clinical

### `consultations`

**Columns**

* id (PK)
* doctor_id (FK)
* patient_id (FK)
* appointment_id (FK)
* draft_id (FK)
* chief_complaint
* diagnosis
* notes
* status
* consultation_date
* completed_at

---

### `consultation_drafts`

**Columns**

* id (PK)
* data (JSON)
* updated_at

---

### `prescriptions`

**Columns**

* id (PK)
* consultation_id (FK)
* doctor_id
* patient_id
* type
* status
* rendered_prescription_html
* rendered_prescription_snapshot
* added_to_history

---

### `medication_prescriptions`

**Columns**

* id (PK)
* prescription_id (FK)
* medicine_name
* generic_name
* medicine_type
* strength
* dose_morning, dose_afternoon, dose_evening, dose_night
* dosage_type
* dosage_pattern
* frequency_text
* duration_value
* duration_unit
* meal_instruction
* start_date
* end_date
* quantity
* refills

---

### `test_prescriptions`

**Columns**

* id (PK)
* prescription_id (FK)
* test_name
* test_type
* urgency
* instructions
* preferred_lab
* expected_date

---

### `surgery_recommendations`

**Columns**

* id (PK)
* prescription_id (FK)
* procedure_name
* procedure_type
* urgency
* estimated_cost_min
* estimated_cost_max
* pre_op_instructions
* preferred_facility

---

## Layer 4 — Medical Data

### `medical_reports`

**Columns**

* id (PK)
* patient_id (FK)
* image_url
* raw_text
* ocr_engine
* line_count

---

### `medical_tests`

**Columns**

* id (PK)
* report_id (FK)
* test_name
* value
* unit
* reference_range

---

### `health_metrics`

**Columns**

* id (PK)
* user_id (FK)
* metric_type
* value
* unit
* source
* recorded_at

---

### `medicines`

**Columns**

* id (PK)
* generic_name
* description
* routes

---

### `brands`

**Columns**

* id (PK)
* medicine_id (FK)
* name
* manufacturer

---

### `medicine_search_index`

**Columns**

* id (PK)
* medicine_id (FK)
* searchable_text

---

## Layer 5 — Access Control and Consent

### `patient_access`

**Columns**

* id (PK)
* doctor_id (FK)
* patient_id (FK)
* access_type
* accessed_at
* ip
* ua

---

### `patient_data_sharing`

**Columns**

* id (PK)
* patient_id (FK)
* shared_with_id (FK)
* data_types (JSON)
* shared_at
* expires_at

**Relationship**

* M:N between patients and doctors

---

### `health_data_consents`

**Columns**

* id (PK)
* user_id (FK)
* data_type
* allowed
* share_medical_tests
* consented_at

---

## Layer 6 — AI and Notifications

### `ai_interactions`

**Columns**

* id (PK)
* user_id (FK)
* feature
* prompt_version
* sanitized_input
* raw_output
* validated_output
* validation_status
* latency_ms
* provider

---

### `chorui_chat_messages`

**Columns**

* id (PK)
* conversation_id
* user_id (FK)
* patient_id (FK)
* sender
* role_context
* intent
* structured_data
* context_mode
* ip
* ua
* created_at

---

### `notifications`

**Columns**

* id (PK)
* to_user_id (FK)
* type
* status
* delivery_method
* read_at

---

### `reminders`

**Columns**

* id (PK)
* appointment_id (FK)
* due_at
* timezone
* reminder_type
* status
* delivery_method
* sent_at

---

### `reminder_delivery_logs`

**Columns**

* id (PK)
* reminder_id (FK)
* status
* sent_at
* error_message

---

## Layer 7 — Infrastructure

### `media_files`

**Columns**

* id (PK)
* url
* content_type
* size
* mimetype
* uploaded_by (FK)

---

### `doctor_action`

**Columns**

* id (PK)
* doctor_id (FK)
* action_type
* priority
* status
* due_at

---

### `alembic_version`

**Columns**

* version_num

---

# Relationship Summary (Strict)

* profiles ↔ doctor_profiles → 1:1
* profiles ↔ patient_profiles → 1:1
* doctor_profiles → doctor_locations → 1:N
* doctor_profiles → doctor_availability → 1:N
* doctor_profiles → appointments → 1:N
* patient_profiles → appointments → 1:N
* appointments → consultations → 1:0..1
* consultations → prescriptions → 1:N
* prescriptions → medication_prescriptions → 1:N
* prescriptions → test_prescriptions → 1:N
* prescriptions → surgery_recommendations → 1:N
* medical_reports → medical_tests → 1:N
* medicines → brands → 1:N
* patients ↔ doctors (via patient_data_sharing) → M:N
* profiles → ai_interactions → 1:N
* profiles → chorui_chat_messages → 1:N
* profiles → notifications → 1:N

---
