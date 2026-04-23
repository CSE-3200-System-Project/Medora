# Appointment Workflow

Appointments are the central coordinating object in Medora. They connect patients and doctors, gate consultation creation, and drive the reminder system.

---

## Status State Machine

An appointment passes through up to 12 statuses:

```
                    ┌─────────────────────┐
                    │        PENDING       │  ← created by patient
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
   PENDING_ADMIN_REVIEW  PENDING_DOCTOR_   PENDING_PATIENT_
   (if admin approval     CONFIRMATION     CONFIRMATION
    required)             (doctor reviews) (patient confirms reschedule)
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                        CONFIRMED
                             │
               ┌─────────────┼──────────────┐
               ▼             ▼              ▼
          COMPLETED    RESCHEDULE_     CANCEL_
                       REQUESTED       REQUESTED
                             │              │
                    ┌────────┘              └────────┐
                    ▼                               ▼
         PENDING_PATIENT_CONFIRMATION         CANCELLED /
         (patient accepts new time)     CANCELLED_BY_DOCTOR /
                                        CANCELLED_BY_PATIENT
                                               │
                                               ▼
                                           NO_SHOW
```

---

## Booking Flow (Patient)

```
Patient visits /patient/find-doctor → searches by name/specialty/location
  │
  ├─ Selects doctor → views /patient/doctor/{id}
  │     └─ GET /doctor/{profile_id}/slots?date=... → returns available slot times
  │           (slot_service.py generates slots from doctor_availability minus booked)
  │
  ├─ Selects date + slot → appointment creation form
  │
  ▼
POST /appointment/
  Body: { doctor_id, appointment_date, slot_time, reason, doctor_location_id }
  │
  ├─ Backend validates slot is not already booked
  ├─ Creates Appointment { status: PENDING, hold_expires_at: now() + hold_TTL }
  │     └─ hold_expires_at prevents double-booking during payment/confirmation
  ├─ Creates Reminder record
  ├─ Creates Notification to doctor
  │
  ▼
Patient → /appointment-success page
```

### Soft-Hold Expiry

Appointments start as `PENDING` with a `hold_expires_at` timestamp. The background loop (`_run_hold_expiry_loop`) calls `appointment_service.expire_pending_holds()` every 60 seconds, which sets status to `CANCELLED` for any PENDING appointment past its hold TTL.

---

## Slot Availability

```
GET /doctor/{id}/slots?date=2024-01-15
  │
  ├─ Loads doctor_availability for the requested day-of-week
  ├─ GET /appointment/doctor/{id}/booked-slots?date=...
  │     └─ Returns all confirmed/pending slots for that date
  ├─ slot_service subtracts booked slots from template
  └─ Returns available slot list

Real-time sync:
  Frontend useRealtimeSlots() subscribes to Supabase Realtime channel
  on the appointments table filtered by doctor_id + date.
  Any INSERT/UPDATE pushes a refresh event to all subscribed clients.
```

---

## Reschedule Flow

```
Doctor or Patient initiates reschedule:
  PATCH /appointment/{id} → status: RESCHEDULE_REQUESTED
  or
  POST /reschedule/ { appointment_id, proposed_date, proposed_slot, reason }
    └─ Creates AppointmentRescheduleRequest record
    └─ Creates notification to other party

Other party responds:
  PATCH /reschedule/{request_id} { action: "accept" | "reject", response_note }
    ├─ accept → updates appointment date/slot, status: CONFIRMED
    └─ reject → status: back to CONFIRMED, request marked rejected

Request expiry: reschedule requests have an expires_at field;
  expired unresponded requests are treated as rejected.
```

---

## Cancellation Flow

```
Patient or Doctor initiates:
  PATCH /appointment/{id}/cancel
    Body: { cancellation_reason_key, cancellation_reason_note }
    │
    ├─ reason_key validated against role-appropriate reason catalog
    │   (GET /appointment/cancellation-reasons returns the catalog)
    ├─ Sets status: CANCELLED_BY_PATIENT or CANCELLED_BY_DOCTOR
    ├─ Sets cancelled_by_id, cancelled_at
    └─ Creates notification to other party

Admin cancellation:
  PATCH /appointment/{id} with admin token → any status transition allowed
```

---

## Appointment Lifecycle + Consultation

```
Appointment CONFIRMED
  │
  ▼
Doctor navigates to patient page → /doctor/patient/{id}/consultation
  │
POST /consultation/
  Body: { appointment_id, patient_id, chief_complaint }
    └─ Creates Consultation { status: open, appointment_id }
  │
  ▼
Doctor fills SOAP / creates prescriptions
  ├─ Auto-save: PATCH /consultation/{id}/draft
  │     └─ Updates ConsultationDraft.payload (JSON snapshot)
  │
  └─ Issue prescription: POST /consultation/{id}/prescription
        Body: { type: "medication", items: [...] }
          └─ Creates Prescription + MedicationPrescription / TestPrescription / SurgeryRecommendation children
          └─ Creates Notification to patient

  ▼
Complete: PATCH /consultation/{id}/complete
  └─ Sets status: completed, completed_at: now()
  └─ Sets appointment status: COMPLETED
  └─ Prescription rendered_prescription_snapshot frozen at this point
```

---

## Reminder System

```
On appointment creation:
  Reminder record created { appointment_id, due_at, timezone, status: pending }

reminder_dispatcher (background loop, min 300s interval):
  ├─ SELECT reminders WHERE status=pending AND due_at <= now() + window
  ├─ For each due reminder:
  │   ├─ delivery_method=push → push_service.send_push_to_user()
  │   ├─ delivery_method=email → email_service.send_appointment_reminder_email()
  │   └─ delivery_method=in_app → notification_service.create_notification()
  ├─ Sets reminder.status = sent, sent_at = now()
  └─ Exponential backoff on provider errors
```

---

## Doctor Schedule Management

```
Doctor sets weekly availability:
  PUT /availability/weekly
    Body: { schedule: { monday: [{start: "09:00", end: "13:00"}], ... } }
    └─ Upserts DoctorAvailability records

Exceptions (day off):
  POST /availability/exception { date, reason }
  DELETE /availability/exception/{id}

Overrides (extra availability):
  POST /availability/override { date, slots: [...] }
  DELETE /availability/override/{id}

Slot generation:
  GET /availability/{doctor_id}/slots/{target_date}
    └─ availability_service generates time slots from weekly template
    └─ Subtracts confirmed + pending appointments for that date
    └─ Returns available slots list
```

---

## Google Calendar Sync

```
Doctor enables Google Calendar (Step 6 of onboarding or in settings):
  GET /oauth/google/authorize → redirects to Google OAuth consent
  GET /oauth/google/callback → exchanges code, stores OAuthToken

On appointment CONFIRMED:
  google_calendar_service.create_event(appointment, doctor_token)
    └─ Creates Google Calendar event on doctor's linked calendar
    └─ Stores google_event_id on appointment record

On appointment CANCELLED:
  google_calendar_service.delete_event(google_event_id, doctor_token)
```
