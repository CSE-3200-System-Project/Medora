"""Pydantic schemas for patient data-sharing preferences."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Category toggle payload ──────────────────────────────────────────────────

class SharingCategoryUpdate(BaseModel):
    """Partial update – only include the categories you want to change."""
    can_view_profile: Optional[bool] = None
    can_view_conditions: Optional[bool] = None
    can_view_medications: Optional[bool] = None
    can_view_allergies: Optional[bool] = None
    can_view_medical_history: Optional[bool] = None
    can_view_family_history: Optional[bool] = None
    can_view_lifestyle: Optional[bool] = None
    can_view_vaccinations: Optional[bool] = None
    can_view_reports: Optional[bool] = None
    can_view_health_metrics: Optional[bool] = None
    can_view_prescriptions: Optional[bool] = None


class SharingBulkUpdate(BaseModel):
    """Set ALL categories to the same value at once."""
    share_all: bool


# ── Response schemas ─────────────────────────────────────────────────────────

class SharingCategoryResponse(BaseModel):
    can_view_profile: bool
    can_view_conditions: bool
    can_view_medications: bool
    can_view_allergies: bool
    can_view_medical_history: bool
    can_view_family_history: bool
    can_view_lifestyle: bool
    can_view_vaccinations: bool
    can_view_reports: bool
    can_view_health_metrics: bool
    can_view_prescriptions: bool

    class Config:
        from_attributes = True


class DoctorSharingSummary(BaseModel):
    """One row in the patient's 'manage access' screen."""
    doctor_id: str
    doctor_name: str
    doctor_photo_url: Optional[str] = None
    specialization: Optional[str] = None
    sharing: SharingCategoryResponse
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PatientDoctorListItem(BaseModel):
    """A doctor the patient has interacted with (from appointments)."""
    doctor_id: str
    doctor_name: str
    doctor_photo_url: Optional[str] = None
    specialization: Optional[str] = None
    has_sharing_record: bool = False
