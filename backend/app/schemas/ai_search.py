from pydantic import BaseModel
from typing import List, Optional, Dict
from app.schemas.doctor import DoctorCardSchema

class UserLocation(BaseModel):
    latitude: float
    longitude: float

class AIDoctorSearchRequest(BaseModel):
    user_text: str
    location: Optional[str] = None
    consultation_mode: Optional[str] = None
    user_location: Optional[UserLocation] = None  # For distance-based ranking
    # Add legacy filters to allow mixed search
    speciality_id: Optional[int] = None

class AIDoctorResult(DoctorCardSchema):
    score: float
    reason: str
    distance_km: Optional[float] = None  # Distance from user (offline only)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PatientContextFactor(BaseModel):
    category: str  # "condition", "medication", "surgery", "hospitalization", "allergy"
    value: str  # e.g., "Diabetes", "Hypertension", "Chest surgery"
    influence: str  # Brief explanation of why this matters for the search

class AIDoctorSearchResponse(BaseModel):
    doctors: List[AIDoctorResult]
    ambiguity: str
    medical_intent: Optional[Dict] = None  # Contains:
    # - matched_specialties: List of (name, confidence) tuples from LLM
    # - primary_specialties: List[str] - Main specialties from LLM/symptoms
    # - secondary_specialties: List[str] - GP/Internal Medicine fallbacks
    # - extracted_specialty_names: List[str] - All specialties used for search
    # - total_specialties_matched: int
    # - fallback_reason: Optional[str] - Explanation when fallbacks are used
    # - symptoms, severity, duration_days, etc. from LLM response
    patient_context_factors: Optional[List[PatientContextFactor]] = None  # Medical history factors influencing search
