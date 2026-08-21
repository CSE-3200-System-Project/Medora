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

class Helpline(BaseModel):
    """One reachable human service, resolved against the current time in Asia/Dhaka."""

    key: str
    name_en: str
    name_bn: str
    number: str
    always_available: bool = False
    open_now: bool = True
    opens_at: Optional[str] = None
    closes_at: Optional[str] = None
    reliability: str = "operational"
    note_en: Optional[str] = None
    note_bn: Optional[str] = None


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
    # Navigation explanation metadata returned by the model.
    patient_context_factors: Optional[List[PatientContextFactor]] = None  # Medical history factors influencing search
    requires_immediate_care: bool = False
    safety_message: Optional[str] = None
    uncertain: bool = False
    manual_browse_available: bool = True

    # Arohon. The tier and its risk class travel to the client because the ceiling
    # asymmetry is only real if the screen changes with it: a physical red flag gets the
    # takeover, a self-harm disclosure gets support and keeps the choice. Both are L3.
    risk_class: Optional[str] = None
    autonomy_tier: Optional[str] = None
    escalation_mode: Optional[str] = None  # "emergency_takeover" | "crisis_support" | None
    # Always false on this route. Stated rather than omitted so the client can show the
    # user that nothing is being sent on their behalf.
    autonomous_notification: bool = False
    helplines: List[Helpline] = []
    correlation_id: Optional[str] = None
