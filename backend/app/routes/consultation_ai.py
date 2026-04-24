import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.ai_interaction import AIFeedback, AIInteraction
from app.db.models.consultation import Consultation
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole
from app.db.models.patient import PatientProfile
from app.db.models.patient_data_sharing import PatientDataSharingPreference, SHARING_CATEGORY_FIELDS
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.ai_orchestrator import (
    AIClinicalQueryRequest,
    AIFeedbackRequest,
    AIInteractionResponse,
    AIPatientSummaryRequest,
    AIPrescriptionSuggestionsRequest,
    AISafetyCheckRequest,
    AISafetyCheckResponse,
    AISOAPNotesRequest,
    AIStructureIntakeRequest,
)
from app.services.ai_orchestrator import (
    AIExecutionResult,
    AIOrchestratorError,
    ai_orchestrator,
)

router = APIRouter()


async def _require_doctor(db: AsyncSession, user) -> Profile:
    """Validate doctor role using the profile cached on user (from auth dep)."""
    profile = getattr(user, "profile", None)
    if profile is None:
        result = await db.execute(select(Profile).where(Profile.id == user.id))
        profile = result.scalar_one_or_none()
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access this resource")
    return profile


async def _get_doctor_consultation(db: AsyncSession, consultation_id: str, doctor_id: str) -> Consultation:
    result = await db.execute(
        select(Consultation).where(
            Consultation.id == consultation_id,
            Consultation.doctor_id == doctor_id,
        )
    )
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return consultation


async def _require_consultation_ai_permissions(db: AsyncSession, consultation: Consultation) -> None:
    doctor_ai_result = await db.execute(
        select(DoctorProfile.ai_assistance).where(DoctorProfile.profile_id == consultation.doctor_id)
    )
    doctor_ai_assistance = doctor_ai_result.scalar_one_or_none()
    if doctor_ai_assistance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    if not doctor_ai_assistance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor has disabled Chorui AI assistance.",
        )

    patient_ai_result = await db.execute(
        select(
            PatientProfile.consent_ai,
            PatientProfile.ai_personal_context_enabled,
        ).where(PatientProfile.profile_id == consultation.patient_id)
    )
    patient_ai_row = patient_ai_result.first()
    if patient_ai_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient medical profile not found")
    legacy_consent = bool(patient_ai_row[0]) if patient_ai_row[0] is not None else False
    personal_context_enabled = legacy_consent if patient_ai_row[1] is None else bool(patient_ai_row[1])
    if not personal_context_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has disabled Chorui AI personal-context sharing.",
        )

    sharing_result = await db.execute(
        select(PatientDataSharingPreference).where(
            PatientDataSharingPreference.patient_id == consultation.patient_id,
            PatientDataSharingPreference.doctor_id == consultation.doctor_id,
        )
    )
    sharing_pref = sharing_result.scalar_one_or_none()
    view_fields = [field for field in SHARING_CATEGORY_FIELDS if field != "can_use_ai"]
    has_any_shared_category = bool(
        sharing_pref and any(bool(getattr(sharing_pref, field, False)) for field in view_fields)
    )
    if not has_any_shared_category:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has not shared any personal information categories for Chorui AI.",
        )


def _build_interaction_response(interaction: AIInteraction) -> AIInteractionResponse:
    return AIInteractionResponse(
        interaction_id=interaction.id,
        feature=interaction.feature,
        output=interaction.validated_output or {},
        validation_status=interaction.validation_status,
        provider=interaction.provider,
        latency_ms=interaction.latency_ms,
    )


