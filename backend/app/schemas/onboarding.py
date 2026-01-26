from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# === Shared Sub-Models ===

class Condition(BaseModel):
    name: str
    year: str
    treating: bool
    notes: Optional[str] = None

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
    duration: Optional[str] = None
    duration_days: Optional[int] = None

class MedicalTestRecord(BaseModel):
    """Patient's medical/lab test record"""
    test_name: str  # Name of the test (from medicaltest table or custom)
    test_id: Optional[int] = None  # Reference to medicaltest.id if selected from list
    test_date: Optional[str] = None  # When the test was done (YYYY-MM-DD)
    result: Optional[str] = None  # Test result/findings
    result_value: Optional[str] = None  # Numeric value if applicable
    result_unit: Optional[str] = None  # Unit of measurement
    normal_range: Optional[str] = None  # Reference range
    status: Optional[str] = None  # normal, abnormal, critical
    prescribing_doctor: Optional[str] = None  # Doctor who prescribed
    hospital_lab: Optional[str] = None  # Hospital/Lab where test was done
    notes: Optional[str] = None  # Additional notes
    document_url: Optional[str] = None  # Uploaded report URL

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

# === Patient Onboarding Schema ===

class PatientOnboardingUpdate(BaseModel):
    # Step 1 - Basic Identity
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_photo_url: Optional[str] = None
    nid_number: Optional[str] = None
    
    # Step 2 - Contact & Physical
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    blood_group: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    medical_summary_url: Optional[str] = None
    
    # Step 3 - Known Conditions
    has_conditions: Optional[str] = None  # Frontend sends "yes"/"no"
    conditions: Optional[List[Condition]] = None
    has_diabetes: Optional[bool] = None
    has_hypertension: Optional[bool] = None
    has_heart_disease: Optional[bool] = None
    has_asthma: Optional[bool] = None
    has_kidney_disease: Optional[bool] = None
    has_liver_disease: Optional[bool] = None
    has_thyroid: Optional[bool] = None
    has_neurological: Optional[bool] = None
    has_cancer: Optional[bool] = None
    has_arthritis: Optional[bool] = None
    has_stroke: Optional[bool] = None
    has_epilepsy: Optional[bool] = None
    has_mental_health: Optional[bool] = None
    chronic_conditions_notes: Optional[str] = None
    other_conditions: Optional[str] = None
    condition_details: Optional[str] = None
    
    # Step 4 - Medications & Allergies
    taking_meds: Optional[str] = None
    medications: Optional[List[Medication]] = None
    allergies: Optional[str] = None
    allergy_reaction: Optional[str] = None
    drug_allergies: Optional[List[DrugAllergy]] = None
    food_allergies: Optional[str] = None
    environmental_allergies: Optional[str] = None
    
    # Step 5 - Medical History
    past_surgeries: Optional[str] = None
    surgery_description: Optional[str] = None
    surgeries: Optional[List[Surgery]] = None
    ongoing_treatments: Optional[str] = None
    treatment_description: Optional[str] = None
    ongoing_treatment_details: Optional[str] = None
    hospitalizations: Optional[List[Hospitalization]] = None
    previous_doctors: Optional[str] = None
    last_checkup_date: Optional[str] = None
    
    # Medical Tests/Lab Reports
    has_medical_tests: Optional[str] = None  # "yes" or "no"
    medical_tests: Optional[List[MedicalTestRecord]] = None
    
    # Step 6 - Family History
    family_has_diabetes: Optional[bool] = None
    family_has_hypertension: Optional[bool] = None
    family_has_heart_disease: Optional[bool] = None
    family_has_cancer: Optional[bool] = None
    family_has_stroke: Optional[bool] = None
    family_has_asthma: Optional[bool] = None
    family_has_thalassemia: Optional[bool] = None
    family_has_blood_disorders: Optional[bool] = None
    family_has_mental_health: Optional[bool] = None
    family_has_kidney_disease: Optional[bool] = None
    family_has_thyroid: Optional[bool] = None
    family_history_notes: Optional[str] = None
    
    # Step 7 - Lifestyle & Vaccination
    smoking: Optional[str] = None
    smoking_details: Optional[str] = None
    smoking_amount: Optional[str] = None
    alcohol: Optional[str] = None
    alcohol_details: Optional[str] = None
    alcohol_frequency: Optional[str] = None
    tobacco_use: Optional[str] = None
    drug_use: Optional[str] = None
    caffeine: Optional[str] = None
    activity_level: Optional[str] = None
    exercise_type: Optional[str] = None
    exercise_frequency: Optional[str] = None
    sleep_duration: Optional[str] = None
    sleep_quality: Optional[str] = None
    diet: Optional[str] = None
    diet_restrictions: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    water_intake: Optional[str] = None
    stress_level: Optional[str] = None
    mental_health_history: Optional[str] = None
    mental_health_concerns: Optional[str] = None
    currently_in_therapy: Optional[bool] = None
    
    vaccination_status: Optional[str] = None
    vaccinations: Optional[List[Vaccination]] = None
    has_epi_vaccination: Optional[bool] = None
    has_covid_vaccination: Optional[bool] = None
    covid_vaccine_doses: Optional[int] = None
    has_hepatitis_vaccination: Optional[bool] = None
    has_tb_vaccination: Optional[bool] = None
    has_tt_vaccination: Optional[bool] = None
    
    # Step 8 - Preferences & Consent
    language: Optional[str] = None
    preferred_language: Optional[str] = None
    languages_spoken: Optional[List[str]] = None
    preferred_contact_method: Optional[str] = None
    notifications: Optional[bool] = None
    notification_preferences: Optional[List[str]] = None
    emergency_name: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None
    emergency_address: Optional[str] = None
    secondary_emergency_name: Optional[str] = None
    secondary_emergency_phone: Optional[str] = None
    consent_storage: Optional[bool] = None
    consent_ai: Optional[bool] = None
    consent_doctor: Optional[bool] = None
    consent_research: Optional[bool] = None
    
    onboarding_completed: Optional[bool] = None

