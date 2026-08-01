from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class ProcessingPurpose(str, Enum):
    CLINICAL_SHARING = "clinical_sharing"
    EXTERNAL_TEXT_AI = "external_text_ai"
    CLOUD_DOCUMENT_OCR = "cloud_document_ocr"
    EXTERNAL_LIVE_AUDIO = "external_live_audio"
    RESEARCH_EXPORT = "research_export"


class ProcessingConsentUpsert(BaseModel):
    scopes: list[str] = Field(min_length=1, max_length=20)
    provider: str | None = Field(default=None, max_length=80)
    recipient_id: str | None = None
    valid_until: datetime | None = None
    policy_version: str = Field(default="softwarex-v1", min_length=1, max_length=40)
    audit_note: str | None = Field(default=None, max_length=500)

    @field_validator("scopes")
    @classmethod
    def normalize_scopes(cls, scopes: list[str]) -> list[str]:
        normalized = sorted({scope.strip().lower() for scope in scopes if scope.strip()})
        if not normalized:
            raise ValueError("At least one non-empty scope is required")
        return normalized


class ProcessingConsentResponse(BaseModel):
    id: str
    subject_id: str
    purpose: ProcessingPurpose
    version: int
    scopes: list[str]
    provider: str | None = None
    recipient_id: str | None = None
    policy_version: str
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    granted_at: datetime
    active: bool

    model_config = {"from_attributes": True}


class ProcessingConsentListResponse(BaseModel):
    items: list[ProcessingConsentResponse]