async def _persist_interaction(
    *,
    db: AsyncSession,
    consultation: Consultation,
    result: AIExecutionResult,
    doctor_action: str | None = None,
) -> AIInteraction:
    interaction = AIInteraction(
        id=str(uuid.uuid4()),
        feature=result.feature,
        prompt_version=result.prompt_version,
        sanitized_input=result.sanitized_input,
        raw_output=result.raw_output,
        validated_output=result.validated_output,
        validation_status=result.validation_status,
        doctor_action=doctor_action,
        doctor_id=consultation.doctor_id,
        patient_id=consultation.patient_id,
        latency_ms=result.latency_ms,
        provider=result.provider,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return interaction


async def _persist_failed_interaction(
    *,
    db: AsyncSession,
    consultation: Consultation,
    feature: str,
    prompt_version: str,
    sanitized_input: dict[str, Any],
) -> AIInteraction:
    interaction = AIInteraction(
        id=str(uuid.uuid4()),
        feature=feature,
        prompt_version=prompt_version,
        sanitized_input=sanitized_input,
        raw_output=None,
        validated_output=None,
        validation_status="failed",
        doctor_action=None,
        doctor_id=consultation.doctor_id,
        patient_id=consultation.patient_id,
        latency_ms=None,
        provider=ai_orchestrator.provider,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return interaction


def _safe_sanitized_input(payload: Any, mode: str) -> dict[str, Any]:
    try:
        if mode == "structured":
            return ai_orchestrator._sanitize_structured_input(payload)
        if mode == "transcript":
            return {"transcript": ai_orchestrator._sanitize_text(str(payload))}
        if mode == "query":
            return {"query": ai_orchestrator._sanitize_text(str(payload))}
    except Exception:
        return {}
    return {}


@router.post("/{consultation_id}/ai/patient-summary", response_model=AIInteractionResponse)
async def ai_patient_summary(
    consultation_id: str,
    payload: AIPatientSummaryRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    try:
        result = await ai_orchestrator.generate_patient_summary(
            payload.data,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
    except AIOrchestratorError as exc:
        await _persist_failed_interaction(
            db=db,
            consultation=consultation,
            feature="generate_patient_summary",
            prompt_version=payload.prompt_version,
            sanitized_input=_safe_sanitized_input(payload.data, "structured"),
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    interaction = await _persist_interaction(db=db, consultation=consultation, result=result)
    return _build_interaction_response(interaction)


@router.post("/{consultation_id}/ai/intake-structure", response_model=AIInteractionResponse)
async def ai_structure_intake(
    consultation_id: str,
    payload: AIStructureIntakeRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    try:
        result = await ai_orchestrator.structure_intake(
            payload.data,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
    except AIOrchestratorError as exc:
        await _persist_failed_interaction(
            db=db,
            consultation=consultation,
            feature="structure_intake",
            prompt_version=payload.prompt_version,
            sanitized_input=_safe_sanitized_input(payload.data, "structured"),
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    interaction = await _persist_interaction(db=db, consultation=consultation, result=result)
    return _build_interaction_response(interaction)


@router.post("/{consultation_id}/ai/soap-notes", response_model=AIInteractionResponse)
async def ai_generate_soap_notes(
    consultation_id: str,
    payload: AISOAPNotesRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    try:
        result = await ai_orchestrator.generate_soap_notes(
            payload.transcript,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
    except AIOrchestratorError as exc:
        await _persist_failed_interaction(
            db=db,
            consultation=consultation,
            feature="generate_soap_notes",
            prompt_version=payload.prompt_version,
            sanitized_input=_safe_sanitized_input(payload.transcript, "transcript"),
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    interaction = await _persist_interaction(db=db, consultation=consultation, result=result)
    return _build_interaction_response(interaction)


@router.post("/{consultation_id}/ai/clinical-query", response_model=AIInteractionResponse)
async def ai_clinical_query(
    consultation_id: str,
    payload: AIClinicalQueryRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    try:
        result = await ai_orchestrator.clinical_info_query(
            payload.query,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
    except AIOrchestratorError as exc:
        await _persist_failed_interaction(
            db=db,
            consultation=consultation,
            feature="clinical_info_query",
            prompt_version=payload.prompt_version,
            sanitized_input=_safe_sanitized_input(payload.query, "query"),
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    interaction = await _persist_interaction(db=db, consultation=consultation, result=result)
    return _build_interaction_response(interaction)


@router.post("/{consultation_id}/ai/prescription-suggestions", response_model=AIInteractionResponse)
async def ai_prescription_suggestions(
    consultation_id: str,
    payload: AIPrescriptionSuggestionsRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    try:
        result = await ai_orchestrator.prescription_suggestions(
            payload.data,
            include_meta=True,
            prompt_version=payload.prompt_version,
        )
    except AIOrchestratorError as exc:
        await _persist_failed_interaction(
            db=db,
            consultation=consultation,
            feature="prescription_suggestions",
            prompt_version=payload.prompt_version,
            sanitized_input=_safe_sanitized_input(payload.data, "structured"),
        )
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    interaction = await _persist_interaction(db=db, consultation=consultation, result=result)
    return _build_interaction_response(interaction)


@router.post("/{consultation_id}/ai/feedback")
async def ai_feedback(
    consultation_id: str,
    payload: AIFeedbackRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)

    result = await db.execute(
        select(AIInteraction).where(
            AIInteraction.id == payload.ai_interaction_id,
            AIInteraction.doctor_id == user.id,
            AIInteraction.patient_id == consultation.patient_id,
        )
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI interaction not found")

    feedback = AIFeedback(
        id=str(uuid.uuid4()),
        ai_interaction_id=interaction.id,
        rating=payload.rating,
        correction_text=payload.correction_text,
    )
    db.add(feedback)

    if payload.doctor_action:
        interaction.doctor_action = payload.doctor_action

    await db.commit()

    return {"message": "Feedback submitted successfully", "ai_interaction_id": interaction.id}


@router.post("/{consultation_id}/safety-check", response_model=AISafetyCheckResponse)
async def consultation_safety_check(
    consultation_id: str,
    payload: AISafetyCheckRequest,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    consultation = await _get_doctor_consultation(db, consultation_id, user.id)
    await _require_consultation_ai_permissions(db, consultation)

    issues: list[str] = []
    status_label = "safe"

    note_text = payload.notes.lower().strip()
    allergies = [entry.strip().lower() for entry in payload.allergies if entry.strip()]
    planned_meds = [entry.strip().lower() for entry in payload.planned_medications if entry.strip()]

    for med in planned_meds:
        for allergy in allergies:
            token = allergy.split(" ")[0]
            if token and token in med:
                issues.append(f"Potential allergy conflict detected: {med} vs {allergy}")
                status_label = "blocked"

    if len(note_text) < 40 and status_label != "blocked":
        issues.append("Clinical notes are too brief. Add minimum assessment and plan details.")
        status_label = "warning"

    high_risk_keywords = ["chest pain", "anaphylaxis", "seizure", "stroke", "suicidal", "severe bleeding"]
    if any(keyword in note_text for keyword in high_risk_keywords) and status_label == "safe":
        issues.append("High-risk symptom terms detected. Confirm emergency protocol and referral notes.")
        status_label = "warning"

    override_required = status_label == "warning"
    if status_label == "warning" and payload.override_reason and payload.override_reason.strip():
        override_required = False

    return AISafetyCheckResponse(
        status=status_label,
        issues=issues,
        override_required=override_required,
    )
