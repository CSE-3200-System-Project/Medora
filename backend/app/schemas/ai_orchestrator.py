from typing import Any

from pydantic import BaseModel, Field


class ChoruiHistoryMessage(BaseModel):
    role: str = Field(..., min_length=1, max_length=16)
    content: str = Field(..., min_length=1, max_length=4000)
    timestamp: str | None = None


class ChoruiAssistantRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str | None = Field(default=None, max_length=64)
    patient_id: str | None = None
    history: list[ChoruiHistoryMessage] = Field(default_factory=list)
    role_context: str | None = Field(default=None, max_length=32)
    prompt_version: str = "v1"


class ChoruiAssistantResponse(BaseModel):
    reply: str
    conversation_id: str
    structured_data: dict[str, Any] = Field(default_factory=dict)
    context_mode: str = "general"


class ChoruiIntakeSaveRequest(BaseModel):
    patient_id: str
    structured_data: dict[str, Any] = Field(default_factory=dict)


class ChoruiIntakeSaveResponse(BaseModel):
    status: str = "saved"
    message: str = "Clinical intake saved successfully."
    saved_fields: list[str] = Field(default_factory=list)


class AIPatientSummaryRequest(BaseModel):
    data: dict[str, Any]
    prompt_version: str = "v1"


class AIStructureIntakeRequest(BaseModel):
    data: dict[str, Any]
    prompt_version: str = "v1"


class AISOAPNotesRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=15000)
    prompt_version: str = "v1"


class AIClinicalQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    prompt_version: str = "v1"
    patient_id: str | None = None
    notes: str | None = None


class AIPrescriptionSuggestionsRequest(BaseModel):
    data: dict[str, Any]
    prompt_version: str = "v1"


class AIInteractionResponse(BaseModel):
    interaction_id: str
    feature: str
    output: dict[str, Any]
    validation_status: str
    provider: str
    latency_ms: int | None = None


class AIFeedbackRequest(BaseModel):
    ai_interaction_id: str
    rating: int = Field(..., ge=1, le=5)
    correction_text: str | None = Field(default=None, max_length=2000)
    doctor_action: str | None = Field(default=None, max_length=64)


class AIPatientSummaryViewResponse(BaseModel):
    ai_generated: bool
    interaction_id: str | None = None
    summary: dict[str, Any] | None = None
    raw_data: dict[str, Any]


class AIClinicalInfoResponse(BaseModel):
    ai_generated: bool
    interaction_ids: list[str] = Field(default_factory=list)
    answer: str
    suggested_conditions: list[dict[str, Any]] = Field(default_factory=list)
    suggested_tests: list[dict[str, Any]] = Field(default_factory=list)
    suggested_medications: list[dict[str, Any]] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)


class AIVoiceToNotesRequest(BaseModel):
    patient_id: str
    transcript: str = Field(..., min_length=1, max_length=15000)
    prompt_version: str = "v1"


class AIVoiceToNotesResponse(BaseModel):
    interaction_id: str | None = None
    soap_notes: dict[str, Any]
    formatted_notes: str


class AISafetyCheckRequest(BaseModel):
    notes: str = Field(default="", max_length=20000)
    planned_medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    override_reason: str | None = Field(default=None, max_length=1000)


class AISafetyCheckResponse(BaseModel):
    status: str
    issues: list[str] = Field(default_factory=list)
    override_required: bool = False


class AIDoctorPatientSummaryResponse(BaseModel):
    ai_generated: bool = True
    summary: dict[str, Any] = Field(default_factory=dict)
    highlight_points: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    assistant_boundary: str = "AI assistant only. Final diagnosis and treatment decisions remain with the doctor."
    privacy_mode: str = "strict_local"


class AIPatientPrescriptionExplainerResponse(BaseModel):
    ai_generated: bool = True
    summary: dict[str, Any] = Field(default_factory=dict)
    highlight_points: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    assistant_boundary: str = "This is a support explanation, not a replacement for your doctor advice."
    privacy_mode: str = "strict_local"
