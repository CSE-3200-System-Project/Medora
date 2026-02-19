# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **Project: MEDORA**

### **Scope: BACKEND (FastAPI, AI-Orchestrated, Healthcare-Safe)**

**Last Updated:** January 13, 2026  
**Status:** Active Development with Core Features Implemented  
**Version:** 1.0 (Implementation-Aligned)

---

## EXECUTIVE SUMMARY

Medora backend is a **production-ready healthcare data platform** built with FastAPI, PostgreSQL (Supabase), and Groq AI. It implements:

* **Patient & Doctor Onboarding** (8-step wizards with comprehensive medical data collection)
* **Doctor Verification System** (BMDC credentials validation by admins)
* **Doctor Search & Discovery** (with AI-powered intent extraction via Groq)
* **Appointment Management** (booking, status updates, cancellation)
* **Role-Based Access Control** (Patient, Doctor, Admin with strict permission enforcement)
* **JWT Authentication** (via Supabase Auth)
* **File Upload** (profiles, documents, medical records to Supabase Storage)
* **Async Database** (SQLAlchemy 2.0 + asyncpg for non-blocking I/O)

---

## 1. BACKEND VISION & PURPOSE

### 1.1 Backend Mission

The Medora backend is the **authoritative, safety-enforcing, privacy-preserving core** of the system.

It must:

* Store **complete, structured, longitudinal medical data**
* Strictly enforce **role-based access control (RBAC)**
* Orchestrate **AI modules safely** for doctor matching and intent extraction
* Provide **auditability and research traceability**
* Enable **structured medical history collection** through 8-step onboarding wizards
* Facilitate **doctor-patient matching** and **appointment management**
* Never act as a diagnostic authority

The backend is the **source of truth**, not the frontend, not AI.

### 1.2 Backend Non-Negotiables

* No diagnosis or medical decision-making
* No autonomous medical decisions without human review
* No silent data access without audit logging
* No uncontrolled AI output—all AI responses are validated and logged
* No cross-role data leakage—strict permission enforcement at the route level

---

## 2. BACKEND ACTORS (SYSTEM VIEW)

### 2.1 Patient

* **Owns** all personal medical data
* **Grants and revokes** access to doctors
* **Submits** medical history, documents, images, audio
* **Receives** structured outputs from backend
* **Manages** appointments with doctors
* **Controls** consent preferences for data usage and AI assistance

### 2.2 Doctor

* **Reads** patient data only with explicit permission
* **Cannot alter** patient-declared history (can only add comments/flags)
* **Writes** prescriptions, advice, care plans, and notes
* **Flags** data issues and AI errors
* **Books appointments** with patients
* **Searches** for patients by unique ID
* **Cannot diagnose**—only provides medical guidance based on patient data

### 2.3 Admin

* **Verifies** doctors (manual review of BMDC credentials)
* **Oversees** audit logs and access trails
* **Reviews** complaints and reports
* **Manages** safety escalation and user suspension
* **Cannot access** patient medical data directly

### 2.4 AI Services (Restricted Actor)

* **Operate** only through backend orchestration
* **Never write** directly to database
* **Never bypass** safety rules or access control
* **Always provide** confidence scores and logs
* **Current implementations:**
  - **Groq LLM** (doctor-patient intent extraction and specialty matching)
  - **Future:** OCR for prescription scanning, CV analysis for wound tracking

---

## 3. SYSTEM ARCHITECTURE

### 3.1 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | FastAPI 0.95+ | Async HTTP API server |
| Database | PostgreSQL (Supabase) | Persistent data storage |
| ORM | SQLAlchemy 2.0 | Async object-relational mapping |
| Driver | asyncpg | Non-blocking PostgreSQL driver |
| Auth | Supabase Auth | JWT-based user authentication |
| Storage | Supabase Storage | File uploads (images, documents) |
| AI | Groq LLM | Doctor-patient intent extraction |
| Migrations | Alembic | Database schema versioning |
| Validation | Pydantic v2 | Request/response schema validation |

### 3.2 System Boundaries

### Backend **IS**:

