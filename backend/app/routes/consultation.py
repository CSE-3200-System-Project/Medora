"""
Consultation and Prescription API routes.
Handles doctor-patient consultations and prescription management.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import ValidationError

from app.core.dependencies import get_db
from app.core.patient_reference import (
    patient_ref_from_uuid,
    resolve_doctor_patient_identifier,
)
from app.routes.auth import get_current_user_token
from app.db.models.consultation import (
    Consultation,
    ConsultationDraft,
    Prescription,
    MedicationPrescription,
    TestPrescription,
    SurgeryRecommendation,
)
from app.db.models.enums import (
    ConsultationStatus,
    PrescriptionType,
    PrescriptionStatus,
    DosageType,
    UserRole,
)
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.db.models.media_file import MediaFile
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationDraftUpdate,
    ConsultationDraftResponse,
    ConsultationResponse,
    ConsultationListResponse,
    ConsultationWithPrescriptions,
    PrescriptionCreate,
    PrescriptionResponse,
    PrescriptionListResponse,
    MedicationPrescriptionCreate,
    MedicationPrescriptionResponse,
    TestPrescriptionCreate,
    TestPrescriptionResponse,
    SurgeryRecommendationCreate,
    SurgeryRecommendationResponse,
    PrescriptionReject,
    PrescriptionFullResponse,
)
from app.schemas.upload import MediaFileResponse
from app.services.doctor_action_service import (
    create_consultation_completed_action,
    create_prescription_issued_action,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== HELPER FUNCTIONS ==========

async def get_doctor_profile(db: AsyncSession, user_id: str) -> DoctorProfile:
    """Get doctor profile and verify user is a doctor."""
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="Only doctors can access this resource")
    
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == user_id)
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    return doctor


async def get_patient_profile(db: AsyncSession, user_id: str) -> PatientProfile:
    """Get patient profile and verify user is a patient."""
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Only patients can access this resource")
    
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == user_id)
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    return patient


async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
) -> Notification:
    """Create a notification for a user."""
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=notification_type,
        priority=priority,
        title=title,
        message=message,
        action_url=action_url,
        data=metadata,
    )
    db.add(notification)
    return notification


def build_consultation_response(
    consultation: Consultation,
    doctor_profile: Optional[Profile] = None,
    patient_profile: Optional[Profile] = None,
) -> dict:
    """Build consultation response with doctor/patient info."""
    response = {
        "id": consultation.id,
        "doctor_id": consultation.doctor_id,
        "patient_id": consultation.patient_id,
        "patient_ref": patient_ref_from_uuid(consultation.patient_id),
        "appointment_id": consultation.appointment_id,
        "draft_id": consultation.draft_id,
        "chief_complaint": consultation.chief_complaint,
        "diagnosis": consultation.diagnosis,
        "notes": consultation.notes,
        "status": consultation.status.value if consultation.status else "open",
        "consultation_date": consultation.consultation_date,
        "completed_at": consultation.completed_at,
        "created_at": consultation.created_at,
    }
    
    if doctor_profile:
        response["doctor_name"] = f"{doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip()
        response["doctor_photo"] = getattr(doctor_profile, 'profile_photo_url', None)
        response["doctor_specialization"] = None  # Will fetch from DoctorProfile if needed
    
    if patient_profile:
        response["patient_name"] = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip()
        response["patient_photo"] = getattr(patient_profile, 'profile_photo_url', None)
    
    return response


def build_prescription_response(
    prescription: Prescription,
    doctor_profile: Optional[Profile] = None,
    include_snapshot: bool = False,
) -> dict:
    """Build prescription response with all items."""
    response = {
        "id": prescription.id,
        "consultation_id": prescription.consultation_id,
        "doctor_id": prescription.doctor_id,
        "patient_id": prescription.patient_id,
        "patient_ref": patient_ref_from_uuid(prescription.patient_id),
        "type": prescription.type.value if prescription.type else "medication",
        "status": prescription.status.value if prescription.status else "pending",
        "rejection_reason": prescription.rejection_reason,
        "notes": prescription.notes,
        "created_at": prescription.created_at,
        "accepted_at": prescription.accepted_at,
        "rejected_at": prescription.rejected_at,
        "added_to_history": prescription.added_to_history,
        "rendered_prescription_html": prescription.rendered_prescription_html,
        "rendered_prescription_generated_at": prescription.rendered_prescription_generated_at,
        "medications": [],
        "tests": [],
        "surgeries": [],
    }

    if include_snapshot:
        response["rendered_prescription_snapshot"] = _normalize_prescription_snapshot_payload(
            prescription.rendered_prescription_snapshot
        )
    
    if doctor_profile:
        response["doctor_name"] = f"{doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip()
        response["doctor_photo"] = None  # Not available in this context
        response["doctor_specialization"] = None  # Not available in this context
    
    # Add medications
    if prescription.medications:
        for med in prescription.medications:
            response["medications"].append({
                "id": med.id,
                "prescription_id": med.prescription_id,
                "medicine_name": med.medicine_name,
                "generic_name": med.generic_name,
                "medicine_type": med.medicine_type.value if med.medicine_type else "tablet",
                "strength": med.strength,
                "dose_morning": med.dose_morning,
                "dose_afternoon": med.dose_afternoon,
                "dose_evening": med.dose_evening,
                "dose_night": med.dose_night,
                "dose_morning_amount": med.dose_morning_amount,
                "dose_afternoon_amount": med.dose_afternoon_amount,
                "dose_evening_amount": med.dose_evening_amount,
                "dose_night_amount": med.dose_night_amount,
                "frequency_per_day": med.frequency_per_day,
                "dosage_type": med.dosage_type.value if med.dosage_type else None,
                "dosage_pattern": med.dosage_pattern,
                "frequency_text": med.frequency_text,
                "duration_value": med.duration_value,
                "duration_unit": med.duration_unit.value if med.duration_unit else "days",
                "meal_instruction": med.meal_instruction.value if med.meal_instruction else "after_meal",
                "special_instructions": med.special_instructions,
                "start_date": med.start_date,
                "end_date": med.end_date,
                "quantity": med.quantity,
                "refills": med.refills,
                "created_at": med.created_at,
            })
    
    # Add tests
    if prescription.tests:
        for test in prescription.tests:
            response["tests"].append({
                "id": test.id,
                "prescription_id": test.prescription_id,
                "test_name": test.test_name,
                "test_type": test.test_type,
                "instructions": test.instructions,
                "urgency": test.urgency.value if test.urgency else "normal",
                "preferred_lab": test.preferred_lab,
                "expected_date": test.expected_date,
                "created_at": test.created_at,
            })
    
    # Add surgeries
    if prescription.surgeries:
        for surgery in prescription.surgeries:
            response["surgeries"].append({
                "id": surgery.id,
                "prescription_id": surgery.prescription_id,
                "procedure_name": surgery.procedure_name,
                "procedure_type": surgery.procedure_type,
                "reason": surgery.reason,
                "urgency": surgery.urgency.value if surgery.urgency else "scheduled",
                "recommended_date": surgery.recommended_date,
                "estimated_cost_min": surgery.estimated_cost_min,
                "estimated_cost_max": surgery.estimated_cost_max,
                "pre_op_instructions": surgery.pre_op_instructions,
                "notes": surgery.notes,
                "preferred_facility": surgery.preferred_facility,
                "created_at": surgery.created_at,
            })
    
    return response


def _calculate_age(date_of_birth) -> Optional[int]:
    if not date_of_birth:
        return None

    today = datetime.now(timezone.utc).date()
    age = today.year - date_of_birth.year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        age -= 1
    return age


def _duration_text(duration_value: Optional[int], duration_unit: Optional[Any]) -> Optional[str]:
    if not duration_value:
        return None

    unit = duration_unit.value if hasattr(duration_unit, "value") else str(duration_unit or "days")
    return f"{duration_value} {unit}"


def _frequency_text_from_count(frequency_per_day: Optional[int]) -> Optional[str]:
    if not frequency_per_day:
        return None

    frequency_map = {
        1: "Once daily",
        2: "Twice daily",
        3: "Three times daily",
        4: "Four times daily",
    }
    return frequency_map.get(frequency_per_day, f"{frequency_per_day} times daily")


def _route_from_medicine_type(medicine_type: Optional[Any]) -> Optional[str]:
    if not medicine_type:
        return None

    value = medicine_type.value if hasattr(medicine_type, "value") else str(medicine_type)
    route_map = {
        "tablet": "Oral",
        "capsule": "Oral",
        "syrup": "Oral",
        "powder": "Oral",
        "injection": "Injection",
        "drops": "Drops",
        "inhaler": "Inhalation",
        "cream": "Topical",
        "ointment": "Topical",
        "gel": "Topical",
        "suppository": "Rectal",
        "patch": "Transdermal",
    }
    return route_map.get(value, value.replace("_", " ").title())


def _derive_dosage_mode(medication: MedicationPrescription) -> tuple[DosageType, Optional[str], Optional[str]]:
    if medication.dosage_type == DosageType.PATTERN and medication.dosage_pattern:
        return DosageType.PATTERN, medication.dosage_pattern, medication.frequency_text

    if medication.dosage_type == DosageType.FREQUENCY and medication.frequency_text:
        return DosageType.FREQUENCY, medication.dosage_pattern, medication.frequency_text

    if medication.dosage_pattern:
        return DosageType.PATTERN, medication.dosage_pattern, medication.frequency_text

    if medication.frequency_text:
        return DosageType.FREQUENCY, medication.dosage_pattern, medication.frequency_text

    morning = medication.dose_morning_amount or "1"
    afternoon = medication.dose_afternoon_amount or "1"
    evening = medication.dose_evening_amount or "1"
    night = medication.dose_night_amount or "1"

    morning_value = morning if medication.dose_morning else "0"
    afternoon_value = afternoon if medication.dose_afternoon else "0"
    # Use evening as the third slot. If evening is empty but night exists, reuse night there.
    evening_slot_value = evening if medication.dose_evening else (night if medication.dose_night else "0")

    if medication.dose_morning or medication.dose_afternoon or medication.dose_evening or medication.dose_night:
        return DosageType.PATTERN, f"{morning_value}-{afternoon_value}-{evening_slot_value}", None

    fallback_frequency = _frequency_text_from_count(medication.frequency_per_day)
    if fallback_frequency:
        return DosageType.FREQUENCY, None, fallback_frequency

    return DosageType.FREQUENCY, None, None


def _build_doctor_address(doctor: DoctorProfile) -> Optional[str]:
    if doctor.chamber_name and doctor.chamber_address:
        return f"{doctor.chamber_name}, {doctor.chamber_address}"
    if doctor.hospital_name and doctor.hospital_address:
        return f"{doctor.hospital_name}, {doctor.hospital_address}"
    return doctor.chamber_address or doctor.hospital_address


def _build_doctor_chamber_info(doctor: DoctorProfile) -> Optional[str]:
    if doctor.chamber_name and doctor.chamber_address:
        return f"{doctor.chamber_name}, {doctor.chamber_address}"
    if doctor.chamber_name:
        return doctor.chamber_name
    return doctor.chamber_address


def _build_profile_name(profile: Optional[Profile]) -> Optional[str]:
    if not profile:
        return None

    full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip()
    return full_name or None


def _build_doctor_identity_snapshot(
    doctor_profile: Optional[Profile],
    doctor_details: Optional[DoctorProfile],
) -> dict[str, Any]:
    base_name = _build_profile_name(doctor_profile)
    display_name = base_name
    if base_name and doctor_details and doctor_details.title:
        display_name = f"{doctor_details.title} {base_name}".strip()

    return {
        "name": display_name,
        "specialization": doctor_details.specialization if doctor_details else None,
        "qualification": (
            (doctor_details.qualifications or doctor_details.degree)
            if doctor_details
            else None
        ),
        "chamber_info": _build_doctor_chamber_info(doctor_details) if doctor_details else None,
    }


def _build_patient_identity_snapshot(
    patient_profile: Optional[Profile],
    patient_details: Optional[PatientProfile],
) -> dict[str, Any]:
    return {
        "name": _build_profile_name(patient_profile),
        "age": _calculate_age(patient_details.date_of_birth) if patient_details else None,
        "gender": patient_details.gender if patient_details else None,
        "blood_group": patient_details.blood_group if patient_details else None,
    }


def _meal_instruction_text(meal_instruction: Optional[Any]) -> Optional[str]:
    if not meal_instruction:
        return None

    value = meal_instruction.value if hasattr(meal_instruction, "value") else str(meal_instruction)
    labels = {
        "before_meal": "Before meal",
        "after_meal": "After meal",
        "with_meal": "With meal",
        "empty_stomach": "Empty stomach",
        "any_time": "Any time",
    }
    return labels.get(value, value.replace("_", " ").title())


def _safe_list_from_draft(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list):
        return []

    return [item for item in value if isinstance(item, dict)]


def _normalize_optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _normalize_optional_date_like(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _parse_optional_iso_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        normalized = text.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _normalize_prescription_snapshot_payload(raw_payload: Any) -> Optional[dict[str, Any]]:
    if not isinstance(raw_payload, dict):
        return None

    try:
        snapshot = PrescriptionFullResponse.model_validate(raw_payload)
    except ValidationError:
        return None

    normalized = snapshot.model_dump(mode="json")
    normalized.pop("data_source", None)
    normalized.pop("snapshot_generated_at", None)
    return normalized


def _latest_prescription_snapshot_for_consultation(
    consultation: Consultation,
) -> tuple[Optional[dict[str, Any]], Optional[datetime]]:
    prescriptions = sorted(
        consultation.prescriptions or [],
        key=lambda prescription: prescription.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    for prescription in prescriptions:
        normalized = _normalize_prescription_snapshot_payload(
            prescription.rendered_prescription_snapshot
        )
        if normalized:
            return normalized, prescription.rendered_prescription_generated_at

    return None, None


def _normalize_draft_medication_item(item: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = dict(item)

    medicine_name = _normalize_optional_text(
        normalized.get("medicine_name")
        or normalized.get("name")
        or normalized.get("medication_name")
    )
    if not medicine_name:
        return None

    normalized["medicine_name"] = medicine_name
    normalized["generic_name"] = _normalize_optional_text(normalized.get("generic_name"))
    normalized["strength"] = _normalize_optional_text(normalized.get("strength"))
    normalized["dosage_pattern"] = _normalize_optional_text(normalized.get("dosage_pattern"))
    normalized["frequency_text"] = _normalize_optional_text(normalized.get("frequency_text"))
    normalized["special_instructions"] = _normalize_optional_text(normalized.get("special_instructions"))
    normalized["start_date"] = _normalize_optional_date_like(normalized.get("start_date"))
    normalized["end_date"] = _normalize_optional_date_like(normalized.get("end_date"))
    return normalized


def _normalize_draft_test_item(item: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = dict(item)

    test_name = _normalize_optional_text(
        normalized.get("test_name")
        or normalized.get("name")
    )
    if not test_name:
        return None

    normalized["test_name"] = test_name
    normalized["test_type"] = _normalize_optional_text(normalized.get("test_type"))
    normalized["instructions"] = _normalize_optional_text(normalized.get("instructions"))
    normalized["preferred_lab"] = _normalize_optional_text(normalized.get("preferred_lab"))
    normalized["expected_date"] = _normalize_optional_date_like(normalized.get("expected_date"))
    return normalized


def _normalize_draft_surgery_item(item: dict[str, Any]) -> Optional[dict[str, Any]]:
    normalized = dict(item)

    procedure_name = _normalize_optional_text(
        normalized.get("procedure_name")
        or normalized.get("name")
    )
    if not procedure_name:
        return None

    normalized["procedure_name"] = procedure_name
    normalized["procedure_type"] = _normalize_optional_text(normalized.get("procedure_type"))
    normalized["reason"] = _normalize_optional_text(normalized.get("reason"))
    normalized["pre_op_instructions"] = _normalize_optional_text(normalized.get("pre_op_instructions"))
    normalized["notes"] = _normalize_optional_text(normalized.get("notes"))
    normalized["preferred_facility"] = _normalize_optional_text(normalized.get("preferred_facility"))
    normalized["recommended_date"] = _normalize_optional_date_like(normalized.get("recommended_date"))
    return normalized


def _normalize_consultation_draft_payload(raw_payload: Any) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        return {}

    payload = dict(raw_payload)

    for text_key in ("chief_complaint", "diagnosis", "notes", "prescription_notes"):
        payload[text_key] = _normalize_optional_text(payload.get(text_key))

    prescription_type = payload.get("prescription_type")
    if prescription_type not in {item.value for item in PrescriptionType}:
        payload["prescription_type"] = None

    normalized_medications: list[dict[str, Any]] = []
    for medication in _safe_list_from_draft(payload, "medications"):
        normalized = _normalize_draft_medication_item(medication)
        if normalized:
            normalized_medications.append(normalized)
    payload["medications"] = normalized_medications

    normalized_tests: list[dict[str, Any]] = []
    for test in _safe_list_from_draft(payload, "tests"):
        normalized = _normalize_draft_test_item(test)
        if normalized:
            normalized_tests.append(normalized)
    payload["tests"] = normalized_tests

    normalized_surgeries: list[dict[str, Any]] = []
    for surgery in _safe_list_from_draft(payload, "surgeries"):
        normalized = _normalize_draft_surgery_item(surgery)
        if normalized:
            normalized_surgeries.append(normalized)
    payload["surgeries"] = normalized_surgeries

    payload["patient_info"] = payload.get("patient_info") if isinstance(payload.get("patient_info"), dict) else None
    payload["doctor_info"] = payload.get("doctor_info") if isinstance(payload.get("doctor_info"), dict) else None

    return payload


def _parse_int_or_none(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)

    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _derive_draft_dosage_mode(medication_data: dict[str, Any]) -> tuple[DosageType, Optional[str], Optional[str]]:
    dosage_type_raw = medication_data.get("dosage_type")
    dosage_pattern = medication_data.get("dosage_pattern")
    frequency_text = medication_data.get("frequency_text")

    if dosage_type_raw == DosageType.PATTERN.value and dosage_pattern:
        return DosageType.PATTERN, str(dosage_pattern), str(frequency_text) if frequency_text else None

    if dosage_type_raw == DosageType.FREQUENCY.value and frequency_text:
        return DosageType.FREQUENCY, str(dosage_pattern) if dosage_pattern else None, str(frequency_text)

    if dosage_pattern:
        return DosageType.PATTERN, str(dosage_pattern), str(frequency_text) if frequency_text else None

    if frequency_text:
        return DosageType.FREQUENCY, None, str(frequency_text)

    morning_amount = str(medication_data.get("dose_morning_amount") or "1")
    noon_amount = str(medication_data.get("dose_afternoon_amount") or "1")
    night_amount = str(
        medication_data.get("dose_evening_amount")
        or medication_data.get("dose_night_amount")
        or "1"
    )

    has_morning = bool(medication_data.get("dose_morning"))
    has_noon = bool(medication_data.get("dose_afternoon"))
    has_night = bool(medication_data.get("dose_evening")) or bool(medication_data.get("dose_night"))

    if has_morning or has_noon or has_night:
        pattern = f"{morning_amount if has_morning else '0'}-{noon_amount if has_noon else '0'}-{night_amount if has_night else '0'}"
        return DosageType.PATTERN, pattern, None

    fallback_frequency = _frequency_text_from_count(_parse_int_or_none(medication_data.get("frequency_per_day")))
    if fallback_frequency:
        return DosageType.FREQUENCY, None, fallback_frequency

    return DosageType.FREQUENCY, None, None


def _get_consultation_draft_payload(consultation: Consultation) -> dict[str, Any]:
    if consultation.draft and isinstance(consultation.draft.payload, dict):
        return _normalize_consultation_draft_payload(consultation.draft.payload)
    return {}


def _consultation_has_persisted_prescription_items(consultation: Consultation) -> bool:
    for prescription in consultation.prescriptions or []:
        if (prescription.medications and len(prescription.medications) > 0) or (
            prescription.tests and len(prescription.tests) > 0
        ) or (
            prescription.surgeries and len(prescription.surgeries) > 0
        ):
            return True

    return False


def _resolve_preview_data_source(consultation: Consultation) -> str:
    if consultation.draft:
        return "draft"
    if _consultation_has_persisted_prescription_items(consultation):
        return "prescription"
    return "draft"


def _build_consultation_draft_response(consultation: Consultation) -> dict[str, Any]:
    payload = _get_consultation_draft_payload(consultation)

    prescription_type = payload.get("prescription_type")
    if prescription_type not in {item.value for item in PrescriptionType}:
        prescription_type = None

    return {
        "consultation_id": consultation.id,
        "draft_id": consultation.draft_id,
        "chief_complaint": payload.get("chief_complaint", consultation.chief_complaint),
        "diagnosis": payload.get("diagnosis", consultation.diagnosis),
        "notes": payload.get("notes", consultation.notes),
        "prescription_type": prescription_type,
        "prescription_notes": payload.get("prescription_notes"),
        "medications": _safe_list_from_draft(payload, "medications"),
        "tests": _safe_list_from_draft(payload, "tests"),
        "surgeries": _safe_list_from_draft(payload, "surgeries"),
        "patient_info": payload.get("patient_info") if isinstance(payload.get("patient_info"), dict) else None,
        "doctor_info": payload.get("doctor_info") if isinstance(payload.get("doctor_info"), dict) else None,
        "updated_at": consultation.draft.updated_at if consultation.draft else consultation.updated_at,
    }


def _validate_consultation_draft_payload(raw_payload: Any) -> ConsultationDraftUpdate:
    if not isinstance(raw_payload, dict):
        raise HTTPException(status_code=400, detail="Draft payload must be a JSON object")

    try:
        return ConsultationDraftUpdate.model_validate(raw_payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid consultation draft payload",
                "errors": exc.errors(),
            },
        )


async def _resolve_consultation_by_draft_id(
    db: AsyncSession,
    draft_id: str,
) -> Optional[Consultation]:
    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.draft))
        .where(Consultation.draft_id == draft_id)
    )
    return result.scalar_one_or_none()


async def _resolve_consultation_with_draft(
    db: AsyncSession,
    consultation_id: str,
) -> Optional[Consultation]:
    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.draft))
        .where(Consultation.id == consultation_id)
    )
    return result.scalar_one_or_none()


async def _get_or_create_consultation_draft(
    db: AsyncSession,
    consultation: Consultation,
) -> ConsultationDraft:
    if consultation.draft:
        return consultation.draft

    if consultation.draft_id:
        existing_draft_result = await db.execute(
            select(ConsultationDraft).where(ConsultationDraft.id == consultation.draft_id)
        )
        existing_draft = existing_draft_result.scalar_one_or_none()
        if existing_draft:
            consultation.draft = existing_draft
            return existing_draft

        consultation.draft_id = None

    draft = ConsultationDraft(id=str(uuid.uuid4()), payload={})
    db.add(draft)
    consultation.draft = draft
    consultation.draft_id = draft.id
    return draft


async def _apply_consultation_draft_update(
    db: AsyncSession,
    consultation: Consultation,
    data: ConsultationDraftUpdate,
) -> ConsultationDraft:
    draft_record = await _get_or_create_consultation_draft(db, consultation)
    payload = _normalize_consultation_draft_payload(draft_record.payload)

    if "chief_complaint" in data.model_fields_set:
        consultation.chief_complaint = data.chief_complaint
        payload["chief_complaint"] = data.chief_complaint

    if "diagnosis" in data.model_fields_set:
        consultation.diagnosis = data.diagnosis
        payload["diagnosis"] = data.diagnosis

    if "notes" in data.model_fields_set:
        consultation.notes = data.notes
        payload["notes"] = data.notes

    if "prescription_type" in data.model_fields_set:
        payload["prescription_type"] = data.prescription_type.value if data.prescription_type else None

    if "prescription_notes" in data.model_fields_set:
        payload["prescription_notes"] = data.prescription_notes

    if "medications" in data.model_fields_set:
        normalized_medications: list[dict[str, Any]] = []
        for item in data.medications or []:
            medication_payload = item.model_dump(mode="json")
            dosage_type, dosage_pattern, frequency_text = _derive_draft_dosage_mode(medication_payload)
            medication_payload["dosage_type"] = dosage_type.value
            medication_payload["dosage_pattern"] = dosage_pattern
            medication_payload["frequency_text"] = frequency_text
            medication_payload["duration"] = _duration_text(
                _parse_int_or_none(medication_payload.get("duration_value")),
                medication_payload.get("duration_unit"),
            )
            medication_payload["route"] = _route_from_medicine_type(medication_payload.get("medicine_type"))
            normalized_medications.append(medication_payload)

        payload["medications"] = normalized_medications

    if "tests" in data.model_fields_set:
        payload["tests"] = [item.model_dump(mode="json") for item in (data.tests or [])]

    if "surgeries" in data.model_fields_set:
        payload["surgeries"] = [item.model_dump(mode="json") for item in (data.surgeries or [])]

    profiles_result = await db.execute(
        select(Profile).where(Profile.id.in_([consultation.doctor_id, consultation.patient_id]))
    )
    profiles = {profile.id: profile for profile in profiles_result.scalars().all()}

    doctor_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == consultation.doctor_id)
    )
    doctor_details = doctor_result.scalar_one_or_none()

    patient_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == consultation.patient_id)
    )
    patient_details = patient_result.scalar_one_or_none()

    payload["doctor_info"] = _build_doctor_identity_snapshot(
        profiles.get(consultation.doctor_id),
        doctor_details,
    )
    payload["patient_info"] = _build_patient_identity_snapshot(
        profiles.get(consultation.patient_id),
        patient_details,
    )

    draft_record.payload = payload
    return draft_record


# ========== CONSULTATION ROUTES (DOCTOR) ==========

@router.post("/", response_model=ConsultationResponse)
async def start_consultation(
    data: ConsultationCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new consultation with a patient.
    Only doctors can start consultations.
    """
    try:
        doctor = await get_doctor_profile(db, user.id)
        
        resolved_patient_id = await resolve_doctor_patient_identifier(
            db,
            doctor_id=user.id,
            patient_identifier=str(data.patient_id).strip(),
        )
        if not resolved_patient_id:
            raise HTTPException(status_code=404, detail="Patient not found for this doctor")

        # Verify patient exists
        result = await db.execute(
            select(PatientProfile).where(PatientProfile.profile_id == resolved_patient_id)
        )
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Check if there's an active consultation with this patient
        result = await db.execute(
            select(Consultation).where(
                and_(
                    Consultation.doctor_id == user.id,
                    Consultation.patient_id == resolved_patient_id,
                    Consultation.status == ConsultationStatus.OPEN
                )
            )
        )
        existing = result.scalars().first()  # Use first() to handle edge case of multiple rows
        if existing:
            raise HTTPException(status_code=400, detail="Active consultation already exists with this patient")
        
        # Create consultation with an initialized draft record so draft_id is always present.
        initial_draft_payload = _normalize_consultation_draft_payload(
            {
                "chief_complaint": data.chief_complaint,
                "diagnosis": None,
                "notes": data.notes,
                "prescription_type": None,
                "prescription_notes": None,
                "medications": [],
                "tests": [],
                "surgeries": [],
                "patient_info": None,
                "doctor_info": None,
            }
        )
        consultation_draft = ConsultationDraft(
            id=str(uuid.uuid4()),
            payload=initial_draft_payload,
        )

        consultation = Consultation(
            id=str(uuid.uuid4()),
            doctor_id=user.id,
            patient_id=resolved_patient_id,
            appointment_id=data.appointment_id,
            chief_complaint=data.chief_complaint,
            notes=data.notes,
            status=ConsultationStatus.OPEN,
            draft_id=consultation_draft.id,
        )
        consultation.draft = consultation_draft
        db.add(consultation_draft)
        db.add(consultation)
        
        # Get doctor profile info for notification
        result = await db.execute(
            select(Profile).where(Profile.id == user.id)
        )
        doctor_profile = result.scalar_one_or_none()
        doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
        
        # Create notification for patient
        await create_notification(
            db=db,
            user_id=resolved_patient_id,
            notification_type=NotificationType.CONSULTATION_STARTED,
            title="Consultation Started",
            message=f"{doctor_name} has started a consultation session with you.",
            action_url=f"/patient/prescriptions",
            metadata={"consultation_id": consultation.id, "doctor_id": user.id},
            priority=NotificationPriority.HIGH,
        )
        
        await db.commit()
        await db.refresh(consultation)
        
        return build_consultation_response(consultation, doctor_profile)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to start consultation (doctor_id=%s, patient_id=%s)", user.id, data.patient_id)
        raise HTTPException(status_code=500, detail="Failed to start consultation")


