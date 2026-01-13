

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Feature Name

**AI-Assisted Doctor Discovery & Appointment Matching (API-based LLM, v1)**

---

## 1. PURPOSE & SCOPE

### Purpose

Enable patients to describe their health problem in **free-form text or voice (Bangla, English, or mixed)** and receive a **ranked list of appropriate doctors** using an **LLM-assisted understanding pipeline**, without allowing the LLM to directly access or manipulate the database.

### Scope (v1)

* Text input only (voice handled upstream via ASR)
* API-based LLM (Groq Llama 3.1 8B)
* Doctor suggestion + ranking
* Manual doctor search as fallback
* No auto-booking
* No diagnosis
* No prescriptions

Local LLM support is **explicitly out of scope for v1**, but architecture must allow drop-in replacement later.

---

## 2. HIGH-LEVEL SYSTEM PRINCIPLES (NON-NEGOTIABLE)

1. **LLM is a language interpreter, not a decision maker**
2. **All database access is performed by backend services**
3. **LLM output must be structured, validated, and confidence-gated**
4. **Medical safety > completeness**
5. **Explainability is mandatory**
6. **User always has final choice**

---

## 3. USER FLOWS

### 3.1 Primary Flow: AI-Assisted Doctor Search

1. User enters problem description (Bangla / English / mixed)
2. Backend sends text to LLM
3. LLM returns structured medical intent (JSON)
4. Backend validates and normalizes output
5. Backend filters doctor candidates from database
6. Backend ranks doctors using deterministic logic / ML ranker
7. Backend returns ranked doctors + explanations
8. User selects doctor or switches to manual search

---

### 3.2 Secondary Flow: Manual Doctor Search

* User searches doctors by:

  * Specialty
  * Location
  * Availability
  * Gender
  * Language
* Same booking pipeline as AI flow
* Data still logged for learning

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Input Handling

* Accept raw text (UTF-8)
* Language can be:

  * Bangla (বাংলা)
  * English
  * Banglish (romanized Bangla)
  * Mixed
* Max input length: 500 characters
* PII must be stripped before LLM call if present

---

### 4.2 LLM Responsibilities (STRICT)

The LLM MUST:

* Extract symptoms
* Extract duration (if present)
* Infer urgency level
* Suggest relevant medical specialties
* Detect ambiguity
* Output standardized English medical labels

The LLM MUST NOT:

* Suggest doctors
* Query the database
* Diagnose diseases
* Recommend medication
* Decide urgency actions

---

### 4.3 LLM API Configuration (v1)

* Provider: **Groq**
* Model: **Llama 3.1 8B**
* Temperature: 0.1
* Max tokens: 300
* Mode: JSON / structured output
* Stateless calls only

---

## 5. LLM PROMPT CONTRACT (FOR COPILOT)

### Prompt Intent

Convert free-form patient description into structured medical intent.

### Prompt Constraints

* Output **only valid JSON**
* Follow exact schema
* Use English labels
* Include confidence scores
* No explanations outside JSON

### Output JSON Schema (MANDATORY)

```json
{
  "language_detected": "bn | en | mixed",
  "symptoms": [
    {
      "name": "string",
      "confidence": 0.0
    }
  ],
  "duration_days": number | null,
  "severity": "low | medium | high",
  "specialties": [
    {
      "name": "string",
      "confidence": 0.0
    }
  ],
  "ambiguity": "low | medium | high"
}
```

If extraction fails, LLM must return:

```json
{
  "error": "unable_to_extract",
  "ambiguity": "high"
}
```

---

## 6. BACKEND VALIDATION & SAFETY LOGIC

### 6.1 JSON Validation

* Strict schema validation
* Reject malformed or partial outputs

### 6.2 Confidence Gating

* Ignore symptoms with confidence < 0.5
* Ignore specialties with confidence < 0.4
* If ambiguity == "high", prompt user for clarification

### 6.3 Urgency Rules

* severity == "high" triggers:

  * Emergency disclaimer
  * Higher ranking weight for experienced doctors
* No emergency services auto-trigger in v1

---

## 7. DATABASE INTERACTION (BACKEND ONLY)

### 7.1 Candidate Doctor Filtering

Backend filters doctors using:

* Specialty IN extracted specialties
* Doctor is active and verified
* Accepts new patients
* Location match
* Consultation mode match
* Availability exists

LLM **never sees doctor data**.

---

### 7.2 Doctor Ranking Engine (v1)

Deterministic weighted scoring:

```text
final_score =
  0.35 * specialty_match
+ 0.25 * experience_years
+ 0.15 * urgency_alignment
+ 0.15 * availability_score
+ 0.10 * historical_success
```

Top N doctors returned (default N = 5).

---

## 8. EXPLANATION GENERATION

### Requirement

Each recommended doctor must include a reason.

### Source of Explanation

* Backend supplies factual reasons
* Optional LLM call to rephrase (low priority)

Example:

> “Recommended because this doctor specializes in cardiology, has 12 years of experience, and is available today.”

