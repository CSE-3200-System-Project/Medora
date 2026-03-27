from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import date, datetime

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
    hospital_latitude: Optional[float] = None
    hospital_longitude: Optional[float] = None
    chamber_name: Optional[str] = None
    chamber_address: Optional[str] = None
    chamber_city: Optional[str] = None
    chamber_latitude: Optional[float] = None
    chamber_longitude: Optional[float] = None
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

# Complete doctor profile schema for detail page
class EducationItem(BaseModel):
    degree: str
    institution: str
    year: Optional[int] = None
    country: Optional[str] = None

class WorkExperienceItem(BaseModel):
    position: str
    hospital: str
    from_year: Optional[int] = None
    to_year: Optional[int] = None
    current: bool = False

class LocationInfo(BaseModel):
    id: Optional[str] = None
    name: str
    location_type: Optional[str] = None
    display_name: Optional[str] = None
    address: str
    city: str
    country: Optional[str] = "Bangladesh"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    availability: Optional[str] = None
    available_days: Optional[List[str]] = None
    appointment_duration: Optional[int] = None
    time_slots: Optional[str] = None
    normalized_time_slots: Optional[str] = None
    time_slots_needs_review: Optional[bool] = None
    day_time_slots: Optional[dict] = None  # Optional per-day schedule for this location

class DoctorProfileResponse(BaseModel):
    # Basic info
    profile_id: str
    first_name: str
    last_name: str
    title: Optional[str] = None
    gender: Optional[str] = None
    profile_photo_url: Optional[str] = None
    
    # Professional credentials
    bmdc_number: Optional[str] = None
    bmdc_verified: bool = False
    qualifications: Optional[str] = None
    specialization: Optional[str] = None
    speciality_name: Optional[str] = None  # From joined Speciality table
    years_of_experience: Optional[int] = None
    
    # Bio
    about: Optional[str] = None
    
    # Services and conditions
    services: Optional[List[str]] = None
    sub_specializations: Optional[List[str]] = None
    
    # Locations (hospital and chamber)
    locations: List[LocationInfo] = []
    
    # Consultation details
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    consultation_mode: Optional[str] = None
    appointment_duration: Optional[int] = None
    
    # Availability
    visiting_hours: Optional[str] = None
    available_days: Optional[List[str]] = None
    
    # Professional background
    education: Optional[List[EducationItem]] = None
    work_experience: Optional[List[WorkExperienceItem]] = None
    
    # Additional
    languages_spoken: Optional[List[str]] = None
    emergency_availability: bool = False
    telemedicine_available: bool = False
    
    class Config:
        from_attributes = True

# Appointment slots schema
class TimeSlot(BaseModel):
    time: str  # e.g., "03:00 PM"
    available: bool = True
    
class TimeSlotGroup(BaseModel):
    period: str  # "afternoon", "evening", "night"
    slots: List[TimeSlot]

class AppointmentSlotsResponse(BaseModel):
    date: str
    location: str
    slots: List[TimeSlotGroup]


class GeocodeLocationRequest(BaseModel):
    location_text: str


class GeocodeLocationResponse(BaseModel):
    latitude: float
    longitude: float
    display_name: Optional[str] = None
    source: str
