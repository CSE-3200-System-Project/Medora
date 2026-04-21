from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MediaFileResponse(BaseModel):
    id: str
    owner_profile_id: str
    bucket: str
    storage_path: str
    public_url: Optional[str] = None
    file_name: str
    original_file_name: Optional[str] = None
    content_type: Optional[str] = None
    file_extension: Optional[str] = None
    file_size: int
    checksum_sha256: Optional[str] = None
    category: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    visibility: str
    created_at: datetime

    class Config:
        from_attributes = True


class MediaUploadResponse(BaseModel):
    url: Optional[str] = None
    file: MediaFileResponse


class MedicationOCRResult(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    quantity: Optional[str] = None
    confidence: float


class PrescriptionOCRMeta(BaseModel):
    model: str
    model_type: str
    processing_time_ms: int
    detected_regions: int
    ocr_line_count: int
    yolo_avg_confidence: Optional[float] = None
    yolo_min_confidence: Optional[float] = None
    yolo_max_confidence: Optional[float] = None
    ocr_avg_confidence: Optional[float] = None
    ocr_min_confidence: Optional[float] = None
    ocr_max_confidence: Optional[float] = None


class PrescriptionExtractionResponse(BaseModel):
    extracted_text: str
    confidence: float
    medications: list[MedicationOCRResult] = Field(default_factory=list)
    raw_text: str = ""
    meta: PrescriptionOCRMeta | None = None
    file: Optional[MediaFileResponse] = None