* A medical data authority and gatekeeper
* A secure orchestrator for medical workflows
* A research-grade logging and audit system
* A safety enforcer with strict permission boundaries
* An AI middleware with safety validation
* A HIPAA-adjacent compliance framework (Bangladesh context)
* A longitudinal medical history repository
* A doctor verification and credentialing system

### Backend **IS NOT**:

* A diagnostic engine or decision-maker
* A chatbot or conversational AI
* A replacement for hospitals or medical facilities
* A prescription authority (only stores doctor-written prescriptions)
* A telemedicine platform (appointment coordination only, not call handling)
* A payment processor
* An insurance adjudicator

### 3.3 Architecture Overview

```
Backend Components:
 Authentication Layer (Supabase Auth + JWT)
 Database Layer (PostgreSQL + SQLAlchemy 2.0 async ORM)
 API Routes (FastAPI)
    /auth - Signup, login, logout, token verification
    /profile - Onboarding PATCH/GET for patients and doctors
    /doctor - Doctor search, discovery, and profile retrieval
    /appointment - Appointment CRUD and status management
    /admin - Doctor verification, user management
    /specialities - Specialization master data
    /upload - File upload to Supabase Storage
    /ai - AI-powered doctor matching and intent extraction
    /health - Health check endpoint
 Validation Layer (Pydantic v2 schemas)
 AI Orchestration (Groq LLM client)
 Storage Layer (Supabase Storage for files)
```

---

## 4. AUTHENTICATION & AUTHORIZATION

### 4.1 Authentication Flow

* **Provider:** Supabase Auth (managed JWT service)
* **Registration:**
  1. User signs up with email + password + role-specific data (via `/auth/signup/patient` or `/auth/signup/doctor`)
  2. Supabase creates auth user and returns JWT tokens
  3. Backend creates Profile + role-specific profile (PatientProfile/DoctorProfile)
  4. User receives session with access_token
* **Login:**
  1. User provides email + password (via `/auth/login`)
  2. Supabase validates credentials and returns session
  3. Backend checks account status (banned users are rejected)
  4. Frontend stores access token in secure cookie
* **API Usage:**
  - All protected routes require `Authorization: Bearer <access_token>` header
  - Backend verifies token with Supabase
  - User object injected into route handlers

### 4.2 Authorization (RBAC - Role-Based Access Control)

**User Roles:**
```
PATIENT  - Individual patient user
DOCTOR   - Licensed medical professional
ADMIN    - Platform administrator
```

**Doctor Verification States:**
```
unverified  - Doctor account created, awaiting admin review
pending     - Verification in progress
verified    - Admin approved, can access patient data & book appointments
rejected    - Credentials not accepted, account unusable
```

**Account Status:**
```
active      - Normal account, can use platform
suspended   - Temporary suspension by admin
deleted     - User-initiated deletion (soft delete)
banned      - Permanent suspension (security/violation)
```

### 4.3 Route-Level Authorization

**Public Routes (No Auth):**
```
GET /doctor/search          - Search doctors by specialty, location, etc.
GET /doctor/{profile_id}    - View doctor profile
GET /specialities/          - Get all medical specializations
GET /health                 - Health check
```

**Authenticated Routes (Bearer Token Required):**
```
GET /profile/verification-status
PATCH /profile/patient/onboarding
GET /profile/patient/
PATCH /profile/doctor/onboarding
GET /profile/doctor/
POST /appointment/
GET /appointment/my-appointments
```

**Admin Routes (x-admin-password Header):**
```
GET /admin/pending-doctors
POST /admin/verify-doctor/{id}
GET /admin/doctors
POST /admin/suspend-user/{id}
```

---

## 5. DATA MODELS

### 5.1 Base Profile Table

All users (Patient, Doctor, Admin) have a base `Profile` record:

```python
class Profile(Base):
    __tablename__ = "profiles"
    
    id: str                              # UUID from Supabase Auth
    role: UserRole                       # PATIENT, DOCTOR, ADMIN (enum)
    status: AccountStatus                # active, suspended, deleted, banned
    verification_status: VerificationStatus  # unverified, pending, verified, rejected
    verified_at: datetime | None
    
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    onboarding_completed: bool           # True when wizard completes all 8 steps
    
    created_at: datetime
    updated_at: datetime
```

