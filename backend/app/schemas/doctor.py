from pydantic import BaseModel
from typing import List, Optional, Any

class DoctorCardSchema(BaseModel):
    profile_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    specialization: Optional[str] = None
    qualifications: Optional[str] = None
    years_of_experience: Optional[int] = None
    hospital_name: Optional[str] = None
    hospital_address: Optional[str] = None
    hospital_city: Optional[str] = None
    consultation_fee: Optional[float] = None
    profile_photo_url: Optional[str] = None
    visiting_hours: Optional[str] = None
    available_days: Optional[List[Any]] = None
    consultation_mode: Optional[str] = None
    
    class Config:
        from_attributes = True

class DoctorSearchResponse(BaseModel):
    doctors: List[DoctorCardSchema]
    total: int
