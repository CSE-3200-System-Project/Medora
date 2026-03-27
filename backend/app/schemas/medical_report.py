"""Pydantic schemas for medical report endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReportTestResultResponse(BaseModel):
    id: str
    report_id: str
    test_id: Optional[int] = None
    test_name: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    reference_range_min: Optional[float] = None
    reference_range_max: Optional[float] = None
    reference_range_text: Optional[str] = None
    confidence: Optional[float] = None
    is_manually_edited: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DoctorCommentResponse(BaseModel):
    id: str
    report_id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    comment: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MedicalReportResponse(BaseModel):
    id: str
    patient_id: str
    uploaded_by: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    report_date: Optional[datetime] = None
    parsed: bool
    shared_with_doctors: bool = False
    ocr_engine: Optional[str] = None
    processing_time_ms: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    results: list[ReportTestResultResponse] = Field(default_factory=list)
    comments: list[DoctorCommentResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MedicalReportListItem(BaseModel):
    id: str
    patient_id: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    report_date: Optional[datetime] = None
    parsed: bool
    shared_with_doctors: bool = False
    created_at: datetime
    result_count: int = 0
    comment_count: int = 0
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class MedicalReportUploadResponse(BaseModel):
    report: MedicalReportResponse
    file_url: Optional[str] = None


class DoctorCommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=5000)


# ── Result editing by patient ────────────────────────────────────────────────


class ReportResultCreate(BaseModel):
    """Patient manually adds a new test result row."""
    test_name: str = Field(..., min_length=1, max_length=500)
    value: Optional[float] = None
    value_text: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(normal|high|low)$")
    reference_range_min: Optional[float] = None
    reference_range_max: Optional[float] = None
    reference_range_text: Optional[str] = Field(None, max_length=200)


class ReportResultUpdate(BaseModel):
    """Patient edits an existing test result row (partial update)."""
    test_name: Optional[str] = Field(None, min_length=1, max_length=500)
    value: Optional[float] = None
    value_text: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(normal|high|low)$")
    reference_range_min: Optional[float] = None
    reference_range_max: Optional[float] = None
    reference_range_text: Optional[str] = Field(None, max_length=200)


# ── Report visibility ────────────────────────────────────────────────────────


class ReportVisibilityUpdate(BaseModel):
    """Toggle report-level visibility."""
    shared_with_doctors: bool


class ReportDoctorAccessItem(BaseModel):
    doctor_id: str
    can_view: bool


class ReportDoctorAccessUpdate(BaseModel):
    """Set per-doctor visibility overrides for a report."""
    overrides: list[ReportDoctorAccessItem]


class ReportVisibilityResponse(BaseModel):
    report_id: str
    shared_with_doctors: bool
    doctor_overrides: list[ReportDoctorAccessItem] = Field(default_factory=list)
