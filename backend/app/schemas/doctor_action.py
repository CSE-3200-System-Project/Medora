from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.db.models.enums import DoctorActionPriority, DoctorActionStatus, DoctorActionType


class DoctorActionCreate(BaseModel):
    action_type: DoctorActionType = DoctorActionType.MANUAL_TASK
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: DoctorActionPriority = DoctorActionPriority.MEDIUM
    status: DoctorActionStatus = DoctorActionStatus.PENDING
    related_patient_id: Optional[str] = None
    related_appointment_id: Optional[str] = None
    revenue_amount: Optional[float] = None
    due_date: Optional[datetime] = None


class DoctorActionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[DoctorActionPriority] = None
    status: Optional[DoctorActionStatus] = None
    related_patient_id: Optional[str] = None
    related_appointment_id: Optional[str] = None
    revenue_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class DoctorActionResponse(BaseModel):
    id: str
    doctor_id: str
    action_type: DoctorActionType
    title: str
    description: Optional[str] = None
    priority: DoctorActionPriority
    status: DoctorActionStatus
    related_patient_id: Optional[str] = None
    related_appointment_id: Optional[str] = None
    revenue_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DoctorActionListResponse(BaseModel):
    actions: list[DoctorActionResponse]
    total: int


class DoctorActionStatsPendingItem(BaseModel):
    id: str
    title: str
    priority: DoctorActionPriority
    status: DoctorActionStatus
    due_date: Optional[str] = None
    related_patient_id: Optional[str] = None


class DoctorActionRevenuePoint(BaseModel):
    week: str
    revenue: float


class DoctorActionDemographicPoint(BaseModel):
    range: str
    value: float


class DoctorActionWeeklyWsiPoint(BaseModel):
    week: str
    appointments: int
    no_shows: int
    pending_tasks: int
    overdue_tasks: int
    wsi: int


class DoctorActionStatsResponse(BaseModel):
    monthly_revenue: float
    weekly_wsi: list[DoctorActionWeeklyWsiPoint]
    pending_actions_count: int
    pending_actions: list[DoctorActionStatsPendingItem]
    completion_rate: float
    revenue_trend: list[DoctorActionRevenuePoint]
    demographic_breakdown: list[DoctorActionDemographicPoint]
