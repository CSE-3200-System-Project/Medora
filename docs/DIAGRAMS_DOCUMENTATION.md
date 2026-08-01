# Architecture Diagrams Documentation

## Overview

This document describes the architecture diagrams for Medora. The actual diagram files should be placed in `docs/diagrams/` and `docs/screens/` directories. This document provides the specifications and structure for each diagram.

---

## 1. System Architecture Diagram

**File**: `docs/architecture.png`  
**Purpose**: High-level system overview showing service boundaries and communication

### Components to Include

```
┌──────────────────────────────────────────────────────────────────┐
│                          Medora Architecture                      │
│                                                                   │
│  ┌─────────────────┐         HTTPS/Bearer Auth      ┌──────────┐ │
│  │   Frontend      │  ────────────────────────────▶  │ Backend  │ │
│  │   Next.js 16    │                                 │ FastAPI  │ │
│  │   PWA + React   │                                 │ Python   │ │
│  │   19            │                                 │ 3.11     │ │
│  └───────┬─────────┘                                 └────┬─────┘ │
│          │                                                 │       │
│          │ Supabase Client                                 │ Async │
│          │ + Realtime                                      │ SQLAlch│
│          ▼                                                 ▼       │
│  ┌─────────────────┐         ┌──────────────────────────────┐    │
│  │   Supabase      │ ◀─────▶ │   PostgreSQL (Supabase)      │    │
│  │   Auth/Storage  │         │   RLS + Transactions         │    │
│  │   Realtime      │         └──────────────┬───────────────┘    │
│  └─────────────────┘                        │                    │
│                                             │ OCR Delegation     │
│                                             ▼                    │
│                                    ┌──────────────────┐          │
│                                    │  AI OCR Service   │          │
│                                    │  YOLO + Azure OCR │          │
│                                    │  FastAPI 8001     │          │
│                                    └──────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow Arrows
1. User → Frontend (Browser/PWA interaction)
2. Frontend → Backend (HTTPS with Bearer token)
3. Frontend → Supabase (Auth, Storage, Realtime channels)
4. Backend → PostgreSQL (Async SQLAlchemy)
5. Backend → AI OCR Service (HTTP delegation for OCR)
6. Supabase → Frontend (Realtime stream events)

### Annotations
- **Ports**: Frontend (3000), Backend (8000), AI OCR (8001)
- **Protocols**: HTTPS, WebSocket (Supabase Realtime), TCP (PostgreSQL)
- **Security**: JWT verification, RBAC, CORS, RLS

---

## 2. Class Diagram (Database Schema)

**File**: `docs/class-diagram.png`  
**Purpose**: Entity-relationship diagram showing database models

### Core Entities (41 Models)

#### User & Profile Layer
```
Profile (Base)
├── role: enum (patient, doctor, admin)
├── email: string
├── created_at: datetime
└── updated_at: datetime

Patient
├── profile_id: FK → Profile
├── first_name, last_name
├── date_of_birth, gender
├── blood_group
├── allergies: JSON
├── chronic_conditions: JSON
├── current_medications: JSON
├── past_surgeries: JSON
└── emergency_contact: JSON

Doctor
├── profile_id: FK → Profile
├── qualifications: JSON
├── specialities: JSON (FK → Speciality)
├── experience_years
├── bio: text
├── is_verified: boolean
├── verification_date: datetime
└── rating: float

Admin
├── profile_id: FK → Profile
└── permissions: JSON
```

#### Appointment Layer
```
Appointment
├── patient_id: FK → Patient
├── doctor_id: FK → Doctor
├── status: enum (pending, confirmed, completed, cancelled, rescheduled)
├── appointment_date: date
├── time_slot: string
├── consultation_type: enum
├── created_at, updated_at
├── cancellation_reason: text
└── cancellation_metadata: JSON

AppointmentRequest (Reschedule)
├── appointment_id: FK → Appointment
├── proposed_date: date
├── proposed_time_slot: string
├── status: enum (pending, accepted, rejected)
├── proposed_by: FK → Doctor
└── responded_at: datetime

