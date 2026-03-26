"""Schemas for medical report OCR endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ReportOCRRequest(BaseModel):
    image_url: str | None = None
    image_file: str | None = None
    subject_token: str | None = None


class ReportTestResult(BaseModel):
    test_name: str
    value: float | None = None
    value_text: str | None = None
    unit: str | None = None
    reference_range_min: float | None = None
    reference_range_max: float | None = None
    reference_range_text: str | None = None
    status: str | None = None  # normal / high / low
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ReportOCRMeta(BaseModel):
    model: str
    processing_time_ms: int
    ocr_engine: str  # "azure" or "paddleocr"
    line_count: int
    tests_extracted: int


class ReportOCRResponse(BaseModel):
    tests: list[ReportTestResult]
    raw_text: str
    meta: ReportOCRMeta