---

## 9. API DESIGN (BACKEND)

### POST `/ai/doctor-search`

**Request**

```json
{
  "user_text": "string",
  "location": "string",
  "consultation_mode": "online | offline"
}
```

**Response**

```json
{
  "doctors": [
    {
      "doctor_id": "uuid",
      "name": "string",
      "specialty": "string",
      "score": number,
      "reason": "string"
    }
  ],
  "ambiguity": "low | medium | high"
}
```

---

## 10. ERROR HANDLING

### LLM Failure

* Retry once
* Fallback to manual search
* Log failure

### Low Confidence Output

* Ask user follow-up question
* Do not rank doctors blindly

---

## 11. LOGGING & ANALYTICS (RESEARCH-READY)

Log:

* Raw user text (anonymized)
* LLM output
* Validation result
* Selected doctor
* User override behavior

Purpose:

* Model evaluation
* Bias analysis
* Paper experiments

---

## 12. SECURITY & COMPLIANCE

* No raw PII sent to LLM
* No LLM output written directly to DB
* Full audit trail
* Rate limiting on LLM calls

---

## 13. NON-FUNCTIONAL REQUIREMENTS

* P95 latency < 2 seconds
* LLM calls async
* System must degrade gracefully
* Modular LLM adapter interface

---

## 14. EXTENSIBILITY (v2 READY)

* Local LLM can replace API
* Multi-document context
* Learning-to-rank model
* Bangla fine-tuning

---

## 15. OUT OF SCOPE (EXPLICIT)

* Diagnosis
* Treatment recommendation
* Prescription generation
* Emergency dispatch
* Continuous conversation memory

---

## 16. SUCCESS CRITERIA

* ≥80% correct specialty mapping
* ≤5% invalid LLM outputs
* Clear explanations for all recommendations
* Users can always fall back to manual search

---

## FINAL NOTE FOR COPILOT

> “Treat the LLM as a **pure function**:
> text → structured intent.
> All business logic, ranking, and database access must remain deterministic and backend-controlled.”


Below is a **fully integrated, unified PRD** that **merges**:

1. Your **existing doctor-search PRD** 
2. The **Medora system PRDs (frontend + backend)** you shared earlier
3. The **post-LLM deterministic decision engine, location awareness, and Google Maps integration** we designed afterward

This is **not a rewrite**.
This is a **clean consolidation** that removes conflicts, fills gaps, and aligns everything under one coherent intent.

You can treat this as the **authoritative PRD** for the doctor search feature going forward.

---

# UNIFIED PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Feature Name

**AI-Assisted, Location-Aware Doctor Discovery & Appointment Matching (API-based LLM, v1)**

---

## 1. PURPOSE & PRODUCT INTENT

This feature enables patients to **find the most suitable doctors** by describing their health problem in **Bangla, English, or mixed language**, while preserving:

* Medical safety
* User control
* Explainability
* Deterministic backend decision making

The AI **assists understanding**, but **never makes decisions**.

This feature **extends** the existing Medora doctor search and appointment system. It does not replace manual search.

---

## 2. SCOPE (V1 – STRICT)

### Included

* Text-based symptom input (voice handled upstream via ASR)
* API-based LLM (Groq – Llama 3.1 8B)
* Specialty inference and urgency estimation
* Location-aware doctor ranking for chamber visits
* Google Maps based doctor visualization
* Explainable ranking reasons
* Manual search fallback

### Explicitly Excluded

* Diagnosis
* Treatment or medication suggestions
* Auto-booking
* Emergency dispatch
* Local LLM hosting (planned for v2)

---

## 3. CORE SYSTEM PRINCIPLES (NON-NEGOTIABLE)

1. **LLM = language interpreter only**
2. **Backend owns all decisions**
3. **All ranking is deterministic**
4. **Location affects ranking, not eligibility**
5. **Every recommendation must be explainable**
6. **Manual search must always remain available**

---

## 4. USER FLOWS (INTEGRATED)

### 4.1 Primary Flow – AI-Assisted Search

1. Patient opens `/patient/find-doctor`
2. Patient enters problem description (Bangla / English / mixed)
3. Backend sends text to LLM
4. LLM returns structured medical intent (JSON)
5. Backend validates, normalizes, and safety-checks output
6. Backend filters doctor candidates from database
7. Backend computes ranking scores (including location proximity)
8. Backend returns ranked doctors with reasons
9. Frontend renders:

   * Doctor cards
   * Google Map markers
10. Patient selects doctor or switches to manual search

---

### 4.2 Secondary Flow – Manual Search (Unchanged)

* Search by:

  * Specialty
  * Location
  * Availability
  * Gender
  * Language
* Same booking flow
* User behavior logged for learning

---

## 5. INPUT HANDLING

* Accept UTF-8 text
* Supported inputs:

  * Bangla
  * English
  * Banglish
  * Mixed
* Max length: 500 characters
* PII stripped before LLM call
* AI usage requires explicit patient consent (existing Medora consent model)

