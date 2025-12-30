# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **Project: MEDORA**

### **Scope: BACKEND (FastAPI, AI-Orchestrated, Healthcare-Safe)**

---

## 1. BACKEND VISION & PURPOSE

### 1.1 Backend Mission

The Medora backend is the **authoritative, safety-enforcing, privacy-preserving core** of the system.

It must:

* store **complete, structured, longitudinal medical data**
* strictly enforce **role-based access**
* orchestrate **AI modules safely**
* provide **auditability and research traceability**
* never act as a diagnostic authority

The backend is the **source of truth**, not the frontend, not AI.

---

### 1.2 Backend Non-Negotiables

* No diagnosis
* No autonomous medical decisions
* No silent data access
* No uncontrolled AI output
* No cross-role data leakage

---

## 2. BACKEND ACTORS (SYSTEM VIEW)

### 2.1 Patient (API Perspective)

* Owns medical data
* Grants and revokes access
* Submits history, documents, images, audio
* Receives structured outputs

### 2.2 Doctor

* Reads patient data with permission
* Writes prescriptions, advice, plans
* Flags issues and AI errors
* Cannot alter patient-declared history

### 2.3 Admin

* Verifies doctors
* Oversees audits
* Reviews complaints
* Manages safety escalation

### 2.4 AI Services (Restricted Actor)

* Operate only through backend orchestration
* Never write directly to database
* Never bypass safety rules

---

## 3. SYSTEM BOUNDARIES (WHAT BACKEND IS / IS NOT)

### Backend **IS**:

* A medical data authority
* A secure orchestrator
* A research-grade logging system
* A safety gatekeeper

### Backend **IS NOT**:

* A diagnostic engine
* A chatbot
* A replacement for hospitals
* A prescription authority

---

## 4. AUTHENTICATION & AUTHORIZATION

### 4.1 Authentication

* JWT-based authentication
* Short-lived access tokens
* Refresh token strategy
* Device/session awareness

### 4.2 Authorization (RBAC)

Roles:

* Patient
* Doctor
* Admin

Permissions are:

* Explicit
* Scoped
* Time-bound

Example:

* Doctor can view Patient X from Date A to Date B only

No implicit access ever.

---

## 5. PATIENT IDENTITY & CORE DATA MODEL

### 5.1 Patient Unique ID

* System-generated
* Immutable
* Primary lookup key for doctors
* Never derived from phone/email

---

### 5.2 Patient Core Profile

Stored as structured fields:

* Demographics
* Height/weight (optional)
* Occupation
* Metadata timestamps

---

### 5.3 Patient Onboarding Data Model (Comprehensive)

The patient onboarding collects structured medical data across 8 steps:

**Step 1: Personal Identity**
* NID Number, Date of Birth, Gender
* Profile Photo URL

**Step 2: Physical & Address**
* Height, Weight, Blood Group
* Address, City, District, Postal Code, Country
* Marital Status, Occupation

**Step 3: Chronic Conditions**
* Boolean flags for: Diabetes, Hypertension, Heart Disease, Asthma, Kidney Disease, Liver Disease, Thyroid, Neurological, Cancer, Arthritis, Stroke, Epilepsy, Mental Health
* Condition details and notes (text)
* Other conditions (free text)

**Step 4: Medications & Allergies**
* Current medications (JSON array): name, dose, frequency, duration, prescribedBy
* Drug allergies (JSON array): name, reaction, severity
* Food allergies, Environmental allergies

**Step 5: Medical History**
* Surgeries (JSON array): name, date, hospital, notes
* Hospitalizations (JSON array): reason, hospital, date, duration
* Ongoing treatment details
* Previous doctors, Last checkup date

**Step 6: Family History**
* Boolean flags for: Diabetes, Hypertension, Heart Disease, Cancer, Stroke, Asthma, Thalassemia, Blood Disorders, Mental Health, Kidney Disease, Thyroid
* Family history notes

**Step 7: Lifestyle & Mental Health**
* Smoking status, amount, details
* Alcohol use, frequency, details
* Caffeine consumption
* Dietary restrictions
* Activity level, Exercise type & frequency
* Sleep duration & quality
* Stress level
* Mental health concerns (text)
* Currently in therapy (boolean)
* Vaccinations (JSON array): name, date, nextDue

**Step 8: Preferences & Consent**
* Languages spoken (JSON array)
* Preferred contact method
* Emergency contact (name, relation, phone, address)
* Secondary emergency contact
* Notification preferences
* Consent flags: storage, AI, doctor access, research

---

### 5.4 Doctor Profile Data Model (Comprehensive)

The doctor onboarding collects professional data across 8 steps:

**Step 1: Personal Identity**
* Title (Dr., Prof., etc.), Gender, Date of Birth
* NID Number, Profile Photo

**Step 2: Professional Credentials**
* BMDC Registration Number, BMDC Document
* Qualifications (text), Degree
* Degree Certificates
* Education History (JSON array): degree, institution, year, country

**Step 3: Specialization**
* Primary Specialization
* Sub-specializations (JSON array)
* Services Offered (JSON array)

**Step 4: Experience**
* Years of Experience
* Work Experience (JSON array): position, institution, startDate, endDate, current, responsibilities

**Step 5: Practice Details**
* Hospital: name, address, city, country
* Chamber: name, address, city
* Affiliation Letter URL
* Consultation Mode (online/offline/both)

**Step 6: Consultation Setup**
* Consultation Fee, Follow-up Fee
* Visiting Hours
* Available Days (JSON array)
* Appointment Duration
* Emergency Availability & Contact
* Telemedicine availability & platforms

