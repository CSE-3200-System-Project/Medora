# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **Project: MEDORA**

### **Scope: FRONTEND (WEB – Next.js)**

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Vision

Medora is a **secure, structured, longitudinal digital healthcare platform** that enables:

* patients to organize and understand their complete medical history
* doctors to view trusted, categorized, medication-aware patient data
* safe AI assistance without diagnosis or autonomous decisions

The frontend must communicate **trust, seriousness, privacy, and medical accuracy** from the first screen.

---

### 1.2 Frontend Objectives

The frontend must:

1. Enable **structured data entry**, not free-text chaos
2. Make **patient history instantly readable** for doctors
3. Highlight **generic-centric medication intelligence**
4. Enforce **privacy, consent, and access control visually**
5. Support **longitudinal timelines** (not snapshots)
6. Be scalable for future AI, OCR, CV, and research modules

---

## 2. USER ROLES (FRONTEND PERSPECTIVE)

### 2.1 Patient

* Owns their data
* Controls doctor access
* Views, uploads, tracks, and organizes health information

### 2.2 Doctor

* Views patient data only with permission
* Cannot edit patient-declared history (can comment/flag)
* Adds prescriptions, advice, and plans

### 2.3 Admin

* Verifies doctors
* Audits system usage
* Reviews reports and complaints

---

## 3. GLOBAL FRONTEND PRINCIPLES (NON-NEGOTIABLE)

### 3.1 UI Tone

* Calm
* Medical
* Minimal
* No gamification
* No flashy colors

### 3.2 Data Philosophy

* Structured > free text
* Generic drug > brand
* Timeline > single record
* Explicit consent > implicit access

### 3.3 Safety

* No diagnosis language
* No “you have X” statements
* Clear disclaimers everywhere medical content appears

---

## 4. INFORMATION ARCHITECTURE (HIGH LEVEL)

```
Public
 ├── Landing
 ├── Login
 ├── Signup

Auth Required
 ├── Role Selection
 ├── Onboarding (Patient / Doctor)

Patient Dashboard
 ├── Profile
 ├── Medical History
 ├── Medications
 ├── Tests & Reports
 ├── Wound Tracker
 ├── Appointments
 ├── Doctors
 ├── Settings

Doctor Dashboard
 ├── Search Patient (by ID)
 ├── Patient Overview
 ├── Prescriptions
 ├── Notes & Plans
 ├── Appointments
 ├── Profile & Verification

Admin
 ├── Doctor Verification
 ├── Reports & Complaints
 ├── Audit Logs
```

---

## 5. AUTHENTICATION & ONBOARDING

### 5.1 Login Screen

**Fields**

* Email
* Password

**UX**

* Medical disclaimer under form
* Error states must be explicit
* No social login (trust issue)

---

### 5.2 Signup Screen

**Fields**

* Full Name
* Email
* Password
* Confirm Password

**Requirements**

* Strong password enforcement
* Privacy notice acknowledgement checkbox

---

### 5.3 Role Selection Screen

User selects:

* Patient
* Doctor

**Rules**

* Role selection is one-time
* Cannot proceed without selection
* Visual explanation of role differences

---

## 6. PATIENT ONBOARDING (CRITICAL)

### 6.1 Overview

Patient onboarding is an **8-step wizard** that collects comprehensive medical data in a structured format. The wizard:

* Pre-fills data from signup (name, email, phone)
* Allows editing after initial completion
* Uses step indicators for progress
* Validates before progression

---

### 6.2 Step 1: Personal Identity

* NID Number (national ID)
* Date of Birth (date picker)
* Gender (radio: Male/Female/Other)
* Profile Photo (upload with preview)

---

### 6.3 Step 2: Physical & Address

* Height (cm), Weight (kg)
* Blood Group (select)
* Address, City, District, Postal Code, Country
* Marital Status (select)
* Occupation (text)

---

### 6.4 Step 3: Chronic Conditions

**Checkbox-based conditions:**
* Diabetes
* Hypertension
* Heart Disease
* Asthma
* Kidney Disease
* Liver Disease
* Thyroid Disorder
* Neurological Conditions
* Cancer
* Arthritis
* Stroke/CVA
* Epilepsy
* Mental Health Conditions

