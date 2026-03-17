from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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


class PrescriptionExtractionResponse(BaseModel):
    extracted_text: str
    confidence: float
    file: Optional[MediaFileResponse] = None
