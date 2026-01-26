"""
Medical Test Pydantic schemas for API request/response.
"""
from pydantic import BaseModel
from typing import List, Optional
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