DoctorAvailability
├── doctor_id: FK → Doctor
├── day_of_week: string
├── time_slots: JSON
└── is_available: boolean

DoctorLocation
├── doctor_id: FK → Doctor
├── location_name: string
├── address: text
├── latitude, longitude
├── location_type: enum (hospital, chamber)
└── is_primary: boolean

AppointmentAudit
├── appointment_id: FK → Appointment
├── action: string
├── performed_by: string
├── metadata: JSON
└── timestamp: datetime
```

#### Consultation & Prescription Layer
```
Consultation
├── appointment_id: FK → Appointment
├── doctor_id: FK → Doctor
├── patient_id: FK → Patient
├── consultation_type: enum
├── notes: text
├── draft_html: text
├── status: enum
└── created_at, updated_at

Prescription
├── consultation_id: FK → Consultation
├── doctor_id: FK → Doctor
├── patient_id: FK → Patient
├── rendered_html: text
├── snapshot: JSON
├── status: enum (pending, accepted, rejected)
└── created_at, updated_at

MedicationPrescription
├── prescription_id: FK → Prescription
├── medicine_name: string
├── brand_name: string
├── dosage: string
├── frequency: string
├── duration: string
├── instructions: text
└── timing: JSON (before/after meal, morning/night)

TestPrescription
├── prescription_id: FK → Prescription
├── test_name: string
├── test_type: string
└── notes: text

SurgeryRecommendation
├── prescription_id: FK → Prescription
├── procedure_name: string
├── urgency: enum
└── notes: text
```

#### Medical History & Records Layer
```
MedicalReport
├── patient_id: FK → Patient
├── uploaded_by: FK → Profile
├── file_url: string
├── report_type: enum
├── ocr_result: JSON
├── status: enum
└── created_at

HealthMetric
├── patient_id: FK → Patient
├── metric_type: enum (blood_pressure, blood_sugar, heart_rate, temperature, weight)
├── value: float
├── unit: string
├── recorded_at: datetime
└── notes: text

HealthDataConsent
├── patient_id: FK → Patient
├── granted_to: FK → Doctor
├── consent_type: enum
├── status: enum (active, revoked)
├── granted_at, revoked_at
└── scope: JSON

PatientDataSharing
├── patient_id: FK → Patient
├── sharing_with: FK → Doctor
├── share_medications: boolean
├── share_tests: boolean
├── share_surgeries: boolean
├── share_vitals: boolean
└── updated_at

PatientAccess
├── patient_id: FK → Patient
├── accessed_by: FK → Doctor
├── access_type: enum
├── granted_at: datetime
└── last_accessed: datetime
```

#### AI & Communication Layer
```
AIInteraction
├── user_id: FK → Profile
├── interaction_type: enum (search, chat, voice)
├── provider: enum (groq, gemini, cerdasbras)
├── input_text: text
├── output_text: text
├── latency_ms: int
├── created_at
└── metadata: JSON

ChoruiChat
├── user_id: FK → Profile
├── conversation_id: string
├── role: enum (patient, doctor)
├── message: text
├── is_user_message: boolean
├── context: JSON
└── created_at

Reminder
├── patient_id: FK → Patient
├── reminder_type: enum (medication, appointment)
├── scheduled_at: datetime
├── status: enum (pending, sent, skipped)
├── timezone: string
├── medication_name: string
└── recurrence: JSON

Notification
├── user_id: FK → Profile
├── notification_type: enum (10+ types)
├── title: string
├── message: text
├── metadata: JSON
├── is_read: boolean
├── created_at
└── delivery_status: enum

MediaFile
├── uploaded_by: FK → Profile
├── file_url: string
├── file_type: enum
├── file_size: int
└── created_at

Medicine
├── name: string
├── brand_name: string
├── generic_name: string
├── dosage_form: enum
├── strength: string
├── manufacturer: string
└── category: string