### 5.2 Patient Profile (PatientProfile)

Comprehensive medical data model with ~100 fields across 8 onboarding steps:

**STEP 1: Personal Identity**
- DOB, gender, profile photo URL, NID number

**STEP 2: Physical & Address**
- Height, weight, blood group, marital status, occupation
- Address, city, district, postal code, country

**STEP 3: Chronic Conditions**
- Boolean flags for 13 common conditions (diabetes, hypertension, heart disease, etc.)
- Free-text condition details and other conditions
- Structured conditions array with onset year and treating physician

**STEP 4: Medications & Allergies**
- Current medications (JSON array): {name, dosage, frequency, duration, generic_name, prescribing_doctor}
- Drug allergies (JSON array): {drug_name, reaction, severity}
- Food and environmental allergies

**STEP 5: Medical History**
- Surgeries (JSON array): {name, year, hospital, reason, document_url}
- Hospitalizations (JSON array): {reason, hospital, year, duration_days}
- Ongoing treatment details, previous doctors, last checkup date

**STEP 6: Family History**
- Boolean flags for 11 conditions in first-degree relatives
- Family history free-text notes

**STEP 7: Lifestyle & Mental Health**
- Substance use (smoking, alcohol, tobacco, drugs, caffeine)
- Physical activity (level, exercise type, frequency)
- Sleep and stress metrics
- Diet and dietary restrictions
- Mental health concerns, therapy status
- Vaccinations (JSON array): {name, date, doses, next_due}
- EPI, COVID, Hepatitis, TB, TT vaccination tracking

**STEP 8: Preferences & Consent**
- Languages spoken, preferred contact method
- Emergency contacts (primary and secondary)
- Notification preferences
- Consent flags: storage, AI, doctor access, research

### 5.3 Doctor Profile (DoctorProfile)

Professional data model with ~80 fields across 8 onboarding steps:

**STEP 1: Personal Identity**
- Title (Dr., Prof., Assoc. Prof., etc.), gender, DOB, NID, profile photo

**STEP 2: Professional Credentials**
- BMDC number (UNIQUE, REQUIRED)
- BMDC document URL + upload timestamp
- Qualifications (free text), degree, degree certificates
- Education history (JSON array): {degree, institution, year, country}

**STEP 3: Specialization**
- Primary speciality (FK to specialities table)
- Sub-specializations (JSON array)
- Services offered (JSON array)

**STEP 4: Experience**
- Years of experience
- Work history (JSON array): {position, hospital, from_year, to_year, current}

**STEP 5: Practice Details**
- Primary hospital: name, address, city, country
- Chamber/clinic: name, address, city
- Affiliation letter URL
- Consultation mode (online, in-person, both)

**STEP 6: Consultation Setup**
- Fees (consultation + follow-up)
- Visiting hours (human-readable)
- Available days (JSON array)
- Appointment duration (minutes)
- Emergency availability + contact
- Telemedicine platforms (zoom, google-meet, whatsapp, etc.)

**STEP 7: About**
- Professional bio/description

**STEP 8: Preferences & Consent**
- Languages spoken
- AI assistance preference
- Case types handled
- Terms acceptance

### 5.4 Appointments

```python
class Appointment(Base):
    __tablename__ = "appointments"
    
    id: str                      # UUID
    doctor_id: str               # FK to doctor_profiles.profile_id
    patient_id: str              # FK to patient_profiles.profile_id
    appointment_date: DateTime
    reason: str                  # Reason for appointment
    notes: str | None            # Additional notes
    status: AppointmentStatus    # PENDING, CONFIRMED, COMPLETED, CANCELLED
    created_at: DateTime
    updated_at: DateTime
```

**Status Workflow:**
```
Appointment created → PENDING
    ↓
Doctor confirms → CONFIRMED
    ↓
After appointment → COMPLETED
    
(Any state) → CANCELLED (patient or doctor action)
```

### 5.5 Specialities (Master Data)

```python
class Speciality(Base):
    __tablename__ = "specialities"
    
    id: int                      # Auto-increment PK
    name: str                    # UNIQUE (e.g., "Cardiology", "Nephrology")
```

