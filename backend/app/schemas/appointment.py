from pydantic import BaseModel
from datetime import datetime, date, time
from typing import Optional
from enum import Enum


class AppointmentStatus(str, Enum):
    # Original statuses
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

    # New statuses
    PENDING_ADMIN_REVIEW = "PENDING_ADMIN_REVIEW"
    PENDING_DOCTOR_CONFIRMATION = "PENDING_DOCTOR_CONFIRMATION"
    PENDING_PATIENT_CONFIRMATION = "PENDING_PATIENT_CONFIRMATION"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    NO_SHOW = "NO_SHOW"


# ── Original schemas (kept for backward compat) ──

class AppointmentBase(BaseModel):
    doctor_id: str
    doctor_location_id: Optional[str] = None
    location_name: Optional[str] = None
    appointment_date: datetime
    reason: str
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    appointment_date: Optional[datetime] = None


# ── New V2 schemas ──

class AppointmentCreateV2(BaseModel):
    """Enhanced appointment creation with separate date and time fields."""
    doctor_id: str
    doctor_location_id: Optional[str] = None
    location_name: Optional[str] = None
    requested_date: date
    requested_time: time
    duration_minutes: Optional[int] = 30
    reason: str
    notes: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    """Used by appointment_service.transition_status."""
    status: AppointmentStatus
    notes: Optional[str] = None


class AdminAppointmentAction(BaseModel):
    """Admin approve/reject with optional notes."""
    action: str  # "approve" | "reject" | "propose_time"
    notes: Optional[str] = None
    proposed_date: Optional[date] = None
    proposed_time: Optional[time] = None


# ── Response schemas ──

class AppointmentResponse(AppointmentBase):
    id: str
    patient_id: str
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime

    # New fields
    slot_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    google_event_id: Optional[str] = None

    # Optional nested details for frontend display
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    blood_group: Optional[str] = None
    chronic_conditions: Optional[list] = None

    class Config:
        from_attributes = True


class AppointmentRequestResponse(BaseModel):
    """Response for appointment booking requests (pre-approval)."""
    id: str
    doctor_id: str
    patient_id: str
    requested_date: date
    requested_time: time
    requested_duration: int
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Optional display fields
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True