Speciality
├── name: string
├── description: text
└── icon: string

DoctorAction
├── doctor_id: FK → Doctor
├── action_type: enum
├── description: text
├── status: enum
├── due_date: datetime
└── completed_at

OAuthToken
├── user_id: FK → Profile
├── provider: string
├── access_token: string
├── refresh_token: string
├── expires_at: datetime
└── scopes: JSON
```

### Relationships
- Profile 1→1 Patient/Doctor/Admin (inheritance)
- Patient 1→* Appointments (as patient)
- Doctor 1→* Appointments (as doctor)
- Doctor 1→* DoctorAvailability
- Doctor 1→* DoctorLocation
- Appointment 1→1 Consultation
- Consultation 1→1 Prescription
- Prescription 1→* MedicationPrescription
- Prescription 1→* TestPrescription
- Prescription 1→* SurgeryRecommendation
- Patient 1→* MedicalReport
- Patient 1→* HealthMetric
- Patient 1→* HealthDataConsent
- Patient 1→* Reminder
- Patient 1→* Notification
- Profile 1→* AIInteraction
- Profile 1→* ChoruiChat

---

## 3. Data Flow Diagram (DFD)

**File**: `docs/dfd.png`  
**Purpose**: Show data movement through the system

### Level 0 DFD (Context Diagram)

```
┌──────────┐                                    ┌──────────┐
│ Patient  │                                    │ Doctor   │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │  Login, Search, Book, View                     │  Login, Manage, Prescribe
     ▼                                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    Medora System                              │
│                                                               │
│  ┌───────────┐   ┌────────────┐   ┌──────────┐              │
│  │ Frontend  │   │ Backend    │   │ AI OCR   │              │
│  │ Next.js   │◀─▶│ FastAPI    │◀─▶│ Service  │              │
│  └─────┬─────┘   └─────┬──────┘   └──────────┘              │
│        │               │                                     │
│        ▼               ▼                                     │
│  ┌────────────────────────────┐                              │
│  │   Supabase (PostgreSQL)    │                              │
│  │   Auth, Storage, Realtime  │                              │
│  └────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
     │                                                │
     │  Notifications, Results                        │  Notifications, Reports
     ▼                                                ▼
┌──────────┐                                    ┌──────────┐
│ Notifications                                 │ Admin    │
│ (Push, Email, In-App)                         └────┬─────┘
└──────────┘                                         │
                                                     │  Verify, Moderate
                                                     ▼
                                              ┌──────────┐
                                              │ Medora   │
                                              │ System   │
                                              └──────────┘
