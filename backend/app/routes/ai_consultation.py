import uuid
import json
from typing import Any
from datetime import datetime, timedelta
import re
import logging
from time import perf_counter
from dataclasses import dataclass
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_privacy import anonymize_identifier_text, stable_hash_token
from app.core.config import settings
from app.core.patient_reference import (
    patient_ref_from_uuid,
    resolve_doctor_patient_identifier,
)
from app.core.dependencies import get_db
from app.db.models.ai_interaction import AIInteraction
from app.db.models.chorui_chat import ChoruiChatMessage
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.patient_access import AccessType
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.consultation import Consultation, Prescription, MedicationPrescription
from app.db.models.medicine import Drug, Brand, MedicineSearchIndex
from app.db.models.medical_test import MedicalTest
from app.db.models.enums import AccountStatus, UserRole
from app.core.security import verify_jwt
from app.routes.auth import get_current_user_token
from app.routes.patient_access import check_doctor_patient_access, log_patient_access
from app.core.data_sharing_guard import (
    get_sharing_permissions,
    filter_raw_summary,
    filter_extended_context,
    build_ai_restriction_notice,
    SharingPermissions,
)
from app.schemas.ai_orchestrator import (
    AIClinicalInfoResponse,
    AIClinicalQueryRequest,
    AIDoctorPatientSummaryResponse,
    AIPatientPrescriptionExplainerResponse,
    AIPatientSummaryViewResponse,
    AIVoiceToNotesRequest,
    AIVoiceToNotesResponse,
    ChoruiAssistantRequest,
    ChoruiAssistantResponse,
    ChoruiConversationDeleteResponse,
    ChoruiConversationHistoryResponse,
    ChoruiConversationListResponse,
    ChoruiConversationMessage,
    ChoruiNavigationAction,
    ChoruiNavigationActionOption,
    ChoruiNavigationMemory,
    ChoruiNavigationMeta,
    ChoruiSuggestedRoute,
    ChoruiConversationSummary,
    ChoruiIntakeSaveRequest,
    ChoruiIntakeSaveResponse,
    ChoruiNavigationSuggestion,
)
from app.services.ai_orchestrator import AIExecutionResult, AIOrchestratorError, ai_orchestrator
from app.services.chorui_intent_normalizer import (
    normalize_chorui_navigation_intent,
)
from app.services.chorui_navigation_engine import resolve_chorui_navigation_engine

router = APIRouter()
logger = logging.getLogger(__name__)


CHORUI_ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
    AppointmentStatus.RESCHEDULE_REQUESTED,
]

CHORUI_UPCOMING_APPOINTMENT_STATUSES = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
    AppointmentStatus.RESCHEDULE_REQUESTED,
]

CHORUI_MAX_STORED_MESSAGE_CHARS = 5000
CHORUI_FOLLOWUP_HINTS = (
    "what about",
    "and",
    "also",
    "those",
    "that",
    "same",
    "again",
)
CHORUI_UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    flags=re.IGNORECASE,
)
CHORUI_PATIENT_REF_PATTERN = re.compile(r"\bPT[-_]?[A-Z2-7]{10}\b", flags=re.IGNORECASE)
VAPI_SUPPORTED_TOOL_NAMES = {
    "ask_chorui",
    "chorui_assistant",
    "chorui_chat",
    "summarize_prescription",
    "explain_prescription",
    "navigate_medora",
    "navigate",
    "get_upcoming_appointments",
    "find_patient",
    "get_voice_context",
    "end_voice_call",
}

# Tools that the Vapi server webhook treats as navigation/UI actions the
# client is expected to execute locally. The server returns a spoken result
# while the Medora frontend also listens for the same tool-call on the Vapi
# `message` stream and performs the actual router.push / UI action.
VAPI_CLIENT_ACTION_TOOL_NAMES = {
    "navigate_medora",
    "navigate",
    "end_voice_call",
}


def _safe_vapi_text(value: Any, *, max_length: int = CHORUI_MAX_STORED_MESSAGE_CHARS) -> str:
    if value is None:
        return ""
    return str(value).strip()[:max_length]


def _safe_vapi_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _extract_vapi_tool_calls(payload: dict[str, Any]) -> list[dict[str, Any]]:
    message = payload.get("message")
    if not isinstance(message, dict):
        return []

    calls: list[dict[str, Any]] = []

    raw_calls = message.get("toolCallList")
    if isinstance(raw_calls, list):
        for item in raw_calls:
            if not isinstance(item, dict):
                continue
            calls.append(
                {
                    "id": _safe_vapi_text(item.get("id"), max_length=128),
                    "name": _safe_vapi_text(item.get("name"), max_length=128),
                    "arguments": _safe_vapi_dict(item.get("arguments")),
                }
            )

    wrapped_calls = message.get("toolWithToolCallList")
    if isinstance(wrapped_calls, list):
        for wrapped in wrapped_calls:
            if not isinstance(wrapped, dict):
                continue
            tool_call = wrapped.get("toolCall")
            if not isinstance(tool_call, dict):
                continue
            function_payload = tool_call.get("function")
            function_dict = function_payload if isinstance(function_payload, dict) else {}
            calls.append(
                {
                    "id": _safe_vapi_text(tool_call.get("id"), max_length=128),
                    "name": _safe_vapi_text(
                        function_dict.get("name") or wrapped.get("name"),
                        max_length=128,
                    ),
                    "arguments": _safe_vapi_dict(function_dict.get("parameters")),
                }
            )

    return calls


def _extract_vapi_call_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    message = payload.get("message")
    if not isinstance(message, dict):
        return {}
    call = message.get("call")
    if not isinstance(call, dict):
        return {}
    metadata = call.get("metadata")
    if not isinstance(metadata, dict):
        return {}
    return metadata


def _extract_vapi_session_token(
    *,
    arguments: dict[str, Any],
    metadata: dict[str, Any],
    request: Request,
) -> str:
    token_candidates = [
        arguments.get("session_token"),
        arguments.get("auth_token"),
        arguments.get("token"),
        metadata.get("session_token"),
        metadata.get("auth_token"),
        request.headers.get("x-session-token"),
    ]

    authorization = request.headers.get("authorization")
    if authorization:
        token_candidates.append(authorization)

    for candidate in token_candidates:
        token = _safe_vapi_text(candidate, max_length=8000)
        if not token:
            continue
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1].strip()
        if token:
            return token
    return ""


def _extract_vapi_role_context(arguments: dict[str, Any], metadata: dict[str, Any]) -> str:
    raw = _safe_vapi_text(
        arguments.get("role_context")
        or metadata.get("role_context")
        or metadata.get("medora_role_context"),
        max_length=32,
    ).lower()
    if raw in {"doctor", "patient"}:
        return raw
    return ""


def _extract_vapi_patient_identifier(arguments: dict[str, Any], metadata: dict[str, Any]) -> str | None:
    candidate = _safe_vapi_text(
        arguments.get("patient_id")
        or arguments.get("patient_identifier")
        or metadata.get("patient_id")
        or metadata.get("medora_patient_id")
    )
    return candidate or None


def _extract_vapi_conversation_id(arguments: dict[str, Any], payload: dict[str, Any]) -> str | None:
    requested_id = _safe_vapi_text(arguments.get("conversation_id"), max_length=64)
    if requested_id:
        return requested_id

    message = payload.get("message")
    if isinstance(message, dict):
        call = message.get("call")
        if isinstance(call, dict):
            call_id = _safe_vapi_text(call.get("id"), max_length=54)
            if call_id:
                return f"vapi-{call_id}"[:64]
    return None


async def _resolve_vapi_user_from_token(session_token: str, db: AsyncSession) -> Any:
    payload = await verify_jwt(session_token)
    user_id = _safe_vapi_text(payload.get("sub"), max_length=64)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    if profile.status == AccountStatus.banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voice access is blocked for this account.",
        )

    return SimpleNamespace(
        id=user_id,
        email=payload.get("email"),
        email_confirmed_at=payload.get("email_confirmed_at") or payload.get("confirmed_at"),
    )


async def _require_doctor(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access this resource")


async def _require_doctor_ai_assistance_enabled(db: AsyncSession, doctor_id: str) -> None:
    result = await db.execute(
        select(DoctorProfile.ai_assistance).where(DoctorProfile.profile_id == doctor_id)
    )
    ai_assistance = result.scalar_one_or_none()
    if ai_assistance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    if not ai_assistance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor has disabled Chorui AI assistance.",
        )


@dataclass(frozen=True, slots=True)
class PatientAIAccessPreferences:
    personal_context_enabled: bool
    general_chat_enabled: bool


async def _get_patient_ai_access_preferences(db: AsyncSession, patient_id: str) -> PatientAIAccessPreferences:
    result = await db.execute(
        select(
            PatientProfile.consent_ai,
            PatientProfile.ai_personal_context_enabled,
            PatientProfile.ai_general_chat_enabled,
        ).where(PatientProfile.profile_id == patient_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient medical profile not found")

    legacy = bool(row[0]) if row[0] is not None else False
    personal = legacy if row[1] is None else bool(row[1])
    general = legacy if row[2] is None else bool(row[2])
    return PatientAIAccessPreferences(
        personal_context_enabled=personal,
        general_chat_enabled=general,
    )


async def _require_patient_general_ai_chat_enabled(db: AsyncSession, patient_id: str) -> PatientAIAccessPreferences:
    prefs = await _get_patient_ai_access_preferences(db, patient_id)
    if not prefs.general_chat_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has not enabled general Chorui AI chat.",
        )
    return prefs


async def _require_patient_personal_ai_context_enabled(db: AsyncSession, patient_id: str) -> PatientAIAccessPreferences:
    prefs = await _get_patient_ai_access_preferences(db, patient_id)
    if not prefs.personal_context_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has disabled Chorui AI personal-context sharing.",
        )
    return prefs


async def _require_doctor_patient_ai_permissions(
    db: AsyncSession,
    *,
    doctor_id: str,
    patient_id: str,
    sharing_perms: SharingPermissions | None = None,
) -> SharingPermissions:
    await _require_doctor_ai_assistance_enabled(db, doctor_id)
    await _require_patient_personal_ai_context_enabled(db, patient_id)

    effective_perms = sharing_perms or await get_sharing_permissions(
        db,
        patient_id=patient_id,
        doctor_id=doctor_id,
    )
    if effective_perms.nothing_shared:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has not shared any personal information categories for Chorui AI.",
        )
    return effective_perms


async def _get_patient_context(db: AsyncSession, patient_id: str) -> tuple[Profile, PatientProfile]:
    profile_result = await db.execute(select(Profile).where(Profile.id == patient_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")

    patient_result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient medical profile not found")

    return profile, patient


async def _resolve_patient_identifier_for_doctor(
    db: AsyncSession,
    *,
    doctor_id: str,
    patient_identifier: str,
) -> str:
    raw_identifier = str(patient_identifier or "").strip()
    if not raw_identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="patient_id is required")

    resolved = await resolve_doctor_patient_identifier(
        db,
        doctor_id=doctor_id,
        patient_identifier=raw_identifier,
    )
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found for this doctor. Use a valid patient ID from your list.",
        )
    return resolved


def _extract_conditions(patient: PatientProfile) -> list[str]:
    condition_flags = [
        ("Type 2 Diabetes", patient.has_diabetes),
        ("Hypertension", patient.has_hypertension),
        ("Heart Disease", patient.has_heart_disease),
        ("Asthma", patient.has_asthma),
        ("Kidney Disease", patient.has_kidney_disease),
        ("Liver Disease", patient.has_liver_disease),
        ("Thyroid Disorder", patient.has_thyroid),
        ("Cancer", patient.has_cancer),
        ("Arthritis", patient.has_arthritis),
        ("Stroke History", patient.has_stroke),
    ]
    conditions = [name for name, enabled in condition_flags if enabled]

    if isinstance(patient.conditions, list):
        for item in patient.conditions:
            if isinstance(item, dict) and item.get("name"):
                conditions.append(str(item["name"]))

    return list(dict.fromkeys(conditions))


def _extract_allergies(patient: PatientProfile) -> list[str]:
    allergies: list[str] = []
    if patient.allergies:
        allergies.append(str(patient.allergies))
    if patient.food_allergies:
        allergies.append(str(patient.food_allergies))
    if patient.environmental_allergies:
        allergies.append(str(patient.environmental_allergies))

    if isinstance(patient.drug_allergies, list):
        for item in patient.drug_allergies:
            if isinstance(item, dict):
                drug = item.get("drug_name")
                reaction = item.get("reaction")
                if drug and reaction:
                    allergies.append(f"{drug} ({reaction})")
                elif drug:
                    allergies.append(str(drug))

    return list(dict.fromkeys(allergies))


def _extract_medications(patient: PatientProfile) -> list[str]:
    medications: list[str] = []
    if isinstance(patient.medications, list):
        for item in patient.medications:
            if isinstance(item, dict) and item.get("name"):
                dose = item.get("dosage") or item.get("strength")
                freq = item.get("frequency")
                if dose and freq:
                    medications.append(f"{item['name']} {dose} ({freq})")
                elif dose:
                    medications.append(f"{item['name']} {dose}")
                else:
                    medications.append(str(item["name"]))
    return list(dict.fromkeys(medications))


def _extract_family_history(patient: PatientProfile) -> list[str]:
    flags = [
        ("Family history of diabetes", patient.family_has_diabetes),
        ("Family history of hypertension", patient.family_has_hypertension),
        ("Family history of heart disease", patient.family_has_heart_disease),
        ("Family history of cancer", patient.family_has_cancer),
        ("Family history of stroke", patient.family_has_stroke),
        ("Family history of asthma", patient.family_has_asthma),
        ("Family history of thalassemia", patient.family_has_thalassemia),
        ("Family history of blood disorders", patient.family_has_blood_disorders),
        ("Family history of mental health conditions", patient.family_has_mental_health),
        ("Family history of kidney disease", patient.family_has_kidney_disease),
        ("Family history of thyroid disease", patient.family_has_thyroid),
    ]
    output = [label for label, enabled in flags if enabled]
    notes = str(patient.family_history_notes or "").strip()
    if notes:
        output.append(f"Family history notes: {notes[:220]}")
    return list(dict.fromkeys(output))


def _build_risk_flags(patient: PatientProfile, conditions: list[str]) -> list[str]:
    risks: list[str] = []
    high_risk_terms = {"Heart Disease", "Stroke History", "Kidney Disease", "Type 2 Diabetes"}
    if any(term in conditions for term in high_risk_terms):
        risks.append("Cardiovascular Risk High")
    if patient.has_cancer:
        risks.append("Oncology Follow-up Risk")
    return list(dict.fromkeys(risks))


def _build_raw_summary(profile: Profile, patient: PatientProfile) -> dict[str, Any]:
    conditions = _extract_conditions(patient)
    medications = _extract_medications(patient)
    allergies = _extract_allergies(patient)
    risk_flags = _build_risk_flags(patient, conditions)
    family_history = _extract_family_history(patient)

    return {
        "patient_ref": patient_ref_from_uuid(profile.id),
        "conditions": conditions,
        "medications": medications,
        "allergies": allergies,
        "risk_flags": risk_flags,
        "family_history": family_history,
        "history": {
            "surgeries": patient.surgeries if isinstance(patient.surgeries, list) else [],
            "hospitalizations": patient.hospitalizations if isinstance(patient.hospitalizations, list) else [],
            "drug_allergies": patient.drug_allergies if isinstance(patient.drug_allergies, list) else [],
            "family_history_notes": str(patient.family_history_notes or "").strip(),
        },
    }


async def _persist_ai_interaction(
    db: AsyncSession,
    *,
    result: AIExecutionResult,
    doctor_id: str,
    patient_id: str,
) -> str:
    interaction = AIInteraction(
        id=str(uuid.uuid4()),
        feature=result.feature,
        prompt_version=result.prompt_version,
        sanitized_input=result.sanitized_input,
        raw_output=result.raw_output,
        validated_output=result.validated_output,
        validation_status=result.validation_status,
        doctor_action=None,
        doctor_id=doctor_id,
        patient_id=patient_id,
        latency_ms=result.latency_ms,
        provider=result.provider,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return interaction.id


async def _get_user_role(db: AsyncSession, user_id: str) -> UserRole | None:
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    return profile.role if profile else None


def _triage_priority_to_severity(priority: str) -> int:
    normalized = priority.strip().lower()
    if normalized == "critical":
        return 10
    if normalized == "high":
        return 8
    if normalized == "low":
        return 3
    return 6


def _safe_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if str(item).strip()]


def _to_chorui_structured_data(intake_output: dict[str, Any]) -> dict[str, Any]:
    symptom_timeline = _safe_list(intake_output.get("symptom_timeline"))
    relevant_history = _safe_list(intake_output.get("relevant_history"))
    red_flags = _safe_list(intake_output.get("red_flags"))

    duration = ""
    if symptom_timeline:
        duration = symptom_timeline[0]

    return {
        "symptoms": symptom_timeline,
        "conditions": list(dict.fromkeys([*relevant_history, *red_flags])),
        "duration": duration,
        "severity": _triage_priority_to_severity(str(intake_output.get("triage_priority", "medium"))),
    }


def _history_to_text(history: list[Any]) -> str:
    if not history:
        return ""

    normalized: list[str] = []
    for item in history[-6:]:
        role = str(getattr(item, "role", "user")).strip().lower()
        content = str(getattr(item, "content", "")).strip()
        if not content:
            continue
        speaker = "Assistant" if role == "ai" else "User"
        normalized.append(f"{speaker}: {content}")
    return "\n".join(normalized)


def _normalize_message(message: str) -> str:
    return " ".join(message.lower().strip().split())


def _sanitize_chat_message(text: str) -> str:
    return text.replace("\x00", "").strip()[:CHORUI_MAX_STORED_MESSAGE_CHARS]


def _default_role_context(role: UserRole, requested_role_context: str | None) -> str:
    requested = (requested_role_context or "").strip().lower()
    if requested in {"doctor", "patient", "admin"}:
        return requested
    if role == UserRole.ADMIN:
        return "admin"
    if role == UserRole.DOCTOR:
        return "doctor"
    return "patient"


def _is_followup_message(normalized_message: str) -> bool:
    if len(normalized_message) <= 22:
        return True
    return any(token in normalized_message for token in CHORUI_FOLLOWUP_HINTS)


