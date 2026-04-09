from typing import Any, Literal

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
    ui_locale: Literal["en", "bn"] | None = Field(default=None)
    prompt_version: str = "v1"


class ChoruiNavigationActionOption(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    canonical_intent: str = Field(..., min_length=1, max_length=80)
    route: str = Field(..., min_length=1, max_length=240)


class ChoruiSuggestedRoute(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    route: str = Field(..., min_length=1, max_length=240)
    canonical_intent: str = Field(..., min_length=1, max_length=80)


class ChoruiNavigationAction(BaseModel):
    type: Literal["navigate", "clarify", "suggest", "undo", "none"] = "none"
    route: str | None = Field(default=None, max_length=240)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    requires_confirmation: bool = False
    missing_params: list[str] = Field(default_factory=list)
    options: list[ChoruiNavigationActionOption] = Field(default_factory=list)
    reason: str | None = Field(default=None, max_length=240)
    delay_ms: int | None = Field(default=None, ge=0, le=5000)


class ChoruiNavigationMemory(BaseModel):
    pending_intent: str | None = Field(default=None, max_length=80)
    missing_params: list[str] = Field(default_factory=list)
    last_resolved_intent: str | None = Field(default=None, max_length=80)


class ChoruiNavigationMeta(BaseModel):
    previous_route: str | None = Field(default=None, max_length=240)
    last_navigation_route: str | None = Field(default=None, max_length=240)


class ChoruiAssistantResponse(BaseModel):
    reply: str
    conversation_id: str
    structured_data: dict[str, Any] = Field(default_factory=dict)
    context_mode: str = "general"
    action: ChoruiNavigationAction | None = None
    suggested_routes: list[ChoruiSuggestedRoute] = Field(default_factory=list)
    memory: ChoruiNavigationMemory | None = None
    navigation_meta: ChoruiNavigationMeta | None = None


class ChoruiConversationSummary(BaseModel):
    conversation_id: str
    role_context: str
    context_mode: str
    patient_id: str | None = None
    patient_ref: str | None = None
    last_sender: str
    last_message: str
    updated_at: str


class ChoruiConversationListResponse(BaseModel):
    conversations: list[ChoruiConversationSummary] = Field(default_factory=list)


class ChoruiConversationMessage(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str


class ChoruiConversationHistoryResponse(BaseModel):
    conversation_id: str
    context_mode: str = "general"
    messages: list[ChoruiConversationMessage] = Field(default_factory=list)


class ChoruiConversationDeleteResponse(BaseModel):
    conversation_id: str
    deleted: bool = True


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
    privacy_mode: str = "record_augmented"


class AIPatientPrescriptionExplainerResponse(BaseModel):
    ai_generated: bool = True
    summary: dict[str, Any] = Field(default_factory=dict)
    highlight_points: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    assistant_boundary: str = "This is a support explanation, not a replacement for your doctor advice."
    privacy_mode: str = "record_augmented"