```

### Level 1 DFD (Process Breakdown)

**Process 1: Authentication & Onboarding**
```
User → [Signup/Login] → Supabase Auth → JWT Token → [Onboarding] → Profile Created
```

**Process 2: Appointment Booking**
```
Patient → [Search Doctors] → AI Doctor Search → Doctor List
Patient → [Select Slot] → Backend Validates → Appointment Created
Backend → [Notify Doctor] → Notification Dispatched
```

**Process 3: Consultation & Prescription**
```
Doctor → [Start Consultation] → Consultation Created
Doctor → [Fill Prescription Form] → Prescription Saved
Patient → [Receive Notification] → Views Prescription → Accepts/Rejects
```

**Process 4: Prescription OCR**
```
Patient → [Upload Prescription] → Backend Receives Image
Backend → [Delegate to AI OCR] → AI OCR Service Processes
AI OCR → [YOLO Detection] → [Azure OCR Extraction] → [Parser Structuring]
AI OCR → [Return Structured Data] → Backend Stores → Patient Views
```

**Process 5: AI Chat (Chorui)**
```
User → [Send Message] → Backend Receives
Backend → [Consent + known-identifier redaction] → AI Orchestrator → named LLM Provider
LLM → [Generate Response] → Backend Validates → Stores Conversation
Backend → [Return Response] → User Sees Reply
```

**Process 6: Reminder Dispatch**
```
Background Loop → [Scan Due Reminders] → Create Notifications
Notifications → [Push via VAPID] → [Email via SMTP] → [In-App]
Delivery Logs → [Record Success/Failure] → Update Reminder Status
```

---

## 4. Use Case Diagram

**File**: `docs/use-case-diagram.png`  
**Purpose**: Show actor interactions with system features

### Actors
1. **Patient** (Primary user)
2. **Doctor** (Primary user)
3. **Admin** (System administrator)
4. **AI OCR Service** (Secondary actor)
5. **LLM Provider** (Secondary actor: Groq/Gemini/Cerebras)
6. **Supabase** (Secondary actor: Auth, Storage, Database)

### Patient Use Cases
- Register & Login
- Complete Onboarding
- Search Doctors (AI-powered)
- Book Appointment
- View/Cancel/Reschedule Appointment
- View Medical History
- Update Medical History
- View Prescription
- Accept/Reject Prescription
- Track Health Metrics
- Set Medication Reminders
- Chat with Chorui AI
- Upload Prescription for OCR
- View Analytics Dashboard
- Manage Data Sharing Consent
- Receive Notifications

### Doctor Use Cases
- Register & Login
- Complete Onboarding
- Manage Profile & Schedule
- View Appointments
- Confirm/Reschedule/Complete Appointments
- Access Patient Records (with consent)
- Create Consultation
- Issue Prescription (Medications, Tests, Procedures)
- View Practice Analytics
- Chat with Chorui AI (Patient Summaries)
- Manage Doctor Actions
- Receive Notifications

### Admin Use Cases
- Login to Admin Panel
- Review Doctor Verifications
- Approve/Reject Doctors
- Manage Patient Accounts
- View System Dashboard
- Moderate Accounts (Ban/Suspend)
- Review Schedules

### System Use Cases (Automated)
- Dispatch Reminders
- Send Notifications
- Process OCR (AI OCR Service)
- Generate AI Responses (LLM Provider)
- Sync Google Calendar
- Push Realtime Updates (Supabase)

---

## 5. Activity Diagrams

**File**: `docs/activity-diagram.png`  
**Purpose**: Show workflow sequences for critical processes

### Activity 1: Appointment Booking Flow

```
Start
  ↓
Patient searches for doctor (AI-powered)
  ↓
System returns ranked doctor list
  ↓
Patient selects doctor and date
  ↓
System fetches available time slots (realtime)
  ↓
Patient selects time slot
  ↓
System validates slot availability
  ├─ Slot taken → Show error → Return to slot selection
  └─ Slot available → Create appointment (status: pending)
  ↓
System sends notification to doctor
  ↓
Doctor reviews appointment
  ├─ Doctor rejects → Appointment cancelled → Notify patient → End
  └─ Doctor confirms → Status: confirmed → Notify patient
  ↓
Appointment appears in both dashboards
  ↓
End
```

### Activity 2: Prescription OCR Flow

```
Start
  ↓
Patient uploads prescription image
  ↓
Frontend sends to Backend /upload endpoint
  ↓
Backend validates file type and size
  ↓
Backend delegates to AI OCR Service
  ↓
AI OCR Service: Input normalization
  ↓
YOLO region detection
  ├─ Regions detected → Continue
  └─ No regions → Return error → End
  ↓
Azure Document Intelligence OCR extraction
  ├─ OCR successful → Continue
  └─ OCR failed → Try PaddleOCR fallback
      ├─ Fallback successful → Continue
      └─ Fallback failed → Return error → End
  ↓
Parser structures output (medications, tests, dosages)
  ↓
RapidFuzz medicine matching against database
  ↓
AI OCR Service returns structured JSON
  ↓
Backend stores OCR result
  ↓
Frontend displays extracted data to patient
  ↓
End
```

### Activity 3: Reschedule Workflow

```
Start
  ↓
Doctor initiates reschedule (proposes new date/time)
  ↓
System creates AppointmentRequest (status: pending)
  ↓
System sends notification to patient
  ↓
Patient receives notification
  ↓
