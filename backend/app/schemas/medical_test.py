"""
Medical Test Pydantic schemas for API request/response.
"""
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime


class MedicalTestResult(BaseModel):
    """Single result in medical test search."""
    id: int
    display_name: str
    normalized_name: str
    
    class Config:
        from_attributes = True


class MedicalTestSearchResponse(BaseModel):
    """Response for medical test search endpoint."""
    results: List[MedicalTestResult]
    total: int
    query: str


class MedicalTestDetailResponse(BaseModel):
    """Complete medical test details."""
    id: int
    display_name: str
    normalized_name: str
    is_active: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


MedicalTestLifecycleStatus = Literal["pending", "completed", "skipped"]


class PatientMedicalTestPatchRequest(BaseModel):
    test_name: str
    test_date: str
    prescribing_doctor: Optional[str] = None
    hospital_lab: Optional[str] = None
    result: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[MedicalTestLifecycleStatus] = None


class PatientMedicalTestPatchResponse(BaseModel):
    message: str
    test: dict