**Step 7: About**
* Professional bio/about text

**Step 8: Consent**
* Terms accepted
* AI assistance preference
* Languages spoken (JSON array)
* Case types (preferences)

---

## 6. MEDICAL HISTORY DATA MODEL (CRITICAL)

### 6.1 Past Medical History

Stored as:

* Enumerated conditions
* Yes / No / Unknown
* Optional onset date
* Optional notes

No free-text-only storage.

---

### 6.2 Surgical History

Each surgery record:

* Name
* Reason
* Year
* Document reference
* **Document-missing flag**

Backend enforces the flag if no document is uploaded.

---

### 6.3 Investigation History

Rules:

* Latest 3 months prioritized
* Older records archived but queryable

Each test record:

* Category
* Name
* Date
* Report file
* Status

---

## 7. MEDICATION INTELLIGENCE CORE

### 7.1 Generic-Centric Drug Model

Internal representation:

```
GenericDrug
 ├── Brand
 ├── Company
 ├── DosageForm
```

Generic is the primary key.

---

### 7.2 Medication History

Each entry:

* Generic ID
* Brand ID
* Dose
* Frequency
* Duration
* Current / Past flag
* Prescribed by (doctor/system)

---

### 7.3 Drug Interaction Flagging

* Rule-based interaction lookup
* Generates **alerts**, not decisions
* Stored as review-required flags
* Always routed to doctor view

---

## 8. PRESCRIPTION & DOCUMENT PROCESSING (RESEARCH CORE)

### 8.1 OCR Pipeline

Steps:

1. Image intake
2. Quality assessment
3. OCR execution
4. Layout parsing
5. Entity extraction
6. Confidence scoring

### 8.2 Output Rules

* Structured fields only
* Confidence score attached
* Ambiguous fields flagged
* No silent auto-fill

Doctors can confirm or reject OCR results.

---

## 9. AUDIO & MULTIMODAL INPUT HANDLING

### 9.1 Audio Intake

* VAD segmentation
* ASR transcription
* Language detection
* Text normalization

### 9.2 Multimodal Requests

Patient input may include:

* Text
* Voice
* Images

Backend:

* Correlates with patient history
* Routes to matching logic
* Logs context for research

---

## 10. DOCTOR MATCHING & APPOINTMENTS

### 10.1 Doctor Matching

Based on:

* Specialty
* Subspecialty
* Patient history relevance
* Location
* Availability
* Previous consultations

No ranking implies quality or superiority.

---

### 10.2 Appointment Management

Backend supports:

* Create
* Update
* Cancel
* Reschedule

Conflict resolution enforced server-side.

---

## 11. DOCTOR VERIFICATION SYSTEM

### 11.1 Verification Data

Required:

* BM&DC number
* Degree type
* Specialty
* Documents

### 11.2 Verification Status

* Pending
* Approved
* Rejected
* Suspended

Only verified doctors can access patient data.

---

## 12. DOCTOR OUTPUTS

### 12.1 Prescriptions

Doctors can add:

* Medicines (generic-first)
* Tests
* Advice
* Follow-up notes

Stored as immutable medical records.

---

### 12.2 Doctor Notes & Plans

* Editable only by the author
* Versioned
* Time-stamped
* Visible only to doctors

---

## 13. WOUND & FIRST AID MODULE

### 13.1 Image Handling

* Preprocessing
* ROI detection
* Temporal linking

### 13.2 Longitudinal Tracking

* Each upload linked chronologically
* Progress metrics stored
* Regression flags generated

Doctors view progression visually, backend stores metrics.

---

## 14. AI ORCHESTRATION & SAFETY

### 14.1 AI Invocation Rules

* AI never called directly by frontend
* Backend mediates every call
* Context-limited prompts
* Output validated by safety agents

---

### 14.2 Agentic Safety Layer

Agents enforce:

* No diagnosis
* Escalation thresholds
* Explanation depth
* Output blocking

---

## 15. NOTIFICATION SYSTEM

### 15.1 Trigger Types

* Time-based
* Event-based
* Risk-based

### 15.2 Channels

* Patient
* Doctor
* Admin

Notifications are:

* Logged
* Throttled
* Severity-aware

---

## 16. PRIVACY, CONSENT & CONFIDENTIALITY

### 16.1 Consent Enforcement

* Explicit consent records
* Scope-limited access
* Revocable permissions

### 16.2 Access Logging

Every access logs:

* Who
* What
* When
* Why (context)

Audit logs are immutable.

---

## 17. REPORTING & COMPLAINT SYSTEM

### 17.1 Doctor Reports

* AI error
* OCR error
* Data inconsistency

### 17.2 Patient Complaints

* Doctor behavior
* Platform misuse

Admin reviews all reports.

---

## 18. ADMIN OVERSIGHT

Admins can:

* Verify doctors
* Suspend users
* Review audits
* Monitor AI confidence trends
* Export logs for research

Admins never modify clinical data.

---

## 19. NON-FUNCTIONAL REQUIREMENTS

* High availability
* Data integrity
* Fault isolation
* Graceful degradation
* Scalable async processing

---

## 20. OUT OF SCOPE (BACKEND PHASE 1)

* Autonomous diagnosis
* Emergency medical response
* Insurance integration
* National EMR replacement

---

## 21. SUCCESS METRICS (BACKEND)

* Zero unauthorized access incidents
* OCR confidence traceability
* Doctor review completion rates
* Data consistency across timelines
* Reproducible research logs

---

## 22. GUIDING PRINCIPLE

> **The backend exists to protect humans from software mistakes, not to replace human judgment.**

---

### **END OF BACKEND PRD**

---