**Seeded specialities include:**
- General Practice
- Cardiology, Nephrology, Pulmonology, Gastroenterology
- Neurology, Psychiatry, Endocrinology
- Orthopedics, Dermatology, Ophthalmology
- Gynecology, Pediatrics, Obstetrics
- etc. (full list in database seed)

---

## 6. API ENDPOINTS (Complete Reference)

### 6.1 Authentication Routes (`/auth`)

**POST /auth/signup/patient**
```
Creates patient account
Input: PatientSignup {email, password, first_name, last_name, phone, dob, gender, blood_group, allergies}
Output: {message, user_id, session {access_token, refresh_token}}
Status: 201 Created / 400 Bad Request
```

**POST /auth/signup/doctor**
```
Creates doctor account (sets verification_status = pending)
Input: DoctorSignup {email, password, first_name, last_name, phone, bmdc_number, bmdc_document}
Output: {message, user_id, session {access_token, refresh_token}}
Status: 201 Created / 400 Bad Request
```

**POST /auth/login**
```
Authenticates user
Input: UserLogin {email, password}
Output: {session {access_token, refresh_token}, user {...}, profile {role, verification_status, onboarding_completed}}
Checks: Rejects if account is banned (403)
Status: 200 OK / 401 Unauthorized
```

**POST /auth/logout**
```
Logs out current user
Output: {message: "Logged out successfully"}
Status: 200 OK
```

### 6.2 Profile Routes (`/profile`)

**GET /profile/verification-status**
```
Get current user's verification status
Auth: Required (Bearer token)
Output: {verification_status, role, bmdc_verified}
Status: 200 OK / 404 Not Found
```

**PATCH /profile/patient/onboarding**
```
Update patient onboarding (all 8 steps, partial updates)
Auth: Required (must be patient)
Input: PatientOnboardingUpdate {any subset of ~100 fields}
Output: Updated PatientProfile
Status: 200 OK / 404 Not Found
```