**Text fields:**
* Other conditions (free text)
* Condition details/notes

---

### 6.5 Step 4: Medications & Allergies

**Current Medications (dynamic list):**
* Medication Name
* Dosage
* Frequency (select)
* Duration
* Prescribed By

**Drug Allergies (dynamic list):**
* Drug Name
* Reaction
* Severity (select)

**Additional allergies:**
* Food Allergies (text)
* Environmental Allergies (text)

---

### 6.6 Step 5: Medical History

**Surgeries (dynamic list):**
* Surgery Name
* Date
* Hospital
* Notes

**Hospitalizations (dynamic list):**
* Reason
* Hospital
* Date
* Duration

**Additional fields:**
* Ongoing Treatment Details (textarea)
* Previous Doctors (text)
* Last Checkup Date (date)

---

### 6.7 Step 6: Family History

**Checkbox-based conditions (first-degree relatives):**
* Diabetes, Hypertension, Heart Disease, Cancer, Stroke
* Asthma, Thalassemia, Blood Disorders
* Mental Health Conditions, Kidney Disease, Thyroid Disorders

**Notes field:**
* Family History Notes (textarea)

---

### 6.8 Step 7: Lifestyle & Mental Health

**Habits:**
* Smoking status, amount, details
* Alcohol use, frequency, details
* Caffeine consumption
* Dietary restrictions

**Activity:**
* Activity Level, Exercise Type & Frequency
* Sleep Duration & Quality
* Water Intake, Stress Level

**Mental Health:**
* Current mental health concerns (textarea)
* Currently in therapy (checkbox)

**Vaccinations (dynamic list):**
* Vaccine Name, Date Received, Next Due Date

---

### 6.9 Step 8: Preferences & Consent

**Language:**
* Languages Spoken (dynamic list)
* Preferred Language (select)
* Preferred Contact Method (select)

**Emergency Contacts:**
* Primary: Name, Relation, Phone, Address
* Secondary: Name, Phone

**Notification Preferences:**
* Appointment, Medication, Health Tips, Doctor Updates

**Consent Checkboxes:**
* Data Storage, AI Assistance, Doctor Access, Research

---

### 6.10 Patient Unique ID Generation

* System-generated
* Visible in profile
* Copyable
* Used by doctors to search

---

### 6.2 Patient Profile Sections (ALL REQUIRED)

#### A. Basic Information

* Name
* Age
* Gender
* Occupation
* Height (optional)
* Weight (optional)

---

#### B. Past Medical History (Structured)

Checkbox-based conditions:

* Hypertension
* Diabetes
* Asthma
* Heart disease
* Kidney disease
* Liver disease
* Thyroid
* Neurological
* Allergies
* Others (notes)

Each condition:

* Yes / No / Unknown
* Since (optional)

---

#### C. Surgical History

Each surgery entry:

* Surgery name
* Reason
* Year
* Document upload (optional)
* **Flag if no document**

Doctors must see the “document missing” flag clearly.

---

#### D. Investigation History

Focus on **last 3 months**

Categories:

* Blood
* Urine
* Kidney
* Liver
* Imaging

Each entry:

* Test name
* Date
* Report upload
* Status (Normal / Abnormal / Unknown)

---

#### E. Medication History (MOST IMPORTANT UI)

Each medicine entry:

* **Generic name (primary)**
* Brand name
* Dose
* Frequency
* Duration
* Current / Past

UI must visually prioritize **generic name**.

---

#### F. Family History

First-degree relatives only:

* Heart disease
* Stroke
* Diabetes
* Asthma
* Hypertension
* Thalassemia
* Blood disorders

---

#### G. Personal History

* Smoking
* Alcohol
* Drugs
* Tobacco (Paan/Jorda)
* Vaccination status:

  * EPI
  * COVID
  * Hepatitis
  * TB
  * TT

---

## 7. PATIENT DASHBOARD

### 7.1 Overview Cards

