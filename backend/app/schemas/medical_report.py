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
    created_at: datetime

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
