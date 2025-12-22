from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class Condition(BaseModel):
    name: str
    year: str
    treating: bool

class Medication(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str

class PatientOnboardingUpdate(BaseModel):
    # Step 1
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    
    # Step 2
    height: Optional[float] = None
    weight: Optional[float] = None
    blood_group: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    occupation: Optional[str] = None
    medical_summary_url: Optional[str] = None
    
    # Step 3
    has_conditions: Optional[str] = None # Frontend sends "yes"/"no"
    conditions: Optional[List[Condition]] = None
    
    # Step 4
    taking_meds: Optional[str] = None # Frontend sends "yes"/"no"
    medications: Optional[List[Medication]] = None
    allergies: Optional[str] = None
    allergy_reaction: Optional[str] = None
    
    # Step 5
    past_surgeries: Optional[str] = None # Frontend sends "yes"/"no"
    surgery_description: Optional[str] = None
    ongoing_treatments: Optional[str] = None # Frontend sends "yes"/"no"
    
    # Step 6
    smoking: Optional[str] = None
    alcohol: Optional[str] = None
    activity_level: Optional[str] = None
    sleep_duration: Optional[str] = None
    diet: Optional[str] = None
    
    # Step 7
    language: Optional[str] = None
    notifications: Optional[bool] = None
    emergency_name: Optional[str] = None
    emergency_relation: Optional[str] = None
    emergency_phone: Optional[str] = None
    consent_storage: Optional[bool] = None
    consent_ai: Optional[bool] = None
    consent_doctor: Optional[bool] = None
    
    onboarding_completed: Optional[bool] = None

class DoctorOnboardingUpdate(BaseModel):
    # Step 1
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_photo_url: Optional[str] = None
    
    # Step 2
    degree: Optional[str] = None
    specialization: Optional[str] = None
    experience: Optional[str] = None # Frontend sends string
    degree_certificates_url: Optional[str] = None
    
    # Step 3
    registration_number: Optional[str] = None # Maps to bmdc_number
    bmdc_document_url: Optional[str] = None
    
    # Step 4
    hospital_name: Optional[str] = None
    practice_location: Optional[str] = None
    consultation_mode: Optional[str] = None
    affiliation_letter_url: Optional[str] = None
    
    # Step 5
    consultation_fee: Optional[str] = None # Frontend sends string
    available_days: Optional[List[str]] = None
    time_slots: Optional[str] = None
    emergency_availability: Optional[bool] = None
    
    # Step 6
    language: Optional[str] = None
    case_types: Optional[str] = None
    ai_assistance: Optional[bool] = None
    terms_accepted: Optional[bool] = None
    
    onboarding_completed: Optional[bool] = None
