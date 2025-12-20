from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BaseSignup(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class PatientSignup(BaseSignup):
    date_of_birth: date
    gender: str
    blood_group: Optional[str] = None
    allergies: Optional[str] = None

class DoctorSignup(BaseSignup):
    bmdc_number: str
    bmdc_document: Optional[str] = None # URL or path to document