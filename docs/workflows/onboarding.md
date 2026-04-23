# Onboarding Workflows

Both patient and doctor onboarding are multi-step flows that must be completed before accessing the main application. `profiles.onboarding_completed` is the gate; the (home) layout checks this flag and redirects to onboarding if false.

---

## Patient Onboarding

### Registration

```
POST /auth/signup/patient
  Body: { email, password, first_name, last_name, phone }
  │
  ▼
Supabase Auth: creates auth user, sends confirmation email
  │
  ▼
Backend creates Profile { role: "patient", status: "active",
                          verification_status: "unverified",
                          onboarding_completed: false }
  └─ PatientProfile row created with FK = profile.id
  │
  ▼
Supabase sends email → user clicks confirm link
  └─ /auth/confirm route.ts handles Supabase callback
  │
  ▼
User redirected to /patient/home (onboarding_completed check triggers redirect to onboarding flow)
```

### Onboarding Steps

Patients complete onboarding inline in the profile/settings pages — not a dedicated wizard. Steps are saved incrementally via `PATCH /profile/patient/onboarding`.

| Step | Fields Collected |
|---|---|
| 1 — Identity | date_of_birth, gender, profile_photo, nid_number |
| 2 — Address & Physical | address, city, district, height, weight, blood_group, marital_status, occupation |
| 3 — Known Conditions | has_conditions, conditions (JSON), chronic condition boolean flags (13 conditions), notes |
| 4 — Medications & Allergies | taking_meds, medications (JSON), has_allergies, allergies (JSON) |
| 5 — Surgical & Family History | has_surgeries, surgeries (JSON), has_family_history, family_history (JSON) |

On final step: `POST /profile/complete-onboarding` → sets `onboarding_completed = true`.

---

## Doctor Onboarding

Doctor onboarding is a **dedicated multi-step wizard** at `(onboarding)/onboarding/doctor/`. It is a protected route; the doctor must be authenticated before reaching it. Steps are saved incrementally.

### Registration

```
POST /auth/signup/doctor
  Body: { email, password, first_name, last_name, phone }
  │
  ▼
Supabase Auth creates user + confirmation email
  │
  ▼
Backend creates Profile { role: "doctor", status: "active",
                          verification_status: "unverified",
                          onboarding_completed: false }
  └─ DoctorProfile row created with bmdc_number placeholder
  │
  ▼
Email confirmed → user enters onboarding wizard
```

### Onboarding Steps (6 Steps)

Each step calls `PATCH /profile/doctor/onboarding` with the step payload.

| Step | Fields | Notes |
|---|---|---|
| 1 — Personal Identity | title, gender, date_of_birth, profile_photo_url, nid_number | Profile photo uploaded to Supabase Storage first |
| 2 — Professional Credentials | bmdc_number, bmdc_document_url, qualifications, degree, degree_certificates_url, education (JSON) | BMDC doc uploaded to Storage |
| 3 — Specialization | speciality_id, sub_specializations (JSON), services (JSON) | Selects from `specialities` table |
| 4 — Experience | years_of_experience, work_experience (JSON) | Each entry: position, hospital, from_year, to_year, current |
| 5 — Practice Details | hospital_name, hospital_address, chamber_name, chamber_address, coordinates, consultation_mode, affiliation_letter_url | Geocoding via `POST /doctor/geocode` |
| 6 — Consultation Setup | consultation_fee, follow_up_fee, visiting_hours (JSON), google_calendar_enabled | visiting_hours: `{ day: [{start, end}] }` |

On final step: `POST /profile/complete-onboarding` → sets `onboarding_completed = true`, `verification_status = "pending"`.

### Doctor Verification (Admin Flow)

After onboarding completes, the doctor is in `verification_status = "pending"`. They cannot access clinical features until verified.

```
Admin sees doctor in /admin/requests (GET /admin/pending-doctors)
  │
  ├─ Admin reviews BMDC document, credentials
  │
  ├─ Approve: POST /admin/verify-doctor/{doctor_id}
  │     └─ Sets verification_status = "verified", verified_at = now()
  │     └─ Creates notification to doctor
  │
  └─ Reject: POST /admin/verify-doctor/{doctor_id} { action: "reject", reason }
        └─ Sets verification_status = "rejected"
        └─ Creates notification to doctor
```

`require_doctor` dependency in backend enforces: `role == "doctor" AND verification_status == "verified"`. Unverified doctors receive HTTP 403 on all clinical endpoints.

---

## Admin Account

Admin accounts are provisioned directly in the database. No self-registration flow. The admin role check in `admin.py` uses a separate `require_admin` dependency that verifies `profile.role == "admin"`.