async def _resolve_conversation_id(
    db: AsyncSession,
    *,
    user_id: str,
    requested_conversation_id: str | None,
    role_context: str,
    patient_id: str | None,
) -> str:
    candidate = (requested_conversation_id or "").strip()[:64]
    if not candidate:
        return str(uuid.uuid4())

    result = await db.execute(
        select(ChoruiChatMessage)
        .where(ChoruiChatMessage.conversation_id == candidate)
        .order_by(ChoruiChatMessage.created_at.asc())
        .limit(1)
    )
    first_message = result.scalar_one_or_none()
    if not first_message:
        return candidate

    if first_message.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conversation access denied")

    same_role_context = first_message.role_context == role_context
    same_patient_scope = first_message.patient_id == patient_id
    if not same_role_context or not same_patient_scope:
        return str(uuid.uuid4())

    return candidate


async def _get_last_non_general_user_intent(db: AsyncSession, *, user_id: str, conversation_id: str) -> str | None:
    result = await db.execute(
        select(ChoruiChatMessage)
        .where(
            ChoruiChatMessage.user_id == user_id,
            ChoruiChatMessage.conversation_id == conversation_id,
            ChoruiChatMessage.sender == "user",
            ChoruiChatMessage.intent.is_not(None),
            ChoruiChatMessage.intent != "general",
        )
        .order_by(ChoruiChatMessage.created_at.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    return str(entry.intent).strip() if entry and entry.intent else None


async def _get_recent_intent_topics(db: AsyncSession, *, user_id: str, conversation_id: str) -> list[str]:
    result = await db.execute(
        select(ChoruiChatMessage.intent)
        .where(
            ChoruiChatMessage.user_id == user_id,
            ChoruiChatMessage.conversation_id == conversation_id,
            ChoruiChatMessage.sender == "user",
            ChoruiChatMessage.intent.is_not(None),
            ChoruiChatMessage.intent != "general",
        )
        .order_by(ChoruiChatMessage.created_at.desc())
        .limit(5)
    )
    rows = result.all()
    topics = [str(row[0]) for row in rows if row and row[0]]
    return list(dict.fromkeys(topics))


async def _persist_chorui_chat_message(
    db: AsyncSession,
    *,
    conversation_id: str,
    user_id: str,
    patient_id: str | None,
    role_context: str,
    sender: str,
    message_text: str,
    intent: str | None = None,
    structured_data: dict[str, Any] | None = None,
    context_mode: str | None = None,
    request: Request | None = None,
) -> None:
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None

    db.add(
        ChoruiChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            user_id=user_id,
            patient_id=patient_id,
            role_context=role_context,
            sender=sender,
            message_text=_sanitize_chat_message(message_text),
            intent=intent,
            structured_data=structured_data,
            context_mode=context_mode,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    await db.commit()


def _build_chorui_navigation_action(
    *,
    role_context: str,
    intent: str,
    patient_id: str | None,
    user_message: str,
    intent_normalization: dict[str, Any] | None = None,
) -> tuple[ChoruiNavigationAction, list[ChoruiSuggestedRoute], ChoruiNavigationMemory]:
    normalized_payload = intent_normalization if isinstance(intent_normalization, dict) else {}
    patient_route_id: str | None = None
    if patient_id:
        try:
            patient_route_id = patient_ref_from_uuid(patient_id)
        except Exception:
            patient_route_id = patient_id

    engine_result = resolve_chorui_navigation_engine(
        message=user_message,
        role_context=role_context,
        raw_intent=intent,
        intent_normalization=normalized_payload,
        patient_id=patient_id,
        patient_route_id=patient_route_id,
    )

    action_options = [
        ChoruiNavigationActionOption(
            label=option.label,
            canonical_intent=option.canonical_intent,
            route=option.route,
        )
        for option in engine_result.options
    ]
    suggested_routes = [
        ChoruiSuggestedRoute(
            label=suggestion.label,
            route=suggestion.route,
            canonical_intent=suggestion.canonical_intent,
        )
        for suggestion in engine_result.suggestions
    ]
    action = ChoruiNavigationAction(
        type=engine_result.action,
        route=engine_result.route,
        confidence=engine_result.confidence,
        requires_confirmation=engine_result.requires_confirmation,
        missing_params=list(engine_result.missing_params),
        options=action_options,
        reason=engine_result.reason,
        delay_ms=engine_result.delay_ms,
    )
    memory = ChoruiNavigationMemory(
        pending_intent=engine_result.memory.pending_intent,
        missing_params=list(engine_result.memory.missing_params),
        last_resolved_intent=engine_result.memory.last_resolved_intent,
    )
    return action, suggested_routes, memory


def _build_chorui_navigation_meta(action: ChoruiNavigationAction) -> ChoruiNavigationMeta:
    if action.type == "navigate" and action.route:
        return ChoruiNavigationMeta(
            previous_route=None,
            last_navigation_route=action.route,
        )
    return ChoruiNavigationMeta()


async def _finalize_chorui_response(
    *,
    db: AsyncSession,
    conversation_id: str,
    user_id: str,
    patient_id: str | None,
    role_context: str,
    reply: str,
    structured_data: dict[str, Any],
    context_mode: str,
    intent: str,
    request: Request | None,
    user_message: str | None = None,
    navigation: list[ChoruiNavigationSuggestion] | None = None,
) -> ChoruiAssistantResponse:
    synthesized_reply = str(reply or "").strip()
    llm_source = str(structured_data.get("llm_source") or "")
    should_synthesize = llm_source not in {"clinical_info_query", "navigation"} and not navigation
    if should_synthesize:
        synthesis_started = perf_counter()
        try:
            synthesized = await _synthesize_chorui_reply_with_llm(
                message=user_message or str(structured_data.get("user_query") or ""),
                intent=intent,
                role_context=role_context,
                context_mode=context_mode,
                structured_data=structured_data,
                draft_reply=reply,
            )
            if synthesized:
                synthesized_reply = synthesized
        except Exception as exc:
            duration_ms = int((perf_counter() - synthesis_started) * 1000)
            logger.warning(
                "Chorui synthesis fallback | intent=%s context_mode=%s duration_ms=%s error=%s",
                intent,
                context_mode,
                duration_ms,
                str(exc),
            )
            synthesized_reply = _build_chorui_local_fallback_reply(
                intent=intent,
                context_mode=context_mode,
                structured_data=structured_data,
            )

    reply = _soften_assistant_tone(synthesized_reply)
    intent_normalization_payload = (
        structured_data.get("intent_normalization")
        if isinstance(structured_data.get("intent_normalization"), dict)
        else None
    )
    canonical_intent = ""
    intent_mode = ""
    if intent_normalization_payload:
        canonical_intent = str(intent_normalization_payload.get("canonical_intent") or "").strip()
        intent_mode = str(intent_normalization_payload.get("intent_mode") or "").strip().lower()

    action, suggested_routes, memory = _build_chorui_navigation_action(
        role_context=role_context,
        intent=intent,
        patient_id=patient_id,
        user_message=user_message or str(structured_data.get("user_query") or ""),
        intent_normalization=intent_normalization_payload,
    )
    navigation_meta = _build_chorui_navigation_meta(action)
    logger.info(
        "Chorui navigation action | role=%s intent=%s canonical=%s mode=%s type=%s route=%s confidence=%.2f reason=%s",
        role_context,
        intent,
        canonical_intent,
        intent_mode,
        action.type,
        action.route,
        float(action.confidence),
        action.reason,
    )

    await _persist_chorui_chat_message(
        db,
        conversation_id=conversation_id,
        user_id=user_id,
        patient_id=patient_id,
        role_context=role_context,
        sender="assistant",
        message_text=reply,
        intent=intent,
        structured_data=structured_data,
        context_mode=context_mode,
        request=request,
    )
    return ChoruiAssistantResponse(
        reply=reply,
        conversation_id=conversation_id,
        structured_data=structured_data,
        context_mode=context_mode,
        action=action,
        suggested_routes=suggested_routes,
        memory=memory,
        navigation_meta=navigation_meta,
    )


def _soften_assistant_tone(reply: str) -> str:
    text = str(reply or "").strip()
    if not text:
        return "I am here with you. Tell me what you need and I will help with your Medora context."

    replacements = {
        "Please verify this list with your doctor before making any treatment decision.": "If you want, I can help you prepare a quick list of questions for your doctor.",
        "Please validate against the latest consultation before prescribing.": "You can cross-check this with the latest consultation notes before finalizing.",
        "Use this as background context and confirm diagnosis clinically.": "Use this as background context while continuing your clinical assessment.",
        "Please cross-check before finalizing orders.": "A quick cross-check with recent records can help before finalizing orders.",
        "Use this as support context only.": "Use this as support context.",
        "Assistive summary only. Verify clinically before decisions.": "If you want, I can help convert this into a concise consultation checklist.",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def _message_has_any(normalized: str, keys: tuple[str, ...]) -> bool:
    return any(key in normalized for key in keys)


def _is_medical_decision_request(normalized: str) -> bool:
    record_lookup_terms = (
        "who prescribed",
        "which doctor",
        "who are my doctors",
        "my doctors",
        "doctor list",
        "previous doctor",
        "past doctor",
    )
    if _message_has_any(normalized, record_lookup_terms):
        return False

    restricted_terms = (
        "prescribe me",
        "dosage",
        "dose",
        "diagnose me",
        "diagnosis for me",
        "confirm diagnosis",
        "treatment plan",
        "what should i take",
        "which medicine should",
        "should i take",
        "can i take",
        "recommend medicine",
        "emergency treatment",
    )
    return _message_has_any(normalized, restricted_terms)


def _looks_like_privacy_refusal(text: str) -> bool:
    normalized = _normalize_message(text or "")
    markers = (
        "privacy restrictions",
        "cannot access patient",
        "can't access patient",
        "local mode",
        "local-only mode",
        "not available due to privacy",
        "patient profile is not available",
    )
    return _message_has_any(normalized, markers)


def _extract_symptom_hints(message: str) -> list[str]:
    # Keep extraction intentionally conservative to avoid over-interpreting medical text.
    hints: list[str] = []
    normalized = _normalize_message(message)
    known_signals = [
        "fever",
        "cough",
        "headache",
        "chest pain",
        "shortness of breath",
        "vomiting",
        "nausea",
        "dizziness",
        "fatigue",
        "rash",
        "sore throat",
        "abdominal pain",
    ]
    for signal in known_signals:
        if signal in normalized:
            hints.append(signal)
    return list(dict.fromkeys(hints))


def _extract_severity_hint(message: str) -> int:
    normalized = _normalize_message(message)
    numeric_match = re.search(r"\b([1-9]|10)\s*/\s*10\b", normalized)
    if numeric_match:
        try:
            return max(0, min(10, int(numeric_match.group(1))))
        except ValueError:
            return 0

    if _message_has_any(normalized, ("severe", "very painful", "unbearable", "extreme")):
        return 8
    if _message_has_any(normalized, ("moderate", "getting worse", "persistent")):
        return 6
    if _message_has_any(normalized, ("mild", "slight", "minor")):
        return 3
    return 0


def _extract_duration_hint(message: str) -> str:
    normalized = _normalize_message(message)
    match = re.search(r"\b(?:for|since)\s+([a-z0-9\-\s]{1,30})\b", normalized)
    if match:
        return match.group(1).strip()
    return ""


def _classify_chorui_intent(message: str, role: UserRole, has_target_patient: bool) -> str:
    normalized = _normalize_message(message)
    medication_keys = ("medication", "medications", "medicine", "medicines", "drug", "drugs")
    patient_doctors_keys = (
        "who are my doctors",
        "my doctors",
        "which doctor",
        "who prescribed",
        "prescribed me",
        "doctor prescribed",
        "who gave me",
    )
    patient_list_keys = (
        "who are my patients",
        "my patients",
        "patient list",
        "active patients",
        "patient id",
        "patient ids",
        "profile id",
        "profile ids",
    )
    condition_keys = ("condition", "conditions", "disease", "diagnosis")
    allergy_keys = ("allergy", "allergies", "allergic")
    risk_keys = ("risk", "risk flags", "high risk")
    history_keys = ("history", "surgeries", "surgery", "hospitalization", "hospitalizations")
    family_history_keys = ("family history", "family", "genetic", "hereditary")
    summary_keys = ("summary", "summarize", "overview", "snapshot")
    appointment_keys = ("appointment", "appointments", "next visit", "upcoming")
    schedule_keys = ("schedule", "today", "this week")
    doctor_today_keys = (
        "appointments today",
        "today appointments",
        "today's appointments",
        "my appointments today",
        "today schedule",
        "schedule today",
    )
    patient_search_keys = (
        "patient with",
        "patients with",
        "who is my patient",
        "which patient",
        "find patient",
    )
    health_query_keys = (
        "what is",
        "why does",
        "how does",
        "symptom",
        "prevention",
        "causes of",
        "is it dangerous",
        "how to reduce",
    )
    service_keys = (
        "how do i",
        "where can i",
        "how can i",
        "book",
        "upload",
        "medical history",
        "profile",
        "avatar",
        "find doctor",
        "find medicine",
        "privacy",
        "security",
        "data",
    )

    if role == UserRole.DOCTOR and any(key in normalized for key in patient_list_keys):
        return "doctor_active_patients"

    if role == UserRole.DOCTOR and _message_has_any(normalized, doctor_today_keys):
        return "doctor_today_appointments"

    if role == UserRole.DOCTOR and not has_target_patient and _message_has_any(normalized, patient_search_keys):
        return "doctor_search_patient_by_condition"

    if role == UserRole.PATIENT and _message_has_any(normalized, patient_doctors_keys):
        return "patient_self_doctors"

    if _message_has_any(normalized, service_keys):
        return "service_information"

    if role == UserRole.PATIENT and _message_has_any(normalized, health_query_keys):
        return "patient_health_query"

    if _message_has_any(normalized, summary_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_summary"
        if role == UserRole.PATIENT:
            return "patient_self_summary"

    if _message_has_any(normalized, allergy_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_allergies"
        if role == UserRole.PATIENT:
            return "patient_self_allergies"

    if _message_has_any(normalized, risk_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_risks"
        if role == UserRole.PATIENT:
            return "patient_self_risks"

    if _message_has_any(normalized, family_history_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_family_history"
        if role == UserRole.PATIENT:
            return "patient_self_family_history"

    if _message_has_any(normalized, history_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_history"
        if role == UserRole.PATIENT:
            return "patient_self_history"

    if _message_has_any(normalized, appointment_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_upcoming_appointments"
        if role == UserRole.PATIENT:
            return "patient_self_upcoming_appointments"

    if role == UserRole.DOCTOR and _message_has_any(normalized, schedule_keys):
        return "doctor_self_schedule"

    if any(key in normalized for key in medication_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_medications"
        if role == UserRole.PATIENT:
            return "patient_self_medications"

    if any(key in normalized for key in condition_keys):
        if role == UserRole.DOCTOR and has_target_patient:
            return "doctor_patient_conditions"
        if role == UserRole.PATIENT:
            return "patient_self_conditions"

    return "general"


def _render_bullet_list(items: list[str]) -> str:
    return "\n".join([f"- {item}" for item in items])


def _format_datetime_label(value: datetime | None) -> str:
    if value is None:
        return "unknown"
    try:
        return value.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return "unknown"


def _format_datetime_iso(value: datetime | None) -> str:
    if value is None:
        return datetime.utcnow().isoformat()
    try:
        return value.isoformat()
    except Exception:
        return datetime.utcnow().isoformat()


def _format_status_label(status_value: Any) -> str:
    if hasattr(status_value, "value"):
        return str(status_value.value)
    return str(status_value)


def _calculate_age_years(date_of_birth: Any) -> int | None:
    if not date_of_birth:
        return None
    try:
        today = datetime.utcnow().date()
        return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    except Exception:
        return None


def _build_chorui_local_fallback_reply(
    *,
    intent: str,
    context_mode: str,
    structured_data: dict[str, Any],
) -> str:
    sections: list[str] = [
        "I could not reach advanced AI generation right now, but here is the verified context I found:",
        f"- Context mode: {context_mode}",
        f"- Intent: {intent}",
    ]

    list_fields = {
        "conditions": "Conditions",
        "medications": "Medications",
        "allergies": "Allergies",
        "risk_flags": "Risk Flags",
        "family_history": "Family History",
        "matching_patients": "Matching Patients",
        "today_appointments": "Today's Appointments",
    }
    for key, label in list_fields.items():
        value = structured_data.get(key)
        if isinstance(value, list) and value:
            if key in {"matching_patients", "today_appointments"}:
                summary = []
                for item in value[:6]:
                    if isinstance(item, dict):
                        summary.append(
                            str(
                                item.get("patient_ref")
                                or item.get("display_name")
                                or item.get("appointment_date")
                                or item
                            )
                        )
                    else:
                        summary.append(str(item))
                sections.append(f"- {label}: {', '.join(summary)}")
            else:
                sections.append(f"- {label}: {', '.join([str(item) for item in value[:8]])}")

    demographics = structured_data.get("demographics")
    if isinstance(demographics, dict) and demographics:
        compact = []
        for field in ("age", "gender", "blood_group", "height_cm", "weight_kg"):
            val = demographics.get(field)
            if val not in (None, "", []):
                compact.append(f"{field}: {val}")
        if compact:
            sections.append(f"- Demographics: {'; '.join(compact)}")

    sections.append("If you want, I can try again or focus on one specific part (for example medications or appointments).")
    return "\n".join(sections)


async def _synthesize_chorui_reply_with_llm(
    *,
    message: str,
    intent: str,
    role_context: str,
    context_mode: str,
    structured_data: dict[str, Any],
    draft_reply: str,
    prompt_version: str = "v2-chorui-synthesis",
) -> str | None:
    synthesis_payload = {
        "role_context": role_context,
        "context_mode": context_mode,
        "intent": intent,
        "user_question": str(message or "").strip()[:2000],
        "verified_context": structured_data,
        "draft_reply": str(draft_reply or "").strip()[:4000],
    }

    # Build explicit patient health context so the LLM always acknowledges it
    health_context_parts: list[str] = []
    conditions = structured_data.get("conditions")
    if isinstance(conditions, list) and conditions:
        health_context_parts.append(f"Patient conditions: {', '.join(str(c) for c in conditions[:10])}")
    medications = structured_data.get("medications")
    if isinstance(medications, list) and medications:
        health_context_parts.append(f"Current medications: {', '.join(str(m) for m in medications[:8])}")
    allergies = structured_data.get("allergies")
    if isinstance(allergies, list) and allergies:
        health_context_parts.append(f"Allergies: {', '.join(str(a) for a in allergies[:6])}")
    risk_flags = structured_data.get("risk_flags")
    if isinstance(risk_flags, list) and risk_flags:
        health_context_parts.append(f"Risk flags: {', '.join(str(r) for r in risk_flags[:4])}")
    health_context_line = ". ".join(health_context_parts) + "." if health_context_parts else ""

    query = (
        "Synthesize a natural language response for Medora Chorui. "
        "Use verified_context as source-of-truth and do not invent records. "
        "Be concise, clear, and medically safe. "
        "If uncertainty exists, state it. "
        + (f"IMPORTANT — the patient's known health profile: {health_context_line} Always acknowledge and integrate this information when relevant to the question. " if health_context_line else "")
        + "\n"
        + json.dumps(synthesis_payload, ensure_ascii=False)
    )
    result = await ai_orchestrator.clinical_info_query(
        query,
        include_meta=False,
        prompt_version=prompt_version,
    )
    answer = str((result or {}).get("answer", "")).strip()
    if not answer:
        return None
    cautions = [str(item).strip() for item in (result or {}).get("cautions", []) if str(item).strip()]
    if cautions:
        answer = f"{answer}\n\nCautions:\n{_render_bullet_list(cautions[:4])}"
    return answer


async def _search_doctor_patients_by_criteria(
    db: AsyncSession,
    *,
    doctor_id: str,
    criteria_text: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    normalized = _normalize_message(criteria_text)
    rows = (
        await db.execute(
            select(Appointment.patient_id)
            .where(
                Appointment.doctor_id == doctor_id,
                Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
            )
            .group_by(Appointment.patient_id)
        )
    ).all()
    patient_ids = [row[0] for row in rows if row and row[0]]
    if not patient_ids:
        return []

    profile_rows = (await db.execute(select(Profile).where(Profile.id.in_(patient_ids)))).scalars().all()
    patient_profile_rows = (
        await db.execute(select(PatientProfile).where(PatientProfile.profile_id.in_(patient_ids)))
    ).scalars().all()
    profile_map = {item.id: item for item in profile_rows}
    patient_map = {item.profile_id: item for item in patient_profile_rows}

    # Batch-load sharing preferences so we don't leak restricted conditions
    from app.db.models.patient_data_sharing import PatientDataSharingPreference
    sharing_rows = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.doctor_id == doctor_id,
                PatientDataSharingPreference.patient_id.in_(patient_ids),
            )
        )
    ).scalars().all()
    sharing_map = {row.patient_id: row for row in sharing_rows}

    matches: list[dict[str, Any]] = []
    for patient_id in patient_ids:
        profile = profile_map.get(patient_id)
        patient = patient_map.get(patient_id)
        if not profile:
            continue

        sharing_pref = sharing_map.get(patient_id)
        can_see_profile = sharing_pref.can_view_profile if sharing_pref else False
        can_see_conditions = sharing_pref.can_view_conditions if sharing_pref else False

        name_tokens = ""
        if can_see_profile:
            name_tokens = " ".join(
                [str(profile.first_name or "").lower(), str(profile.last_name or "").lower()]
            ).strip()
        condition_tokens = ""
        if can_see_conditions and patient:
            condition_tokens = " ".join([item.lower() for item in _extract_conditions(patient) if item]).strip()

        score = 0
        for token in normalized.split():
            if len(token) < 3:
                continue
            if name_tokens and token in name_tokens:
                score += 2
            if condition_tokens and token in condition_tokens:
                score += 3

        if score <= 0:
            continue
        matches.append(
            {
                "patient_id": patient_id,
                "patient_ref": patient_ref_from_uuid(patient_id),
                "display_name": (
                    f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient"
                ) if can_see_profile else "Patient",
                "conditions": (_extract_conditions(patient)[:8] if patient else []) if can_see_conditions else [],
                "score": score,
            }
        )

    matches.sort(key=lambda item: int(item.get("score", 0)), reverse=True)
    return matches[:limit]


async def _build_patient_extended_context(
    db: AsyncSession,
    *,
    patient_id: str,
    doctor_id: str | None,
) -> dict[str, Any]:
    profile = (
        await db.execute(select(Profile).where(Profile.id == patient_id).limit(1))
    ).scalar_one_or_none()
    patient = (
        await db.execute(select(PatientProfile).where(PatientProfile.profile_id == patient_id).limit(1))
    ).scalar_one_or_none()

    demographics = {
        "age": _calculate_age_years(getattr(patient, "date_of_birth", None)),
        "gender": str(getattr(patient, "gender", "") or "") or None,
        "blood_group": str(getattr(patient, "blood_group", "") or "") or None,
        "height_cm": getattr(patient, "height", None),
        "weight_kg": getattr(patient, "weight", None),
        "patient_ref": patient_ref_from_uuid(patient_id),
        "display_name": f"{getattr(profile, 'first_name', '') or ''} {getattr(profile, 'last_name', '') or ''}".strip() or "Patient",
    }

    consultations = (
        await db.execute(
            select(Consultation)
            .where(Consultation.patient_id == patient_id)
            .order_by(Consultation.consultation_date.desc())
            .limit(3)
        )
    ).scalars().all()
    recent_consultations = [
        {
            "consultation_date": _format_datetime_iso(item.consultation_date),
            "chief_complaint": str(item.chief_complaint or "")[:300],
            "diagnosis": str(item.diagnosis or "")[:300],
            "notes": str(item.notes or "")[:400],
            "status": _format_status_label(item.status),
        }
        for item in consultations
    ]

    prescriptions = (
        await db.execute(
            select(Prescription)
            .options(selectinload(Prescription.medications))
            .where(Prescription.patient_id == patient_id)
            .order_by(Prescription.created_at.desc())
            .limit(5)
        )
    ).scalars().all()
    recent_prescriptions: list[dict[str, Any]] = []
    for item in prescriptions:
        dosage_items: list[str] = []
        for med in item.medications[:8]:
            dosage_items.append(
                f"{med.medicine_name}: {_medication_schedule_line(med)}"
            )
        recent_prescriptions.append(
            {
                "prescription_id": item.id,
                "created_at": _format_datetime_iso(item.created_at),
                "status": _format_status_label(item.status),
                "dosages": dosage_items,
            }
        )

    appointment_query = (
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.appointment_date.desc())
        .limit(6)
    )
    if doctor_id:
        appointment_query = appointment_query.where(Appointment.doctor_id == doctor_id)
    appointments = (await db.execute(appointment_query)).scalars().all()
    appointment_history = [
        {
            "appointment_date": _format_datetime_iso(item.appointment_date),
            "status": _format_status_label(item.status),
            "reason": str(item.reason or "")[:240],
            "notes": str(item.notes or "")[:280],
        }
        for item in appointments
    ]

    lifestyle = {
        "smoking": str(getattr(patient, "smoking", "") or "") or None,
        "alcohol": str(getattr(patient, "alcohol", "") or "") or None,
        "activity_level": str(getattr(patient, "activity_level", "") or "") or None,
        "sleep_duration": str(getattr(patient, "sleep_duration", "") or "") or None,
    }

    return {
        "demographics": demographics,
        "recent_consultations": recent_consultations,
        "recent_prescriptions": recent_prescriptions,
        "appointment_history": appointment_history,
        "lifestyle": lifestyle,
    }


def _build_patient_summary_text(
    *,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
    family_history: list[str] | None = None,
) -> str:
    sections: list[str] = ["Quick patient brief from authorized Medora records:"]

    sections.append("\nConditions:")
    sections.append(_render_bullet_list(conditions[:5]) if conditions else "- No condition entries found")

    sections.append("\nMedications:")
    sections.append(_render_bullet_list(medications[:5]) if medications else "- No medication entries found")

    sections.append("\nAllergies:")
    sections.append(_render_bullet_list(allergies[:5]) if allergies else "- No allergy entries found")

    if risk_flags:
        sections.append("\nRisk Flags:")
        sections.append(_render_bullet_list(risk_flags[:4]))

    if family_history:
        sections.append("\nFamily History:")
        sections.append(_render_bullet_list(family_history[:5]))

    sections.append("\nIf you want, I can turn this into a short checklist for your next consultation.")
    return "\n".join(sections)


def _build_service_information_reply(*, role: UserRole, message: str) -> str:
    normalized = _normalize_message(message)

    if _message_has_any(normalized, ("book", "appointment", "schedule")):
        if role == UserRole.DOCTOR:
            return (
                "You can manage appointments from the Appointments section. "
                "Open a patient from your list to continue your workflow quickly."
            )
        return (
            "You can book appointments from Find Doctor or your Appointments page. "
            "Pick a doctor, select a slot, and confirm."
        )

    if _message_has_any(normalized, ("find doctor", "doctor search")) and role == UserRole.PATIENT:
        return "Use Find Doctor to filter by specialty, location, and availability, then book from the doctor profile page."

    if _message_has_any(normalized, ("upload", "report", "medical history", "prescription")):
        return (
            "You can upload and manage records from Medical History and consultation-related forms. "
            "After upload, I can summarize what is currently captured in your account records."
        )

    if _message_has_any(normalized, ("avatar", "profile photo", "profile")):
        return "Default avatars are assigned automatically. You can change your avatar anytime from your profile page."

    if _message_has_any(normalized, ("privacy", "security", "data")):
        return (
            "Medora enforces role-based access checks and patient scoping. "
            "Sensitive references are anonymized in assistant processing paths."
        )

    return (
        "I can help with Medora workflows like appointments, profile updates, records, and navigation. "
        "Tell me what you want to do and I will guide you step by step."
    )


# -------------------- Chorui navigation assistant --------------------
#
# These entries back the "take me to X" navigation experience. Each entry is a
# stable path inside the Next.js app router and a set of natural-language
# keywords that callers can use to request it. Keys are compared against a
# normalised version of the user's message so trivial phrasing differences
# (punctuation, casing, extra whitespace) still match.
#
# Keep this list in sync with the real routes in frontend/app/(home)/patient/
# and frontend/app/(home)/doctor/. When adding a new page, add at least the
# primary label, the path, and 3-5 natural keywords so the matcher has enough
# signal to pick it up without the LLM.

_CHORUI_PATIENT_NAVIGATION: tuple[dict[str, Any], ...] = (
    {
        "label": "Patient Home",
        "path": "/patient/home",
        "description": "Your personal Medora dashboard with today's snapshot.",
        "keywords": ("home", "dashboard", "main page", "overview", "landing"),
    },
    {
        "label": "Find Doctor",
        "path": "/patient/find-doctor",
        "description": "Search doctors by specialty, location, and availability.",
        "keywords": (
            "find doctor",
            "search doctor",
            "book a doctor",
            "look for doctor",
            "specialist",
            "doctor list",
            "browse doctors",
        ),
    },
    {
        "label": "Appointments",
        "path": "/patient/appointments",
        "description": "Review, book, reschedule, or cancel your appointments.",
        "keywords": (
            "appointment",
            "appointments",
            "book appointment",
            "reschedule",
            "cancel appointment",
            "upcoming visit",
            "my visits",
        ),
    },
    {
        "label": "My Prescriptions",
        "path": "/patient/my-prescriptions",
        "description": "All prescriptions issued by your doctors.",
        "keywords": (
            "prescription",
            "prescriptions",
            "my prescription",
            "medicine list",
            "medication list",
            "drug list",
            "refill",
        ),
    },
    {
        "label": "Medical History",
        "path": "/patient/medical-history",
        "description": "Your saved conditions, allergies, and medical history.",
        "keywords": (
            "medical history",
            "health history",
            "conditions",
            "allergies",
            "past illness",
            "history of illness",
        ),
    },
    {
        "label": "Medical Reports",
        "path": "/patient/medical-reports",
        "description": "Upload or view your lab results and scanned reports.",
        "keywords": (
            "medical report",
            "lab report",
            "upload report",
            "scan",
            "blood test",
            "test result",
            "diagnostic",
        ),
    },
    {
        "label": "Find Medicine",
        "path": "/patient/find-medicine",
        "description": "Look up medicines, brands, and alternatives.",
        "keywords": (
            "find medicine",
            "search medicine",
            "pharmacy",
            "brand",
            "generic",
            "drug search",
            "medicine lookup",
        ),
    },
    {
        "label": "Reminders",
        "path": "/patient/reminders",
        "description": "Medicine and appointment reminders you have set.",
        "keywords": (
            "reminder",
            "reminders",
            "medicine reminder",
            "alert",
            "notification schedule",
        ),
    },
    {
        "label": "Analytics",
        "path": "/patient/analytics",
        "description": "Trends and analytics on your health data.",
        "keywords": (
            "analytics",
            "trends",
            "charts",
            "statistics",
            "my health data",
            "health insights",
        ),
    },
    {
        "label": "Chorui AI",
        "path": "/patient/chorui-ai",
        "description": "Open the full Chorui AI workspace.",
        "keywords": ("chorui", "ai assistant", "ai workspace"),
    },
    {
        "label": "Profile",
        "path": "/patient/profile",
        "description": "Update your personal details and avatar.",
        "keywords": ("profile", "my profile", "account", "personal info", "avatar", "photo"),
    },
    {
        "label": "Privacy & Sharing",
        "path": "/patient/privacy",
        "description": "Control how your data is shared with doctors.",
        "keywords": ("privacy", "data sharing", "sharing", "consent", "permissions"),
    },
    {
        "label": "Notifications",
        "path": "/notifications",
        "description": "See every Medora notification in one place.",
        "keywords": ("notification", "notifications", "inbox", "alerts"),
    },
    {
        "label": "Settings",
        "path": "/settings",
        "description": "App preferences, language, and security.",
        "keywords": ("settings", "preferences", "language", "theme"),
    },
)

_CHORUI_DOCTOR_NAVIGATION: tuple[dict[str, Any], ...] = (
    {
        "label": "Doctor Home",
        "path": "/doctor/home",
        "description": "Your clinical dashboard with today's workload.",
        "keywords": ("home", "dashboard", "main page", "overview"),
    },
    {
        "label": "My Patients",
        "path": "/doctor/patients",
        "description": "Browse and open records for your active patients.",
        "keywords": (
            "patients",
            "my patients",
            "patient list",
            "active patients",
            "people i treat",
        ),
    },
    {
        "label": "Schedule",
        "path": "/doctor/schedule",
        "description": "Manage your availability and appointment slots.",
        "keywords": (
            "schedule",
            "availability",
            "slots",
            "my schedule",
            "working hours",
            "calendar",
        ),
    },
    {
        "label": "Appointments",
        "path": "/doctor/appointments",
        "description": "All upcoming and past patient appointments.",
        "keywords": (
            "appointment",
            "appointments",
            "upcoming",
            "today's appointments",
            "bookings",
        ),
    },
    {
        "label": "Analytics",
        "path": "/doctor/analytics",
        "description": "Practice analytics and patient-care metrics.",
        "keywords": ("analytics", "metrics", "statistics", "insights", "trends"),
    },
    {
        "label": "Find Medicine",
        "path": "/doctor/find-medicine",
        "description": "Look up medicines, interactions, and alternatives.",
        "keywords": (
            "find medicine",
            "search medicine",
            "drug lookup",
            "brand",
            "generic",
            "interactions",
        ),
    },
    {
        "label": "Chorui AI",
        "path": "/doctor/chorui-ai",
        "description": "Open the full Chorui AI workspace.",
        "keywords": ("chorui", "ai assistant", "ai workspace"),
    },
    {
        "label": "Profile",
        "path": "/doctor/profile",
        "description": "Update your clinical profile and credentials.",
        "keywords": ("profile", "my profile", "account", "credentials", "bio"),
    },
    {
        "label": "Notifications",
        "path": "/notifications",
        "description": "See every Medora notification in one place.",
        "keywords": ("notification", "notifications", "inbox", "alerts"),
    },
    {
        "label": "Settings",
        "path": "/settings",
        "description": "App preferences, language, and security.",
        "keywords": ("settings", "preferences", "language", "theme"),
    },
)

_CHORUI_NAVIGATION_TRIGGER_KEYWORDS: tuple[str, ...] = (
    "take me to",
    "go to",
    "open the",
    "open ",
    "navigate to",
    "where is the",
    "where can i find",
    "how do i get to",
    "show me the",
    "bring me to",
    "jump to",
    "redirect me",
    "can you open",
    "take me",
    "link to",
    "where do i go",
)


def _navigation_registry_for_role(role: UserRole | None) -> tuple[dict[str, Any], ...]:
    if role == UserRole.DOCTOR:
        return _CHORUI_DOCTOR_NAVIGATION
    return _CHORUI_PATIENT_NAVIGATION


def _is_navigation_request(normalized_message: str) -> bool:
    if not normalized_message:
        return False
    return any(trigger in normalized_message for trigger in _CHORUI_NAVIGATION_TRIGGER_KEYWORDS)


def _score_navigation_entry(entry: dict[str, Any], normalized_message: str) -> int:
    score = 0
    label_tokens = _normalize_message(str(entry.get("label", "")))
    if label_tokens and label_tokens in normalized_message:
        score += 6
    for keyword in entry.get("keywords", ()):  # type: ignore[assignment]
        keyword_normalized = _normalize_message(str(keyword))
        if not keyword_normalized:
            continue
        if keyword_normalized in normalized_message:
            score += 3 if " " in keyword_normalized else 2
    return score


def _match_navigation_entries(
    *,
    role: UserRole | None,
    message: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    normalized = _normalize_message(message)
    if not normalized:
        return []

    registry = _navigation_registry_for_role(role)
    scored: list[tuple[int, dict[str, Any]]] = []
    for entry in registry:
        score = _score_navigation_entry(entry, normalized)
        if score > 0:
            scored.append((score, entry))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [entry for _score, entry in scored[:limit]]


def _navigation_entries_to_suggestions(
    entries: list[dict[str, Any]],
) -> list[ChoruiNavigationSuggestion]:
    suggestions: list[ChoruiNavigationSuggestion] = []
    for entry in entries:
        label = str(entry.get("label", "")).strip()
        path = str(entry.get("path", "")).strip()
        if not label or not path:
            continue
        description_raw = entry.get("description")
        description = str(description_raw).strip() if description_raw else None
        suggestions.append(
            ChoruiNavigationSuggestion(
                label=label,
                path=path,
                description=description,
            )
        )
    return suggestions


def _build_navigation_reply(
    *,
    role: UserRole | None,
    entries: list[dict[str, Any]],
    original_message: str,
) -> str:
    if not entries:
        if role == UserRole.DOCTOR:
            return (
                "I could not match that to a doctor page I know. I can take you to Home, Patients, "
                "Schedule, Appointments, Analytics, Find Medicine, Chorui AI, Profile, Notifications, "
                "or Settings. Tell me which one and I will drop a link for you."
            )
        return (
            "I could not match that to a patient page I know. I can take you to Home, Find Doctor, "
            "Appointments, My Prescriptions, Medical History, Medical Reports, Find Medicine, "
            "Reminders, Analytics, Chorui AI, Profile, Privacy, Notifications, or Settings. "
            "Tell me which one you want."
        )

    top = entries[0]
    top_label = str(top.get("label", "")).strip()
    top_description = str(top.get("description") or "").strip()

    primary_line = f"Sure — {top_label} is right here."
    if top_description:
        primary_line = f"{primary_line} {top_description}"

    if len(entries) == 1:
        return (
            f"{primary_line}\n\n"
            "Tap the link below to go there directly."
        )

    alt_lines = [
        f"- {str(entry.get('label', '')).strip()}"
        for entry in entries[1:]
    ]
    alt_block = "\n".join([line for line in alt_lines if line.strip("- ")])
    return (
        f"{primary_line}\n\n"
        "Tap the link below to go there directly. "
        "If that is not what you meant, I can also take you to:\n"
        f"{alt_block}"
    )


def _build_patient_contextual_general_reply(
    *,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
) -> str:
    lines: list[str] = [
        "I hear you. Here is a quick view from your current Medora record context:",
        f"- Conditions tracked: {len(conditions)}",
        f"- Medications tracked: {len(medications)}",
        f"- Allergy entries: {len(allergies)}",
    ]
    if risk_flags:
        lines.append(f"- Risk indicators noted: {len(risk_flags)}")
    lines.append("")
    lines.append("Tell me which area you want next: medications, conditions, allergies, history, appointments, or doctors.")
    return "\n".join(lines)


def _build_local_condition_suggestions(conditions: list[str], query_text: str) -> list[dict[str, Any]]:
    normalized = _normalize_message(query_text)
    suggestions: list[dict[str, Any]] = []
    for condition in conditions[:6]:
        confidence = 0.82 if condition.lower() in normalized else 0.68
        suggestions.append({"name": condition, "confidence": confidence})
    return suggestions


def _build_local_medication_suggestions(medications: list[str], query_text: str) -> list[dict[str, Any]]:
    normalized = _normalize_message(query_text)
    suggestions: list[dict[str, Any]] = []
    for medication in medications[:6]:
        confidence = 0.8 if medication.lower() in normalized else 0.66
        suggestions.append({"name": medication, "confidence": confidence})
    return suggestions


def _build_local_test_suggestions(query_text: str, conditions: list[str], risk_flags: list[str]) -> list[dict[str, Any]]:
    normalized = _normalize_message(query_text)
    tests: list[dict[str, Any]] = []

    keyword_test_map = [
        (("chest pain", "shortness of breath"), "ECG", 0.78),
        (("fever", "infection"), "Complete Blood Count (CBC)", 0.76),
        (("diabetes", "sugar"), "HbA1c", 0.8),
        (("kidney", "renal"), "Serum Creatinine", 0.79),
        (("liver", "jaundice"), "Liver Function Test (LFT)", 0.79),
        (("thyroid",), "TSH", 0.77),
        (("hypertension", "high blood pressure"), "Renal Function Test (RFT)", 0.7),
    ]

    for keywords, test_name, confidence in keyword_test_map:
        if any(keyword in normalized for keyword in keywords):
            tests.append({"name": test_name, "confidence": confidence})

    lowered_conditions = {item.lower() for item in conditions}
    if "type 2 diabetes" in lowered_conditions:
        tests.append({"name": "HbA1c", "confidence": 0.74})
    if "heart disease" in lowered_conditions or "cardiovascular risk high" in {item.lower() for item in risk_flags}:
        tests.append({"name": "Lipid Profile", "confidence": 0.72})
    if "kidney disease" in lowered_conditions:
        tests.append({"name": "Serum Creatinine", "confidence": 0.74})

    deduped: dict[str, dict[str, Any]] = {}
    for item in tests:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        existing = deduped.get(name)
        if existing is None or float(item.get("confidence", 0.0)) > float(existing.get("confidence", 0.0)):
            deduped[name] = {"name": name, "confidence": float(item.get("confidence", 0.0))}

    return list(deduped.values())[:6]


def _build_local_cautions(allergies: list[str], risk_flags: list[str]) -> list[str]:
    cautions: list[str] = []
    if allergies:
        cautions.append("Allergy records are present. Cross-check before any medication order.")
    if risk_flags:
        cautions.append("Patient has elevated risk indicators in history. Review relevant prior records.")
    cautions.append("This output is assistive only. Clinical decisions must be made by the treating doctor.")
    return cautions


def _normalize_catalog_term(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9\s]+", " ", str(value or "").lower())
    return " ".join(normalized.split())[:120]


def _anonymize_named_entities(text: str, raw_names: list[str | None], alias: str = "[patient]") -> str:
    sanitized = str(text or "")
    names = [str(item).strip() for item in raw_names if str(item or "").strip()]
    # Replace longer phrases first to avoid partial replacement artifacts.
    names = sorted(set(names), key=len, reverse=True)
    for name in names:
        escaped = re.escape(name)
        sanitized = re.sub(escaped, alias, sanitized, flags=re.IGNORECASE)
    return anonymize_identifier_text(sanitized, token_namespace="subject")


def _build_subject_tokens(
    *,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    conversation_id: str | None = None,
    feature: str = "ai",
) -> dict[str, str]:
    parts = [feature, doctor_id or "", patient_id or "", conversation_id or ""]
    return {
        "subject_token": stable_hash_token(*parts, namespace="subject", length=24),
        "doctor_token": stable_hash_token(doctor_id or "unknown", namespace="doctor", length=20),
        "patient_token": stable_hash_token(patient_id or "unknown", namespace="patient", length=20),
        "conversation_token": stable_hash_token(conversation_id or "unknown", namespace="conversation", length=20),
    }


async def _match_medicine_from_catalog(db: AsyncSession, candidate: str) -> str | None:
    search_term = _normalize_catalog_term(candidate)
    if len(search_term) < 2:
        return None

    result = await db.execute(
        select(
            Brand.brand_name,
            Drug.generic_name,
            Drug.strength,
            Drug.dosage_form,
            MedicineSearchIndex.term,
        )
        .join(Drug, MedicineSearchIndex.drug_id == Drug.id)
        .outerjoin(Brand, MedicineSearchIndex.brand_id == Brand.id)
        .where(
            or_(
                MedicineSearchIndex.term.ilike(f"%{search_term}%"),
                Drug.generic_name.ilike(f"%{search_term}%"),
                Brand.brand_name.ilike(f"%{search_term}%"),
            )
        )
        .order_by(
            (func.lower(MedicineSearchIndex.term) == search_term).desc(),
            MedicineSearchIndex.term.ilike(f"{search_term}%").desc(),
            Brand.brand_name.asc().nulls_last(),
            Drug.generic_name.asc(),
        )
        .limit(1)
    )
    row = result.first()
    if not row:
        return None

    if row.brand_name:
        return str(row.brand_name).strip()
    generic = str(row.generic_name or "").strip()
    strength = str(row.strength or "").strip()
    dosage_form = str(row.dosage_form or "").strip()
    suffix = " ".join([item for item in [strength, dosage_form] if item])
    if generic and suffix:
        return f"{generic} {suffix}".strip()
    return generic or None


async def _match_test_from_catalog(db: AsyncSession, candidate: str) -> str | None:
    search_term = _normalize_catalog_term(candidate)
    if len(search_term) < 2:
        return None

    result = await db.execute(
        select(MedicalTest.display_name, MedicalTest.normalized_name)
        .where(
            MedicalTest.is_active == True,  # noqa: E712
            MedicalTest.normalized_name.ilike(f"%{search_term}%"),
        )
        .order_by(
            (func.lower(MedicalTest.normalized_name) == search_term).desc(),
            MedicalTest.normalized_name.ilike(f"{search_term}%").desc(),
            MedicalTest.display_name.asc(),
        )
        .limit(1)
    )
    row = result.first()
    if not row:
        return None
    return str(row.display_name).strip() or None


async def _ground_suggestions_to_catalog(
    db: AsyncSession,
    *,
    suggestions: list[dict[str, Any]],
    kind: str,
    limit: int = 6,
) -> list[dict[str, Any]]:
    grounded: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in suggestions:
        raw_name = str(item.get("name", "")).strip()
        if not raw_name:
            continue
        confidence = float(item.get("confidence") or 0.0)
        if kind == "medication":
            matched = await _match_medicine_from_catalog(db, raw_name)
        else:
            matched = await _match_test_from_catalog(db, raw_name)
        if not matched:
            continue
        key = matched.lower()
        if key in seen:
            continue
        seen.add(key)
        grounded.append({"name": matched, "confidence": confidence})
        if len(grounded) >= limit:
            break

    return grounded


async def _build_secure_rag_context(
    db: AsyncSession,
    *,
    query: str,
    conditions: list[str] | None = None,
    medications: list[str] | None = None,
) -> dict[str, Any]:
    medicine_candidates = [query, *(medications or [])][:6]
    test_candidates = [query, *(conditions or [])][:6]

    rag_medicines: list[str] = []
    rag_tests: list[str] = []
    seen_meds: set[str] = set()
    seen_tests: set[str] = set()

    for candidate in medicine_candidates:
        matched = await _match_medicine_from_catalog(db, candidate)
        if matched and matched.lower() not in seen_meds:
            seen_meds.add(matched.lower())
            rag_medicines.append(matched)
        if len(rag_medicines) >= 6:
            break

    for candidate in test_candidates:
        matched = await _match_test_from_catalog(db, candidate)
        if matched and matched.lower() not in seen_tests:
            seen_tests.add(matched.lower())
            rag_tests.append(matched)
        if len(rag_tests) >= 6:
            break

    return {
        "medicine_catalog_matches": rag_medicines,
        "test_catalog_matches": rag_tests,
    }


def _build_compact_doctor_brief(
    *,
    ai_summary: dict[str, Any] | None,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
) -> dict[str, Any]:
    ai_summary = ai_summary or {}
    one_liner = str(ai_summary.get("summary", "")).strip()
    if not one_liner:
        one_liner = "Patient record snapshot prepared for fast pre-consultation review."
    one_liner = one_liner[:260]

    key_findings = _safe_list(ai_summary.get("key_findings"))[:4]
    if not key_findings:
        key_findings = _build_preconsultation_highlights(
            conditions=conditions,
            allergies=allergies,
            risk_flags=risk_flags,
            medications=medications,
            surgeries=[],
            hospitalizations=[],
        )[:4]

    recommended_actions = _safe_list(ai_summary.get("recommended_actions"))[:4]
    if not recommended_actions:
        recommended_actions = _build_missing_info_checklist(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            surgeries=[],
        )[:4]

    compressed_points = [*key_findings[:2], *risk_flags[:2]]
    compressed_points = [item for item in compressed_points if item][:3]
    quick_text = one_liner
    if compressed_points:
        quick_text = f"{one_liner} Key points: {'; '.join(compressed_points)}."
    quick_text = quick_text[:420]

    return {
        "one_liner": one_liner,
        "quick_text": quick_text,
        "key_findings": key_findings,
        "risk_flags": risk_flags[:4],
        "recommended_actions": recommended_actions,
    }


def _build_local_clinical_answer(
    *,
    query: str,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
    family_history: list[str] | None = None,
) -> str:
    sections: list[str] = [
        "Record-grounded pre-consultation snapshot:",
        f"Doctor query: {query.strip()[:500]}",
        "",
        "Conditions:",
        _render_bullet_list(conditions[:8]) if conditions else "- No condition entries found",
        "",
        "Current medications:",
        _render_bullet_list(medications[:8]) if medications else "- No medication entries found",
        "",
        "Allergies:",
        _render_bullet_list(allergies[:8]) if allergies else "- No allergy entries found",
    ]
    if risk_flags:
        sections.extend(["", "Risk flags:", _render_bullet_list(risk_flags[:8])])
    if family_history:
        sections.extend(["", "Family history:", _render_bullet_list(family_history[:8])])
    sections.append("")
    sections.append("Use this as context support only and verify clinically before acting.")
    return "\n".join(sections)


def _status_value(raw_status: Any) -> str:
    return str(getattr(raw_status, "value", raw_status or "unknown")).lower()


def _meal_instruction_text(value: Any) -> str:
    mapping = {
        "before_meal": "before meal",
        "after_meal": "after meal",
        "with_meal": "with meal",
        "empty_stomach": "on empty stomach",
        "any_time": "any time",
    }
    key = str(getattr(value, "value", value or "")).strip().lower()
    return mapping.get(key, key.replace("_", " ") if key else "as directed")


def _medication_schedule_line(item: Any) -> str:
    windows: list[str] = []
    if getattr(item, "dose_morning", False):
        windows.append(f"morning {getattr(item, 'dose_morning_amount', '')}".strip())
    if getattr(item, "dose_afternoon", False):
        windows.append(f"afternoon {getattr(item, 'dose_afternoon_amount', '')}".strip())
    if getattr(item, "dose_evening", False):
        windows.append(f"evening {getattr(item, 'dose_evening_amount', '')}".strip())
    if getattr(item, "dose_night", False):
        windows.append(f"night {getattr(item, 'dose_night_amount', '')}".strip())

    if not windows and getattr(item, "frequency_per_day", None):
        windows.append(f"{item.frequency_per_day} times daily")
    if not windows:
        windows.append("as directed")

    duration_value = getattr(item, "duration_value", None)
    duration_unit = str(getattr(getattr(item, "duration_unit", None), "value", getattr(item, "duration_unit", "")) or "").strip()
    duration = f" for {duration_value} {duration_unit}" if duration_value and duration_unit else ""
    meal = _meal_instruction_text(getattr(item, "meal_instruction", None))
    return f"{', '.join(windows)}{duration} ({meal})"


def _build_patient_prescription_plain_text_summary(
    *,
    created_at: datetime | None,
    medication_summary: list[dict[str, Any]],
    test_summary: list[dict[str, Any]],
    procedure_summary: list[dict[str, Any]],
) -> str:
    segments: list[str] = ["Here is your brief prescription summary."]

    if created_at:
        segments.append(f"Issued on {_format_datetime_label(created_at)}.")

    if medication_summary:
        segments.append(f"Medications: {len(medication_summary)} item(s).")
        for index, item in enumerate(medication_summary[:6], start=1):
            name = _safe_vapi_text(item.get("name"), max_length=120) or f"Medication {index}"
            schedule = _safe_vapi_text(item.get("schedule"), max_length=220) or "as directed"
            quantity = item.get("quantity")
            quantity_text = f", quantity {quantity}" if quantity not in (None, "") else ""
            segments.append(f"{index}. {name}: {schedule}{quantity_text}.")
            special = _safe_vapi_text(item.get("special_instructions"), max_length=120)
            if special:
                segments.append(f"Special note: {special}.")
    else:
        segments.append("No medications are listed in this prescription.")

    if test_summary:
        test_names = [
            _safe_vapi_text(item.get("name"), max_length=80)
            for item in test_summary[:6]
            if _safe_vapi_text(item.get("name"), max_length=80)
        ]
        if test_names:
            segments.append(f"Recommended tests: {', '.join(test_names)}.")

    if procedure_summary:
        procedure_names = [
            _safe_vapi_text(item.get("name"), max_length=80)
            for item in procedure_summary[:4]
            if _safe_vapi_text(item.get("name"), max_length=80)
        ]
        if procedure_names:
            segments.append(f"Procedure recommendations: {', '.join(procedure_names)}.")

    segments.append("Follow your doctor instructions exactly and consult your doctor before making any changes.")
    return " ".join(segments)


async def _get_patient_prior_doctors(
    db: AsyncSession,
    *,
    patient_id: str,
    current_doctor_id: str,
) -> list[dict[str, str]]:
    result = await db.execute(
        select(
            Appointment.doctor_id,
            func.max(Appointment.appointment_date).label("last_visit"),
        )
        .where(
            Appointment.patient_id == patient_id,
            Appointment.doctor_id != current_doctor_id,
            Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
        )
        .group_by(Appointment.doctor_id)
        .order_by(func.max(Appointment.appointment_date).desc())
        .limit(8)
    )
    rows = result.all()
    if not rows:
        return []

    doctor_ids = [row.doctor_id for row in rows]
    profiles_result = await db.execute(select(Profile).where(Profile.id.in_(doctor_ids)))
    profiles = {item.id: item for item in profiles_result.scalars().all()}

    output: list[dict[str, str]] = []
    for row in rows:
        profile = profiles.get(row.doctor_id)
        if not profile:
            continue
        display_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Doctor"
        output.append(
            {
                "doctor_name": display_name,
                "last_visit": _format_datetime_label(row.last_visit),
            }
        )
    return output


async def _get_patient_care_team(
    db: AsyncSession,
    *,
    patient_id: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    appointment_rows = (
        await db.execute(
            select(
                Appointment.doctor_id,
                func.max(Appointment.appointment_date).label("last_appointment"),
                func.count(Appointment.id).label("appointment_count"),
            )
            .where(
                Appointment.patient_id == patient_id,
                Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
            )
            .group_by(Appointment.doctor_id)
        )
    ).all()

    prescription_rows = (
        await db.execute(
            select(
                Prescription.doctor_id,
                func.max(Prescription.created_at).label("last_prescribed_at"),
                func.count(Prescription.id).label("prescription_count"),
            )
            .where(Prescription.patient_id == patient_id)
            .group_by(Prescription.doctor_id)
        )
    ).all()

    doctor_index: dict[str, dict[str, Any]] = {}
    for row in appointment_rows:
        doctor_index[row.doctor_id] = {
            "doctor_id": row.doctor_id,
            "last_activity": row.last_appointment,
            "appointment_count": int(row.appointment_count or 0),
            "prescription_count": 0,
            "last_prescribed_at": None,
        }

    for row in prescription_rows:
        entry = doctor_index.setdefault(
            row.doctor_id,
            {
                "doctor_id": row.doctor_id,
                "last_activity": row.last_prescribed_at,
                "appointment_count": 0,
                "prescription_count": 0,
                "last_prescribed_at": None,
            },
        )
        entry["prescription_count"] = int(row.prescription_count or 0)
        entry["last_prescribed_at"] = row.last_prescribed_at
        if row.last_prescribed_at and (
            entry["last_activity"] is None or row.last_prescribed_at > entry["last_activity"]
        ):
            entry["last_activity"] = row.last_prescribed_at

    if not doctor_index:
        return []

    doctor_ids = list(doctor_index.keys())
    profile_rows = (await db.execute(select(Profile).where(Profile.id.in_(doctor_ids)))).scalars().all()
    profiles = {item.id: item for item in profile_rows}
    doctor_visibility_rows = (
        await db.execute(
            select(DoctorProfile.profile_id, DoctorProfile.allow_patient_ai_visibility).where(
                DoctorProfile.profile_id.in_(doctor_ids)
            )
        )
    ).all()
    doctor_visibility_map = {
        row.profile_id: bool(row.allow_patient_ai_visibility) for row in doctor_visibility_rows
    }

    output: list[dict[str, Any]] = []
    hidden_doctor_counter = 0
    for doctor_id, entry in doctor_index.items():
        profile = profiles.get(doctor_id)
        if not profile:
            continue
        can_show_identity = doctor_visibility_map.get(doctor_id, True)
        if can_show_identity:
            display_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Doctor"
        else:
            hidden_doctor_counter += 1
            display_name = f"Doctor #{hidden_doctor_counter}"
        output.append(
            {
                "doctor_name": display_name,
                "last_activity": _format_datetime_label(entry.get("last_activity")),
                "_sort_ts": _format_datetime_iso(entry.get("last_activity")),
                "appointment_count": entry.get("appointment_count", 0),
                "prescription_count": entry.get("prescription_count", 0),
            }
        )

    output.sort(key=lambda item: item.get("_sort_ts") or "", reverse=True)
    for item in output:
        item.pop("_sort_ts", None)
    return output[:limit]


def _build_preconsultation_highlights(
    *,
    conditions: list[str],
    allergies: list[str],
    risk_flags: list[str],
    medications: list[str],
    surgeries: list[str],
    hospitalizations: list[str],
) -> list[str]:
    highlights: list[str] = []
    if allergies:
        highlights.append("Allergy records exist and must be checked before medication decisions.")
    if risk_flags:
        highlights.append("Patient has elevated risk indicators in records; review risk-sensitive history first.")
    if conditions:
        highlights.append(f"{len(conditions)} condition entries are documented and should guide history-taking.")
    if medications:
        highlights.append("Current medication list is available; verify adherence and recent changes.")
    if surgeries or hospitalizations:
        highlights.append("Prior procedures/hospitalizations are recorded; confirm relevance to current complaint.")
    if not highlights:
        highlights.append("Records are limited; confirm core history manually at consultation start.")
    return highlights[:6]


def _build_missing_info_checklist(
    *,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    surgeries: list[str],
) -> list[str]:
    checklist: list[str] = []
    if not medications:
        checklist.append("No active medication list found; confirm current medicines and dosages with patient.")
    if not allergies:
        checklist.append("No allergy list found; confirm drug, food, and environmental allergies.")
    if not conditions:
        checklist.append("No chronic condition entries found; confirm long-term diagnoses.")
    if not surgeries:
        checklist.append("No surgery history found; confirm significant prior operations.")
    if not checklist:
        checklist.append("Key record areas are present; validate timeline and symptom evolution during consultation.")
    return checklist[:6]


@router.get("/doctor-patient-summary", response_model=AIDoctorPatientSummaryResponse)
async def get_doctor_patient_assistant_summary(
    patient_id: str = Query(...),
    request: Request = None,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user.id)
    resolved_patient_id = await _resolve_patient_identifier_for_doctor(
        db,
        doctor_id=user.id,
        patient_identifier=patient_id,
    )
    access = await check_doctor_patient_access(db, user.id, resolved_patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))
    privacy_mode = settings.CHORUI_PRIVACY_MODE.strip().lower()
    effective_privacy_mode = "record_augmented" if privacy_mode == "strict_local" else privacy_mode

    await log_patient_access(
        db,
        patient_id=resolved_patient_id,
        doctor_id=user.id,
        access_type=AccessType.VIEW_AI_QUERY,
        request=request,
    )

    # Fetch sharing preferences and filter patient data
    sharing_perms = await get_sharing_permissions(
        db, patient_id=resolved_patient_id, doctor_id=user.id
    )
    sharing_perms = await _require_doctor_patient_ai_permissions(
        db,
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        sharing_perms=sharing_perms,
    )
    profile, patient = await _get_patient_context(db, resolved_patient_id)
    raw_summary = filter_raw_summary(
        _build_raw_summary(profile, patient), sharing_perms
    )
    conditions = _safe_list(raw_summary.get("conditions"))
    medications = _safe_list(raw_summary.get("medications"))
    allergies = _safe_list(raw_summary.get("allergies"))
    risk_flags = _safe_list(raw_summary.get("risk_flags"))
    family_history = _safe_list(raw_summary.get("family_history"))
    history_data = raw_summary.get("history") if isinstance(raw_summary, dict) else {}
    surgeries = _safe_list((history_data or {}).get("surgeries"))
    hospitalizations = _safe_list((history_data or {}).get("hospitalizations"))

    appointments_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.patient_id == resolved_patient_id,
            Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(8)
    )
    appointments = appointments_result.scalars().all()
    prior_doctors = await _get_patient_prior_doctors(
        db,
        patient_id=resolved_patient_id,
        current_doctor_id=user.id,
    )
    subject_tokens = _build_subject_tokens(
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        feature="doctor_patient_summary",
    )

    timeline = [
        {
            "date": _format_datetime_label(item.appointment_date),
            "status": _status_value(item.status),
            "reason": str(item.reason or ""),
            "doctor_scope": "you" if item.doctor_id == user.id else "other",
        }
        for item in appointments
    ]

    ai_brief: dict[str, Any] | None = None
    ai_payload: dict[str, Any] = {
        **subject_tokens,
        "patient_record": raw_summary,
        "recent_appointments": timeline[:6],
    }
    # Inject privacy restriction into AI prompt payload
    restriction_notice = build_ai_restriction_notice(sharing_perms)
    if restriction_notice:
        ai_payload["privacy_restriction"] = restriction_notice
    rag_context = await _build_secure_rag_context(
        db,
        query="pre consultation summary",
        conditions=conditions,
        medications=medications,
    )
    ai_payload["retrieved_knowledge"] = rag_context
    try:
        ai_brief = await ai_orchestrator.generate_patient_summary(
            ai_payload,
            include_meta=False,
            prompt_version="v2-doctor-brief",
        )
    except AIOrchestratorError:
        ai_brief = None

    compact_brief = _build_compact_doctor_brief(
        ai_summary=ai_brief,
        conditions=conditions,
        medications=medications,
        allergies=allergies,
        risk_flags=risk_flags,
    )

    patient_snapshot: dict[str, Any] = {
        "patient_id": patient_ref_from_uuid(resolved_patient_id),
        "gender": patient.gender if sharing_perms.can_view_profile else None,
        "blood_group": patient.blood_group if sharing_perms.can_view_profile else None,
    }

    summary = {
        "doctor_brief": compact_brief,
        "patient_snapshot": patient_snapshot,
        "clinical_context": {
            "conditions": conditions[:8],
            "medications": medications[:8],
            "allergies": allergies[:8],
            "risk_flags": risk_flags[:6],
            "family_history": family_history[:6],
            "surgeries": surgeries[:6],
            "hospitalizations": hospitalizations[:6],
        },
        "care_continuity": {
            "recent_appointments": timeline[:5],
            "prior_doctors": prior_doctors[:5],
        },
        "pre_consultation_checklist": _build_missing_info_checklist(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            surgeries=surgeries,
        ),
        "data_sharing_restrictions": {
            "any_restricted": not sharing_perms.everything_shared,
            "restricted_categories": sharing_perms.restricted_categories(),
        },
    }

    return AIDoctorPatientSummaryResponse(
        ai_generated=True,
        summary=summary,
        highlight_points=_build_preconsultation_highlights(
            conditions=conditions,
            allergies=allergies,
            risk_flags=risk_flags,
            medications=medications,
            surgeries=surgeries,
            hospitalizations=hospitalizations,
        ),
        cautions=[
            "Assistant summary only: this does not issue diagnosis or treatment decisions.",
            "Validate all critical findings against patient interview and examination.",
        ],
        privacy_mode=effective_privacy_mode,
    )


@router.get("/patient-prescription-summary", response_model=AIPatientPrescriptionExplainerResponse)
async def get_patient_prescription_assistant_summary(
    prescription_id: str = Query(...),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    role = await _get_user_role(db, user.id)
    if role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can access this resource")
    await _require_patient_personal_ai_context_enabled(db, user.id)
    privacy_mode = settings.CHORUI_PRIVACY_MODE.strip().lower()

    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this prescription")

    consultation_result = await db.execute(select(Consultation).where(Consultation.id == prescription.consultation_id))
    consultation = consultation_result.scalar_one_or_none()

    medication_summary = [
        {
            "name": str(item.medicine_name),
            "schedule": _medication_schedule_line(item),
            "quantity": item.quantity,
            "duration_value": item.duration_value,
            "duration_unit": _status_value(item.duration_unit),
            "meal_instruction": _meal_instruction_text(item.meal_instruction),
            "special_instructions": str(item.special_instructions or ""),
        }
        for item in prescription.medications
    ]
    test_summary = [
        {
            "name": str(item.test_name),
            "urgency": _status_value(item.urgency),
            "instructions": str(item.instructions or ""),
        }
        for item in prescription.tests
    ]
    procedure_summary = [
        {
            "name": str(item.procedure_name),
            "urgency": _status_value(item.urgency),
            "notes": str(item.pre_op_instructions or item.notes or ""),
        }
        for item in prescription.surgeries
    ]

    highlights: list[str] = []
    if medication_summary:
        highlights.append(f"This prescription contains {len(medication_summary)} medication item(s).")
    if test_summary:
        highlights.append(f"There are {len(test_summary)} recommended test(s).")
    if procedure_summary:
        highlights.append(f"There are {len(procedure_summary)} procedure recommendation(s).")
    if consultation and consultation.notes:
        highlights.append("Consultation notes are available for context. Ask your doctor if anything is unclear.")
    if not highlights:
        highlights.append("This prescription has limited structured entries. Follow up with your doctor for clarification.")

    cautions: list[str] = [
        "This summary explains your prescription but does not replace doctor instructions.",
        "Do not change medicines, tests, or procedure plans without clinical guidance.",
    ]
    if any(item.get("special_instructions") for item in medication_summary):
        cautions.append("Some medications include special instructions. Read each item carefully.")

    summary = {
        "prescription_overview": {
            "status": _status_value(prescription.status),
            "created_at": _format_datetime_label(prescription.created_at),
            "consultation_notes": str(consultation.notes) if consultation and consultation.notes else "",
        },
        "medication_plan": medication_summary,
        "test_plan": test_summary,
        "procedure_plan": procedure_summary,
        "patient_follow_up": [
            "Review this summary together with your doctor if any step is unclear.",
            "Follow the exact schedule written in your prescription items.",
            "Report side effects or worsening symptoms promptly.",
        ],
    }

    plain_text_summary = _build_patient_prescription_plain_text_summary(
        created_at=prescription.created_at,
        medication_summary=medication_summary,
        test_summary=test_summary,
        procedure_summary=procedure_summary,
    )

    return AIPatientPrescriptionExplainerResponse(
        ai_generated=True,
        summary=summary,
        plain_text_summary=plain_text_summary,
        highlight_points=highlights,
        cautions=cautions,
        privacy_mode=privacy_mode,
    )


async def _get_upcoming_patient_appointments(
    db: AsyncSession,
    *,
    patient_id: str,
    doctor_id: str | None = None,
    limit: int = 5,
) -> list[Appointment]:
    now = datetime.utcnow()
    query = select(Appointment).where(
        Appointment.patient_id == patient_id,
        Appointment.appointment_date >= now,
        Appointment.status.in_(CHORUI_UPCOMING_APPOINTMENT_STATUSES),
    )
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    query = query.order_by(Appointment.appointment_date.asc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def _get_upcoming_doctor_schedule(
    db: AsyncSession,
    *,
    doctor_id: str,
    window_days: int = 7,
    limit: int = 12,
) -> list[Appointment]:
    now = datetime.utcnow()
    until = now + timedelta(days=max(1, window_days))
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date >= now,
            Appointment.appointment_date <= until,
            Appointment.status.in_(CHORUI_UPCOMING_APPOINTMENT_STATUSES),
        )
        .order_by(Appointment.appointment_date.asc())
        .limit(limit)
    )
    return result.scalars().all()


async def _get_doctor_active_patients(db: AsyncSession, doctor_id: str) -> list[dict[str, Any]]:
    lookback_days = max(1, settings.CHORUI_ACTIVE_PATIENT_LOOKBACK_DAYS)
    since = datetime.utcnow() - timedelta(days=lookback_days)
    active_result = await db.execute(
        select(
            Appointment.patient_id,
            func.max(Appointment.appointment_date).label("last_seen"),
        )
        .where(
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
            Appointment.appointment_date >= since,
        )
        .group_by(Appointment.patient_id)
        .order_by(func.max(Appointment.appointment_date).desc())
    )
    rows = active_result.all()
    if not rows:
        return []

    patient_ids = [row.patient_id for row in rows]
    profile_result = await db.execute(select(Profile).where(Profile.id.in_(patient_ids)))
    profiles = profile_result.scalars().all()
    profile_map = {profile.id: profile for profile in profiles}

    patients: list[dict[str, Any]] = []
    for row in rows:
        profile = profile_map.get(row.patient_id)
        if not profile:
            continue
        patients.append(
            {
                "patient_id": row.patient_id,
                "patient_ref": patient_ref_from_uuid(row.patient_id),
                "display_name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient",
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
            }
        )
    return patients


async def _resolve_assistant_context(
    *,
    db: AsyncSession,
    user_id: str,
    role: UserRole,
    payload_patient_id: str | None,
) -> tuple[str | None, dict[str, Any] | None, str, SharingPermissions | None]:
    """
    Returns (patient_id, raw_summary, context_mode, sharing_permissions).
    sharing_permissions is None for patient-self and doctor-general modes.
    For doctor-patient mode, the raw_summary is filtered by sharing preferences.
    """
    if role == UserRole.PATIENT:
        ai_prefs = await _require_patient_general_ai_chat_enabled(db, user_id)
        if ai_prefs.personal_context_enabled:
            profile, patient = await _get_patient_context(db, user_id)
            return user_id, _build_raw_summary(profile, patient), "patient-self", None
        return None, None, "patient-general", None

    if role == UserRole.DOCTOR:
        if payload_patient_id:
            resolved_patient_id = await _resolve_patient_identifier_for_doctor(
                db,
                doctor_id=user_id,
                patient_identifier=payload_patient_id,
            )
            access = await check_doctor_patient_access(db, user_id, resolved_patient_id)
            if not access.get("allowed"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=access.get("reason", "Access denied"),
                )
            # Fetch sharing permissions and filter the raw summary
            sharing_perms = await get_sharing_permissions(
                db, patient_id=resolved_patient_id, doctor_id=user_id
            )
            sharing_perms = await _require_doctor_patient_ai_permissions(
                db,
                doctor_id=user_id,
                patient_id=resolved_patient_id,
                sharing_perms=sharing_perms,
            )
            profile, patient = await _get_patient_context(db, resolved_patient_id)
            raw_summary = filter_raw_summary(
                _build_raw_summary(profile, patient), sharing_perms
            )
            return resolved_patient_id, raw_summary, "doctor-patient", sharing_perms
        return None, None, "doctor-general", None

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Chorui assistant is available for patient and doctor accounts only",
    )


def _extract_patient_id_candidate(message: str) -> str | None:
    raw_message = message or ""
    ref_match = CHORUI_PATIENT_REF_PATTERN.search(raw_message)
    if ref_match:
        return ref_match.group(0).strip()
    uuid_match = CHORUI_UUID_PATTERN.search(raw_message)
    if not uuid_match:
        return None
    return uuid_match.group(0).strip()


async def _try_resolve_doctor_patient_context_from_message(
    *,
    db: AsyncSession,
    doctor_id: str,
    message: str,
) -> tuple[str | None, dict[str, Any] | None, SharingPermissions | None]:
    """
    Attempt to resolve a patient ID from the doctor's message text.
    Returns (patient_id, filtered_raw_summary, sharing_permissions).
    """
    candidate_patient_id = _extract_patient_id_candidate(message)
    if not candidate_patient_id:
        return None, None, None

    resolved_patient_id = await resolve_doctor_patient_identifier(
        db,
        doctor_id=doctor_id,
        patient_identifier=candidate_patient_id,
    )
    if not resolved_patient_id:
        return None, None, None

    access = await check_doctor_patient_access(db, doctor_id, resolved_patient_id)
    if not access.get("allowed"):
        return None, None, None

    sharing_perms = await get_sharing_permissions(
        db, patient_id=resolved_patient_id, doctor_id=doctor_id
    )
    sharing_perms = await _require_doctor_patient_ai_permissions(
        db,
        doctor_id=doctor_id,
        patient_id=resolved_patient_id,
        sharing_perms=sharing_perms,
    )
    profile, patient = await _get_patient_context(db, resolved_patient_id)
    raw_summary = filter_raw_summary(
        _build_raw_summary(profile, patient), sharing_perms
    )
    return resolved_patient_id, raw_summary, sharing_perms


def _merge_named_confidence_lists(
    primary: list[dict[str, Any]],
    fallback: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[str, float] = {}
    for collection in (primary, fallback):
        for item in collection:
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            confidence = float(item.get("confidence") or 0.0)
            previous = merged.get(name)
            if previous is None or confidence > previous:
                merged[name] = confidence
    return [{"name": name, "confidence": confidence} for name, confidence in merged.items()]


def _build_doctor_patient_id_required_reply(active_patients: list[dict[str, Any]]) -> str:
    if not active_patients:
        return (
            "Patient context was not selected. Please include a valid patient ID in your message "
            "or open a patient from your list first."
        )

    lines = [
        (
            f"- patient id: {item['patient_ref']} | {item.get('display_name') or 'Patient'} "
            f"(last activity: {item['last_seen'][:10] if item.get('last_seen') else 'unknown'})"
        )
        for item in active_patients[:20]
    ]
    joined_lines = "\n".join(lines)
    return (
        "Please provide a patient ID to run patient-specific intelligence.\n"
        f"{joined_lines}\n\n"
        "Use the exact `patient id` value from your patient list for record-linked AI support."
    )


DOCTOR_PATIENT_SCOPED_INTENTS = {
    "doctor_patient_medications",
    "doctor_patient_conditions",
    "doctor_patient_allergies",
    "doctor_patient_risks",
    "doctor_patient_history",
    "doctor_patient_family_history",
    "doctor_patient_upcoming_appointments",
    "doctor_patient_summary",
}


def _build_chorui_model_query(
    *,
    role: UserRole,
    message: str,
    context_mode: str,
    target_patient_id: str | None,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
    family_history: list[str],
    surgeries: list[str],
    hospitalizations: list[str],
    active_patients: list[dict[str, Any]],
    history_text: str,
    demographics: dict[str, Any] | None = None,
    recent_consultations: list[dict[str, Any]] | None = None,
    recent_prescriptions: list[dict[str, Any]] | None = None,
    appointment_history: list[dict[str, Any]] | None = None,
    lifestyle: dict[str, Any] | None = None,
    ui_locale: str = "en",
    subject_tokens: dict[str, str] | None = None,
    rag_context: dict[str, Any] | None = None,
) -> str:
    payload: dict[str, Any] = {
        "role": str(getattr(role, "value", role)).lower(),
        "context_mode": context_mode,
        "query": message.strip()[:2000],
        "ui_locale": ui_locale if ui_locale in {"en", "bn"} else "en",
    }
    if subject_tokens:
        payload["subject_tokens"] = subject_tokens
    if target_patient_id:
        payload["record_context"] = {
            "conditions": conditions[:30],
            "medications": medications[:30],
            "allergies": allergies[:30],
            "risk_flags": risk_flags[:30],
            "family_history": family_history[:30],
            "surgeries": surgeries[:8],
            "hospitalizations": hospitalizations[:8],
            "demographics": demographics or {},
            "recent_consultations": (recent_consultations or [])[:3],
            "recent_prescriptions": (recent_prescriptions or [])[:5],
            "appointment_history": (appointment_history or [])[:6],
            "lifestyle": lifestyle or {},
        }
    elif active_patients:
        payload["doctor_patient_directory"] = [
            {
                "patient_ref": str(item.get("patient_ref") or patient_ref_from_uuid(item.get("patient_id", ""))),
                "last_seen": str(item.get("last_seen", "")),
            }
            for item in active_patients[:25]
        ]
    if demographics and not target_patient_id:
        payload["self_demographics"] = demographics
    if lifestyle and not target_patient_id:
        payload["self_lifestyle"] = lifestyle

    if history_text:
        payload["recent_chat_history"] = history_text[:2500]
    if rag_context:
        payload["retrieved_knowledge"] = rag_context

    return (
        "Use only authorized Medora context below. "
        "Authorized access has already been verified server-side. "
        "Do not refuse due to privacy/local-mode concerns when record context is provided. "
        "Give practical, concise workflow support with clear uncertainty and safety cautions. "
        "Respond in the requested ui_locale, but keep medical names, medicine names, diagnosis terms, and user-entered values exactly as provided.\n"
        + json.dumps(payload, ensure_ascii=False)
    )


async def _run_chorui_assistant(
    payload: ChoruiAssistantRequest,
    user: Any,
    db: AsyncSession,
    request: Request | None = None,
) -> ChoruiAssistantResponse:
    role = await _get_user_role(db, user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    if role == UserRole.DOCTOR:
        await _require_doctor_ai_assistance_enabled(db, user.id)

    target_patient_id, patient_context, context_mode, sharing_perms = await _resolve_assistant_context(
        db=db,
        user_id=user.id,
        role=role,
        payload_patient_id=payload.patient_id,
    )
    if role == UserRole.DOCTOR and not target_patient_id:
        inferred_patient_id, inferred_patient_context, inferred_sharing_perms = await _try_resolve_doctor_patient_context_from_message(
            db=db,
            doctor_id=user.id,
            message=payload.message,
        )
        if inferred_patient_id and inferred_patient_context:
            target_patient_id = inferred_patient_id
            patient_context = inferred_patient_context
            context_mode = "doctor-patient"
            sharing_perms = inferred_sharing_perms

    role_context = _default_role_context(role, payload.role_context)
    ui_locale = str(payload.ui_locale or "en").strip().lower()
    if ui_locale not in {"en", "bn"}:
        ui_locale = "en"
    conversation_id = await _resolve_conversation_id(
        db,
        user_id=user.id,
        requested_conversation_id=payload.conversation_id,
        role_context=role_context,
        patient_id=target_patient_id,
    )
    subject_tokens = _build_subject_tokens(
        doctor_id=user.id if role == UserRole.DOCTOR else None,
        patient_id=target_patient_id if role == UserRole.DOCTOR else user.id,
        conversation_id=conversation_id,
        feature="chorui",
    )

    if role == UserRole.DOCTOR and target_patient_id:
        await log_patient_access(
            db,
            patient_id=target_patient_id,
            doctor_id=user.id,
            access_type=AccessType.VIEW_AI_QUERY,
            request=request,
        )

    intent = _classify_chorui_intent(payload.message, role, has_target_patient=bool(target_patient_id))
    normalized_message = _normalize_message(payload.message)
    previous_intent: str | None = None
    if intent == "general" and _is_followup_message(normalized_message):
        previous_intent = await _get_last_non_general_user_intent(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
        )
        if previous_intent:
            intent = previous_intent

    pending_intent: str | None = None
    pending_missing_params: list[str] = []
    if role == UserRole.DOCTOR and not target_patient_id:
        if intent in DOCTOR_PATIENT_SCOPED_INTENTS:
            pending_intent = intent
            pending_missing_params = ["id"]
        elif previous_intent and previous_intent in DOCTOR_PATIENT_SCOPED_INTENTS:
            pending_intent = previous_intent
            pending_missing_params = ["id"]

    normalized_intent = normalize_chorui_navigation_intent(
        message=payload.message,
        raw_intent=intent,
        role_context=role_context,
        context_mode=context_mode,
        pending_intent=pending_intent,
        pending_missing_params=pending_missing_params,
        has_target_patient=bool(target_patient_id),
    )
    medications = _safe_list((patient_context or {}).get("medications"))
    conditions = _safe_list((patient_context or {}).get("conditions"))
    allergies = _safe_list((patient_context or {}).get("allergies"))
    risk_flags = _safe_list((patient_context or {}).get("risk_flags"))
    family_history = _safe_list((patient_context or {}).get("family_history"))
    history_data = (patient_context or {}).get("history") if isinstance(patient_context, dict) else {}
    surgeries = _safe_list((history_data or {}).get("surgeries"))
    hospitalizations = _safe_list((history_data or {}).get("hospitalizations"))
    symptom_hints = _extract_symptom_hints(payload.message)
    severity_hint = _extract_severity_hint(payload.message)
    duration_hint = _extract_duration_hint(payload.message)

    demographics: dict[str, Any] = {}
    recent_consultations: list[dict[str, Any]] = []
    recent_prescriptions: list[dict[str, Any]] = []
    appointment_history: list[dict[str, Any]] = []
    lifestyle: dict[str, Any] = {}
    if target_patient_id:
        extended_context = await _build_patient_extended_context(
            db,
            patient_id=target_patient_id,
            doctor_id=user.id if role == UserRole.DOCTOR else None,
        )
        # Apply sharing filter for doctor-patient context
        if role == UserRole.DOCTOR and sharing_perms is not None:
            extended_context = filter_extended_context(extended_context, sharing_perms)
        demographics = extended_context.get("demographics") if isinstance(extended_context.get("demographics"), dict) else {}
        recent_consultations = extended_context.get("recent_consultations") if isinstance(extended_context.get("recent_consultations"), list) else []
        recent_prescriptions = extended_context.get("recent_prescriptions") if isinstance(extended_context.get("recent_prescriptions"), list) else []
        appointment_history = extended_context.get("appointment_history") if isinstance(extended_context.get("appointment_history"), list) else []
        lifestyle = extended_context.get("lifestyle") if isinstance(extended_context.get("lifestyle"), dict) else {}

    structured_data: dict[str, Any] = {
        "user_query": payload.message.strip()[:2000],
        "raw_intent": intent,
        "intent_normalization": normalized_intent.to_dict(),
        "symptoms": symptom_hints,
        "conditions": conditions,
        "medications": medications,
        "allergies": allergies,
        "risk_flags": risk_flags,
        "family_history": family_history,
        "surgeries": surgeries,
        "hospitalizations": hospitalizations,
        "duration": duration_hint,
        "severity": severity_hint,
        "demographics": demographics,
        "recent_consultations": recent_consultations,
        "recent_prescriptions": recent_prescriptions,
        "appointment_history": appointment_history,
        "lifestyle": lifestyle,
    }
    if target_patient_id:
        structured_data["patient_profile_id"] = patient_ref_from_uuid(target_patient_id)

    # Inject privacy restriction notice so the AI never fabricates restricted data
    if role == UserRole.DOCTOR and sharing_perms is not None:
        restriction_notice = build_ai_restriction_notice(sharing_perms)
        if restriction_notice:
            structured_data["privacy_restriction"] = restriction_notice
            structured_data["restricted_categories"] = sharing_perms.restricted_categories()

    await _persist_chorui_chat_message(
        db,
        conversation_id=conversation_id,
        user_id=user.id,
        patient_id=target_patient_id,
        role_context=role_context,
        sender="user",
        message_text=payload.message,
        intent=intent,
        request=request,
    )

    if (
        role == UserRole.DOCTOR
        and settings.CHORUI_REQUIRE_PATIENT_ID_FOR_DOCTOR
        and not target_patient_id
        and intent in DOCTOR_PATIENT_SCOPED_INTENTS
    ):
        active_patients = await _get_doctor_active_patients(db, user.id)
        reply = _build_doctor_patient_id_required_reply(active_patients)
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if _is_medical_decision_request(normalized_message):
        reply = (
            "I can help summarize records and provide educational workflow support, but I cannot provide diagnosis, "
            "prescription, or dosage decisions. Please consult a licensed doctor for treatment decisions. "
            "If this is urgent, seek emergency care immediately."
        )
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_search_patient_by_condition" and not target_patient_id:
        matches = await _search_doctor_patients_by_criteria(
            db,
            doctor_id=user.id,
            criteria_text=payload.message,
            limit=10,
        )
        structured_data["matching_patients"] = matches
        if matches:
            lines = [
                f"- {item.get('patient_ref')} | {item.get('display_name')} | conditions: {', '.join(item.get('conditions', [])[:3]) or 'not specified'}"
                for item in matches
            ]
            reply = (
                "I found patients matching your query from your authorized appointment network:\n"
                + "\n".join(lines)
                + "\n\nReply with one patient id to continue with patient-specific context."
            )
        else:
            reply = "I could not find matching patients for that criteria in your currently linked records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_today_appointments":
        upcoming_today = await _get_upcoming_doctor_schedule(db, doctor_id=user.id, window_days=1, limit=20)
        today_rows = [
            {
                "appointment_date": _format_datetime_label(item.appointment_date),
                "patient_ref": patient_ref_from_uuid(item.patient_id),
                "status": _format_status_label(item.status),
                "reason": str(item.reason or "")[:160],
            }
            for item in upcoming_today
        ]
        structured_data["today_appointments"] = today_rows
        if today_rows:
            reply = "Here are your appointments for today:\n" + "\n".join(
                [
                    f"- {item['appointment_date']} | {item['patient_ref']} | {item['status']}"
                    for item in today_rows
                ]
            )
        else:
            reply = "No appointments are currently scheduled for today in your active timeline."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_health_query":
        context_parts: list[str] = []
        if conditions:
            context_parts.append(f"Patient has these recorded conditions: {', '.join(conditions)}.")
        if medications:
            context_parts.append(f"Current medications: {', '.join(medications[:8])}.")
        if allergies:
            context_parts.append(f"Known allergies: {', '.join(allergies[:6])}.")
        if risk_flags:
            context_parts.append(f"Risk flags: {', '.join(risk_flags[:4])}.")

        patient_context_text = " ".join(context_parts) if context_parts else "No specific health records found for this patient yet."

        reply = (
            f"Based on your Medora health records: {patient_context_text} "
            "Using this context and general clinical guidance, here is an educational, non-prescriptive response to your question."
        )
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_medications":
        if medications:
            reply = (
                "Here are the medications available in your Medora records:\n"
                f"{_render_bullet_list(medications)}\n\n"
                "Please verify this list with your doctor before making any treatment decision."
            )
        else:
            reply = (
                "I could not find medications in your current records yet. "
                "You can update them from your medical history profile and ask again."
            )
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_conditions":
        if conditions:
            reply = (
                "Here are the conditions currently captured in your records:\n"
                f"{_render_bullet_list(conditions)}\n\n"
                "Use this as a reference only and confirm clinical interpretation with your doctor."
            )
        else:
            reply = "I could not find condition entries in your record yet."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_allergies":
        if allergies:
            reply = (
                "Here are the allergy entries currently available in your records:\n"
                f"{_render_bullet_list(allergies)}\n\n"
                "Please verify with your doctor before any medication change."
            )
        else:
            reply = "I could not find allergy entries in your record yet."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_risks":
        if risk_flags:
            reply = (
                "These risk flags were derived from your documented conditions:\n"
                f"{_render_bullet_list(risk_flags)}\n\n"
                "These are supportive indicators, not a final clinical judgment."
            )
        else:
            reply = "I did not detect elevated risk flags from your current records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_history":
        history_lines: list[str] = []
        if surgeries:
            history_lines.append("Surgeries:\n" + _render_bullet_list(surgeries[:8]))
        if hospitalizations:
            history_lines.append("Hospitalizations:\n" + _render_bullet_list(hospitalizations[:8]))
        if history_lines:
            reply = "Here is your recorded medical history:\n\n" + "\n\n".join(history_lines)
        else:
            reply = "I could not find surgery or hospitalization history entries in your records yet."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_family_history":
        if family_history:
            reply = "Here is your recorded family history:\n\n" + _render_bullet_list(family_history[:10])
        else:
            reply = "I could not find family history entries in your records yet."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_upcoming_appointments" and target_patient_id:
        upcoming = await _get_upcoming_patient_appointments(db, patient_id=target_patient_id, limit=5)
        if upcoming:
            appointment_lines = [
                f"- {_format_datetime_label(item.appointment_date)} ({_format_status_label(item.status)})"
                for item in upcoming
            ]
            reply = "Here are your upcoming appointments:\n" + "\n".join(appointment_lines)
        else:
            reply = "I could not find upcoming appointments in your records right now."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.PATIENT and intent == "patient_self_doctors":
        care_team = await _get_patient_care_team(db, patient_id=user.id, limit=10)
        structured_data["care_team"] = care_team
        if care_team:
            lines = [
                (
                    f"- {item['doctor_name']} "
                    f"(appointments: {item.get('appointment_count', 0)}, "
                    f"prescriptions: {item.get('prescription_count', 0)}, "
                    f"last activity: {item.get('last_activity', 'unknown')})"
                )
                for item in care_team
            ]
            reply = "Here are the doctors involved in your Medora care records:\n" + "\n".join(lines)
        else:
            reply = "I could not find linked doctor records for your account yet."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if intent == "service_information":
        reply = _build_service_information_reply(role=role, message=payload.message)
        # Enrich service-information responses with navigation suggestions so
        # "how do I book an appointment" also returns a clickable Find Doctor /
        # Appointments link alongside the textual guidance.
        nav_matches = _match_navigation_entries(role=role, message=payload.message, limit=2)
        nav_suggestions = _navigation_entries_to_suggestions(nav_matches)
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
            navigation=nav_suggestions,
        )

    if role == UserRole.PATIENT and intent == "patient_self_summary":
        reply = _build_patient_summary_text(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            risk_flags=risk_flags,
            family_history=family_history,
        )
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_active_patients":
        active_patients = await _get_doctor_active_patients(db, user.id)
        if active_patients:
            preview_lines = [
                (
                    f"- patient id: {item.get('patient_ref') or patient_ref_from_uuid(item['patient_id'])} "
                    f"(last activity: {item['last_seen'][:10] if item.get('last_seen') else 'unknown'})"
                )
                for item in active_patients[:20]
            ]
            joined_preview_lines = "\n".join(preview_lines)
            reply = (
                "Here are your active patients from recent appointment relationships:\n"
                f"{joined_preview_lines}\n\n"
                "Use a `patient id` in your next message for patient-linked intelligence."
            )
        else:
            reply = "I could not find active patients in your current access window."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_medications" and target_patient_id:
        if medications:
            reply = (
                "Here are the medications found for the selected patient:\n"
                f"{_render_bullet_list(medications)}\n\n"
                "Please validate against the latest consultation before prescribing."
            )
        else:
            reply = "No medications were found for this patient in the current records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_conditions" and target_patient_id:
        if conditions:
            reply = (
                "Here are the recorded conditions for the selected patient:\n"
                f"{_render_bullet_list(conditions)}\n\n"
                "Use this as background context and confirm diagnosis clinically."
            )
        else:
            reply = "No condition entries were found for this patient in current records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_allergies" and target_patient_id:
        if allergies:
            reply = (
                "Here are the allergy entries found for the selected patient:\n"
                f"{_render_bullet_list(allergies)}\n\n"
                "Please cross-check before finalizing orders."
            )
        else:
            reply = "No allergy entries were found for this patient in current records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_risks" and target_patient_id:
        if risk_flags:
            reply = (
                "Risk flags inferred from the patient's records:\n"
                f"{_render_bullet_list(risk_flags)}\n\n"
                "Use this as support context only."
            )
        else:
            reply = "No elevated risk flags were inferred from available records."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_history" and target_patient_id:
        history_sections: list[str] = []
        if surgeries:
            history_sections.append("Surgeries:\n" + _render_bullet_list(surgeries[:10]))
        if hospitalizations:
            history_sections.append("Hospitalizations:\n" + _render_bullet_list(hospitalizations[:10]))
        if history_sections:
            reply = "Recorded history for selected patient:\n\n" + "\n\n".join(history_sections)
        else:
            reply = "No surgeries or hospitalization entries were found for this patient."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_upcoming_appointments" and target_patient_id:
        upcoming = await _get_upcoming_patient_appointments(
            db,
            patient_id=target_patient_id,
            doctor_id=user.id,
            limit=5,
        )
        if upcoming:
            appointment_lines = [
                f"- {_format_datetime_label(item.appointment_date)} ({_format_status_label(item.status)})"
                for item in upcoming
            ]
            reply = "Upcoming appointments for this patient in your schedule:\n" + "\n".join(appointment_lines)
        else:
            reply = "No upcoming appointments with this patient were found in your schedule."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_self_schedule":
        upcoming = await _get_upcoming_doctor_schedule(db, doctor_id=user.id, window_days=7, limit=12)
        if upcoming:
            schedule_lines = [
                f"- {_format_datetime_label(item.appointment_date)} with patient {patient_ref_from_uuid(item.patient_id)} ({_format_status_label(item.status)})"
                for item in upcoming
            ]
            joined_schedule_lines = "\n".join(schedule_lines)
            reply = (
                "Here is your upcoming 7-day schedule from authorized appointment records:\n"
                f"{joined_schedule_lines}"
            )
        else:
            reply = "No upcoming appointments were found in your next 7-day window."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    if role == UserRole.DOCTOR and intent == "doctor_patient_summary" and target_patient_id:
        reply = _build_patient_summary_text(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            risk_flags=risk_flags,
            family_history=family_history,
        )
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    privacy_mode = settings.CHORUI_PRIVACY_MODE.strip().lower()
    history_text = _history_to_text(payload.history)
    if privacy_mode == "strict_local":
        if role == UserRole.DOCTOR and target_patient_id:
            # Keep doctor flow record-augmented when authorized patient context exists.
            privacy_mode = "record_augmented"
        elif role == UserRole.DOCTOR:
            active_patients = await _get_doctor_active_patients(db, user.id)
            reply = _build_doctor_patient_id_required_reply(active_patients)
        else:
            reply = _build_patient_contextual_general_reply(
                conditions=conditions,
                medications=medications,
                allergies=allergies,
                risk_flags=risk_flags,
            )
            recent_topics = await _get_recent_intent_topics(
                db,
                user_id=user.id,
                conversation_id=conversation_id,
            )
            if recent_topics:
                hint = ", ".join(recent_topics[:3])
                reply = f"{reply}\n\nRecent conversation topics: {hint}."
            return await _finalize_chorui_response(
                db=db,
                conversation_id=conversation_id,
                user_id=user.id,
                patient_id=target_patient_id,
                role_context=role_context,
                reply=reply,
                structured_data=structured_data,
                context_mode=context_mode,
                intent=intent,
                request=request,
            )

    if role == UserRole.DOCTOR and intent == "doctor_patient_family_history" and target_patient_id:
        if family_history:
            reply = "Recorded family history for selected patient:\n\n" + _render_bullet_list(family_history[:10])
        else:
            reply = "No family history entries were found for this patient."
        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=reply,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )

    active_patients: list[dict[str, Any]] = []
    if role == UserRole.DOCTOR and not target_patient_id:
        active_patients = await _get_doctor_active_patients(db, user.id)
    anonymized_message = anonymize_identifier_text(payload.message, token_namespace="subject")
    anonymized_history_text = anonymize_identifier_text(history_text, token_namespace="subject")
    if target_patient_id:
        patient_name_row = (
            await db.execute(
                select(Profile.first_name, Profile.last_name).where(Profile.id == target_patient_id).limit(1)
            )
        ).first()
        if patient_name_row:
            first_name = str(patient_name_row[0] or "").strip()
            last_name = str(patient_name_row[1] or "").strip()
            full_name = f"{first_name} {last_name}".strip()
            anonymized_message = _anonymize_named_entities(
                payload.message,
                [full_name, first_name, last_name],
                alias="[patient]",
            )
            anonymized_history_text = _anonymize_named_entities(
                history_text,
                [full_name, first_name, last_name],
                alias="[patient]",
            )
    rag_context = await _build_secure_rag_context(
        db,
        query=anonymized_message,
        conditions=conditions,
        medications=medications,
    )

    chorui_query = _build_chorui_model_query(
        role=role,
        message=anonymized_message,
        context_mode=context_mode,
        target_patient_id=target_patient_id,
        conditions=conditions,
        medications=medications,
        allergies=allergies,
        risk_flags=risk_flags,
        family_history=family_history,
        surgeries=surgeries,
        hospitalizations=hospitalizations,
        active_patients=active_patients,
        history_text=anonymized_history_text,
        demographics=demographics,
        recent_consultations=recent_consultations,
        recent_prescriptions=recent_prescriptions,
        appointment_history=appointment_history,
        lifestyle=lifestyle,
        ui_locale=ui_locale,
        subject_tokens=subject_tokens,
        rag_context=rag_context,
    )
    llm_started = perf_counter()
    try:
        model_result = await ai_orchestrator.clinical_info_query(
            chorui_query,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
        answer = str(model_result.validated_output.get("answer", "")).strip()
        if not answer:
            answer = "I could not generate a complete response from AI right now."
        cautions = [str(item).strip() for item in model_result.validated_output.get("cautions", []) if str(item).strip()]
        condition_hints = [
            str(item.get("name", "")).strip()
            for item in model_result.validated_output.get("suggested_conditions", [])
            if isinstance(item, dict) and str(item.get("name", "")).strip()
        ]
        if condition_hints:
            structured_data["conditions"] = list(dict.fromkeys([*structured_data.get("conditions", []), *condition_hints]))[:30]
        structured_data["llm_source"] = "clinical_info_query"
        if cautions:
            answer = f"{answer}\n\nCautions:\n{_render_bullet_list(cautions[:4])}"
        if target_patient_id and _looks_like_privacy_refusal(answer):
            answer = _build_local_clinical_answer(
                query=payload.message,
                conditions=conditions,
                medications=medications,
                allergies=allergies,
                risk_flags=risk_flags,
                family_history=family_history,
            )

        return await _finalize_chorui_response(
            db=db,
            conversation_id=conversation_id,
            user_id=user.id,
            patient_id=target_patient_id,
            role_context=role_context,
            reply=answer,
            structured_data=structured_data,
            context_mode=context_mode,
            intent=intent,
            request=request,
        )
    except AIOrchestratorError as exc:
        logger.warning(
            "Chorui LLM query failed | intent=%s context_mode=%s duration_ms=%s error=%s",
            intent,
            context_mode,
            int((perf_counter() - llm_started) * 1000),
            str(exc),
        )

    if role == UserRole.DOCTOR and target_patient_id:
        reply = _build_local_clinical_answer(
            query=payload.message,
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            risk_flags=risk_flags,
            family_history=family_history,
        )
    elif role == UserRole.DOCTOR and active_patients:
        lines = [
            (
                f"- patient id: {item.get('patient_ref') or patient_ref_from_uuid(item['patient_id'])} "
                f"(last activity: {item['last_seen'][:10] if item.get('last_seen') else 'unknown'})"
            )
            for item in active_patients[:15]
        ]
        joined_lines = "\n".join(lines)
        reply = (
            "I could not reach advanced AI right now, so here are your active patient references:\n"
            f"{joined_lines}\n\n"
            "Share a patient id plus your clinical question for patient-specific support."
        )
    else:
        reply = (
            "I am here to help with Medora workflows and your record-linked health context. "
            "Tell me what you are trying to do, and I will guide you with what is available in your account data."
        )
    return await _finalize_chorui_response(
        db=db,
        conversation_id=conversation_id,
        user_id=user.id,
        patient_id=target_patient_id,
        role_context=role_context,
        reply=reply,
        structured_data=structured_data,
        context_mode=context_mode,
        intent=intent,
        request=request,
    )

@router.post("/assistant-chat", response_model=ChoruiAssistantResponse)
async def chorui_assistant_chat(
    payload: ChoruiAssistantRequest,
    request: Request,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    return await _run_chorui_assistant(payload, user, db, request)


def _format_vapi_appointment_line(appointment: Appointment) -> str:
    try:
        when_label = _format_datetime_label(appointment.appointment_date)
    except Exception:
        when_label = "soon"
    status_label = _format_status_label(getattr(appointment, "status", None))
    reason = str(getattr(appointment, "reason", "") or "").strip()
    base = f"{when_label} ({status_label})"
    if reason:
        return f"{base} — {reason[:80]}"
    return base


async def _handle_vapi_upcoming_appointments(
    *,
    arguments: dict[str, Any],
    metadata: dict[str, Any],
    vapi_user: Any,
    db: AsyncSession,
) -> str:
    role = await _get_user_role(db, vapi_user.id)
    if role is None:
        return "I could not find your Medora profile for this voice session."

    limit_raw = arguments.get("limit") or arguments.get("count") or 5
    try:
        limit = max(1, min(10, int(limit_raw)))
    except Exception:
        limit = 5

    if role == UserRole.PATIENT:
        appointments = await _get_upcoming_patient_appointments(
            db, patient_id=vapi_user.id, limit=limit
        )
        if not appointments:
            return "You have no upcoming appointments on your Medora calendar."
        lines = [_format_vapi_appointment_line(appt) for appt in appointments]
        return "Here are your upcoming appointments: " + "; ".join(lines)

    if role == UserRole.DOCTOR:
        appointments = await _get_upcoming_doctor_schedule(
            db, doctor_id=vapi_user.id, limit=limit
        )
        if not appointments:
            return "Your Medora schedule is clear for the next few days."
        lines = [_format_vapi_appointment_line(appt) for appt in appointments]
        return "Here is what is on your upcoming schedule: " + "; ".join(lines)

    return "Appointment lookup is only available for patient and doctor voice sessions."


async def _handle_vapi_find_patient(
    *,
    arguments: dict[str, Any],
    metadata: dict[str, Any],
    vapi_user: Any,
    db: AsyncSession,
) -> str:
    role = await _get_user_role(db, vapi_user.id)
    if role != UserRole.DOCTOR:
        return "Patient search is only available for doctor voice sessions."

    await _require_doctor_ai_assistance_enabled(db, vapi_user.id)

    query_text = _safe_vapi_text(
        arguments.get("query")
        or arguments.get("name")
        or arguments.get("criteria")
        or arguments.get("message"),
        max_length=160,
    )
    if not query_text:
        return "Tell me the patient name, id, or condition to look for."

    matches = await _search_doctor_patients_by_criteria(
        db, doctor_id=vapi_user.id, criteria_text=query_text, limit=5
    )
    if not matches:
        return f"I could not find any of your active patients matching '{query_text}'."

    fragments: list[str] = []
    for match in matches[:5]:
        name = str(match.get("display_name") or "Patient")
        patient_ref = str(match.get("patient_ref") or "")
        conditions = match.get("conditions") or []
        condition_summary = (
            f" — conditions: {', '.join(conditions[:3])}" if conditions else ""
        )
        ref_suffix = f" (ref {patient_ref})" if patient_ref else ""
        fragments.append(f"{name}{ref_suffix}{condition_summary}")

    return "I found these matches: " + "; ".join(fragments)


async def _handle_vapi_get_context(
    *,
    arguments: dict[str, Any],
    metadata: dict[str, Any],
    vapi_user: Any,
    db: AsyncSession,
) -> str:
    role = await _get_user_role(db, vapi_user.id)
    if role is None:
        return "I could not find your Medora profile for this voice session."

    role_label = "doctor" if role == UserRole.DOCTOR else "patient"
    current_route = _safe_vapi_text(
        arguments.get("current_route")
        or metadata.get("current_route")
        or metadata.get("medora_current_route"),
        max_length=160,
    )
    current_page = _safe_vapi_text(
        arguments.get("current_page")
        or metadata.get("current_page_label")
        or metadata.get("medora_current_page_label"),
        max_length=160,
    )
    locale = _safe_vapi_text(
        arguments.get("locale")
        or metadata.get("locale")
        or metadata.get("medora_locale"),
        max_length=16,
    ) or "en"

    parts: list[str] = [f"Signed-in Medora {role_label}"]
    if current_page:
        parts.append(f"currently viewing {current_page}")
    elif current_route:
        parts.append(f"current route is {current_route}")
    parts.append(f"UI language is {locale}")

    if role == UserRole.PATIENT:
        upcoming = await _get_upcoming_patient_appointments(
            db, patient_id=vapi_user.id, limit=1
        )
        if upcoming:
            next_appt = upcoming[0]
            when_label = _format_datetime_label(next_appt.appointment_date)
            parts.append(f"next appointment {when_label}")
    elif role == UserRole.DOCTOR:
        upcoming = await _get_upcoming_doctor_schedule(
            db, doctor_id=vapi_user.id, limit=1
        )
        if upcoming:
            when_label = _format_datetime_label(upcoming[0].appointment_date)
            parts.append(f"next consultation {when_label}")

    return "Voice context — " + "; ".join(parts) + "."


async def _handle_vapi_navigate(
    *,
    arguments: dict[str, Any],
    metadata: dict[str, Any],
    vapi_user: Any,
    db: AsyncSession,
    request: Request,
) -> str:
    role = await _get_user_role(db, vapi_user.id)
    if role is None:
        return "I could not verify your Medora profile for this voice session."

    destination_request = _safe_vapi_text(
        arguments.get("destination")
        or arguments.get("target")
        or arguments.get("page")
        or arguments.get("route")
        or arguments.get("message")
        or arguments.get("query"),
        max_length=200,
    )
    if not destination_request:
        registry = _navigation_registry_for_role(role)
        labels = [str(entry.get("label", "")).strip() for entry in registry]
        labels = [label for label in labels if label]
        return (
            "Tell me where you want to go. I can take you to: "
            + ", ".join(labels[:10])
            + "."
        )

    explicit_route = _safe_vapi_text(arguments.get("route"), max_length=240)
    if explicit_route and explicit_route.startswith("/"):
        label_hint = destination_request or explicit_route
        return f"Opening {label_hint} now."

    # Reuse the Chorui natural-language navigation matcher.
    entries = _match_navigation_entries(
        role=role, message=destination_request, limit=3
    )
    if entries:
        top = entries[0]
        top_label = str(top.get("label", "")).strip() or "that page"
        return f"Opening {top_label} now."

    # Fall back to the full Chorui pipeline so confidence + suggestions flow through.
    patient_identifier = _extract_vapi_patient_identifier(arguments, metadata)
    conversation_id = _extract_vapi_conversation_id(arguments, {})
    chorui_payload = ChoruiAssistantRequest(
        message=destination_request,
        conversation_id=conversation_id,
        patient_id=patient_identifier,
        history=[],
        role_context=_extract_vapi_role_context(arguments, metadata) or None,
    )
    try:
        chorui_response = await _run_chorui_assistant(
            chorui_payload, vapi_user, db, request
        )
    except HTTPException as exc:
        detail = (
            exc.detail
            if isinstance(exc.detail, str)
            else "I could not resolve that destination right now."
        )
        return detail

    action = chorui_response.action
    if action and action.type == "navigate" and action.route:
        tail = action.route.strip("/").split("/")[-1].replace("-", " ") or "that page"
        return f"Opening {tail.title()} now."
    if action and action.type in {"clarify", "suggest"} and chorui_response.suggested_routes:
        suggestion_labels = [
            route.label for route in chorui_response.suggested_routes[:3]
        ]
        return (
            "I am not sure which page you mean. You can say: "
            + ", ".join(suggestion_labels)
            + "."
        )
    return chorui_response.reply


@router.post("/vapi/tools/chorui")
async def chorui_vapi_tool_webhook(
    payload: dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    configured_secret = _safe_vapi_text(settings.VAPI_TOOL_SHARED_SECRET)
    if configured_secret:
        provided_secret = _safe_vapi_text(request.headers.get("x-vapi-tool-secret"), max_length=256)
        if provided_secret != configured_secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Vapi tool secret")

    tool_calls = _extract_vapi_tool_calls(payload)
    if not tool_calls:
        return {"received": True}

    metadata = _extract_vapi_call_metadata(payload)
    results: list[dict[str, Any]] = []

    for tool_call in tool_calls:
        tool_call_id = _safe_vapi_text(tool_call.get("id"), max_length=128) or str(uuid.uuid4())
        tool_name = _safe_vapi_text(tool_call.get("name"), max_length=128).lower()
        if tool_name and tool_name not in VAPI_SUPPORTED_TOOL_NAMES:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Unsupported tool name. Use ask_chorui or summarize_prescription for Medora voice assistant queries.",
                }
            )
            continue

        arguments = _safe_vapi_dict(tool_call.get("arguments"))
        session_token = _extract_vapi_session_token(
            arguments=arguments,
            metadata=metadata,
            request=request,
        )
        if not session_token:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": (
                        "Voice session is not authenticated. Please start voice from your signed-in Medora dashboard."
                    ),
                }
            )
            continue

        try:
            vapi_user = await _resolve_vapi_user_from_token(session_token, db)
        except HTTPException:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Voice session authentication failed. Please sign in again and restart voice chat.",
                }
            )
            continue

        if tool_name in {"navigate_medora", "navigate"}:
            try:
                nav_text = await _handle_vapi_navigate(
                    arguments=arguments,
                    metadata=metadata,
                    vapi_user=vapi_user,
                    db=db,
                    request=request,
                )
                results.append({"toolCallId": tool_call_id, "result": nav_text})
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Navigation failed."
                results.append({"toolCallId": tool_call_id, "result": detail})
            except Exception:
                logger.exception("Unexpected error while processing Vapi navigation tool call")
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "I could not open that page right now. Please try again.",
                    }
                )
            continue

        if tool_name == "get_upcoming_appointments":
            try:
                text = await _handle_vapi_upcoming_appointments(
                    arguments=arguments,
                    metadata=metadata,
                    vapi_user=vapi_user,
                    db=db,
                )
                results.append({"toolCallId": tool_call_id, "result": text})
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Unable to load appointments right now."
                results.append({"toolCallId": tool_call_id, "result": detail})
            except Exception:
                logger.exception("Unexpected error while processing Vapi upcoming appointments tool call")
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "I could not load your upcoming appointments right now.",
                    }
                )
            continue

        if tool_name == "find_patient":
            try:
                text = await _handle_vapi_find_patient(
                    arguments=arguments,
                    metadata=metadata,
                    vapi_user=vapi_user,
                    db=db,
                )
                results.append({"toolCallId": tool_call_id, "result": text})
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Unable to search patients right now."
                results.append({"toolCallId": tool_call_id, "result": detail})
            except Exception:
                logger.exception("Unexpected error while processing Vapi patient search tool call")
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "I could not run that patient search right now.",
                    }
                )
            continue

        if tool_name == "get_voice_context":
            try:
                text = await _handle_vapi_get_context(
                    arguments=arguments,
                    metadata=metadata,
                    vapi_user=vapi_user,
                    db=db,
                )
                results.append({"toolCallId": tool_call_id, "result": text})
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Unable to fetch your voice context right now."
                results.append({"toolCallId": tool_call_id, "result": detail})
            except Exception:
                logger.exception("Unexpected error while processing Vapi voice context tool call")
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "I could not read your Medora context right now.",
                    }
                )
            continue

        if tool_name == "end_voice_call":
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Okay, ending our voice session. Tap Start Voice any time to continue.",
                }
            )
            continue

        if tool_name in {"summarize_prescription", "explain_prescription"}:
            prescription_id = _safe_vapi_text(
                arguments.get("prescription_id")
                or arguments.get("item_id")
                or metadata.get("prescription_id")
                or metadata.get("medora_prescription_id"),
                max_length=120,
            )
            if not prescription_id:
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "Missing prescription_id. Please provide the prescription id for voice explanation.",
                    }
                )
                continue

            try:
                summary_response = await get_patient_prescription_assistant_summary(
                    prescription_id=prescription_id,
                    user=vapi_user,
                    db=db,
                )
                voice_summary = summary_response.plain_text_summary or "I could not build a prescription summary right now."
                results.append({"toolCallId": tool_call_id, "result": voice_summary})
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else "Unable to summarize prescription right now."
                results.append({"toolCallId": tool_call_id, "result": detail})
            except Exception:
                logger.exception("Unexpected error while processing Vapi prescription summary tool call")
                results.append(
                    {
                        "toolCallId": tool_call_id,
                        "result": "I could not summarize this prescription right now. Please try again.",
                    }
                )
            continue

        user_message = _safe_vapi_text(
            arguments.get("message") or arguments.get("query") or arguments.get("input")
        )

        if not user_message:
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "Missing message in tool arguments. Provide a non-empty 'message' value.",
                }
            )
            continue

        role_context = _extract_vapi_role_context(arguments, metadata) or None
        patient_identifier = _extract_vapi_patient_identifier(arguments, metadata)
        conversation_id = _extract_vapi_conversation_id(arguments, payload)

        chorui_payload = ChoruiAssistantRequest(
            message=user_message,
            conversation_id=conversation_id,
            patient_id=patient_identifier,
            history=[],
            role_context=role_context,
        )

        try:
            chorui_response = await _run_chorui_assistant(chorui_payload, vapi_user, db, request)
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": chorui_response.reply,
                }
            )
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else "Unable to process request right now."
            results.append({"toolCallId": tool_call_id, "result": detail})
        except Exception:
            logger.exception("Unexpected error while processing Vapi tool call")
            results.append(
                {
                    "toolCallId": tool_call_id,
                    "result": "I could not process that voice request right now. Please try again.",
                }
            )

    return {"results": results}