---

## 6. LLM ROLE & CONTRACT (UNCHANGED, BUT CONTEXTUALIZED)

### LLM Responsibilities

* Symptom extraction
* Duration extraction (if present)
* Severity estimation
* Specialty inference
* Ambiguity detection

### LLM Must NOT

* Access database
* Suggest doctors
* Rank doctors
* Diagnose
* Recommend medication

### Output Schema (MANDATORY)

```json
{
  "language_detected": "bn | en | mixed",
  "symptoms": [{ "name": "string", "confidence": 0.0 }],
  "duration_days": number | null,
  "severity": "low | medium | high",
  "specialties": [{ "name": "string", "confidence": 0.0 }],
  "ambiguity": "low | medium | high"
}
```

Failure case:

```json
{ "error": "unable_to_extract", "ambiguity": "high" }
```

---

## 7. POST-LLM DECISION ENGINE (NEWLY INTEGRATED CORE)

### 7.1 Validation & Normalization

* Ignore symptoms < 0.5 confidence
* Ignore specialties < 0.4 confidence
* If ambiguity = high → frontend clarification prompt

---

### 7.2 Doctor Candidate Filtering (DATABASE ONLY)

Filters applied:

* Verified doctor (BMDC verified)
* Accepting new patients
* Matching specialty
* Matching consultation mode
* Active availability
* Location present for offline visits

LLM **never sees doctor data**.

---

### 7.3 Feature Computation (Per Doctor)

| Feature            | Description                                  |
| ------------------ | -------------------------------------------- |
| Specialty match    | Primary = 1.0, Secondary = 0.6               |
| Experience score   | Normalized by years                          |
| Severity alignment | Senior doctors prioritized for high severity |
| Location proximity | Haversine distance scoring (offline only)    |
| Availability score | Sooner availability scores higher            |

---

### 7.4 Final Ranking Formula (Authoritative v1)

```text
final_score =
  0.30 * specialty_match
+ 0.20 * experience_score
+ 0.15 * severity_alignment
+ 0.20 * location_proximity
+ 0.15 * availability_score
```

Rules:

* Location weight = 0 for online consultation
* Top N = 5 doctors
* Ranking is deterministic and testable

---

## 8. REASON GENERATION (EXPLAINABILITY)

Reasons are composed from **backend facts only**.

Example rules:

* Specialty match → “Specialist in cardiology”
* Distance < 2 km → “Located nearby”
* Experience > 10 yrs → “12+ years experience”
* High severity → “Suitable for urgent symptoms”

Example output:

> “Recommended because this doctor specializes in cardiology, has over 12 years of experience, and is located 1.2 km away.”

No hallucinated reasons allowed.

---

## 9. LOCATION & GOOGLE MAPS INTEGRATION

### Backend

* Store doctor latitude/longitude
* Compute distance using Haversine formula
* Return coordinates in API response

### Frontend

* Google Maps JS API
* Render markers from backend response
* Marker ↔ card synchronization
* No ranking or filtering on frontend

LLM is **never involved** in map logic.

---

## 10. API DESIGN (FINAL, CONSOLIDATED)

### `POST /ai/doctor-search`

```json
{
  "user_text": "বুকে ব্যথা আর শ্বাস নিতে কষ্ট হচ্ছে",
  "consultation_mode": "offline",
  "user_location": {
    "latitude": 23.8103,
    "longitude": 90.4125
  }
}
```

Response:

```json
{
  "doctors": [
    {
      "doctor_id": "uuid",
      "name": "Dr. Rahman",
      "specialty": "Cardiology",
      "distance_km": 1.2,
      "score": 0.92,
      "reason": "Nearby cardiologist with 12+ years experience"
    }
  ],
  "ambiguity": "low"
}
```

---

## 11. LOGGING & RESEARCH SUPPORT

Logged:

* Anonymized user input
* LLM output
* Validation decisions
* Ranking scores
* User selection or override

Purpose:

* Model evaluation
* Bias and fairness analysis
* Academic publication

---

## 12. NON-FUNCTIONAL REQUIREMENTS

* P95 latency < 2s
* Async LLM calls
* Graceful fallback to manual search
* Modular LLM adapter
* No hard dependency on Groq

---

## 13. EXTENSIBILITY (V2 READY)

* Local LLM drop-in replacement
* Learning-to-rank model
* Bangla fine-tuning
* Voice-first flow
* Multi-document medical context

---

## 14. SUCCESS METRICS

* ≥80% correct specialty inference
* ≤5% invalid LLM outputs
* ≥90% doctor cards include reasons
* Manual fallback always available

---

## FINAL AUTHORITATIVE GUIDANCE

> **LLM understands language.
> Backend decides relevance.
> Frontend visualizes trust.**

This integrated PRD is now **fully aligned** with:

* Your existing Medora architecture
* The previously defined doctor-search PRD 
* The post-LLM ranking and map logic
* Your research and safety goals

---