**GET /profile/patient/**
```
Get current user's patient profile
Auth: Required (must be patient)
Output: Complete PatientProfile with all fields
Status: 200 OK / 404 Not Found
```

**PATCH /profile/doctor/onboarding**
```
Update doctor onboarding (all 8 steps, partial updates)
Auth: Required (must be doctor)
Input: DoctorOnboardingUpdate {...}
Output: Updated DoctorProfile
Status: 200 OK / 404 Not Found
```

**GET /profile/doctor/**
```
Get current user's doctor profile
Auth: Required (must be doctor)
Output: Complete DoctorProfile with all fields
Status: 200 OK / 404 Not Found
```

### 6.3 Doctor Routes (`/doctor`)

**GET /doctor/search**
```
Search and filter doctors (public)
Query params:
  - query: Text search (name, specialty, hospital, bio)
  - speciality_id: Filter by speciality
  - city: Filter by location
  - gender: Filter by gender
  - consultation_mode: "online" | "in-person" | "both"
Output: {doctors: [DoctorCardSchema], total: int}
Filters: Only bmdc_verified=true doctors
Status: 200 OK
```

**GET /doctor/{profile_id}**
```
Get complete doctor profile (public)
Path param: profile_id (UUID)
Output: Complete DoctorProfileResponse
Status: 200 OK / 404 Not Found
```

### 6.4 Appointment Routes (`/appointment`)

**POST /appointment/**
```
Book appointment with doctor
Auth: Required (must be patient)
Input: AppointmentCreate {doctor_id, appointment_date, reason, notes}
Output: AppointmentResponse {id, status: PENDING, created_at, ...}
Status: 201 Created / 403 Forbidden / 404 Not Found
```

**GET /appointment/my-appointments**
```
Get user's appointments
Auth: Required
Output: List[AppointmentResponse]
Behavior: Patient sees their appointments, Doctor sees theirs
Status: 200 OK
```

**PATCH /appointment/{appointment_id}**
```
Update appointment status
Auth: Required
Input: AppointmentUpdate {status: "CONFIRMED" | "COMPLETED" | "CANCELLED"}
Permissions:
  - Doctor can: PENDING→CONFIRMED, CONFIRMED→COMPLETED, any→CANCELLED
  - Patient can: any→CANCELLED
Output: Updated AppointmentResponse
Status: 200 OK / 403 Forbidden / 404 Not Found
```

### 6.5 Admin Routes (`/admin`)

**Authentication:** All admin routes require `x-admin-password` header

**GET /admin/test**
```
Test admin authentication
Output: {status: "ok", message: "Admin authentication successful"}
Status: 200 OK / 403 Forbidden
```

**GET /admin/pending-doctors**
```
List doctors awaiting verification
Output: {doctors: [{id, name, email, phone, bmdc_number, specialization, bmdc_document_url, created_at}]}
Status: 200 OK / 403 Forbidden
```

**POST /admin/verify-doctor/{doctor_id}**
```
Approve or reject doctor verification
Input: VerifyDoctorRequest {approved: bool, verification_method: str, notes: str}
Behavior:
  - If approved: Sets verification_status=verified, bmdc_verified=true
  - If rejected: Sets verification_status=rejected, bmdc_verified=false
Output: {status: "verified" | "rejected", doctor_id}
Status: 200 OK / 403 Forbidden / 404 Not Found
```

**GET /admin/doctors**
```
List all doctors with verification status
Output: {doctors: [{id, name, email, bmdc_number, specialization, verification_status}]}
Status: 200 OK / 403 Forbidden
```

### 6.6 Specialities Routes (`/specialities`)

**GET /specialities/**
```
Get all medical specializations (public)
Output: SpecialityListResponse {specialities: [{id, name}], total: int}
Status: 200 OK
```

### 6.7 File Upload Routes (`/upload`)

**POST /upload/**
```
Upload file to Supabase Storage (public, no auth)
Input: Form data with file
Output: {url: "https://...public-url..."}
Behavior:
  - Generates UUID-based filename
  - Uploads to "medora-storage" bucket
  - Returns public URL
Status: 200 OK / 500 Internal Server Error
```

### 6.8 AI Doctor Search Routes (`/ai`)

**POST /ai/search**
```
AI-powered doctor matching
Input: AIDoctorSearchRequest {user_text: str}
Output: AIDoctorSearchResponse {doctors: [...], medical_intent: {...}, ambiguity: "low|medium|high"}
Workflow:
  1. Extract specialties from database
  2. Send to Groq LLM with system prompt
  3. LLM extracts symptoms, severity, specialties with confidence
  4. Filter doctors by extracted specialties
  5. Return matching doctors
Status: 200 OK / 500 Server Error
```

### 6.9 Health Check

**GET /health**
```
Health check endpoint
Output: {status: "ok"}
Status: 200 OK
```

---

## 7. PYDANTIC SCHEMAS

### 7.1 Authentication Schemas

```python
class PatientSignup(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    phone: str
    date_of_birth: date
    gender: str
    blood_group: Optional[str] = None
    allergies: Optional[str] = None

class DoctorSignup(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    phone: str
    bmdc_number: str      # Required and unique
    bmdc_document: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str
```

### 7.2 Nested Data Models

```python
class Medication(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    generic_name: Optional[str] = None
    prescribing_doctor: Optional[str] = None

class DrugAllergy(BaseModel):
    drug_name: str
    reaction: str
    severity: Optional[str] = None

class Surgery(BaseModel):
    name: str
    year: str
    hospital: Optional[str] = None
    reason: Optional[str] = None
    document_url: Optional[str] = None

class Hospitalization(BaseModel):
    reason: str
    hospital: Optional[str] = None
    year: Optional[str] = None
    duration_days: Optional[int] = None

class Vaccination(BaseModel):
    name: str
    date: Optional[str] = None
    doses: Optional[int] = None
    next_due: Optional[str] = None

class Education(BaseModel):
    degree: str
    institution: str
    year: Optional[str] = None
    country: Optional[str] = None

class WorkExperience(BaseModel):
    position: str
    hospital: str
    from_year: Optional[str] = None
    to_year: Optional[str] = None
    current: Optional[bool] = False
```

### 7.3 Onboarding Schemas

**PatientOnboardingUpdate**
- ~100 optional fields covering all 8 steps
- Allows partial updates (idempotent)
- Type conversion: yes/no strings → bool, JSON parsing

**DoctorOnboardingUpdate**
- Similar structure for doctor with professional fields

---

## 8. DATABASE SCHEMA

### 8.1 Current Tables

```sql
profiles (base user table)
 id (PK, UUID from Supabase)
 role (ENUM)
 status (ENUM)
 verification_status (ENUM)
 verified_at, created_at, updated_at

patient_profiles (medical data)
 profile_id (PK, FK)
 ~100 columns for medical history
 JSON arrays: medications, allergies, surgeries, vaccinations, etc.

doctor_profiles (professional data)
 profile_id (PK, FK)
 bmdc_number (UNIQUE)
 speciality_id (FK)
 ~80 columns for credentials
 JSON arrays: education, work_experience, telemedicine_platforms

appointments
 id (PK, UUID)
 doctor_id, patient_id (FK)
 appointment_date, status, reason, notes
 created_at, updated_at

specialities (master data)
 id (PK, auto-increment)
 name (UNIQUE)
```

### 8.2 Migrations (Alembic)

Current migrations in `backend/alembic/versions/`:
- Initial schema (profiles, patient_profiles, doctor_profiles)
- Appointments table
- Onboarding_completed field
- BMDC verification fields
- Specialities and foreign key
- Comprehensive onboarding fields
- Banned account status
- Server defaults for bmdc_verified

---

## 9. DEPLOYMENT & INFRASTRUCTURE

### 9.1 Environment Variables

```bash
# Database
SUPABASE_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=service_role_key

# AI
GROQ_API_KEY=xxx

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://medora.app
```

### 9.2 Architecture

- **FastAPI** async route handlers
- **SQLAlchemy 2.0** async ORM with asyncpg driver
- **Connection pooling** for PostgreSQL
- **Non-blocking I/O** for all database operations
- **Structured logging** (can be upgraded from print statements)

### 9.3 Error Handling

- HTTPException with proper status codes
- Pydantic validation errors (422)
- Database errors → 500 Internal Server Error
- All errors logged to stdout

---

## 10. AI ORCHESTRATION

### 10.1 Groq LLM Integration

**Model:** llama-3.1-8b-instant  
**Use case:** Doctor-patient intent extraction  
**Temperature:** 0.1 (deterministic)  
**Safety:** JSON-only structured output

**Workflow:**
```
Patient input: "I have been coughing for a week and my chest hurts"
  ↓
Groq extracts: symptoms=[cough, chest_pain], specialties=[Pulmonology, Cardiology], severity=high
  ↓
Backend filters: Return verified pulmonologists and cardiologists
  ↓
Frontend displays: Matching doctors
```

---

## 11. SECURITY CONSIDERATIONS

### 11.1 Implemented

*  JWT authentication via Supabase
*  CORS allowlist
*  Role-based access control
*  Authorization header validation
*  Password hashing (Supabase)
*  Banned account detection

### 11.2 Future

* Rate limiting per API key
* Request signing for sensitive operations
* Comprehensive audit logging
* Encryption at rest for sensitive fields
* Device fingerprinting

---

## 12. KNOWN LIMITATIONS (Phase 1)

* Admin access via hardcoded password (not production-ready)
* No appointment conflict detection
* Limited appointment date/time validation
* No notification system (email/SMS)
* No doctor-patient permission model
* No prescription/medication endpoints

---

## 13. SUCCESS METRICS

*  Zero unauthorized access incidents
*  Doctor verification workflow functional
*  Appointment booking working
*  Patient onboarding captures all data
*  AI doctor search returns relevant specialists
*  API response time < 500ms
*  File uploads working
*  Comprehensive audit trails

---

## 14. GUIDING PRINCIPLES

> **The backend exists to protect humans from software mistakes, not to replace human judgment.**

1. **Medical Humility** - Never claim to diagnose or decide
2. **Data Integrity** - Patient data is sacred
3. **Transparency** - All AI usage is logged
4. **Privacy First** - Default deny, require explicit permission
5. **Async First** - Non-blocking I/O everywhere
6. **Type Safety** - Type hints on all functions
7. **Simplicity** - Readable, maintainable code

---

### **END OF BACKEND PRD**
