from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HealthDataConsentCreate(BaseModel):
    doctor_id: str


class HealthDataConsentResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    is_active: bool
    granted_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HealthDataConsentListResponse(BaseModel):
    consents: list[HealthDataConsentResponse]
    total: int


class PatientHealthOverview(BaseModel):
    """Health overview returned to an authorized doctor."""
    patient_id: str
    patient_name: str
    today_metrics: list[dict]
    trends: list[dict]
    consent_granted_at: datetime
