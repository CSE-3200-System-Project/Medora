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

class AIDoctorSearchResponse(BaseModel):
    doctors: List[AIDoctorResult]
    ambiguity: str
    medical_intent: Optional[Dict] = None 
