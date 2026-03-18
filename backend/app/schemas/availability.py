from pydantic import BaseModel, Field
from datetime import date, time, datetime
from typing import Optional
from enum import Enum


# ── Time Block Schemas ──

class TimeBlockCreate(BaseModel):
    start_time: time
    end_time: time
    slot_duration_minutes: int = 30


class TimeBlockResponse(BaseModel):
    id: str
    start_time: time
    end_time: time
    slot_duration_minutes: int

    class Config:
        from_attributes = True


# ── Day Availability Schemas ──

class DayAvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday..6=Sunday")
    is_active: bool = True
    time_blocks: list[TimeBlockCreate]


class DayAvailabilityResponse(BaseModel):
    id: str
    day_of_week: int
    is_active: bool
    time_blocks: list[TimeBlockResponse]

    class Config:
        from_attributes = True


# ── Weekly Schedule Schemas ──

class WeeklyScheduleUpdate(BaseModel):
    """Replace the entire weekly schedule for a doctor."""
    days: list[DayAvailabilityCreate]
    appointment_duration: Optional[int] = None  # global override for slot duration


class WeeklyScheduleResponse(BaseModel):
    doctor_id: str
    days: list[DayAvailabilityResponse]
    exceptions: list["ExceptionResponse"] = []
    overrides: list["ScheduleOverrideResponse"] = []


# ── Exception Schemas ──

class ExceptionCreate(BaseModel):
    exception_date: date
    is_available: bool = False
    reason: Optional[str] = None


class ExceptionResponse(BaseModel):
    id: str
    doctor_id: str
    exception_date: date
    is_available: bool
    reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Schedule Override Schemas ──

class ScheduleOverrideCreate(BaseModel):
    override_date: date
    start_time: time
    end_time: time
    slot_duration_minutes: int = 30


class ScheduleOverrideResponse(BaseModel):
    id: str
    doctor_id: str
    override_date: date
    start_time: time
    end_time: time
    slot_duration_minutes: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Slot Schemas ──

class SlotInfo(BaseModel):
    time: str
    is_available: bool
    is_past: bool = False
    appointment_id: Optional[str] = None
    status: Optional[str] = None


class SlotGroupResponse(BaseModel):
    label: str  # "Morning", "Afternoon", "Evening"
    slots: list[SlotInfo]


class AvailableSlotsResponse(BaseModel):
    date: str
    doctor_id: str
    appointment_duration: int
    slot_groups: list[SlotGroupResponse]
    total_available: int


# ── Reschedule Request Schemas ──

class RescheduleRequestCreate(BaseModel):
    appointment_id: str
    proposed_date: date
    proposed_time: time
    reason: Optional[str] = None


class RescheduleRequestResponse(BaseModel):
    id: str
    appointment_id: str
    requested_by_id: str
    requested_by_role: str
    proposed_date: date
    proposed_time: time
    reason: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RescheduleRespondRequest(BaseModel):
    accept: bool


# ── Audit Log Schemas ──

class AuditLogResponse(BaseModel):
    id: str
    appointment_id: str
    action_type: str
    performed_by_id: str
    performed_by_role: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int


# Rebuild forward refs
WeeklyScheduleResponse.model_rebuild()