# === Doctor Onboarding Schema ===

class DoctorOnboardingUpdate(BaseModel):
    # Step 1 - Personal Identity
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None  # Prof., Dr., Assoc. Prof., etc.
    gender: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_photo_url: Optional[str] = None
    nid_number: Optional[str] = None
    
    # Step 2 - Professional Credentials
    registration_number: Optional[str] = None  # Maps to bmdc_number
    bmdc_document_url: Optional[str] = None
    qualifications: Optional[str] = None  # Full qualifications string
    degree: Optional[str] = None  # Primary degree
    degree_certificates_url: Optional[str] = None
    education: Optional[List[Education]] = None
    
    # Step 3 - Specialization
    speciality_id: Optional[int] = None
    specialization: Optional[str] = None
    sub_specializations: Optional[List[str]] = None
    services: Optional[List[str]] = None
    
    # Step 4 - Experience
    experience: Optional[str] = None  # Years - Frontend sends string
    work_experience: Optional[List[WorkExperience]] = None
    
    # Step 5 - Practice Details
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    hospital_city: Optional[str] = None
    hospital_country: Optional[str] = None
    chamber_name: Optional[str] = None
    chamber_address: Optional[str] = None
    chamber_city: Optional[str] = None
    practice_location: Optional[str] = None
    consultation_mode: Optional[str] = None  # online, in-person, both
    affiliation_letter_url: Optional[str] = None
    institution: Optional[str] = None
    
    # Step 6 - Consultation Setup
    consultation_fee: Optional[str] = None  # Frontend sends string
    follow_up_fee: Optional[str] = None
    visiting_hours: Optional[str] = None
    available_days: Optional[List[str]] = None
    time_slots: Optional[str] = None  # Legacy field
    day_time_slots: Optional[Dict[str, List[str]]] = None  # NEW: per-day schedules
    appointment_duration: Optional[int] = None
    emergency_availability: Optional[bool] = None
    emergency_contact: Optional[str] = None
    
    # Step 7 - About & Bio
    about: Optional[str] = None
    
    # Step 8 - Preferences & Consent
    language: Optional[str] = None
    languages_spoken: Optional[List[str]] = None
    case_types: Optional[str] = None
    ai_assistance: Optional[bool] = None
    terms_accepted: Optional[bool] = None
    telemedicine_available: Optional[bool] = None
    telemedicine_platforms: Optional[List[str]] = None
    
    onboarding_completed: Optional[bool] = None