Patient reviews proposed time
  ↓
Patient decision
  ├─ Patient accepts
  │   ↓
  │   System updates appointment with new time
  │   ↓
  │   System sends acceptance notification to doctor
  │   ↓
  │   Both dashboards updated
  │   ↓
  └─ Patient rejects
      ↓
      System marks request as rejected
      ↓
      System sends rejection notification to doctor
      ↓
      Doctor can propose new time or cancel
      ↓
End
```

### Activity 4: Chorui AI Chat Flow

```
Start
  ↓
User sends message to Chorui
  ↓
Backend receives request with role context
  ↓
Backend enforces privacy/consent checks
  ↓
Backend requires purpose-specific consent and applies known-identifier redaction;
unknown or indirect identifiers remain a documented residual risk.
  ↓
Backend assembles context (user profile, relevant data)
  ↓
AI Orchestrator selects LLM provider
  ↓
LLM generates response
  ↓
Backend validates response schema
  ↓
Backend stores conversation turn
  ↓
Backend returns response to user
  ↓
User sees reply
  ├─ User sends another message → Loop to "User sends message"
  └─ User ends conversation → End
```

### Activity 5: Doctor Verification Flow

```
Start
  ↓
Doctor registers with qualifications
  ↓
System creates profile (is_verified: false)
  ↓
System places doctor in verification queue
  ↓
Admin reviews pending verification
  ↓
Admin examines documents and qualifications
  ↓
Admin decision
  ├─ Admin approves
  │   ↓
  │   System sets is_verified: true
  │   ↓
  │   System sends approval notification to doctor
  │   ↓
  │   Doctor gains access to clinical features
  │   ↓
  └─ Admin rejects
      ↓
      System records rejection reason
      ↓
      System sends rejection notification to doctor
      ↓
      Doctor can update and reapply
      ↓
End
```

---

## 6. Sequence Diagrams

### Sequence 1: Patient Books Appointment

```
Patient           Frontend          Backend           Supabase          Doctor
   │                │                 │                 │                │
   │─Search doctor─▶│                 │                 │                │
   │                │─AI search req─▶│                 │                │
   │                │                 │─Query doctors──▶│                │
   │                │                 │◀─Doctor list────│                │
   │                │◀─Doctor list────│                 │                │
   │◀─Display results│                 │                 │                │
   │                │                 │                 │                │
   │─Select slot───▶│                 │                 │                │
   │                │─Book request──▶│                 │                │
   │                │                 │─Check slot─────▶│                │
   │                │                 │◀─Slot available─│                │
   │                │                 │                 │                │
   │                │                 │─Create appt────▶│                │
   │                │                 │◀─Appt created───│                │
   │                │                 │                 │                │
   │                │                 │─────────────────Notify doctor──▶│
   │                │◀─Booking conf───│                 │                │
   │◀─Confirmation──│                 │                 │                │
```

### Sequence 2: Prescription OCR Processing

```
Patient           Frontend          Backend           AI OCR Service    Azure OCR
   │                │                 │                 │                │
   │─Upload image──▶│                 │                 │                │
   │                │─POST /upload──▶│                 │                │
   │                │                 │─Delegate OCR───▶│                │
   │                │                 │                 │─YOLO detect───│
   │                │                 │                 │◀─Regions───────│
   │                │                 │                 │                │
   │                │                 │                 │─Send to Azure──▶
   │                │                 │                 │◀─Extracted text─│
   │                │                 │                 │                │
   │                │                 │                 │─Parse & match──│
   │                │                 │◀─Structured data│                │
   │                │◀─OCR result─────│                 │                │
   │◀─Display data──│                 │                 │                │
