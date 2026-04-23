# API Routes Reference

All routes are on the FastAPI backend. Base URL: configured by `NEXT_PUBLIC_API_URL` in frontend env.

Auth: `Authorization: Bearer <supabase_jwt>` on all protected endpoints.

---

## Authentication — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup/patient` | No | Patient registration |
| POST | `/auth/signup/doctor` | No | Doctor registration |
| POST | `/auth/login` | No | Email/password login |
| POST | `/auth/logout` | No | Logout (Supabase token revoke) |
| GET | `/auth/me` | Yes | Current user profile |
| POST | `/auth/forgot-password` | No | Send reset email |
| POST | `/auth/reset-password` | No | Set new password |

---

## Profile — `/profile`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile/verification-status` | Yes | Own verification status |
| PATCH | `/profile/patient/onboarding` | Patient | Save onboarding step |
| PATCH | `/profile/doctor/onboarding` | Doctor | Save onboarding step |
| POST | `/profile/complete-onboarding` | Yes | Finalize onboarding |
| GET | `/profile/patient/ai-access` | Patient | AI access preferences |

---

## Doctor — `/doctor`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/doctor/search` | Yes | Search doctors (name, specialty, location) |
| GET | `/doctor/{profile_id}` | Yes | Doctor public profile |
| GET | `/doctor/{profile_id}/slots` | Yes | Available appointment slots for a date |
| POST | `/doctor/geocode` | Doctor | Geocode address text → lat/lng |
| POST | `/doctor/geocode-location/{doctor_id}` | Doctor | Geocode a specific doctor location |

---

## Specialities — `/specialities`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/specialities` | Yes | All specialties list |
| GET | `/specialities/search` | Yes | Search specialties by name |

---

## Appointment — `/appointment`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/appointment/` | Patient | Create appointment (with soft-hold) |
| GET | `/appointment/my-appointments` | Yes | Own appointments list |
| GET | `/appointment/upcoming` | Yes | Next N upcoming appointments |
| GET | `/appointment/by-date/{date}` | Doctor | Doctor's appointments on a date |
| GET | `/appointment/stats` | Yes | Appointment statistics |
| GET | `/appointment/cancellation-reasons` | Yes | Role-appropriate cancellation reason catalog |
| PATCH | `/appointment/{id}` | Yes | Update appointment status |
| PATCH | `/appointment/{id}/cancel` | Yes | Cancel with reason |
| DELETE | `/appointment/{id}/pending-request` | Yes | Delete a pending appointment |
| GET | `/appointment/doctor/{id}/booked-slots` | Yes | Booked slots for a doctor on a date |
| GET | `/appointment/patient/previously-visited` | Patient | Doctors the patient has seen before |
| GET | `/appointment/patient/calendar` | Patient | Calendar view of patient appointments |
| GET | `/appointment/doctor/patients` | Doctor | Patients with appointments |

---

## Availability — `/availability`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/availability/{doctor_id}` | Yes | Doctor's weekly availability template |
| GET | `/availability/{doctor_id}/slots/{date}` | Yes | Available slots for a specific date |
| PUT | `/availability/weekly` | Doctor | Set weekly schedule |
| POST | `/availability/exception` | Doctor | Add day-off exception |
| DELETE | `/availability/exception/{id}` | Doctor | Remove exception |
| POST | `/availability/override` | Doctor | Add extra availability override |
| DELETE | `/availability/override/{id}` | Doctor | Remove override |

---

## Reschedule — `/reschedule`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reschedule/` | Yes | Create reschedule request |
| GET | `/reschedule/` | Yes | List pending reschedule requests |
| PATCH | `/reschedule/{id}` | Yes | Accept or reject reschedule |

---

## Consultation — `/consultation`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/consultation/` | Doctor | Start a consultation |
| GET | `/consultation/{id}` | Yes | Get consultation detail |
| PATCH | `/consultation/{id}` | Doctor | Update consultation fields |
| PATCH | `/consultation/{id}/complete` | Doctor | Mark consultation complete |
| PATCH | `/consultation/{id}/draft` | Doctor | Auto-save draft snapshot |
| POST | `/consultation/{id}/prescription` | Doctor | Issue prescription |
| GET | `/consultation/{id}/prescription` | Yes | Get prescriptions for consultation |
| GET | `/consultation/patient/{patient_id}` | Doctor | All consultations for a patient |
| POST | `/consultation/{id}/prescription/{pid}/render` | Doctor | Generate rendered HTML snapshot |

---

## AI — `/ai`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/ai/search` | Patient | AI doctor search (specialty extraction + ranking) |
| GET | `/ai/patient-summary` | Doctor | AI patient summary (consent-filtered) |
| GET | `/ai/patient-summary-patient-view` | Patient | Simplified AI summary for patient |
| POST | `/ai/clinical-info` | Doctor | Clinical reference query |
| POST | `/ai/normalize/voice` | Yes | Audio → transcript (Faster-Whisper ASR) |
| POST | `/ai/voice-to-notes` | Doctor | Transcript → SOAP notes |
| GET | `/ai/prescription-explainer` | Patient | AI explanation of a prescription |
| POST | `/ai/chorui/assistant` | Yes | Chorui assistant message |
| GET | `/ai/chorui/conversations` | Yes | List Chorui conversations |
| GET | `/ai/chorui/conversations/{id}` | Yes | Conversation history |
| DELETE | `/ai/chorui/conversations/{id}` | Yes | Delete conversation |
| POST | `/ai/chorui/intake/save` | Yes | Save structured Chorui intake |

