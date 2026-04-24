from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    doctor_id: str
    rating: int = Field(..., ge=1, le=5)
    note: Optional[str] = Field(None, max_length=2000)
    appointment_id: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    note: Optional[str] = Field(None, max_length=2000)


class ReviewAuthor(BaseModel):
    patient_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_photo_url: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    doctor_id: str
    rating: int
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    author: Optional[ReviewAuthor] = None

    class Config:
        from_attributes = True


class ReviewListResponse(BaseModel):
    reviews: List[ReviewResponse]
    total: int
    rating_avg: float
    rating_count: int


class ReviewEligibilityResponse(BaseModel):
    can_review: bool
    has_existing_review: bool
    existing_review: Optional[ReviewResponse] = None