```

---

## 7. Component Deployment Diagram

**File**: `docs/deployment-diagram.png` (optional, can be same as architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Cloud                              │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │  Azure Container Apps │                                   │
│  │                       │                                   │
│  │  ┌─────────────────┐ │  ┌──────────────────────────────┐│
│  │  │ Backend Service │ │  │  AI OCR Service              ││
│  │  │ FastAPI :8000   │◀┼──┤  FastAPI :8001               ││
│  │  │ (Public HTTPS)  │ │  │  (Internal only)             ││
│  │  └────────┬────────┘ │  └──────────────────────────────┘│
│  │           │          │                                   │
│  └───────────┼──────────┘                                   │
│              │                                              │
│  ┌───────────▼──────────┐    ┌──────────────────────────┐  │
│  │  Azure Container     │    │  Supabase Cloud           │  │
│  │  Registry (ACR)      │    │  PostgreSQL               │  │
│  │  - Backend image     │    │  Auth                     │  │
│  │  - AI OCR image      │    │  Storage                  │  │
│  └──────────────────────┘    │  Realtime                 │  │
│                              └──────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────┐    ┌──────────────────────┐  │
│  │  Azure Monitor           │    │  Azure Key Vault     │  │
│  │  - Prometheus            │    │  - API keys           │  │
│  │  - Grafana               │    │  - DB credentials     │  │
│  └──────────────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│  User Devices            │
│  - Browser (Desktop)     │
│  - Browser (Mobile)      │
│  - PWA (Installed)       │
└──────────────────────────┘
         │
         │ HTTPS
         ▼
┌──────────────────────────┐
│  Frontend Hosting        │
│  Azure Static Web Apps   │
│  or App Service          │
│  (Next.js PWA)           │
└──────────────────────────┘
```

---

## How to Create the Diagrams

### Recommended Tools
1. **Draw.io (diagrams.net)**: Free, web-based, exports to PNG/SVG
2. **PlantUML**: Text-based diagram generation
3. **Lucidchart**: Professional diagram tool
4. **Mermaid.js**: Markdown-integrated diagrams
5. **Excalidraw**: Hand-drawn style diagrams

### Diagram Specifications for Report

| Diagram | Recommended Size | Format | Placement |
|---------|-----------------|--------|-----------|
| Architecture | 1920x1080 | PNG | Section 5 |
| Class Diagram | 1920x1080 | PNG | Section 9 |
| DFD | 1920x1080 | PNG | Section 9 |
| Use Case | 1920x1080 | PNG | Section 9 |
| Activity | 1920x1080 | PNG | Section 9 |
| Sequence | 1920x1080 | PNG | Section 9 |
| Deployment | 1920x1080 | PNG | Section 5 |

### File Locations
- Architecture diagram: `docs/architecture.png`
- Class diagram: `docs/class-diagram.png`
- DFD: `docs/dfd.png`
- Use case diagram: `docs/use-case-diagram.png`
- Activity diagram: `docs/activity-diagram.png`
- AI Microservices: `docs/diagrams/AI_Microservices*.png` (already exist)
- Azure Cloud: `docs/diagrams/Azure_Cloud_Diagram.png` (already exist)

---

## Existing Diagrams

The following diagrams already exist in `docs/diagrams/`:

| File | Description |
|------|-------------|
| `AI_Micoservices1.png` | AI microservices architecture view 1 |
| `AI_Microservice_Diagram.png` | AI microservices detailed diagram |
| `AI_Microservices2.png` | AI microservices architecture view 2 |
| `Azure_Cloud_Diagram.png` | Azure cloud infrastructure diagram |

These can be referenced in the report and combined with newly created diagrams.

---

## Placeholder Notice

> **⚠️ Action Required**: The actual diagram files need to be created and placed in the appropriate directories (`docs/` and `docs/diagrams/`). Use the specifications above to create professional diagrams using Draw.io, Lucidchart, or your preferred diagram tool.
>
> Recommended priority:
> 1. **Architecture Diagram** (highest priority - required for report)
> 2. **Use Case Diagram** (required for academic report)
> 3. **Class Diagram** (shows database design)
> 4. **DFD** (shows data flow)
> 5. **Activity Diagrams** (shows critical workflows)
> 6. **Sequence Diagrams** (optional, for detailed understanding)
