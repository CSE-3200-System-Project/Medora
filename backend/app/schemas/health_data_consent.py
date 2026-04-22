from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class HealthDataConsentCreate(BaseModel):
    doctor_id: str
    share_medical_tests: bool = False


class HealthDataConsentUpdate(BaseModel):
    share_medical_tests: bool


class HealthDataConsentResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    is_active: bool
    share_medical_tests: bool = False
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
    share_medical_tests: bool = False
    medical_tests: Optional[list[dict[str, Any]]] = None