@router.get("/doctor/active", response_model=ConsultationListResponse)
async def get_doctor_active_consultations(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all active consultations for the current doctor."""
    await get_doctor_profile(db, user.id)
    
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.patient),
            selectinload(Consultation.prescriptions)
        )
        .where(
            and_(
                Consultation.doctor_id == user.id,
                Consultation.status == ConsultationStatus.OPEN
            )
        )
        .order_by(Consultation.created_at.desc())
    )
    consultations = result.scalars().all()
    
    # Get patient profiles
    patient_ids = [c.patient_id for c in consultations]
    result = await db.execute(
        select(Profile).where(Profile.id.in_(patient_ids))
    )
    patient_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for consultation in consultations:
        patient_profile = patient_profiles.get(consultation.patient_id)
        response = build_consultation_response(consultation, patient_profile=patient_profile)
        response_list.append(response)
    
    return {"consultations": response_list, "total": len(response_list)}


@router.get("/doctor/history", response_model=ConsultationListResponse)
async def get_doctor_consultation_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get consultation history for the current doctor."""
    await get_doctor_profile(db, user.id)
    
    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.patient))
        .where(Consultation.doctor_id == user.id)
        .order_by(Consultation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    consultations = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(Consultation.id)).where(Consultation.doctor_id == user.id)
    )
    total = count_result.scalar() or 0
    
    # Get patient profiles
    patient_ids = [c.patient_id for c in consultations]
    result = await db.execute(
        select(Profile).where(Profile.id.in_(patient_ids))
    )
    patient_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for consultation in consultations:
        patient_profile = patient_profiles.get(consultation.patient_id)
        response = build_consultation_response(consultation, patient_profile=patient_profile)
        response_list.append(response)
    
    return {"consultations": response_list, "total": total}


