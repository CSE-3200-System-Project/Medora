# AI Flows

End-to-end flows for all AI-powered features in Medora.

---

## 1. Chorui Assistant — Navigation

The primary use of Chorui is helping users navigate the app using natural language.

```
User types: "Show me my upcoming appointments"
  │
POST /ai/chorui/assistant
  Body: { message, conversation_id, role_context: "patient" }
  │
  ├─ Load history: SELECT FROM chorui_chat_messages WHERE conversation_id = ?
  │
  ├─ Assemble context (patient mode):
  │   └─ Upcoming appointments, recent prescriptions, conditions summary
  │   └─ data_sharing_guard filters based on patient consent
  │
  ├─ normalize_chorui_navigation_intent(message)
  │   └─ Maps "upcoming appointments" → canonical_intent: "appointments"
  │
  ├─ resolve_chorui_navigation_engine(intent="appointments", role="patient")
  │   └─ Registry lookup: { route: "/patient/appointments", requires_params: [] }
  │   └─ Returns: { action: "navigate", route: "/patient/appointments", confidence: 0.95 }
  │
  ├─ Save user message + assistant response to chorui_chat_messages
  │
  └─ Response: { action: "navigate", route: "/patient/appointments", message: "..." }

Frontend receives route → navigates user to /patient/appointments
```

**When params are missing (dynamic route):**
```
User: "Show me patient Ahmed's history"
  └─ Intent: "patient_detail" (requires patient_id param)
  └─ Engine returns: { action: "clarify", missing_params: ["patient_id"] }
  └─ Chorui asks: "Which patient would you like to view?"
```

---

## 2. AI Doctor Search

Helps patients find doctors when they describe their symptoms or condition rather than a specialty name.

```
Patient types: "I have chest pain and shortness of breath"
  │
POST /ai/search
  Body: { query: "chest pain and shortness of breath" }
  │
  ├─ ai_doctor.py calls specialty_matching.match_specialty(query)
  │   └─ Semantic matching against specialities table entries
  │   └─ Returns: specialty_id = (Cardiology), confidence score
  │
  ├─ Searches doctors: SELECT from doctor_profiles
  │   WHERE speciality_id = ? AND verification_status = "verified"
  │   Ordered by: years_of_experience, consultation_fee, location proximity
  │
  └─ Returns: DoctorSearchResponse { doctors: [...ranked list] }

Frontend: renders ranked doctor list same as regular search
```

---

## 3. AI-Assisted Consultation (Doctor)

During a consultation, the doctor can request AI assistance for SOAP notes, patient summary, and clinical queries.

### 3a. Patient Summary (Pre-Consultation)

```
Doctor opens /doctor/patient/{id}/consultation/ai
  │
GET /ai/patient-summary?patient_id={id}
  │
  ├─ data_sharing_guard checks consent for this patient-doctor pair
  │   └─ Filters: conditions, medications, allergies, test results per consent
  │
  ├─ Builds patient_data dict (PII-stripped)
  │
  ├─ ai_orchestrator.generate_patient_summary(patient_data)
  │   └─ LLM prompt with PII-sanitized patient context
  │   └─ Validates output as PatientSummaryOutput:
  │       { summary, key_findings, risk_flags, follow_up_questions, recommended_actions }
  │
  ├─ Logs to ai_interactions table
  │
  └─ Returns: { summary, key_findings, risk_flags, follow_up_questions, recommended_actions }
```

### 3b. Voice-to-SOAP Notes

```
Doctor speaks consultation notes
  │
  ├─ Frontend: useVoiceRecorder() captures audio
  │
POST /ai/normalize/voice
  Body: audio file upload
  │
  ├─ asr.py: Faster-Whisper transcribes audio → transcript text
  │
POST /ai/voice-to-notes
  Body: { transcript }
  │
  ├─ ai_orchestrator.generate_soap_notes(transcript)
  │   └─ LLM generates SOAP format:
  │       { subjective: [...], objective: [...], assessment: [...], plan: [...] }
  │
  └─ Returns SOAPNotesOutput → pre-fills consultation form fields
```

### 3c. Clinical Reference Query

```
Doctor asks: "What's the first-line treatment for hypertension in a diabetic patient?"
  │
POST /ai/clinical-info
  Body: { query: "...", patient_context: {...} }  (patient_context PII-stripped)
  │
  ├─ ai_orchestrator.clinical_info_query(query)
  │   └─ LLM generates ClinicalInfoOutput:
  │       { answer, confidence, suggested_conditions, suggested_tests,
  │         suggested_medications, references, cautions }
  │
  └─ Returns structured clinical reference with confidence score
```