---

## Medicine — `/medicine`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/medicine/search` | Yes | Search medicines by name/generic |
| GET | `/medicine/filters` | Yes | Available filter options |
| GET | `/medicine/{drug_id}` | Yes | Drug detail |
| GET | `/medicine/brand/{brand_id}` | Yes | Brand detail |

---

## Medical Reports — `/medical-reports`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/medical-reports/upload` | Patient | Upload report image, trigger OCR |
| GET | `/medical-reports` | Yes | List reports (patient sees own; doctor sees shared) |
| GET | `/medical-reports/{report_id}` | Yes | Report detail + extracted tests |

---

## Medical Test — `/medical-test`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/medical-test/` | Doctor | Create test result |
| GET | `/medical-test/patient/{patient_id}` | Yes | Tests for a patient |
| PATCH | `/medical-test/{id}` | Doctor | Update test |
| DELETE | `/medical-test/{id}` | Doctor | Delete test |

---

## Health Metrics — `/health-metrics`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/health-metrics/` | Patient | Log a health reading |
| GET | `/health-metrics/` | Patient | List own readings (filterable by type/date) |
| GET | `/health-metrics/today` | Patient | Today's readings summary |
| GET | `/health-metrics/trends` | Patient | Trend data for charts |
| PATCH | `/health-metrics/{id}` | Patient | Update reading |
| DELETE | `/health-metrics/{id}` | Patient | Delete reading |

---

## Health Data Consent — `/health-data`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health-data/consent` | Patient | Current consent per data type |
| PATCH | `/health-data/consent` | Patient | Update consent for a data type |

---

## Notifications — `/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/vapid-key` | No | VAPID public key for push subscription |
| POST | `/notifications/subscribe` | Yes | Subscribe to push notifications |
| POST | `/notifications/unsubscribe` | Yes | Unsubscribe |
| GET | `/notifications/` | Yes | List notifications |
| GET | `/notifications/unread-count` | Yes | Unread count |
| PATCH | `/notifications/{id}` | Yes | Mark as read |
| POST | `/notifications/mark-read` | Yes | Bulk mark read |

---

## Reminders — `/reminders`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reminders/` | Yes | Create reminder |
| GET | `/reminders/` | Yes | List own reminders |
| PATCH | `/reminders/{id}` | Yes | Update reminder |
| DELETE | `/reminders/{id}` | Yes | Delete reminder |

---

## Patient Dashboard — `/patient`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patient/dashboard` | Patient | Aggregated home data (appointments, prescriptions, metrics) |

---

## Patient Access — `/patient-access`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patient-access/log` | Yes | Access log for own data |
| GET | `/patient-access/check/{patient_id}` | Doctor | Check if doctor can access patient |

---

## Patient Data Sharing — `/patient-data-sharing`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patient-data-sharing/doctors` | Patient | List doctors with any sharing relationship |
| GET | `/patient-data-sharing/{doctor_id}` | Patient | Sharing preferences for one doctor |
| GET | `/patient-data-sharing` | Patient | All sharing preferences |
| PATCH | `/patient-data-sharing/{doctor_id}` | Patient | Update sharing for a doctor |
| PUT | `/patient-data-sharing/bulk` | Patient | Bulk update sharing |
| DELETE | `/patient-data-sharing/doctors/{doctor_id}` | Patient | Remove sharing for a doctor |

---

## Admin — `/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/pending-doctors` | Admin | Doctors awaiting verification |
| POST | `/admin/verify-doctor/{id}` | Admin | Approve or reject doctor |
| GET | `/admin/doctors` | Admin | All doctors list |
| GET | `/admin/stats` | Admin | Platform statistics |
| GET, PATCH, DELETE | `/admin/users/*` | Admin | User management |
| GET | `/admin/audit-log` | Admin | Audit log |

---

## Upload — `/upload`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload/` | Yes | Upload file to Supabase Storage, returns URL |

---

## OAuth — `/oauth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/oauth/google/authorize` | Doctor | Initiate Google Calendar OAuth |
| GET | `/oauth/google/callback` | Doctor | Handle OAuth callback, store token |
| DELETE | `/oauth/google/revoke` | Doctor | Revoke Google Calendar access |

---

## Doctor Actions — `/doctor/actions`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/doctor/actions/` | Doctor | Log a doctor action |
| GET | `/doctor/actions/` | Doctor | List own actions |
| PATCH | `/doctor/actions/{id}` | Doctor | Update action status |

---

## Health — `/health`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Service health check |

---

## OCR Microservice (Separate Service)

Base URL: configured by `OCR_SERVICE_URL` in backend env.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | OCR service health |
| POST | `/ocr/prescription` | Header token | Extract medications from prescription image |
| POST | `/ocr/medical-report` | Header token | Extract test results from lab report |

OCR requests use `X-Medora-Subject-Token` header (anonymized user token, not a JWT).