* Active medications
* Upcoming appointments
* Recent tests
* Wound tracking status

---

### 7.2 Doctors Access Panel

* List of approved doctors
* Pending access requests
* Revoke access button

---

## 8. DOCTOR FLOW

### 8.1 Doctor Onboarding (8-Step Wizard)

Doctor onboarding collects comprehensive professional data:

**Step 1: Personal Identity**
* Title (Dr., Prof., etc.)
* Gender, Date of Birth
* NID Number
* Profile Photo

**Step 2: Professional Credentials**
* BMDC Registration Number
* BMDC Document Upload
* Qualifications
* Degree Type & Certificates
* Education History (dynamic list): degree, institution, year, country

**Step 3: Specialization**
* Primary Specialization
* Sub-specializations (dynamic list)
* Services Offered (dynamic list)

**Step 4: Experience**
* Years of Experience
* Work Experience (dynamic list): position, institution, dates, responsibilities

**Step 5: Practice Details**
* Hospital: name, address, city, country
* Chamber: name, address, city
* Affiliation Letter
* Consultation Mode (online/offline/both)

**Step 6: Consultation Setup**
* Consultation Fee, Follow-up Fee
* Visiting Hours
* Available Days
* Appointment Duration
* Emergency Availability & Contact
* Telemedicine availability & platforms

**Step 7: About**
* Professional bio/about text

**Step 8: Consent**
* Terms accepted
* AI assistance preference
* Languages spoken
* Preferred case types

---

### 8.2 Doctor Verification Status

Doctor status:

* Pending
* Verified
* Rejected

---

### 8.3 Doctor Dashboard

#### A. Patient Search

* Search by **Patient Unique ID**
* No phone/email search

---

#### B. Patient Overview Screen

Must show at a glance:

* Medical history summary
* Medication summary (generic-wise)
* Allergies
* Latest tests
* Wound timeline

---

### 8.3 Prescription Entry

Doctor can:

* Add medicine (generic first)
* Add brand
* Dose, frequency, duration
* Tests
* Advice notes

Doctors cannot edit patient-declared history.

---

### 8.4 Doctor Notes & Plan

* Free text notes
* Care plan
* Visible only to doctors

---

## 9. MEDICATION INTELLIGENCE (FRONTEND DISPLAY)

### 9.1 Generic vs Brand UI

Example:
**Paracetamol**
Napa, Ace, Fast

---

### 9.2 Drug Interaction Flags

* Non-clinical warnings
* “Review required” indicator
* No decisions shown

---

### 9.3 Patient Medicine Info

* Minor side effects
* Reminder scheduling
* No dosage advice

---

## 10. WOUND & FIRST AID MODULE

### 10.1 Input

* Image upload
* Text or voice description

### 10.2 Output

* Basic first aid steps
* Daily photo upload prompt
* Healing timeline visualization

### 10.3 Doctor View

* Visual progression
* Comments
* Escalation flags

---

## 11. REPORTING & FEEDBACK

### 11.1 Doctor Reports

* Incorrect patient data
* Unsafe AI output
* OCR error

### 11.2 Patient Complaints

* Doctor behavior
* Platform issue

---

## 12. PRIVACY & SECURITY (FRONTEND ENFORCED)

* Consent toggles
* Data visibility labels
* Access logs (read-only)
* Lock icons for sensitive sections

---

## 13. NON-FUNCTIONAL REQUIREMENTS (FRONTEND)

* Responsive design
* Accessibility compliant
* Clear error states
* No silent failures
* Performance optimized for low bandwidth

---

## 14. OUT OF SCOPE (FRONTEND PHASE 1)

* Actual AI inference
* OCR accuracy tuning
* Payment processing
* Real-time chat

---

## 15. SUCCESS CRITERIA (FRONTEND)

* Doctor can understand patient history in < 2 minutes
* Patient can enter history without confusion
* Generic vs brand confusion eliminated
* Privacy visibly enforced
* Screens scale without redesign

---

## FINAL NOTE

This PRD is intentionally **strict and conservative**.
That is why it is **publishable, defensible, and realistic** for Bangladesh.

---