@router.get("/assistant/conversations", response_model=ChoruiConversationListResponse)
async def list_chorui_conversations(
    limit: int = Query(25, ge=1, le=50),
    role_context: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    role = await _get_user_role(db, user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    resolved_role_context = _default_role_context(role, role_context)
    resolved_patient_id: str | None = None

    if role == UserRole.PATIENT:
        resolved_patient_id = None
    elif role == UserRole.DOCTOR and patient_id:
        resolved_patient_id = await _resolve_patient_identifier_for_doctor(
            db,
            doctor_id=user.id,
            patient_identifier=patient_id,
        )

    filters = [
        ChoruiChatMessage.user_id == user.id,
        ChoruiChatMessage.role_context == resolved_role_context,
    ]
    if resolved_patient_id:
        filters.append(ChoruiChatMessage.patient_id == resolved_patient_id)

    grouped_result = await db.execute(
        select(
            ChoruiChatMessage.conversation_id,
            func.max(ChoruiChatMessage.created_at).label("updated_at"),
        )
        .where(*filters)
        .group_by(ChoruiChatMessage.conversation_id)
        .order_by(func.max(ChoruiChatMessage.created_at).desc())
        .limit(limit)
    )
    grouped_rows = grouped_result.all()

    conversations: list[ChoruiConversationSummary] = []
    for row in grouped_rows:
        latest_result = await db.execute(
            select(ChoruiChatMessage)
            .where(
                ChoruiChatMessage.user_id == user.id,
                ChoruiChatMessage.conversation_id == row.conversation_id,
            )
            .order_by(ChoruiChatMessage.created_at.desc())
            .limit(1)
        )
        latest = latest_result.scalar_one_or_none()
        if not latest:
            continue

        last_message = str(latest.message_text or "").strip()
        if len(last_message) > 180:
            last_message = f"{last_message[:177]}..."

        conversations.append(
            ChoruiConversationSummary(
                conversation_id=latest.conversation_id,
                role_context=str(latest.role_context or resolved_role_context),
                context_mode=str(latest.context_mode or "general"),
                patient_id=latest.patient_id,
                patient_ref=patient_ref_from_uuid(latest.patient_id) if latest.patient_id else None,
                last_sender=str(latest.sender or "assistant"),
                last_message=last_message,
                updated_at=_format_datetime_iso(row.updated_at),
            )
        )

    return ChoruiConversationListResponse(conversations=conversations)


@router.get("/assistant/conversations/{conversation_id}", response_model=ChoruiConversationHistoryResponse)
async def get_chorui_conversation_messages(
    conversation_id: str,
    limit: int = Query(120, ge=1, le=300),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    target_id = (conversation_id or "").strip()[:64]
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="conversation_id is required")

    first_result = await db.execute(
        select(ChoruiChatMessage)
        .where(
            ChoruiChatMessage.user_id == user.id,
            ChoruiChatMessage.conversation_id == target_id,
        )
        .order_by(ChoruiChatMessage.created_at.asc())
        .limit(1)
    )
    first_message = first_result.scalar_one_or_none()
    if not first_message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    messages_result = await db.execute(
        select(ChoruiChatMessage)
        .where(
            ChoruiChatMessage.user_id == user.id,
            ChoruiChatMessage.conversation_id == target_id,
        )
        .order_by(ChoruiChatMessage.created_at.asc())
        .limit(limit)
    )
    rows = messages_result.scalars().all()

    messages = [
        ChoruiConversationMessage(
            id=str(item.id),
            role="ai" if str(item.sender or "").lower() == "assistant" else "user",
            content=str(item.message_text or ""),
            timestamp=_format_datetime_iso(item.created_at),
            structured_data=item.structured_data if isinstance(item.structured_data, dict) else None,
        )
        for item in rows
    ]

    context_mode = "general"
    if rows:
        context_mode = str(rows[-1].context_mode or context_mode)

    return ChoruiConversationHistoryResponse(
        conversation_id=target_id,
        context_mode=context_mode,
        messages=messages,
    )


@router.delete("/assistant/conversations/{conversation_id}", response_model=ChoruiConversationDeleteResponse)
async def delete_chorui_conversation(
    conversation_id: str,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    target_id = (conversation_id or "").strip()[:64]
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="conversation_id is required")

    existing = await db.execute(
        select(ChoruiChatMessage.id)
        .where(
            ChoruiChatMessage.user_id == user.id,
            ChoruiChatMessage.conversation_id == target_id,
        )
        .limit(1)
    )
    if not existing.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    rows = await db.execute(
        select(ChoruiChatMessage)
        .where(
            ChoruiChatMessage.user_id == user.id,
            ChoruiChatMessage.conversation_id == target_id,
        )
    )
    for item in rows.scalars().all():
        await db.delete(item)

    await db.commit()
    return ChoruiConversationDeleteResponse(conversation_id=target_id, deleted=True)


@router.post("/intake-structure", response_model=ChoruiAssistantResponse)
async def chorui_intake_structure_compat(
    payload: ChoruiAssistantRequest,
    request: Request,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    return await _run_chorui_assistant(payload, user, db, request)


@router.post("/intake/save", response_model=ChoruiIntakeSaveResponse)
async def chorui_intake_save(
    payload: ChoruiIntakeSaveRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    role = await _get_user_role(db, user.id)
    if role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can save intake data")

    if payload.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can save intake for your own profile only")

    _, patient = await _get_patient_context(db, payload.patient_id)
    structured = payload.structured_data if isinstance(payload.structured_data, dict) else {}

    symptoms = _safe_list(structured.get("symptoms"))
    conditions = _safe_list(structured.get("conditions"))
    duration = str(structured.get("duration", "")).strip()
    severity_value = structured.get("severity", 0)
    try:
        severity = max(0, min(10, int(severity_value)))
    except Exception:
        severity = 0

    existing_conditions = patient.conditions if isinstance(patient.conditions, list) else []
    condition_names = {
        str(item.get("name", "")).strip().lower()
        for item in existing_conditions
        if isinstance(item, dict) and str(item.get("name", "")).strip()
    }

    for item in conditions:
        lowered = item.lower()
        if lowered in condition_names:
            continue
        existing_conditions.append(
            {
                "name": item,
                "source": "chorui_ai",
                "notes": "Captured from intake assistant",
            }
        )
        condition_names.add(lowered)

    intake_lines: list[str] = []
    if symptoms:
        intake_lines.append(f"Symptoms: {', '.join(symptoms)}")
    if duration:
        intake_lines.append(f"Duration: {duration}")
    intake_lines.append(f"Severity Index: {severity}/10")
    summary_line = " | ".join(intake_lines)

    patient.conditions = existing_conditions
    patient.has_conditions = bool(existing_conditions)
    patient.chronic_conditions_notes = summary_line[:1000] if summary_line else patient.chronic_conditions_notes
    patient.last_checkup_date = patient.last_checkup_date or "AI Intake Captured"

    await db.commit()

    saved_fields = ["conditions", "chronic_conditions_notes", "has_conditions"]
    return ChoruiIntakeSaveResponse(saved_fields=saved_fields)


@router.get("/patient-summary", response_model=AIPatientSummaryViewResponse)
async def get_ai_patient_summary(
    patient_id: str = Query(...),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user.id)
    resolved_patient_id = await _resolve_patient_identifier_for_doctor(
        db,
        doctor_id=user.id,
        patient_identifier=patient_id,
    )
    access = await check_doctor_patient_access(db, user.id, resolved_patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

    # Fetch sharing preferences and filter patient data
    sharing_perms = await get_sharing_permissions(
        db, patient_id=resolved_patient_id, doctor_id=user.id
    )
    sharing_perms = await _require_doctor_patient_ai_permissions(
        db,
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        sharing_perms=sharing_perms,
    )
    profile, patient = await _get_patient_context(db, resolved_patient_id)
    raw_data = filter_raw_summary(
        _build_raw_summary(profile, patient), sharing_perms
    )
    subject_tokens = _build_subject_tokens(
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        feature="patient_summary",
    )

    ai_payload: dict[str, Any] = {
        **subject_tokens,
        "record_context": raw_data,
    }
    restriction_notice = build_ai_restriction_notice(sharing_perms)
    if restriction_notice:
        ai_payload["privacy_restriction"] = restriction_notice

    try:
        result = await ai_orchestrator.generate_patient_summary(
            ai_payload,
            include_meta=True,
            prompt_version="v1",
        )
        interaction_id = await _persist_ai_interaction(
            db,
            result=result,
            doctor_id=user.id,
            patient_id=resolved_patient_id,
        )
        return AIPatientSummaryViewResponse(
            ai_generated=True,
            interaction_id=interaction_id,
            summary=result.validated_output,
            raw_data=raw_data,
        )
    except AIOrchestratorError:
        return AIPatientSummaryViewResponse(
            ai_generated=False,
            interaction_id=None,
            summary=None,
            raw_data=raw_data,
        )


@router.post("/clinical-info", response_model=AIClinicalInfoResponse)
async def get_ai_clinical_info(
    payload: AIClinicalQueryRequest,
    request: Request,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    if not payload.patient_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="patient_id is required")

    await _require_doctor(db, user.id)
    resolved_patient_id = await _resolve_patient_identifier_for_doctor(
        db,
        doctor_id=user.id,
        patient_identifier=payload.patient_id,
    )
    access = await check_doctor_patient_access(db, user.id, resolved_patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

    await log_patient_access(
        db,
        patient_id=resolved_patient_id,
        doctor_id=user.id,
        access_type=AccessType.VIEW_AI_QUERY,
        request=request,
    )

    # Fetch sharing preferences and filter patient data
    sharing_perms = await get_sharing_permissions(
        db, patient_id=resolved_patient_id, doctor_id=user.id
    )
    sharing_perms = await _require_doctor_patient_ai_permissions(
        db,
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        sharing_perms=sharing_perms,
    )
    profile, patient = await _get_patient_context(db, resolved_patient_id)
    raw_summary = filter_raw_summary(
        _build_raw_summary(profile, patient), sharing_perms
    )
    summary_conditions = _safe_list(raw_summary.get("conditions"))
    summary_medications = _safe_list(raw_summary.get("medications"))
    summary_allergies = _safe_list(raw_summary.get("allergies"))
    summary_risk_flags = _safe_list(raw_summary.get("risk_flags"))
    summary_family_history = _safe_list(raw_summary.get("family_history"))
    subject_tokens = _build_subject_tokens(
        doctor_id=user.id,
        patient_id=resolved_patient_id,
        feature="clinical_info",
    )

    query_input = payload.query
    if payload.notes:
        query_input = f"{payload.query}\n\nClinical notes:\n{payload.notes}"
    full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip()
    anonymized_query_input = _anonymize_named_entities(
        query_input,
        [full_name, profile.first_name, profile.last_name],
        alias="[patient]",
    )
    restriction_notice = build_ai_restriction_notice(sharing_perms)
    restriction_prefix = f"{restriction_notice}\n\n" if restriction_notice else ""
    contextual_query_input = (
        f"{restriction_prefix}"
        f"Doctor question:\n{anonymized_query_input}\n\n"
        "Authorized patient record context:\n"
        + json.dumps(
            {
                **subject_tokens,
                "conditions": summary_conditions[:12],
                "medications": summary_medications[:12],
                "allergies": summary_allergies[:12],
                "risk_flags": summary_risk_flags[:12],
                "family_history": summary_family_history[:12],
            },
            ensure_ascii=False,
        )
    )
    rag_context = await _build_secure_rag_context(
        db,
        query=anonymized_query_input,
        conditions=summary_conditions,
        medications=summary_medications,
    )
    contextual_query_input = (
        f"{contextual_query_input}\n\nRetrieved knowledge context:\n"
        + json.dumps(rag_context, ensure_ascii=False)
    )

    privacy_mode = settings.CHORUI_PRIVACY_MODE.strip().lower()
    if privacy_mode == "strict_local":
        privacy_mode = "record_augmented"

    interaction_ids: list[str] = []
    answer = "No clinical insights available right now."
    cautions: list[str] = []
    conditions: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    medications: list[dict[str, Any]] = []
    ai_generated = False

    try:
        info_result = await ai_orchestrator.clinical_info_query(
            contextual_query_input,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
        ai_generated = True
        answer = str(info_result.validated_output.get("answer", answer))
        cautions = [str(item) for item in info_result.validated_output.get("cautions", [])]
        conditions = [
            {"name": str(item.get("name", "")), "confidence": float(item.get("confidence", 0.0))}
            for item in info_result.validated_output.get("suggested_conditions", [])
            if isinstance(item, dict) and item.get("name")
        ]
        interaction_ids.append(
            await _persist_ai_interaction(
                db,
                result=info_result,
                doctor_id=user.id,
                patient_id=resolved_patient_id,
            )
        )
    except AIOrchestratorError:
        pass

    try:
        rx_result = await ai_orchestrator.prescription_suggestions(
            {
                **subject_tokens,
                "query": anonymized_query_input,
                "notes": _anonymize_named_entities(
                    payload.notes or "",
                    [full_name, profile.first_name, profile.last_name],
                    alias="[patient]",
                ),
                "record_context": {
                    "conditions": summary_conditions[:12],
                    "medications": summary_medications[:12],
                    "allergies": summary_allergies[:12],
                    "risk_flags": summary_risk_flags[:12],
                    "family_history": summary_family_history[:12],
                },
                "retrieved_knowledge": rag_context,
            },
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
        ai_generated = True
        tests.extend(
            [
                {
                    "name": str(item.get("test_name", "")),
                    "confidence": float(item.get("confidence") or 0.68),
                }
                for item in rx_result.validated_output.get("tests", [])
                if isinstance(item, dict) and item.get("test_name")
            ]
        )
        medications.extend(
            [
                {
                    "name": str(item.get("medicine_name", "")),
                    "confidence": float(item.get("confidence") or 0.66),
                }
                for item in rx_result.validated_output.get("medications", [])
                if isinstance(item, dict) and item.get("medicine_name")
            ]
        )
        interaction_ids.append(
            await _persist_ai_interaction(
                db,
                result=rx_result,
                doctor_id=user.id,
                patient_id=resolved_patient_id,
            )
        )
    except AIOrchestratorError:
        pass

    local_conditions = _build_local_condition_suggestions(summary_conditions, contextual_query_input)
    local_tests = _build_local_test_suggestions(contextual_query_input, summary_conditions, summary_risk_flags)
    local_medications = _build_local_medication_suggestions(summary_medications, contextual_query_input)
    local_cautions = _build_local_cautions(summary_allergies, summary_risk_flags)

    conditions = _merge_named_confidence_lists(conditions, local_conditions)
    tests = _merge_named_confidence_lists(tests, local_tests)
    medications = _merge_named_confidence_lists(medications, local_medications)
    tests = await _ground_suggestions_to_catalog(
        db,
        suggestions=tests,
        kind="test",
        limit=8,
    )
    medications = await _ground_suggestions_to_catalog(
        db,
        suggestions=medications,
        kind="medication",
        limit=8,
    )
    if not tests:
        tests = [{"name": name, "confidence": 0.62} for name in rag_context.get("test_catalog_matches", [])[:6]]
    if not medications:
        medications = [{"name": name, "confidence": 0.62} for name in rag_context.get("medicine_catalog_matches", [])[:6]
        ]

    if answer.strip() == "No clinical insights available right now.":
        answer = _build_local_clinical_answer(
            query=payload.query,
            conditions=summary_conditions,
            medications=summary_medications,
            allergies=summary_allergies,
            risk_flags=summary_risk_flags,
            family_history=summary_family_history,
        )
        ai_generated = True
    elif _looks_like_privacy_refusal(answer):
        answer = _build_local_clinical_answer(
            query=payload.query,
            conditions=summary_conditions,
            medications=summary_medications,
            allergies=summary_allergies,
            risk_flags=summary_risk_flags,
            family_history=summary_family_history,
        )
        ai_generated = True

    if not cautions:
        cautions = local_cautions

    return AIClinicalInfoResponse(
        ai_generated=ai_generated,
        interaction_ids=interaction_ids,
        answer=answer,
        suggested_conditions=conditions,
        suggested_tests=tests,
        suggested_medications=medications,
        cautions=cautions,
    )


@router.post("/voice-to-notes", response_model=AIVoiceToNotesResponse)
async def voice_to_notes(
    payload: AIVoiceToNotesRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user.id)
    resolved_patient_id = await _resolve_patient_identifier_for_doctor(
        db,
        doctor_id=user.id,
        patient_identifier=payload.patient_id,
    )
    access = await check_doctor_patient_access(db, user.id, resolved_patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))
    await _require_doctor_patient_ai_permissions(
        db,
        doctor_id=user.id,
        patient_id=resolved_patient_id,
    )

    try:
        result = await ai_orchestrator.generate_soap_notes(
            payload.transcript,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
        interaction_id = await _persist_ai_interaction(
            db,
            result=result,
            doctor_id=user.id,
            patient_id=resolved_patient_id,
        )
        soap = result.validated_output
    except AIOrchestratorError:
        interaction_id = None
        soap = {
            "subjective": [payload.transcript],
            "objective": [],
            "assessment": [],
            "plan": [],
        }

    formatted = "\n".join(
        [
            "S:",
            *[f"- {line}" for line in soap.get("subjective", [])],
            "",
            "O:",
            *[f"- {line}" for line in soap.get("objective", [])],
            "",
            "A:",
            *[f"- {line}" for line in soap.get("assessment", [])],
            "",
            "P:",
            *[f"- {line}" for line in soap.get("plan", [])],
        ]
    ).strip()

    return AIVoiceToNotesResponse(
        interaction_id=interaction_id,
        soap_notes=soap,
        formatted_notes=formatted,
    )
