from pydantic import BaseModel
from typing import List, Optional, Dict
from app.schemas.doctor import DoctorCardSchema

class AIDoctorSearchRequest(BaseModel):
    user_text: str
    location: Optional[str] = None
    consultation_mode: Optional[str] = None
    # Add legacy filters to allow mixed search
    speciality_id: Optional[int] = None

class AIDoctorResult(DoctorCardSchema):
    score: float
    reason: str

class AIDoctorSearchResponse(BaseModel):
    doctors: List[AIDoctorResult]
    ambiguity: str
    medical_intent: Optional[Dict] = None 