### 3d. Prescription Suggestions

```
Doctor in prescription editor → requests AI suggestions
  │
  ├─ ai_orchestrator.prescription_suggestions(clinical_context)
  │   └─ Input: chief_complaint, diagnosis, patient conditions
  │   └─ Output: list of SuggestedMedication / SuggestedTest
  │       { medicine_name, rationale, dose_hint, frequency_hint, confidence }
  │
  └─ Doctor reviews suggestions → accepts/modifies → adds to prescription
```

---

## 4. Prescription OCR Pipeline

```
Patient uploads prescription image:
  │
POST /medical-reports/upload
  Body: multipart { file, report_type: "prescription" }
  │
  ├─ backend/app/routes/medical_report.py validates consent:
  │   └─ _require_user_ai_consent_for_report_ocr(db, user_id)
  │
  ├─ Uploads file to Supabase Storage
  ├─ Calls ai_service POST /ocr/prescription
  │   Headers: X-Medora-Subject-Token: <anonymized token>
  │   Body: { image_url: <storage url> }
  │   │
  │   └─ ai_service OCR Pipeline:
  │       normalize → YOLO detect regions → Azure OCR → parse → fuzzy match medicines
  │   │
  │   └─ Returns: { medications: [...], raw_text, meta }
  │
  ├─ Saves MedicalReport { patient_id, image_url, raw_text, ocr_engine }
  ├─ Saves MedicalTest records for any extracted tests
  │
  └─ Returns report_id + extracted medications to frontend
```

**Medicine matching** uses RapidFuzz against the `brands` and `medicines` tables. The Supabase connection in `ai_service/app/db.py` queries the medicine search index.

---

## 5. Medical Report (Lab Results) OCR

```
Patient uploads lab report image:
  │
POST /medical-reports/upload (report_type: "lab")
  │
  ├─ Calls ai_service POST /ocr/medical-report
  │   │
  │   └─ ai_service pipeline:
  │       normalize → Azure Document Intelligence (lines + tables)
  │       └─ Fallback: PaddleOCR if Azure fails
  │       └─ report_parser extracts structured test results:
  │           { test_name, value, unit, reference_range }
  │
  ├─ Saves MedicalReport row
  ├─ Saves MedicalTest rows (one per extracted result)
  │
  └─ Returns structured test list to frontend
```

---

## 6. AI Access Consent (Patient Control)

Before AI features can use a patient's data, consent must exist.

```
Patient visits /patient/privacy
  │
GET /health-data/consent → returns current consent per data type
  │
Patient toggles consent for each category:
  PATCH /health-data/consent { data_type: "medications", allowed: true }
    └─ Upserts HealthDataConsent record

When doctor requests AI summary of patient:
  data_sharing_guard.get_sharing_permissions(db, patient_id, doctor_id)
    └─ Reads health_data_consents + patient_data_sharing
    └─ Returns SharingPermissions { allowed_categories: [...] }

  filter_extended_context(patient_data, permissions)
    └─ Removes fields patient has not consented to share
    └─ If anything removed: prepends AI_RESTRICTION_NOTICE to LLM prompt
```

---

## 7. Chorui — Doctor Context Mode

When a doctor uses Chorui and asks about a patient, the engine assembles a doctor-context payload:

```
Doctor types: "Summarize patient Ahmed's recent history"
  │
POST /ai/chorui/assistant
  Body: { message, patient_id, role_context: "doctor" }
  │
  ├─ check_doctor_patient_access(db, doctor_id, patient_id)
  │   └─ Verifies doctor has appointment or consultation with this patient
  │   └─ Logs access to patient_access table
  │
  ├─ get_sharing_permissions(db, patient_id, doctor_id)
  │   └─ Determines what patient has consented to share
  │
  ├─ Builds doctor-context payload:
  │   ├─ Recent appointments
  │   ├─ Consultations (filtered by consent)
  │   ├─ Prescriptions (filtered)
  │   ├─ Medical conditions (filtered)
  │   └─ Labs/test results (filtered)
  │
  ├─ normalize_chorui_navigation_intent → may be "patient_detail" or "patient_summary"
  ├─ ai_orchestrator.generate_patient_summary(context) if summary requested
  │
  └─ Returns response + optional navigation action
```

Patient access is always logged. Doctor cannot query patient context for patients they have no appointment or consultation relationship with.