@router.get("/{consultation_id:uuid}", response_model=ConsultationWithPrescriptions)
async def get_consultation(
    consultation_id: uuid.UUID,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific consultation with all prescriptions."""
    consultation_id_str = str(consultation_id)
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.doctor),
            selectinload(Consultation.patient),
            selectinload(Consultation.prescriptions).selectinload(Prescription.medications),
            selectinload(Consultation.prescriptions).selectinload(Prescription.tests),
            selectinload(Consultation.prescriptions).selectinload(Prescription.surgeries),
        )
        .where(Consultation.id == consultation_id_str)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    # Verify access
    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")
    
    # Get profiles
    result = await db.execute(
        select(Profile).where(Profile.id.in_([consultation.doctor_id, consultation.patient_id]))
    )
    profiles = {p.id: p for p in result.scalars().all()}
    
    doctor_profile = profiles.get(consultation.doctor_id)
    patient_profile = profiles.get(consultation.patient_id)
    
    response = build_consultation_response(consultation, doctor_profile, patient_profile)
    
    # Add prescriptions
    response["prescriptions"] = []
    for prescription in consultation.prescriptions:
        response["prescriptions"].append(build_prescription_response(prescription, doctor_profile))
    
    return response


@router.patch("/{consultation_id:uuid}", response_model=ConsultationResponse)
async def update_consultation(
    consultation_id: uuid.UUID,
    data: ConsultationUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Update consultation notes/diagnosis. Only the doctor can update."""
    consultation_id_str = str(consultation_id)
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id_str)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update")
    
    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update a completed consultation")
    
    # Update fields
    if data.chief_complaint is not None:
        consultation.chief_complaint = data.chief_complaint
    if data.diagnosis is not None:
        consultation.diagnosis = data.diagnosis
    if data.notes is not None:
        consultation.notes = data.notes
    
    await db.commit()
    await db.refresh(consultation)
    
    return build_consultation_response(consultation)


