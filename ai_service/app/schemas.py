from __future__ import annotations

from pydantic import BaseModel, Field


class OCRRequest(BaseModel):
    image_url: str | None = None
    image_file: str | None = None
    subject_token: str | None = None


class BBox(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float


class DetectedRegion(BaseModel):
    label: str = "prescription"
    bbox: BBox
    score: float = 1.0


class OCRLine(BaseModel):
    text: str
    bbox: BBox | None = None
    page: int = 1
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class MedicationResult(BaseModel):
    name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    quantity: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class OCRMeta(BaseModel):
    model: str
    model_type: str
    processing_time_ms: int
    detected_regions: int
    ocr_line_count: int


class OCRDebug(BaseModel):
    detected_regions: list[DetectedRegion]
    ocr_lines: list[OCRLine]
    medicine_db_enabled: bool
    medicine_candidates_loaded: int


class OCRResponse(BaseModel):
    medications: list[MedicationResult]
    raw_text: str
    meta: OCRMeta
    debug: OCRDebug | None = None
