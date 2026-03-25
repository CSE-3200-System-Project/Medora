import uuid
from typing import Any
from datetime import datetime, timedelta
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.db.models.ai_interaction import AIInteraction
from app.db.models.chorui_chat import ChoruiChatMessage
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.patient_access import AccessType
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.db.models.consultation import Consultation, Prescription
from app.db.models.enums import UserRole
from app.routes.auth import get_current_user_token
from app.routes.patient_access import check_doctor_patient_access, log_patient_access
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
    ChoruiIntakeSaveRequest,
    ChoruiIntakeSaveResponse,
)
from app.services.ai_orchestrator import AIExecutionResult, AIOrchestratorError, ai_orchestrator

router = APIRouter()


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


async def _require_doctor(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access this resource")


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

    return {
        "conditions": conditions,
        "medications": medications,
        "allergies": allergies,
        "risk_flags": risk_flags,
        "history": {
            "surgeries": patient.surgeries if isinstance(patient.surgeries, list) else [],
            "hospitalizations": patient.hospitalizations if isinstance(patient.hospitalizations, list) else [],
            "drug_allergies": patient.drug_allergies if isinstance(patient.drug_allergies, list) else [],
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
    if requested in {"doctor", "patient"}:
        return requested
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
) -> ChoruiAssistantResponse:
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
    )


def _message_has_any(normalized: str, keys: tuple[str, ...]) -> bool:
    return any(key in normalized for key in keys)


def _is_medical_decision_request(normalized: str) -> bool:
    restricted_terms = (
        "prescribe",
        "prescription",
        "dosage",
        "dose",
        "diagnose",
        "diagnosis",
        "confirm diagnosis",
        "treatment plan",
        "what should i take",
        "which medicine should",
        "emergency treatment",
    )
    return _message_has_any(normalized, restricted_terms)


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
    patient_list_keys = (
        "who are my patients",
        "my patients",
        "patient list",
        "active patients",
    )
    condition_keys = ("condition", "conditions", "disease", "diagnosis")
    allergy_keys = ("allergy", "allergies", "allergic")
    risk_keys = ("risk", "risk flags", "high risk")
    history_keys = ("history", "surgeries", "surgery", "hospitalization", "hospitalizations")
    summary_keys = ("summary", "summarize", "overview", "snapshot")
    appointment_keys = ("appointment", "appointments", "next visit", "upcoming")
    schedule_keys = ("schedule", "today", "this week")

    if role == UserRole.DOCTOR and any(key in normalized for key in patient_list_keys):
        return "doctor_active_patients"

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


def _format_status_label(status_value: Any) -> str:
    if hasattr(status_value, "value"):
        return str(status_value.value)
    return str(status_value)


def _build_patient_summary_text(*, conditions: list[str], medications: list[str], allergies: list[str], risk_flags: list[str]) -> str:
    sections: list[str] = ["Here is a structured summary from authorized Medora records:"]

    sections.append("\nConditions:")
    sections.append(_render_bullet_list(conditions[:10]) if conditions else "- No condition entries found")

    sections.append("\nMedications:")
    sections.append(_render_bullet_list(medications[:10]) if medications else "- No medication entries found")

    sections.append("\nAllergies:")
    sections.append(_render_bullet_list(allergies[:10]) if allergies else "- No allergy entries found")

    if risk_flags:
        sections.append("\nRisk Flags:")
        sections.append(_render_bullet_list(risk_flags[:10]))

    sections.append("\nThis summary is assistive and should be clinically verified before decisions.")
    return "\n".join(sections)


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


def _build_local_clinical_answer(
    *,
    query: str,
    conditions: list[str],
    medications: list[str],
    allergies: list[str],
    risk_flags: list[str],
) -> str:
    sections: list[str] = [
        "Record-grounded pre-consultation snapshot (strict local mode):",
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
    access = await check_doctor_patient_access(db, user.id, patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

    if settings.CHORUI_PRIVACY_MODE.strip().lower() != "strict_local":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Assistant summary is restricted to strict local privacy mode")

    await log_patient_access(
        db,
        patient_id=patient_id,
        doctor_id=user.id,
        access_type=AccessType.VIEW_AI_QUERY,
        request=request,
    )

    profile, patient = await _get_patient_context(db, patient_id)
    raw_summary = _build_raw_summary(profile, patient)
    conditions = _safe_list(raw_summary.get("conditions"))
    medications = _safe_list(raw_summary.get("medications"))
    allergies = _safe_list(raw_summary.get("allergies"))
    risk_flags = _safe_list(raw_summary.get("risk_flags"))
    history_data = raw_summary.get("history") if isinstance(raw_summary, dict) else {}
    surgeries = _safe_list((history_data or {}).get("surgeries"))
    hospitalizations = _safe_list((history_data or {}).get("hospitalizations"))

    appointments_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(CHORUI_ACTIVE_APPOINTMENT_STATUSES),
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(8)
    )
    appointments = appointments_result.scalars().all()
    prior_doctors = await _get_patient_prior_doctors(db, patient_id=patient_id, current_doctor_id=user.id)

    timeline = [
        {
            "date": _format_datetime_label(item.appointment_date),
            "status": _status_value(item.status),
            "reason": str(item.reason or ""),
            "doctor_scope": "you" if item.doctor_id == user.id else "other",
        }
        for item in appointments
    ]

    summary = {
        "patient_snapshot": {
            "name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient",
            "gender": profile.gender,
            "blood_group": patient.blood_group,
        },
        "clinical_context": {
            "conditions": conditions,
            "medications": medications,
            "allergies": allergies,
            "risk_flags": risk_flags,
            "surgeries": surgeries,
            "hospitalizations": hospitalizations,
        },
        "care_continuity": {
            "recent_appointments": timeline,
            "prior_doctors": prior_doctors,
        },
        "pre_consultation_checklist": _build_missing_info_checklist(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            surgeries=surgeries,
        ),
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
        privacy_mode="strict_local",
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

    if settings.CHORUI_PRIVACY_MODE.strip().lower() != "strict_local":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Assistant summary is restricted to strict local privacy mode")

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

    return AIPatientPrescriptionExplainerResponse(
        ai_generated=True,
        summary=summary,
        highlight_points=highlights,
        cautions=cautions,
        privacy_mode="strict_local",
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
) -> tuple[str | None, dict[str, Any] | None, str]:
    if role == UserRole.PATIENT:
        profile, patient = await _get_patient_context(db, user_id)
        return user_id, _build_raw_summary(profile, patient), "patient-self"

    if role == UserRole.DOCTOR:
        if payload_patient_id:
            access = await check_doctor_patient_access(db, user_id, payload_patient_id)
            if not access.get("allowed"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=access.get("reason", "Access denied"),
                )
            profile, patient = await _get_patient_context(db, payload_patient_id)
            return payload_patient_id, _build_raw_summary(profile, patient), "doctor-patient"
        return None, None, "doctor-general"

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Chorui assistant is available for patient and doctor accounts only",
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

    target_patient_id, patient_context, context_mode = await _resolve_assistant_context(
        db=db,
        user_id=user.id,
        role=role,
        payload_patient_id=payload.patient_id,
    )

    role_context = _default_role_context(role, payload.role_context)
    conversation_id = await _resolve_conversation_id(
        db,
        user_id=user.id,
        requested_conversation_id=payload.conversation_id,
        role_context=role_context,
        patient_id=target_patient_id,
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
    if intent == "general" and _is_followup_message(normalized_message):
        previous_intent = await _get_last_non_general_user_intent(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
        )
        if previous_intent:
            intent = previous_intent
    medications = _safe_list((patient_context or {}).get("medications"))
    conditions = _safe_list((patient_context or {}).get("conditions"))
    allergies = _safe_list((patient_context or {}).get("allergies"))
    risk_flags = _safe_list((patient_context or {}).get("risk_flags"))
    history_data = (patient_context or {}).get("history") if isinstance(patient_context, dict) else {}
    surgeries = _safe_list((history_data or {}).get("surgeries"))
    hospitalizations = _safe_list((history_data or {}).get("hospitalizations"))
    symptom_hints = _extract_symptom_hints(payload.message)
    severity_hint = _extract_severity_hint(payload.message)
    duration_hint = _extract_duration_hint(payload.message)
    structured_data: dict[str, Any] = {
        "symptoms": symptom_hints,
        "conditions": conditions,
        "duration": duration_hint,
        "severity": severity_hint,
    }

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

    if role == UserRole.PATIENT and intent == "patient_self_summary":
        reply = _build_patient_summary_text(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            risk_flags=risk_flags,
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
                f"- {item['display_name']} (last activity: {item['last_seen'][:10] if item.get('last_seen') else 'unknown'})"
                for item in active_patients[:20]
            ]
            reply = (
                "Here are your active patients from recent appointment relationships:\n"
                f"{'\n'.join(preview_lines)}\n\n"
                "This list is access-controlled and limited to active patient relationships."
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
                f"- {_format_datetime_label(item.appointment_date)} with patient {item.patient_id} ({_format_status_label(item.status)})"
                for item in upcoming
            ]
            reply = (
                "Here is your upcoming 7-day schedule from authorized appointment records:\n"
                f"{'\n'.join(schedule_lines)}"
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
    if privacy_mode == "strict_local":
        reply = (
            "I am running in secure local retrieval mode. I can answer from authorized Medora records "
            "for medications, conditions, allergies, history, risk flags, appointments, and active patient lists. "
            "Please ask a direct records question like 'what are my allergies', 'summarize this patient', or 'who are my patients'."
        )
        recent_topics = await _get_recent_intent_topics(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
        )
        if recent_topics:
            hint = ", ".join(recent_topics[:3])
            reply = f"{reply} Recent conversation topics: {hint}."
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

    reply = (
        "I can assist with medical learning and workflow guidance. "
        "Please ask a direct records question, and always confirm clinical decisions with your doctor."
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
    access = await check_doctor_patient_access(db, user.id, patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

    profile, patient = await _get_patient_context(db, patient_id)
    raw_data = _build_raw_summary(profile, patient)

    try:
        result = await ai_orchestrator.generate_patient_summary(
            raw_data,
            include_meta=True,
            prompt_version="v1",
        )
        interaction_id = await _persist_ai_interaction(db, result=result, doctor_id=user.id, patient_id=patient_id)
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
    access = await check_doctor_patient_access(db, user.id, payload.patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

    await log_patient_access(
        db,
        patient_id=payload.patient_id,
        doctor_id=user.id,
        access_type=AccessType.VIEW_AI_QUERY,
        request=request,
    )

    profile, patient = await _get_patient_context(db, payload.patient_id)
    raw_summary = _build_raw_summary(profile, patient)
    summary_conditions = _safe_list(raw_summary.get("conditions"))
    summary_medications = _safe_list(raw_summary.get("medications"))
    summary_allergies = _safe_list(raw_summary.get("allergies"))
    summary_risk_flags = _safe_list(raw_summary.get("risk_flags"))

    query_input = payload.query
    if payload.notes:
        query_input = f"{payload.query}\n\nClinical notes:\n{payload.notes}"

    privacy_mode = settings.CHORUI_PRIVACY_MODE.strip().lower()
    if privacy_mode == "strict_local":
        return AIClinicalInfoResponse(
            ai_generated=True,
            interaction_ids=[],
            answer=_build_local_clinical_answer(
                query=payload.query,
                conditions=summary_conditions,
                medications=summary_medications,
                allergies=summary_allergies,
                risk_flags=summary_risk_flags,
            ),
            suggested_conditions=_build_local_condition_suggestions(summary_conditions, query_input),
            suggested_tests=_build_local_test_suggestions(query_input, summary_conditions, summary_risk_flags),
            suggested_medications=_build_local_medication_suggestions(summary_medications, query_input),
            cautions=_build_local_cautions(summary_allergies, summary_risk_flags),
        )

    interaction_ids: list[str] = []
    answer = "No clinical insights available right now."
    cautions: list[str] = []
    conditions: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    medications: list[dict[str, Any]] = []
    ai_generated = False

    try:
        info_result = await ai_orchestrator.clinical_info_query(
            query_input,
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
                patient_id=payload.patient_id,
            )
        )
    except AIOrchestratorError:
        pass

    try:
        rx_result = await ai_orchestrator.prescription_suggestions(
            {
                "query": payload.query,
                "notes": payload.notes or "",
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
                patient_id=payload.patient_id,
            )
        )
    except AIOrchestratorError:
        pass

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
    access = await check_doctor_patient_access(db, user.id, payload.patient_id)
    if not access.get("allowed"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=access.get("reason", "Access denied"))

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
            patient_id=payload.patient_id,
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