@router.get("/{consultation_id}/draft", response_model=ConsultationDraftResponse)
async def get_consultation_draft(
    consultation_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get backend draft payload for a consultation."""
    consultation = await _resolve_consultation_with_draft(db, consultation_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")

    # Self-heal old open consultations that were created before eager draft initialization.
    if consultation.status == ConsultationStatus.OPEN and consultation.doctor_id == user.id and not consultation.draft:
        await _get_or_create_consultation_draft(db, consultation)
        try:
            await db.commit()
            await db.refresh(consultation)
        except SQLAlchemyError:
            await db.rollback()
            logger.exception(
                "Failed to initialize consultation draft during fetch (consultation_id=%s, doctor_id=%s)",
                consultation_id,
                user.id,
            )
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Failed to initialize consultation draft",
                    "code": "consultation_draft_init_failed",
                },
            )

    return _build_consultation_draft_response(consultation)


@router.patch("/{consultation_id}/draft", response_model=ConsultationDraftResponse)
async def save_consultation_draft(
    consultation_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Persist consultation editor draft state with backend as source of truth."""
    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft payload")

    data = _validate_consultation_draft_payload(raw_payload)

    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.draft))
        .where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update draft")

    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update draft for a completed consultation")

    draft_record = await _apply_consultation_draft_update(db, consultation, data)

    try:
        await db.commit()
        await db.refresh(consultation)
        await db.refresh(draft_record)
    except SQLAlchemyError:
        await db.rollback()
        logger.exception(
            "Database error while saving consultation draft (consultation_id=%s, doctor_id=%s)",
            consultation_id,
            user.id,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to save consultation draft",
                "code": "consultation_draft_save_failed",
            },
        )

    refreshed = await _resolve_consultation_with_draft(db, consultation.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Consultation not found")

    return _build_consultation_draft_response(refreshed)


@router.get("/drafts/{draft_id}", response_model=ConsultationDraftResponse)
async def get_consultation_draft_by_id(
    draft_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get consultation draft by draft_id."""
    consultation = await _resolve_consultation_by_draft_id(db, draft_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Draft not found")

    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this draft")

    return _build_consultation_draft_response(consultation)


@router.patch("/drafts/{draft_id}", response_model=ConsultationDraftResponse)
async def save_consultation_draft_by_id(
    draft_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Persist consultation draft updates directly by draft_id."""
    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft payload")

    data = _validate_consultation_draft_payload(raw_payload)
    consultation = await _resolve_consultation_by_draft_id(db, draft_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Draft not found")

    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update draft")

    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update draft for a completed consultation")

    draft_record = await _apply_consultation_draft_update(db, consultation, data)

    try:
        await db.commit()
        await db.refresh(consultation)
        await db.refresh(draft_record)
    except SQLAlchemyError:
        await db.rollback()
        logger.exception(
            "Database error while saving consultation draft by draft_id (draft_id=%s, doctor_id=%s)",
            draft_id,
            user.id,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to save consultation draft",
                "code": "consultation_draft_save_failed",
            },
        )

    refreshed = await _resolve_consultation_with_draft(db, consultation.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Consultation not found")

    return _build_consultation_draft_response(refreshed)


@router.patch("/{consultation_id}/complete", response_model=ConsultationResponse)
async def complete_consultation(
    consultation_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get backend draft payload for a consultation."""
    consultation = await _resolve_consultation_with_draft(db, consultation_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")

    # Self-heal old open consultations that were created before eager draft initialization.
    if consultation.status == ConsultationStatus.OPEN and consultation.doctor_id == user.id and not consultation.draft:
        await _get_or_create_consultation_draft(db, consultation)
        try:
            await db.commit()
            await db.refresh(consultation)
        except SQLAlchemyError:
            await db.rollback()
            logger.exception(
                "Failed to initialize consultation draft during fetch (consultation_id=%s, doctor_id=%s)",
                consultation_id,
                user.id,
            )
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Failed to initialize consultation draft",
                    "code": "consultation_draft_init_failed",
                },
            )

    return _build_consultation_draft_response(consultation)


@router.patch("/{consultation_id}/draft", response_model=ConsultationDraftResponse)
async def save_consultation_draft(
    consultation_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Persist consultation editor draft state with backend as source of truth."""
    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft payload")

    data = _validate_consultation_draft_payload(raw_payload)

    result = await db.execute(
        select(Consultation)
        .options(selectinload(Consultation.draft))
        .where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update draft")

    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update draft for a completed consultation")

    draft_record = await _apply_consultation_draft_update(db, consultation, data)

    try:
        await db.commit()
        await db.refresh(consultation)
        await db.refresh(draft_record)
    except SQLAlchemyError:
        await db.rollback()
        logger.exception(
            "Database error while saving consultation draft (consultation_id=%s, doctor_id=%s)",
            consultation_id,
            user.id,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to save consultation draft",
                "code": "consultation_draft_save_failed",
            },
        )

    refreshed = await _resolve_consultation_with_draft(db, consultation.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Consultation not found")

    return _build_consultation_draft_response(refreshed)


@router.get("/drafts/{draft_id}", response_model=ConsultationDraftResponse)
async def get_consultation_draft_by_id(
    draft_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get consultation draft by draft_id."""
    consultation = await _resolve_consultation_by_draft_id(db, draft_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Draft not found")

    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this draft")

    return _build_consultation_draft_response(consultation)


@router.patch("/drafts/{draft_id}", response_model=ConsultationDraftResponse)
async def save_consultation_draft_by_id(
    draft_id: str,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Persist consultation draft updates directly by draft_id."""
    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft payload")

    data = _validate_consultation_draft_payload(raw_payload)
    consultation = await _resolve_consultation_by_draft_id(db, draft_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Draft not found")

    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can update draft")

    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update draft for a completed consultation")

    draft_record = await _apply_consultation_draft_update(db, consultation, data)

    try:
        await db.commit()
        await db.refresh(consultation)
        await db.refresh(draft_record)
    except SQLAlchemyError:
        await db.rollback()
        logger.exception(
            "Database error while saving consultation draft by draft_id (draft_id=%s, doctor_id=%s)",
            draft_id,
            user.id,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to save consultation draft",
                "code": "consultation_draft_save_failed",
            },
        )

    refreshed = await _resolve_consultation_with_draft(db, consultation.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Consultation not found")

    return _build_consultation_draft_response(refreshed)


@router.patch("/{consultation_id:uuid}/complete", response_model=ConsultationResponse)
async def complete_consultation(
    consultation_id: uuid.UUID,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Complete a consultation. Only the doctor can complete."""
    consultation_id_str = str(consultation_id)
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id_str)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the consultation doctor can complete")
    
    if consultation.status == ConsultationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Consultation already completed")
    
    consultation.status = ConsultationStatus.COMPLETED
    consultation.completed_at = datetime.now(timezone.utc)
    await create_consultation_completed_action(db, consultation=consultation)
    
    # Get doctor profile info
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    doctor_profile = result.scalar_one_or_none()
    doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
    
    # Notify patient
    await create_notification(
        db=db,
        user_id=consultation.patient_id,
        notification_type=NotificationType.CONSULTATION_COMPLETED,
        title="Consultation Completed",
        message=f"Your consultation with {doctor_name} has been completed. Please review any prescriptions.",
        action_url=f"/patient/prescriptions",
        metadata={"consultation_id": consultation.id, "doctor_id": user.id},
        priority=NotificationPriority.MEDIUM,
    )
    
    await db.commit()
    await db.refresh(consultation)
    
    return build_consultation_response(consultation, doctor_profile)


# ========== PRESCRIPTION ROUTES (DOCTOR) ==========

async def _get_full_prescription_payload_for_consultation(
    consultation_id: str,
    user_id: str,
    db: AsyncSession,
    draft_id: Optional[str] = None,
) -> dict[str, Any]:
    consultation_query = (
        select(Consultation)
        .options(
            selectinload(Consultation.draft),
            selectinload(Consultation.prescriptions).selectinload(Prescription.medications),
            selectinload(Consultation.prescriptions).selectinload(Prescription.tests),
            selectinload(Consultation.prescriptions).selectinload(Prescription.surgeries),
        )
        .where(Consultation.id == consultation_id)
    )
    if draft_id:
        consultation_query = consultation_query.where(Consultation.draft_id == draft_id)

    result = await db.execute(consultation_query)
    consultation = result.scalar_one_or_none()

    if not consultation:
        if draft_id:
            raise HTTPException(status_code=404, detail="Draft not found for consultation")
        raise HTTPException(status_code=404, detail="Consultation not found")

    if consultation.doctor_id != user_id and consultation.patient_id != user_id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")

    if consultation.status != ConsultationStatus.OPEN:
        snapshot_payload, snapshot_generated_at = _latest_prescription_snapshot_for_consultation(consultation)
        if snapshot_payload:
            return {
                "data_source": "snapshot",
                "snapshot_generated_at": snapshot_generated_at,
                **snapshot_payload,
            }

    profiles_result = await db.execute(
        select(Profile).where(Profile.id.in_([consultation.doctor_id, consultation.patient_id]))
    )
    profiles = {profile.id: profile for profile in profiles_result.scalars().all()}

    doctor_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == consultation.doctor_id)
    )
    doctor_details = doctor_result.scalar_one_or_none()

    patient_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == consultation.patient_id)
    )
    patient_details = patient_result.scalar_one_or_none()

    doctor_profile = profiles.get(consultation.doctor_id)
    patient_profile = profiles.get(consultation.patient_id)

    base_doctor_info = _build_doctor_identity_snapshot(doctor_profile, doctor_details)
    base_patient_info = _build_patient_identity_snapshot(patient_profile, patient_details)

    medications: list[dict[str, Any]] = []
    tests: list[dict[str, Any]] = []
    procedures: list[dict[str, Any]] = []
    draft_doctor_info: dict[str, Any] = {}
    draft_patient_info: dict[str, Any] = {}

    draft_payload = _get_consultation_draft_payload(consultation)
    if consultation.status == ConsultationStatus.OPEN:
        # Open consultation preview must always read from draft, not from prescription fallback.
        if not consultation.draft:
            raise HTTPException(
                status_code=409,
                detail="Consultation draft is not initialized. Save consultation before preview.",
            )
        preview_data_source = "draft"
    else:
        preview_data_source = _resolve_preview_data_source(consultation)

    if preview_data_source == "draft":
        draft_doctor_info_raw = draft_payload.get("doctor_info")
        if isinstance(draft_doctor_info_raw, dict):
            draft_doctor_info = draft_doctor_info_raw

        draft_patient_info_raw = draft_payload.get("patient_info")
        if isinstance(draft_patient_info_raw, dict):
            draft_patient_info = draft_patient_info_raw

        draft_medications = _safe_list_from_draft(draft_payload, "medications")
        draft_tests = _safe_list_from_draft(draft_payload, "tests")
        draft_surgeries = _safe_list_from_draft(draft_payload, "surgeries")

        for medication_data in draft_medications:
            medicine_name = str(medication_data.get("medicine_name") or "").strip()
            if not medicine_name:
                continue

            dosage_type, dosage_pattern, frequency_text = _derive_draft_dosage_mode(medication_data)
            if dosage_type == DosageType.FREQUENCY and not frequency_text:
                frequency_text = _frequency_text_from_count(_parse_int_or_none(medication_data.get("frequency_per_day")))

            duration_text = medication_data.get("duration")
            if not isinstance(duration_text, str) or not duration_text.strip():
                duration_text = _duration_text(
                    _parse_int_or_none(medication_data.get("duration_value")),
                    medication_data.get("duration_unit"),
                )

            route_text = medication_data.get("route")
            if not isinstance(route_text, str) or not route_text.strip():
                route_text = _route_from_medicine_type(medication_data.get("medicine_type"))

            medications.append(
                {
                    "medicine_name": medicine_name,
                    "strength": medication_data.get("strength"),
                    "dosage_type": dosage_type.value,
                    "dosage_pattern": dosage_pattern,
                    "frequency_text": frequency_text,
                    "duration": duration_text,
                    "route": route_text,
                    "meal_instruction": _meal_instruction_text(medication_data.get("meal_instruction")),
                    "quantity": _parse_int_or_none(medication_data.get("quantity")),
                }
            )

        for test_data in draft_tests:
            test_name = str(test_data.get("test_name") or "").strip()
            if not test_name:
                continue

            tests.append(
                {
                    "test_name": test_name,
                    "instructions": test_data.get("instructions"),
                    "urgency": test_data.get("urgency"),
                }
            )

        for surgery_data in draft_surgeries:
            procedure_name = str(surgery_data.get("procedure_name") or "").strip()
            if not procedure_name:
                continue

            procedures.append(
                {
                    "procedure_name": procedure_name,
                    "notes": surgery_data.get("notes"),
                    "reason": surgery_data.get("reason"),
                    "urgency": surgery_data.get("urgency"),
                }
            )

        chief_complaint = draft_payload.get("chief_complaint", consultation.chief_complaint)
        diagnosis = draft_payload.get("diagnosis", consultation.diagnosis)
        notes = draft_payload.get("notes", consultation.notes)
    else:
        sorted_prescriptions = sorted(
            consultation.prescriptions or [],
            key=lambda prescription: prescription.created_at or datetime.now(timezone.utc),
        )

        for prescription in sorted_prescriptions:
            for medication in prescription.medications or []:
                dosage_type, dosage_pattern, frequency_text = _derive_dosage_mode(medication)
                if dosage_type == DosageType.FREQUENCY and not frequency_text:
                    frequency_text = _frequency_text_from_count(medication.frequency_per_day)

                medications.append(
                    {
                        "medicine_name": medication.medicine_name,
                        "strength": medication.strength,
                        "dosage_type": dosage_type.value,
                        "dosage_pattern": dosage_pattern,
                        "frequency_text": frequency_text,
                        "duration": _duration_text(medication.duration_value, medication.duration_unit),
                        "route": _route_from_medicine_type(medication.medicine_type),
                        "meal_instruction": _meal_instruction_text(medication.meal_instruction),
                        "quantity": medication.quantity,
                    }
                )

            for test in prescription.tests or []:
                tests.append(
                    {
                        "test_name": test.test_name,
                        "instructions": test.instructions,
                        "urgency": test.urgency.value if test.urgency else None,
                    }
                )

            for surgery in prescription.surgeries or []:
                procedures.append(
                    {
                        "procedure_name": surgery.procedure_name,
                        "notes": surgery.notes,
                        "reason": surgery.reason,
                        "urgency": surgery.urgency.value if surgery.urgency else None,
                    }
                )

        chief_complaint = consultation.chief_complaint
        diagnosis = consultation.diagnosis
        notes = consultation.notes

    final_doctor_info = {
        "name": draft_doctor_info.get("name") or base_doctor_info.get("name") or "",
        "qualification": draft_doctor_info.get("qualification") or base_doctor_info.get("qualification"),
        "specialization": draft_doctor_info.get("specialization") or base_doctor_info.get("specialization"),
        "chamber_info": draft_doctor_info.get("chamber_info") or base_doctor_info.get("chamber_info"),
        "phone": doctor_profile.phone if doctor_profile else None,
        "address": _build_doctor_address(doctor_details) if doctor_details else None,
        "registration_number": doctor_details.bmdc_number if doctor_details else None,
        "signature_url": None,
    }

    final_patient_info = {
        "name": draft_patient_info.get("name") or base_patient_info.get("name") or "",
        "age": draft_patient_info.get("age", base_patient_info.get("age")),
        "gender": draft_patient_info.get("gender") or base_patient_info.get("gender"),
        "blood_group": draft_patient_info.get("blood_group") or base_patient_info.get("blood_group"),
        "patient_id": patient_ref_from_uuid(consultation.patient_id),
    }

    return {
        "data_source": preview_data_source,
        "snapshot_generated_at": None,
        "doctor": final_doctor_info,
        "patient": final_patient_info,
        "consultation": {
            "date": consultation.consultation_date,
            "chief_complaint": chief_complaint,
            "diagnosis": diagnosis,
            "notes": notes,
        },
        "medications": medications,
        "tests": tests,
        "procedures": procedures,
    }


@router.get("/{consultation_id}/full", response_model=PrescriptionFullResponse)
async def get_full_prescription_by_consultation(
    consultation_id: str,
    draft_id: Optional[str] = Query(default=None),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get full structured consultation payload for prescription preview/print."""
    return await _get_full_prescription_payload_for_consultation(consultation_id, user.id, db, draft_id=draft_id)


@router.get("/prescriptions/{consultation_id}/full", response_model=PrescriptionFullResponse)
async def get_full_prescription_by_consultation_legacy(
    consultation_id: str,
    draft_id: Optional[str] = Query(default=None),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible full payload endpoint for existing preview clients."""
    return await _get_full_prescription_payload_for_consultation(consultation_id, user.id, db, draft_id=draft_id)

@router.post("/{consultation_id}/prescription", response_model=PrescriptionResponse)
async def add_prescription(
    consultation_id: uuid.UUID,
    data: PrescriptionCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Add a prescription to a consultation.
    Only the consultation doctor can add prescriptions.
    """
    try:
        consultation_id_str = str(consultation_id)
        result = await db.execute(
            select(Consultation)
            .options(selectinload(Consultation.draft))
            .where(Consultation.id == consultation_id)
        )
        consultation = result.scalar_one_or_none()
        
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
        
        if consultation.doctor_id != user.id:
            raise HTTPException(status_code=403, detail="Only the consultation doctor can add prescriptions")
        
        if consultation.status == ConsultationStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot add prescriptions to a completed consultation")
        
        # Validate that at least one type of prescription item is provided
        has_medications = data.medications and len(data.medications) > 0
        has_tests = data.tests and len(data.tests) > 0
        has_surgeries = data.surgeries and len(data.surgeries) > 0
        
        if not (has_medications or has_tests or has_surgeries):
            raise HTTPException(
                status_code=400,
                detail="Prescription must include at least one medication, test, or procedure"
            )
        
        # Create prescription
        # Use item presence as source of truth so mixed-item prescriptions remain visible
        # across medication/test/surgery views.
        resolved_type = (
            PrescriptionType.MEDICATION if has_medications
            else PrescriptionType.TEST if has_tests
            else PrescriptionType.SURGERY
        )

        normalized_rendered_html = (
            data.rendered_prescription_html.strip()
            if isinstance(data.rendered_prescription_html, str) and data.rendered_prescription_html.strip()
            else None
        )
        normalized_snapshot_payload = _normalize_prescription_snapshot_payload(
            data.rendered_prescription_snapshot
        )
        normalized_snapshot_generated_at = _parse_optional_iso_datetime(
            data.rendered_prescription_generated_at
        )
        if normalized_snapshot_payload and normalized_snapshot_generated_at is None:
            normalized_snapshot_generated_at = datetime.now(timezone.utc)

        prescription = Prescription(
            id=str(uuid.uuid4()),
            consultation_id=consultation_id_str,
            doctor_id=user.id,
            patient_id=consultation.patient_id,
            type=resolved_type,
            notes=data.notes,
            status=PrescriptionStatus.PENDING,
            rendered_prescription_html=normalized_rendered_html,
            rendered_prescription_snapshot=normalized_snapshot_payload,
            rendered_prescription_generated_at=normalized_snapshot_generated_at,
        )
        db.add(prescription)
        
        # Add medications
        if data.medications:
            for med_data in data.medications:
                resolved_dosage_type = (
                    DosageType(med_data.dosage_type.value)
                    if med_data.dosage_type
                    else None
                )

                medication = MedicationPrescription(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    medicine_name=med_data.medicine_name,
                    generic_name=med_data.generic_name,
                    medicine_type=med_data.medicine_type,
                    strength=med_data.strength,
                    dose_morning=med_data.dose_morning,
                    dose_afternoon=med_data.dose_afternoon,
                    dose_evening=med_data.dose_evening,
                    dose_night=med_data.dose_night,
                    dose_morning_amount=med_data.dose_morning_amount,
                    dose_afternoon_amount=med_data.dose_afternoon_amount,
                    dose_evening_amount=med_data.dose_evening_amount,
                    dose_night_amount=med_data.dose_night_amount,
                    frequency_per_day=med_data.frequency_per_day,
                    dosage_type=resolved_dosage_type,
                    dosage_pattern=med_data.dosage_pattern,
                    frequency_text=med_data.frequency_text,
                    duration_value=med_data.duration_value,
                    duration_unit=med_data.duration_unit,
                    meal_instruction=med_data.meal_instruction,
                    special_instructions=med_data.special_instructions,
                    start_date=med_data.start_date,
                    end_date=med_data.end_date,
                    quantity=med_data.quantity,
                    refills=med_data.refills,
                )
                db.add(medication)
        
        # Add tests
        if data.tests:
            for test_data in data.tests:
                test = TestPrescription(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    test_name=test_data.test_name,
                    test_type=test_data.test_type,
                    instructions=test_data.instructions,
                    urgency=test_data.urgency,
                    preferred_lab=test_data.preferred_lab,
                    expected_date=test_data.expected_date,
                )
                db.add(test)
        
        # Add surgeries
        if data.surgeries:
            for surgery_data in data.surgeries:
                surgery = SurgeryRecommendation(
                    id=str(uuid.uuid4()),
                    prescription_id=prescription.id,
                    procedure_name=surgery_data.procedure_name,
                    procedure_type=surgery_data.procedure_type,
                    reason=surgery_data.reason,
                    urgency=surgery_data.urgency,
                    recommended_date=surgery_data.recommended_date,
                    estimated_cost_min=surgery_data.estimated_cost_min,
                    estimated_cost_max=surgery_data.estimated_cost_max,
                    pre_op_instructions=surgery_data.pre_op_instructions,
                    notes=surgery_data.notes,
                    preferred_facility=surgery_data.preferred_facility,
                )
                db.add(surgery)
        
        # Flush to get IDs before creating notification
        await db.flush()
        
        # Get doctor profile for notification
        result = await db.execute(
            select(Profile).where(Profile.id == user.id)
        )
        doctor_profile = result.scalar_one_or_none()
        doctor_name = f"Dr. {doctor_profile.first_name or ''} {doctor_profile.last_name or ''}".strip() if doctor_profile else "Your doctor"
        
        # Create notification for patient
        # Build notification message based on what's included
        prescription_items = []
        if data.medications and len(data.medications) > 0:
            prescription_items.append(f"{len(data.medications)} medication(s)")
        if data.tests and len(data.tests) > 0:
            prescription_items.append(f"{len(data.tests)} test(s)")
        if data.surgeries and len(data.surgeries) > 0:
            prescription_items.append(f"{len(data.surgeries)} procedure(s)")
        
        items_text = ", ".join(prescription_items)
        type_label = data.type.value.replace("_", " ").title()
        
        notification = await create_notification(
            db=db,
            user_id=consultation.patient_id,
            notification_type=NotificationType.PRESCRIPTION_CREATED,
            title="New Prescription",
            message=f"{doctor_name} has prescribed {items_text}. Please review and accept.",
            action_url=f"/patient/prescriptions/{prescription.id}",
            metadata={
                "prescription_id": prescription.id,
                "consultation_id": consultation_id_str,
                "doctor_id": user.id,
                "type": data.type.value,
                "items": items_text,
            },
            priority=NotificationPriority.HIGH,
        )
        logger.info(
            "Created prescription notification (notification_id=%s, prescription_id=%s, patient_id=%s)",
            notification.id,
            prescription.id,
            consultation.patient_id,
        )
        await create_prescription_issued_action(db, prescription=prescription)

        # Prescription is now finalized; clear in-progress draft snapshot.
        draft_to_delete = consultation.draft
        if not draft_to_delete and consultation.draft_id:
            draft_result = await db.execute(
                select(ConsultationDraft).where(ConsultationDraft.id == consultation.draft_id)
            )
            draft_to_delete = draft_result.scalar_one_or_none()

        consultation.draft = None
        consultation.draft_id = None

        if draft_to_delete:
            await db.delete(draft_to_delete)
        
        await db.commit()
        
        # Reload with relationships
        result = await db.execute(
            select(Prescription)
            .options(
                selectinload(Prescription.medications),
                selectinload(Prescription.tests),
                selectinload(Prescription.surgeries),
            )
            .where(Prescription.id == prescription.id)
        )
        prescription = result.scalar_one()
        
        return build_prescription_response(prescription, doctor_profile)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to add prescription (consultation_id=%s, doctor_id=%s)", consultation_id, user.id)
        raise HTTPException(status_code=500, detail="Failed to add prescription")


@router.get("/{consultation_id:uuid}/prescriptions", response_model=PrescriptionListResponse)
async def get_consultation_prescriptions(
    consultation_id: uuid.UUID,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all prescriptions for a consultation."""
    consultation_id_str = str(consultation_id)
    result = await db.execute(
        select(Consultation).where(Consultation.id == consultation_id_str)
    )
    consultation = result.scalar_one_or_none()
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation.doctor_id != user.id and consultation.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this consultation")
    
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
        )
        .where(Prescription.consultation_id == consultation_id_str)
        .order_by(Prescription.created_at.desc())
    )
    prescriptions = result.scalars().all()
    
    # Get doctor profile
    result = await db.execute(
        select(Profile).where(Profile.id == consultation.doctor_id)
    )
    doctor_profile = result.scalar_one_or_none()
    
    response_list = [build_prescription_response(p, doctor_profile) for p in prescriptions]
    
    return {"prescriptions": response_list, "total": len(response_list)}


@router.delete("/prescription/{prescription_id}")
async def delete_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a prescription. Only if pending and by the doctor who created it."""
    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the prescribing doctor can delete")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending prescriptions")
    
    await db.delete(prescription)
    await db.commit()
    
    return {"message": "Prescription deleted successfully"}


# ========== PATIENT PRESCRIPTION ROUTES ==========

@router.get("/patient/prescriptions", response_model=PrescriptionListResponse)
async def get_patient_prescriptions(
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, accepted, rejected"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all prescriptions for the current patient."""
    try:
        # Query prescriptions directly - don't require consultation to exist
        query = select(Prescription).options(
            selectinload(Prescription.medications),
            selectinload(Prescription.tests),
            selectinload(Prescription.surgeries),
        ).where(Prescription.patient_id == user.id)
        
        if status_filter:
            query = query.where(Prescription.status == status_filter)
        
        query = query.order_by(Prescription.created_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        prescriptions = result.scalars().all()
        
        # Get total count
        count_query = select(func.count(Prescription.id)).where(Prescription.patient_id == user.id)
        if status_filter:
            count_query = count_query.where(Prescription.status == status_filter)
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0
        
        # Get doctor profiles
        doctor_ids = list(set([p.doctor_id for p in prescriptions]))
        if doctor_ids:  # Only query if we have doctor IDs
            result = await db.execute(
                select(Profile).where(Profile.id.in_(doctor_ids))
            )
            doctor_profiles = {p.id: p for p in result.scalars().all()}
        else:
            doctor_profiles = {}
        
        response_list = []
        for prescription in prescriptions:
            doctor_profile = doctor_profiles.get(prescription.doctor_id)
            response_list.append(build_prescription_response(prescription, doctor_profile))

        return {"prescriptions": response_list, "total": total}
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Failed to get patient prescriptions (patient_id=%s, status_filter=%s)",
            user.id,
            status_filter,
        )
        raise HTTPException(status_code=500, detail="Failed to fetch patient prescriptions")


@router.get("/patient/prescription/{prescription_id}", response_model=PrescriptionResponse)
async def get_patient_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific prescription for the current patient."""
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
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    # Get doctor profile
    result = await db.execute(
        select(Profile).where(Profile.id == prescription.doctor_id)
    )
    doctor_profile = result.scalar_one_or_none()
    
    return build_prescription_response(prescription, doctor_profile, include_snapshot=True)


@router.post("/patient/prescription/{prescription_id}/accept")
async def accept_prescription(
    prescription_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Accept a prescription and add to medical history."""
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
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Prescription already processed")
    
    # Update prescription status
    prescription.status = PrescriptionStatus.ACCEPTED
    prescription.accepted_at = datetime.now(timezone.utc)
    prescription.added_to_history = True
    
    # Get patient profile for notification
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    patient_profile = result.scalar_one_or_none()
    patient_name = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip() if patient_profile else "Your patient"
    
    # Notify doctor
    await create_notification(
        db=db,
        user_id=prescription.doctor_id,
        notification_type=NotificationType.PRESCRIPTION_ACCEPTED,
        title="Prescription Accepted",
        message=f"{patient_name} has accepted your prescription.",
        action_url=f"/doctor/patients",
        metadata={
            "prescription_id": prescription.id,
            "patient_id": user.id,
        },
        priority=NotificationPriority.MEDIUM,
    )
    
    await db.commit()
    
    return {"message": "Prescription accepted successfully", "status": "accepted"}


@router.post("/patient/prescription/{prescription_id}/reject")
async def reject_prescription(
    prescription_id: str,
    data: PrescriptionReject,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Reject a prescription with optional reason."""
    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.patient_id != user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this prescription")
    
    if prescription.status != PrescriptionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Prescription already processed")
    
    # Update prescription status
    prescription.status = PrescriptionStatus.REJECTED
    prescription.rejected_at = datetime.now(timezone.utc)
    prescription.rejection_reason = data.reason
    
    # Get patient profile for notification
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    patient_profile = result.scalar_one_or_none()
    patient_name = f"{patient_profile.first_name or ''} {patient_profile.last_name or ''}".strip() if patient_profile else "Your patient"
    
    # Notify doctor
    await create_notification(
        db=db,
        user_id=prescription.doctor_id,
        notification_type=NotificationType.PRESCRIPTION_REJECTED,
        title="Prescription Rejected",
        message=f"{patient_name} has rejected your prescription." + (f" Reason: {data.reason}" if data.reason else ""),
        action_url=f"/doctor/patients",
        metadata={
            "prescription_id": prescription.id,
            "patient_id": user.id,
            "reason": data.reason,
        },
        priority=NotificationPriority.HIGH,
    )
    
    await db.commit()
    
    return {"message": "Prescription rejected", "status": "rejected"}


# ========== MEDICAL HISTORY INTEGRATION ==========

@router.get("/patient/medical-history/prescriptions", response_model=PrescriptionListResponse)
async def get_medical_history_prescriptions(
    prescription_type: Optional[str] = Query(None, description="Filter by type: medication, test, surgery"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get accepted prescriptions for medical history."""
    await get_patient_profile(db, user.id)
    
    query = select(Prescription).options(
        selectinload(Prescription.medications),
        selectinload(Prescription.tests),
        selectinload(Prescription.surgeries),
    ).where(
        and_(
            Prescription.patient_id == user.id,
            Prescription.status == PrescriptionStatus.ACCEPTED,
        )
    )
    
    if prescription_type:
        query = query.where(Prescription.type == prescription_type)
    
    query = query.order_by(Prescription.accepted_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    prescriptions = result.scalars().all()
    
    # Get total count
    count_query = select(func.count(Prescription.id)).where(
        and_(
            Prescription.patient_id == user.id,
            Prescription.status == PrescriptionStatus.ACCEPTED,
        )
    )
    if prescription_type:
        count_query = count_query.where(Prescription.type == prescription_type)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Get doctor profiles
    doctor_ids = list(set([p.doctor_id for p in prescriptions]))
    result = await db.execute(
        select(Profile).where(Profile.id.in_(doctor_ids))
    )
    doctor_profiles = {p.id: p for p in result.scalars().all()}
    
    response_list = []
    for prescription in prescriptions:
        doctor_profile = doctor_profiles.get(prescription.doctor_id)
        response_list.append(build_prescription_response(prescription, doctor_profile))
    
    return {"prescriptions": response_list, "total": total}
