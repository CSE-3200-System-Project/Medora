from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import distinct, func, select
from app.core.dependencies import get_db
from app.core.patient_reference import patient_ref_from_uuid
from app.routes.auth import get_current_user_token
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_location import DoctorLocation
from app.db.models.patient import PatientProfile
from app.db.models.appointment_request import (
    AppointmentRescheduleRequest,
    RescheduleRequestStatus,
)
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentCancelRequest,
    CancellationReasonKey,
    AppointmentRescheduleRequestCreate,
    AppointmentRescheduleRespond,
    AppointmentRescheduleWithdraw,
)
from app.services.doctor_action_service import create_appointment_completed_action
from app.services import appointment_service, notification_service, slot_service
from typing import List
from datetime import datetime, timedelta, timezone, date as date_class, time as time_class
from zoneinfo import ZoneInfo
import re

router = APIRouter()


def _status_value(status: AppointmentStatus | str) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _calculate_age(dob):
    if not dob:
        return None
    today = date_class.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _chronic_conditions_from_profile(patient_profile: PatientProfile | None) -> list[str]:
    if not patient_profile:
        return []

    conditions: list[str] = []
    if patient_profile.has_diabetes:
        conditions.append("Diabetes")
    if patient_profile.has_hypertension:
        conditions.append("Hypertension")
    if patient_profile.has_heart_disease:
        conditions.append("Heart Disease")
    if patient_profile.has_asthma:
        conditions.append("Asthma")
    if patient_profile.has_kidney_disease:
        conditions.append("Kidney Disease")
    return conditions


DEFAULT_TIME_SLOTS = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
    "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
]
SLOT_NOTE_PATTERN = re.compile(
    r"Slot:\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
    re.IGNORECASE,
)
SLOT_RANGE_PATTERN = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
    re.IGNORECASE,
)
MEDORA_TIMEZONE = ZoneInfo("Asia/Dhaka")

CANCELLATION_STATUSES = {
    AppointmentStatus.CANCELLED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_DOCTOR,
}
UPCOMING_EXCLUDED_STATUSES = CANCELLATION_STATUSES | {
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
}

CANCELLATION_REASON_LABELS: dict[str, str] = {
    CancellationReasonKey.SCHEDULE_CONFLICT.value: "Schedule conflict",
    CancellationReasonKey.PERSONAL_EMERGENCY.value: "Personal emergency",
    CancellationReasonKey.FEELING_BETTER.value: "Feeling better",
    CancellationReasonKey.TRANSPORT_ISSUE.value: "Transport issue",
    CancellationReasonKey.COST_CONCERN.value: "Cost concern",
    CancellationReasonKey.DOCTOR_UNAVAILABLE.value: "Doctor unavailable",
    CancellationReasonKey.CLINIC_DELAY.value: "Clinic delay",
    CancellationReasonKey.DOUBLE_BOOKED.value: "Double booked",
    CancellationReasonKey.OTHER.value: "Other",
}
PATIENT_ALLOWED_CANCELLATION_REASONS = {
    CancellationReasonKey.SCHEDULE_CONFLICT.value,
    CancellationReasonKey.PERSONAL_EMERGENCY.value,
    CancellationReasonKey.FEELING_BETTER.value,
    CancellationReasonKey.TRANSPORT_ISSUE.value,
    CancellationReasonKey.COST_CONCERN.value,
    CancellationReasonKey.OTHER.value,
}
DOCTOR_ALLOWED_CANCELLATION_REASONS = {
    CancellationReasonKey.DOCTOR_UNAVAILABLE.value,
    CancellationReasonKey.CLINIC_DELAY.value,
    CancellationReasonKey.DOUBLE_BOOKED.value,
    CancellationReasonKey.PERSONAL_EMERGENCY.value,
    CancellationReasonKey.OTHER.value,
}


def _normalize_cancellation_note(note: str | None) -> str | None:
    if note is None:
        return None
    cleaned = " ".join(note.split()).strip()
    if not cleaned:
        return None
    return cleaned[:500]


def _reason_label(reason_key: str | None) -> str:
    if not reason_key:
        return CANCELLATION_REASON_LABELS[CancellationReasonKey.OTHER.value]
    return CANCELLATION_REASON_LABELS.get(reason_key, reason_key.replace("_", " ").title())


def _build_cancellation_reason_text(reason_key: str | None, reason_note: str | None) -> str:
    label = _reason_label(reason_key)
    if reason_note:
        return f"{label}: {reason_note}"
    return label


def _validate_cancellation_reason_for_role(reason_key: str, performed_by_role: str) -> None:
    role = performed_by_role.lower()
    if role == "patient" and reason_key not in PATIENT_ALLOWED_CANCELLATION_REASONS:
        raise HTTPException(status_code=400, detail="Invalid cancellation reason for patient")
    if role == "doctor" and reason_key not in DOCTOR_ALLOWED_CANCELLATION_REASONS:
        raise HTTPException(status_code=400, detail="Invalid cancellation reason for doctor")


def _normalize_slot_label(time_label: str) -> str:
    cleaned = " ".join(time_label.strip().upper().split())
    cleaned = re.sub(r"^(\d{1,2})(AM|PM)$", r"\1 \2", cleaned)
    cleaned = re.sub(r"^(\d{1,2})\s+(AM|PM)$", r"\1:00 \2", cleaned)

    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%I:%M %p").lstrip("0").upper()
        except ValueError:
            continue

    return cleaned


def _slot_label_from_datetime(value: datetime) -> str:
    return value.strftime("%I:%M %p").lstrip("0").upper()


def _parse_slot_time_from_notes(notes: str | None) -> time_class | None:
    if not notes:
        return None

    match = SLOT_NOTE_PATTERN.search(notes)
    if not match:
        return None

    normalized = _normalize_slot_label(match.group(1))
    parsed = datetime.strptime(normalized, "%I:%M %p")
    return time_class(parsed.hour, parsed.minute)


def _canonicalize_appointment_datetime(raw_datetime: datetime, slot_time_val: time_class | None) -> datetime:
    if slot_time_val is not None:
        target_date = raw_datetime.date()
        local_datetime = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            slot_time_val.hour,
            slot_time_val.minute,
            tzinfo=MEDORA_TIMEZONE,
        )
        return local_datetime.astimezone(timezone.utc)

    if raw_datetime.tzinfo is None:
        return raw_datetime.replace(tzinfo=timezone.utc)

    return raw_datetime.astimezone(timezone.utc)


def _slot_sort_key(slot_label: str) -> datetime:
    try:
        return datetime.strptime(_normalize_slot_label(slot_label), "%I:%M %p")
    except ValueError:
        return datetime.strptime("11:59 PM", "%I:%M %p")


def _expand_slot_ranges(slot_ranges: list[str], duration: int) -> list[str]:
    time_slots: list[str] = []
    for range_str in slot_ranges:
        match = SLOT_RANGE_PATTERN.search(range_str)
        if not match:
            continue

        start_time = datetime.strptime(_normalize_slot_label(match.group(1)), "%I:%M %p")
        end_time = datetime.strptime(_normalize_slot_label(match.group(2)), "%I:%M %p")

        current_time = start_time
        while current_time < end_time:
            time_slots.append(current_time.strftime("%I:%M %p").lstrip("0"))
            current_time = current_time + timedelta(minutes=duration)

    # Deduplicate while preserving order
    return list(dict.fromkeys(time_slots))


def _build_appointment_slot_index(appointments: list[Appointment]) -> dict[str, Appointment]:
    slot_index: dict[str, Appointment] = {}
    for appointment in appointments:
        if appointment.slot_time:
            slot_label = datetime(2000, 1, 1, appointment.slot_time.hour, appointment.slot_time.minute).strftime("%I:%M %p").lstrip("0").upper()
            slot_index[slot_label] = appointment
        else:
            slot_index[_slot_label_from_datetime(appointment.appointment_date)] = appointment

        if not appointment.slot_time and appointment.notes:
            note_match = SLOT_NOTE_PATTERN.search(appointment.notes)
            if note_match:
                slot_index[_normalize_slot_label(note_match.group(1))] = appointment

    return slot_index


async def _latest_pending_reschedules_by_appointment(
    db: AsyncSession,
    appointment_ids: list[str],
) -> dict[str, AppointmentRescheduleRequest]:
    if not appointment_ids:
        return {}

    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(
            AppointmentRescheduleRequest.appointment_id.in_(appointment_ids),
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
        .order_by(AppointmentRescheduleRequest.created_at.desc())
    )

    latest_by_appointment: dict[str, AppointmentRescheduleRequest] = {}
    for request in result.scalars().all():
        if request.appointment_id not in latest_by_appointment:
            latest_by_appointment[request.appointment_id] = request

    return latest_by_appointment

@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment_data: AppointmentCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Patient books an appointment with a doctor.
    Uses transactional SELECT FOR UPDATE to prevent double-booking.
    """
    user_id = user.id

    # Verify user is a patient
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can book appointments")

    # Verify doctor exists
    result_doc = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == appointment_data.doctor_id))
    doctor = result_doc.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    selected_location_name = appointment_data.location_name
    if appointment_data.doctor_location_id:
        location_result = await db.execute(
            select(DoctorLocation).where(
                DoctorLocation.id == appointment_data.doctor_location_id,
                DoctorLocation.doctor_id == appointment_data.doctor_id,
            )
        )
        location = location_result.scalar_one_or_none()
        if not location:
            raise HTTPException(status_code=400, detail="Invalid doctor location selected")
        if not selected_location_name:
            selected_location_name = location.location_name

    # Prefer explicit slot label from notes to avoid client-timezone drift.
    appt_dt_raw = appointment_data.appointment_date
    slot_time_val = _parse_slot_time_from_notes(appointment_data.notes)
    if slot_time_val is None and (appt_dt_raw.hour != 0 or appt_dt_raw.minute != 0):
        slot_time_val = time_class(appt_dt_raw.hour, appt_dt_raw.minute)

    appt_dt = _canonicalize_appointment_datetime(appt_dt_raw, slot_time_val)

    try:
        new_appointment = await appointment_service.create_appointment(
            db,
            patient_id=user_id,
            doctor_id=appointment_data.doctor_id,
            doctor_location_id=appointment_data.doctor_location_id,
            location_name=selected_location_name,
            appointment_date=appt_dt,
            slot_time_val=slot_time_val,
            reason=appointment_data.reason,
            notes=appointment_data.notes,
            duration_minutes=doctor.appointment_duration or 30,
        )

        await db.commit()
        await db.refresh(new_appointment)
        return new_appointment
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/my-appointments", response_model=List[AppointmentResponse])
async def get_my_appointments(
    page: int = Query(1, ge=1),
    size: int | None = Query(None, ge=1, le=100),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get appointments for the current user (Doctor or Patient).
    """
    user_id = user.id
    
    # Determine role
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    query = select(Appointment).distinct()

    # Handle uppercase role values from database
    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        # Patients see all of their own appointments, including PENDING_ADMIN_REVIEW
        # so they can see that their request is awaiting approval.
        query = query.where(Appointment.patient_id == user_id)
    elif "DOCTOR" in role_str:
        # Doctors only see appointments after admin has approved them.
        query = query.where(
            Appointment.doctor_id == user_id,
            Appointment.status != AppointmentStatus.PENDING_ADMIN_REVIEW,
        )
    else: # Admin or other
        # Admin might want to see all? For now restrict.
        return []
        
    query = query.order_by(Appointment.appointment_date.desc())

    if size is not None:
        query = query.limit(size).offset((page - 1) * size)
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    if not appointments:
        return []

    latest_pending_reschedules = await _latest_pending_reschedules_by_appointment(
        db,
        [appointment.id for appointment in appointments],
    )
    
    related_profile_ids = {appt.patient_id for appt in appointments} | {appt.doctor_id for appt in appointments}
    profile_rows = await db.execute(select(Profile).where(Profile.id.in_(related_profile_ids)))
    profiles_by_id = {row.id: row for row in profile_rows.scalars().all()}

    patient_profiles_by_id: dict[str, PatientProfile] = {}
    if "DOCTOR" in role_str:
        patient_ids = {appt.patient_id for appt in appointments}
        patient_profile_rows = await db.execute(
            select(PatientProfile).where(PatientProfile.profile_id.in_(patient_ids))
        )
        patient_profiles_by_id = {
            row.profile_id: row for row in patient_profile_rows.scalars().all()
        }

    out = []
    for appt in appointments:
        pending_reschedule = latest_pending_reschedules.get(appt.id)
        patient = profiles_by_id.get(appt.patient_id)
        doctor = profiles_by_id.get(appt.doctor_id)
        patient_profile = patient_profiles_by_id.get(appt.patient_id)
        # Keep slot_time as a proper time object to satisfy AppointmentResponse validation.
        slot_time = appt.slot_time
        if slot_time is None and appt.notes:
            slot_match = SLOT_NOTE_PATTERN.search(appt.notes)
            if slot_match:
                try:
                    normalized_slot = _normalize_slot_label(slot_match.group(1))
                    parsed_time = datetime.strptime(normalized_slot, "%I:%M %p")
                    slot_time = time_class(
                        hour=parsed_time.hour,
                        minute=parsed_time.minute,
                    )
                except ValueError:
                    slot_time = None

        out.append({
            "id": appt.id,
            "appointment_date": appt.appointment_date.isoformat(),
            "slot_time": slot_time,
            "reason": appt.reason,
            "notes": appt.notes,
            "status": _status_value(appt.status),
            "hold_expires_at": appt.hold_expires_at.isoformat() if appt.hold_expires_at else None,
            "patient_id": appt.patient_id,
            "patient_ref": patient_ref_from_uuid(appt.patient_id),
            "doctor_id": appt.doctor_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "patient_phone": patient.phone if patient and "DOCTOR" in role_str else None,
            "patient_age": _calculate_age(patient_profile.date_of_birth) if patient_profile else None,
            "patient_gender": patient_profile.gender if patient_profile else None,
            "blood_group": patient_profile.blood_group if patient_profile else None,
            "chronic_conditions": _chronic_conditions_from_profile(patient_profile),
            "cancellation_reason_key": appt.cancellation_reason_key,
            "cancellation_reason_note": appt.cancellation_reason_note,
            "cancelled_by_id": appt.cancelled_by_id,
            "cancelled_at": appt.cancelled_at.isoformat() if appt.cancelled_at else None,
            "reschedule_request_id": pending_reschedule.id if pending_reschedule else None,
            "reschedule_requested_by_role": (
                pending_reschedule.requested_by_role.value if pending_reschedule else None
            ),
            "proposed_date": pending_reschedule.proposed_date if pending_reschedule else None,
            "proposed_time": pending_reschedule.proposed_time if pending_reschedule else None,
            "reschedule_admin_approval_status": (
                pending_reschedule.admin_approval_status.value if pending_reschedule else None
            ),
            "created_at": appt.created_at.isoformat() if appt.created_at else None,
            "updated_at": appt.updated_at.isoformat() if appt.updated_at else None,
        })

    return out

@router.get("/by-date/{date}")
async def get_appointments_by_date(
    date: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all appointments for a specific date for the current doctor.
    Returns time slots with appointment details.
    """
    user_id = user.id
    
    # Verify user is a doctor
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
    
    # Get doctor profile for time slots
    doc_result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == user_id))
    doctor_profile = doc_result.scalar_one_or_none()
    
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    # Parse date and get appointments for that day
    try:
        target_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
        if target_date.tzinfo is None:
            target_date = target_date.replace(tzinfo=timezone.utc)
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    
    # Get all appointments for this date (excluding ones awaiting admin review)
    query = select(Appointment).where(
        Appointment.doctor_id == user_id,
        Appointment.appointment_date >= start_of_day,
        Appointment.appointment_date < end_of_day,
        Appointment.status != AppointmentStatus.PENDING_ADMIN_REVIEW,
    ).order_by(Appointment.appointment_date)
    
    result = await db.execute(query)
    appointments = result.scalars().all()

    patient_ids = {appointment.patient_id for appointment in appointments}
    patients_by_id: dict[str, Profile] = {}
    if patient_ids:
        patient_rows = await db.execute(select(Profile).where(Profile.id.in_(patient_ids)))
        patients_by_id = {row.id: row for row in patient_rows.scalars().all()}

    patient_profiles_by_id: dict[str, PatientProfile] = {}
    if patient_ids:
        patient_profile_rows = await db.execute(
            select(PatientProfile).where(PatientProfile.profile_id.in_(patient_ids))
        )
        patient_profiles_by_id = {
            row.profile_id: row for row in patient_profile_rows.scalars().all()
        }

    requested_day_full = start_of_day.strftime("%A")
    appointment_duration = doctor_profile.appointment_duration or 30
    time_slots: list[str] = []
    has_authoritative_day_schedule = False

    if (
        getattr(doctor_profile, "day_time_slots", None)
        and isinstance(doctor_profile.day_time_slots, dict)
        and len(doctor_profile.day_time_slots) > 0
    ):
        has_authoritative_day_schedule = True
        day_slots = doctor_profile.day_time_slots.get(requested_day_full, [])
        if isinstance(day_slots, list) and day_slots:
            time_slots = _expand_slot_ranges(day_slots, appointment_duration)
    elif doctor_profile.visiting_hours or doctor_profile.time_slots:
        schedule_text = doctor_profile.visiting_hours or doctor_profile.time_slots or ""
        legacy_ranges = [
            f"{start} - {end}"
            for start, end in re.findall(
                r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))",
                schedule_text,
                re.IGNORECASE,
            )
        ]
        time_slots = _expand_slot_ranges(legacy_ranges, appointment_duration)

    if not time_slots and not has_authoritative_day_schedule:
        time_slots = list(DEFAULT_TIME_SLOTS)

    if not time_slots:
        derived_time_slots = {
            appointment.appointment_date.strftime("%I:%M %p").lstrip("0")
            for appointment in appointments
        }
        time_slots = sorted(derived_time_slots, key=_slot_sort_key)

    appointment_by_slot = _build_appointment_slot_index(appointments)

    slot_data = []
    for slot_time in time_slots:
        matching_appointment = appointment_by_slot.get(_normalize_slot_label(slot_time))
        if not matching_appointment:
            slot_data.append(
                {
                    "time": slot_time,
                    "appointmentId": None,
                    "patientName": None,
                    "patientPhone": None,
                    "patientAge": None,
                    "patientGender": None,
                    "bloodGroup": None,
                    "chronicConditions": [],
                    "reason": None,
                    "status": None,
                    "appointmentDate": None,
                }
            )
            continue

        patient = patients_by_id.get(matching_appointment.patient_id)
        patient_profile = patient_profiles_by_id.get(matching_appointment.patient_id)
        slot_data.append(
            {
                "time": slot_time,
                "appointmentId": matching_appointment.id,
                "patientName": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
                "patientRef": patient_ref_from_uuid(matching_appointment.patient_id),
                "patientPhone": patient.phone if patient else None,
                "patientAge": _calculate_age(patient_profile.date_of_birth) if patient_profile else None,
                "patientGender": patient_profile.gender if patient_profile else None,
                "bloodGroup": patient_profile.blood_group if patient_profile else None,
                "chronicConditions": _chronic_conditions_from_profile(patient_profile),
                "reason": matching_appointment.reason,
                "status": _status_value(matching_appointment.status),
                "appointmentDate": matching_appointment.appointment_date.isoformat(),
                "cancellationReasonKey": matching_appointment.cancellation_reason_key,
                "cancellationReasonNote": matching_appointment.cancellation_reason_note,
                "cancelledAt": matching_appointment.cancelled_at.isoformat() if matching_appointment.cancelled_at else None,
            }
        )

    return slot_data


@router.get("/cancellation-reasons")
async def get_cancellation_reason_catalog():
    return {
        "buffer_minutes": appointment_service.APPOINTMENT_CANCEL_BUFFER_MINUTES,
        "patient": [
            {"key": key, "label": _reason_label(key)}
            for key in sorted(PATIENT_ALLOWED_CANCELLATION_REASONS)
        ],
        "doctor": [
            {"key": key, "label": _reason_label(key)}
            for key in sorted(DOCTOR_ALLOWED_CANCELLATION_REASONS)
        ],
    }


@router.patch("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: str,
    cancel_data: AppointmentCancelRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Request cancellation. For CONFIRMED appointments this creates a cancellation request
    that admin must approve. Patients can still directly withdraw their own PENDING_ADMIN_REVIEW
    requests via /pending-request endpoint."""
    user_id = user.id

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    result_appt = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result_appt.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    is_patient = appointment.patient_id == user_id
    is_doctor = appointment.doctor_id == user_id
    if not (is_patient or is_doctor):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")

    if appointment.status == AppointmentStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Pending requests must use the pending-request delete endpoint",
        )

    cancellable_lifecycle_statuses = {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.RESCHEDULE_REQUESTED,
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
        AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
    }
    if appointment.status not in cancellable_lifecycle_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel appointment with status {appointment.status.value}",
        )

    role_str = str(profile.role).upper()
    performed_by_role = "patient" if "PATIENT" in role_str else "doctor"

    reason_key = cancel_data.reason_key.value
    reason_note = _normalize_cancellation_note(cancel_data.reason_note)
    _validate_cancellation_reason_for_role(reason_key, performed_by_role)

    try:
        appointment_service.validate_cancellation_window(appointment)
        # For CONFIRMED appointments, create a cancellation request awaiting admin review.
        if appointment.status == AppointmentStatus.CONFIRMED:
            await appointment_service.request_cancellation(
                db,
                appointment_id=appointment_id,
                requested_by_id=user_id,
                requested_by_role=performed_by_role,
                reason_key=reason_key,
                reason_note=reason_note,
            )
        else:
            # In-flight states (reschedule, doctor/patient confirmation pending) can still
            # be cancelled directly — admin review isn't required because the appointment
            # is not yet actively binding.
            cancel_status = appointment_service.get_role_based_cancel_status(performed_by_role)
            await appointment_service.transition_status(
                db,
                appointment_id=appointment_id,
                new_status=cancel_status,
                performed_by_id=user_id,
                performed_by_role=performed_by_role,
                notes=reason_note,
                cancellation_reason_key=reason_key,
                cancellation_reason_note=reason_note,
            )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.delete("/{appointment_id}/pending-request", response_model=AppointmentResponse)
async def delete_pending_request(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient can delete only their own pending appointment requests."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can delete pending requests")

    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.patient_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this request")

    if appointment.status not in {
        AppointmentStatus.PENDING,
        AppointmentStatus.PENDING_ADMIN_REVIEW,
    }:
        raise HTTPException(
            status_code=400,
            detail="Only pending appointment requests can be deleted",
        )

    try:
        appointment = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=AppointmentStatus.CANCELLED_BY_PATIENT,
            performed_by_id=user_id,
            performed_by_role="patient",
            notes="PENDING_REQUEST_DELETED",
            cancellation_reason_key=CancellationReasonKey.OTHER.value,
            cancellation_reason_note="Pending request deleted by patient",
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: str,
    update_data: AppointmentUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Update appointment status using the state machine.
    Doctor can Confirm/Complete/Cancel. Patient can Cancel.
    All transitions are validated and audit-logged.
    """
    user_id = user.id

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    result_appt = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result_appt.scalar_one_or_none()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    is_patient = appointment.patient_id == user_id
    is_doctor = appointment.doctor_id == user_id

    if not (is_patient or is_doctor):
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")

    role_str = str(profile.role).upper()
    performed_by_role = "patient" if "PATIENT" in role_str else "doctor"

    if update_data.status is not None:
        # Normalize status
        if isinstance(update_data.status, AppointmentStatus):
            new_status = update_data.status
        else:
            try:
                new_status = AppointmentStatus(update_data.status)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid status value")

        if new_status in CANCELLATION_STATUSES:
            if appointment.status == AppointmentStatus.PENDING:
                raise HTTPException(
                    status_code=400,
                    detail="Pending requests must use the pending-request delete endpoint",
                )
            reason_note = _normalize_cancellation_note(update_data.notes)
            reason_key = CancellationReasonKey.OTHER.value
            _validate_cancellation_reason_for_role(reason_key, performed_by_role)
            new_status = appointment_service.get_role_based_cancel_status(performed_by_role)

            try:
                appointment_service.validate_cancellation_window(appointment)
                appointment = await appointment_service.transition_status(
                    db,
                    appointment_id=appointment_id,
                    new_status=new_status,
                    performed_by_id=user_id,
                    performed_by_role=performed_by_role,
                    notes=reason_note,
                    cancellation_reason_key=reason_key,
                    cancellation_reason_note=reason_note,
                )
            except ValueError as error:
                raise HTTPException(status_code=400, detail=str(error))
        else:
            # Patients can only cancel
            if is_patient:
                raise HTTPException(status_code=403, detail="Patients can only cancel appointments")
            if new_status == AppointmentStatus.RESCHEDULE_REQUESTED:
                raise HTTPException(
                    status_code=400,
                    detail="Use reschedule request endpoints instead of direct status patch",
                )
            if new_status == AppointmentStatus.CANCEL_REQUESTED:
                raise HTTPException(
                    status_code=400,
                    detail="Use cancellation endpoint instead of direct status patch",
                )

            try:
                appointment = await appointment_service.transition_status(
                    db,
                    appointment_id=appointment_id,
                    new_status=new_status,
                    performed_by_id=user_id,
                    performed_by_role=performed_by_role,
                    notes=update_data.notes,
                )
            except ValueError as error:
                raise HTTPException(status_code=400, detail=str(error))
    else:
        # Non-status updates (notes only)
        if update_data.notes and is_doctor:
            appointment.notes = update_data.notes
        if update_data.appointment_date:
            raise HTTPException(
                status_code=400,
                detail="Direct appointment_date updates are not allowed; use reschedule requests",
            )

    await db.commit()
    await db.refresh(appointment)

    if update_data.status is not None and new_status == AppointmentStatus.COMPLETED:
        doctor_profile_result = await db.execute(
            select(Profile).where(Profile.id == appointment.doctor_id)
        )
        doctor_profile = doctor_profile_result.scalar_one_or_none()
        doctor_name = (
            f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}"
            if doctor_profile
            else "Doctor"
        )

        await create_appointment_completed_action(db, appointment=appointment)
        await notification_service.notify_appointment_completed(
            db,
            patient_id=appointment.patient_id,
            doctor_name=doctor_name,
            appointment_id=appointment.id,
            doctor_id=appointment.doctor_id,
        )
        await db.commit()

    return appointment

# === Stats & Upcoming endpoints ===

@router.get("/stats")
async def get_appointment_stats(user: any = Depends(get_current_user_token), db: AsyncSession = Depends(get_db)):
    """Return summary stats for the current doctor"""
    user_id = user.id
    # Ensure profile exists
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can view these stats")

    # Today's range (UTC) - can be adjusted for locale if needed
    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    # Counts
    todays_count = await db.execute(
        select(func.count()).where(
            Appointment.doctor_id == user_id,
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date < end_of_day
        )
    )
    todays_count = todays_count.scalar() or 0

    pending_count = await db.execute(
        select(func.count()).where(
            Appointment.doctor_id == user_id,
            Appointment.status == AppointmentStatus.PENDING
        )
    )
    pending_count = pending_count.scalar() or 0

    total_patients_q = await db.execute(
        select(func.count(distinct(Appointment.patient_id))).where(Appointment.doctor_id == user_id)
    )
    total_patients = total_patients_q.scalar() or 0

    total_q = await db.execute(select(func.count()).where(Appointment.doctor_id == user_id))
    total = total_q.scalar() or 0

    completed_q = await db.execute(select(func.count()).where(Appointment.doctor_id == user_id, Appointment.status == AppointmentStatus.COMPLETED))
    completed = completed_q.scalar() or 0

    completion_rate = (completed / total * 100) if total > 0 else 0

    return {
        "todays_appointments": int(todays_count),
        "total_patients": int(total_patients),
        "pending_reviews": int(pending_count),
        "completion_rate": round(completion_rate, 1)
    }

@router.get("/upcoming")
async def get_upcoming_appointments(limit: int = 3, user: any = Depends(get_current_user_token), db: AsyncSession = Depends(get_db)):
    """Return next upcoming appointments for the current user (doctor or patient)"""
    user_id = user.id
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    now = datetime.now(timezone.utc)

    query = select(Appointment).where(
        Appointment.appointment_date >= now,
        Appointment.status.notin_(list(UPCOMING_EXCLUDED_STATUSES)),
    )
    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        query = query.where(Appointment.patient_id == user_id)
    elif "DOCTOR" in role_str:
        query = query.where(Appointment.doctor_id == user_id)

    query = query.order_by(Appointment.appointment_date.asc()).limit(limit)

    result = await db.execute(query)
    appts = result.scalars().all()
    if not appts:
        return []

    related_profile_ids = {appt.patient_id for appt in appts} | {appt.doctor_id for appt in appts}
    profile_rows = await db.execute(select(Profile).where(Profile.id.in_(related_profile_ids)))
    profiles_by_id = {row.id: row for row in profile_rows.scalars().all()}

    out = []
    for appt in appts:
        patient = profiles_by_id.get(appt.patient_id)
        doctor = profiles_by_id.get(appt.doctor_id)

        out.append({
            "id": appt.id,
            "appointment_date": appt.appointment_date.isoformat(),
            "reason": appt.reason,
            "notes": appt.notes,
            "status": _status_value(appt.status),
            "hold_expires_at": appt.hold_expires_at.isoformat() if appt.hold_expires_at else None,
            "cancellation_reason_key": appt.cancellation_reason_key,
            "cancellation_reason_note": appt.cancellation_reason_note,
            "cancelled_at": appt.cancelled_at.isoformat() if appt.cancelled_at else None,
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None
        })

    return out


# === New Enhanced Appointment Endpoints ===

@router.get("/doctor/{doctor_id}/booked-slots")
async def get_doctor_booked_slots(
    doctor_id: str,
    date: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all booked/confirmed time slots for a doctor on a specific date.
    Delegates to slot_service for structured availability with fallback.
    Public endpoint for patients to see availability.
    """
    # Verify doctor exists
    doc_result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id))
    doctor_profile = doc_result.scalar_one_or_none()

    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Parse date
    try:
        target_date = datetime.strptime(date[:10], "%Y-%m-%d").date()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")

    result = await slot_service.get_available_slots(db, doctor_id, target_date)

    # Flatten grouped slots into the legacy booked-slots format
    slot_data = []
    for group in result.get("slot_groups", []):
        for slot in group.get("slots", []):
            is_past = slot.get("is_past", False)
            is_available = slot.get("is_available", True)
            slot_data.append({
                "time": slot["time"],
                "is_past": is_past,
                "is_booked": (not is_available) and (not is_past),
                "appointment_id": slot.get("appointment_id"),
                "status": slot.get("status"),
                "reason": None,
            })

    return {
        "date": date,
        "doctor_id": doctor_id,
        "appointment_duration": doctor_profile.appointment_duration or 30,
        "slots": slot_data,
    }


@router.get("/patient/previously-visited")
async def get_previously_visited_doctors(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of doctors the patient has previously had appointments with.
    Returns doctor info for suggestion display.
    """
    user_id = user.id
    
    # Verify user is a patient
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    from app.db.models.speciality import Speciality

    latest_visits_subq = (
        select(
            Appointment.doctor_id.label("doctor_id"),
            func.max(Appointment.appointment_date).label("last_visit"),
        )
        .where(
            Appointment.patient_id == user_id,
            Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED]),
        )
        .group_by(Appointment.doctor_id)
        .subquery()
    )

    query = (
        select(
            latest_visits_subq.c.doctor_id,
            latest_visits_subq.c.last_visit,
            DoctorProfile,
            Profile,
            Speciality,
        )
        .join(DoctorProfile, DoctorProfile.profile_id == latest_visits_subq.c.doctor_id)
        .join(Profile, Profile.id == latest_visits_subq.c.doctor_id)
        .outerjoin(Speciality, Speciality.id == DoctorProfile.speciality_id)
        .order_by(latest_visits_subq.c.last_visit.desc())
        .limit(5)
    )

    result = await db.execute(query)
    doctors = []
    for doctor_id, last_visit, doc_profile, doc_name, speciality in result.all():
        doctors.append({
            "doctor_id": doctor_id,
            "profile_id": doctor_id,
            "first_name": doc_name.first_name,
            "last_name": doc_name.last_name,
            "title": doc_profile.title,
            "specialization": speciality.name if speciality else doc_profile.specialization,
            "photo_url": doc_profile.profile_photo_url,
            "profile_photo_url": doc_profile.profile_photo_url,
            "hospital_name": doc_profile.hospital_name,
            "hospital_city": doc_profile.hospital_city,
            "consultation_fee": doc_profile.consultation_fee,
            "last_visit": last_visit.isoformat() if last_visit else None,
        })
    
    return {"doctors": doctors, "total": len(doctors)}


@router.get("/patient/calendar")
async def get_patient_calendar_appointments(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all appointments for patient formatted for calendar view.
    Groups appointments by date with status info.
    """
    user_id = user.id
    
    # Verify user is a patient
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    # Get all patient appointments
    query = select(Appointment).distinct().where(
        Appointment.patient_id == user_id
    ).order_by(Appointment.appointment_date.desc())
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    if not appointments:
        return {"appointments": [], "by_date": [], "total": 0}

    latest_pending_reschedules = await _latest_pending_reschedules_by_appointment(
        db,
        [appointment.id for appointment in appointments],
    )

    from app.db.models.speciality import Speciality

    doctor_ids = {appointment.doctor_id for appointment in appointments}
    doctors_by_id: dict[str, Profile] = {}
    if doctor_ids:
        doctor_rows = await db.execute(select(Profile).where(Profile.id.in_(doctor_ids)))
        doctors_by_id = {row.id: row for row in doctor_rows.scalars().all()}

    doctor_profiles_by_id: dict[str, DoctorProfile] = {}
    if doctor_ids:
        doctor_profile_rows = await db.execute(
            select(DoctorProfile).where(DoctorProfile.profile_id.in_(doctor_ids))
        )
        doctor_profiles_by_id = {
            row.profile_id: row for row in doctor_profile_rows.scalars().all()
        }

    speciality_ids = {
        doctor_profile.speciality_id
        for doctor_profile in doctor_profiles_by_id.values()
        if doctor_profile.speciality_id
    }
    specialities_by_id = {}
    if speciality_ids:
        speciality_rows = await db.execute(select(Speciality).where(Speciality.id.in_(speciality_ids)))
        specialities_by_id = {row.id: row for row in speciality_rows.scalars().all()}
    
    # Group by date
    appointments_by_date = {}
    all_appointments = []
    
    for appt in appointments:
        date_key = appt.appointment_date.strftime("%Y-%m-%d")
        pending_reschedule = latest_pending_reschedules.get(appt.id)
        
        doctor = doctors_by_id.get(appt.doctor_id)
        doc_profile = doctor_profiles_by_id.get(appt.doctor_id)
        speciality = specialities_by_id.get(doc_profile.speciality_id) if doc_profile and doc_profile.speciality_id else None
        
        # Canonical slot value first, with legacy notes fallback for older rows.
        slot_time = (
            appt.slot_time.strftime("%I:%M %p").lstrip("0")
            if appt.slot_time
            else None
        )
        if not slot_time and appt.notes:
            slot_match = re.search(r'Slot:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))', appt.notes, re.IGNORECASE)
            if slot_match:
                slot_time = slot_match.group(1)
        
        appt_data = {
            "id": appt.id,
            "date": date_key,
            "appointment_date": appt.appointment_date.isoformat(),
            "slot_time": slot_time,
            "status": _status_value(appt.status),
            "hold_expires_at": appt.hold_expires_at.isoformat() if appt.hold_expires_at else None,
            "reason": appt.reason,
            "notes": appt.notes,
            "cancellation_reason_key": appt.cancellation_reason_key,
            "cancellation_reason_note": appt.cancellation_reason_note,
            "cancelled_at": appt.cancelled_at.isoformat() if appt.cancelled_at else None,
            "doctor_id": appt.doctor_id,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "doctor_title": doc_profile.title if doc_profile else None,
            "doctor_specialization": (speciality.name if speciality else None) or (doc_profile.specialization if doc_profile else None),
            "doctor_photo_url": doc_profile.profile_photo_url if doc_profile else None,
            "hospital_name": doc_profile.hospital_name if doc_profile else None,
            "reschedule_request_id": pending_reschedule.id if pending_reschedule else None,
            "reschedule_requested_by_role": (
                pending_reschedule.requested_by_role.value if pending_reschedule else None
            ),
            "proposed_date": pending_reschedule.proposed_date.isoformat() if pending_reschedule else None,
            "proposed_time": pending_reschedule.proposed_time.isoformat() if pending_reschedule else None,
            "reschedule_admin_approval_status": (
                pending_reschedule.admin_approval_status.value if pending_reschedule else None
            ),
        }
        
        all_appointments.append(appt_data)
        
        if date_key not in appointments_by_date:
            appointments_by_date[date_key] = {
                "date": date_key,
                "count": 0,
                "statuses": [],
                "appointments": []
            }
        
        appointments_by_date[date_key]["count"] += 1
        appointments_by_date[date_key]["statuses"].append(_status_value(appt.status))
        appointments_by_date[date_key]["appointments"].append(appt_data)
    
    return {
        "appointments": all_appointments,
        "by_date": list(appointments_by_date.values()),
        "total": len(appointments)
    }


@router.get("/doctor/patients")
async def get_doctor_patients(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of patients who have had completed appointments with this doctor.
    Returns patient info with visit history summary.
    """
    user_id = user.id
    
    # Verify user is a doctor
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
    
    query = (
        select(Appointment)
        .where(
            Appointment.doctor_id == user_id,
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        .order_by(Appointment.appointment_date.desc())
    )

    result = await db.execute(query)
    appointments = result.scalars().all()
    if not appointments:
        return {"patients": [], "total": 0}

    stats_by_patient: dict[str, dict] = {}
    for appt in appointments:
        stat = stats_by_patient.get(appt.patient_id)
        if not stat:
            stats_by_patient[appt.patient_id] = {
                "total_visits": 1,
                "last_visit": appt.appointment_date,
                "last_reason": appt.reason,
            }
        else:
            stat["total_visits"] += 1

    patient_ids = set(stats_by_patient.keys())
    patient_rows = await db.execute(select(Profile).where(Profile.id.in_(patient_ids)))
    patients_by_id = {row.id: row for row in patient_rows.scalars().all()}

    patient_profile_rows = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id.in_(patient_ids))
    )
    patient_profiles_by_id = {
        row.profile_id: row for row in patient_profile_rows.scalars().all()
    }

    patients = []
    for patient_id, stats in stats_by_patient.items():
        patient = patients_by_id.get(patient_id)
        if not patient:
            continue
        patient_profile = patient_profiles_by_id.get(patient_id)

        patients.append({
            "patient_id": patient_id,
            "patient_ref": patient_ref_from_uuid(patient_id),
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "phone": patient.phone,
            "profile_photo_url": patient_profile.profile_photo_url if patient_profile else None,
            "age": _calculate_age(patient_profile.date_of_birth) if patient_profile else None,
            "gender": patient_profile.gender if patient_profile else None,
            "blood_group": patient_profile.blood_group if patient_profile else None,
            "chronic_conditions": _chronic_conditions_from_profile(patient_profile),
            "total_visits": stats["total_visits"],
            "last_visit": stats["last_visit"].isoformat() if stats["last_visit"] else None,
            "last_reason": stats["last_reason"],
        })

    return {"patients": patients, "total": len(patients)}


@router.post("/sync-status")
async def sync_appointment_status(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync appointment statuses (placeholder for future auto-sync logic).
    Currently just validates user and returns success.
    Appointments are NOT auto-completed - doctor must manually mark them complete.
    """
    user_id = user.id
    
    # Get user role
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "message": "Status sync successful",
        "updated_count": 0
    }


@router.get("/{appointment_id}/can-complete")
async def can_complete_appointment(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-side check whether a doctor can mark an appointment as completed.
    Returns { can_complete: bool, reason: str | None }
    """
    user_id = user.id

    # Get user role
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can query completion eligibility")

    # Get appointment
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Verify doctor owns this appointment
    if appointment.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="You can only check appointments for your own profile")

    # If not confirmed, cannot complete
    if appointment.status != AppointmentStatus.CONFIRMED:
        return {"can_complete": False, "reason": "Appointment is not CONFIRMED"}

    now = datetime.now(timezone.utc)

    if appointment.appointment_date <= now:
        return {"can_complete": True, "reason": None}

    return {"can_complete": False, "reason": "Appointment time has not passed yet"}


@router.patch("/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Doctor marks appointment as COMPLETED after the appointment time has passed.
    Only the doctor can complete their own appointments.
    """
    user_id = user.id
    
    # Get user role
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can complete appointments")
    
    # Get appointment
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify doctor owns this appointment
    if appointment.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="You can only complete your own appointments")
    
    # Verify appointment is CONFIRMED
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete appointment with status {appointment.status}. Must be CONFIRMED."
        )
    
    # Verify appointment time has passed
    now = datetime.now(timezone.utc)
    if appointment.appointment_date > now:
        raise HTTPException(
            status_code=400,
            detail="Cannot complete appointment before its scheduled time"
        )
    
    # Mark as completed via state machine with audit trail
    try:
        appointment = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=AppointmentStatus.COMPLETED,
            performed_by_id=user_id,
            performed_by_role="doctor",
            notes="Appointment completed by doctor",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    await db.refresh(appointment)

    return {
        "message": "Appointment marked as completed",
        "appointment": {
            "id": appointment.id,
            "status": appointment.status.value
        }
    }



@router.post("/{appointment_id}/reschedule-requests", status_code=status.HTTP_201_CREATED)
async def create_appointment_reschedule_request(
    appointment_id: str,
    payload: AppointmentRescheduleRequestCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Canonical endpoint for doctor/patient reschedule proposals."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    appointment_result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = appointment_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.patient_id != user_id and appointment.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this appointment")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        requested_by_role = "patient"
    elif "DOCTOR" in role_str:
        requested_by_role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can request reschedule")

    try:
        reschedule_request = await appointment_service.request_reschedule(
            db,
            appointment_id=appointment_id,
            requested_by_id=user_id,
            requested_by_role=requested_by_role,
            proposed_date=payload.proposed_date,
            proposed_time=payload.proposed_time,
            reason=payload.reason,
        )
    except ValueError as error:
        detail = str(error)
        status_code = 409 if ("not available" in detail.lower() or "held by another pending" in detail.lower()) else 400
        raise HTTPException(status_code=status_code, detail=detail)

    await db.commit()
    return {
        "id": reschedule_request.id,
        "appointment_id": reschedule_request.appointment_id,
        "requested_by_id": reschedule_request.requested_by_id,
        "requested_by_role": reschedule_request.requested_by_role.value,
        "proposed_date": reschedule_request.proposed_date.isoformat(),
        "proposed_time": reschedule_request.proposed_time.isoformat(),
        "reason": reschedule_request.reason,
        "status": reschedule_request.status.value,
        "expires_at": reschedule_request.expires_at.isoformat() if reschedule_request.expires_at else None,
    }


@router.post("/reschedule-requests/{request_id}/respond")
async def respond_to_appointment_reschedule_request(
    request_id: str,
    payload: AppointmentRescheduleRespond,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Canonical endpoint for accepting/rejecting a reschedule proposal."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        responded_by_role = "patient"
    elif "DOCTOR" in role_str:
        responded_by_role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can respond")

    try:
        reschedule_request = await appointment_service.respond_to_reschedule(
            db,
            reschedule_request_id=request_id,
            accept=payload.accept,
            responded_by_id=user_id,
            responded_by_role=responded_by_role,
            response_note=payload.response_note,
        )
    except ValueError as error:
        detail = str(error)
        status_code = 409 if "slot" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail)

    await db.commit()

    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == reschedule_request.appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()

    return {
        "id": reschedule_request.id,
        "appointment_id": reschedule_request.appointment_id,
        "status": reschedule_request.status.value,
        "responded_at": reschedule_request.responded_at.isoformat() if reschedule_request.responded_at else None,
        "response_note": reschedule_request.response_note,
        "appointment_status": appointment.status.value if appointment else None,
        "appointment_date": appointment.appointment_date.isoformat() if appointment else None,
    }


@router.post("/reschedule-requests/{request_id}/withdraw")
async def withdraw_appointment_reschedule_request(
    request_id: str,
    payload: AppointmentRescheduleWithdraw,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Allow the original requester to withdraw their pending reschedule request."""
    user_id = user.id

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role_str = str(profile.role).upper()
    if "PATIENT" in role_str:
        requester_role = "patient"
    elif "DOCTOR" in role_str:
        requester_role = "doctor"
    else:
        raise HTTPException(status_code=403, detail="Only doctor or patient can withdraw a reschedule request")

    try:
        reschedule_request = await appointment_service.withdraw_reschedule_request(
            db,
            reschedule_request_id=request_id,
            requester_id=user_id,
            requester_role=requester_role,
            response_note=payload.response_note,
        )
    except ValueError as error:
        detail = str(error)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        if "only the requester" in detail.lower() or "not authorized" in detail.lower():
            raise HTTPException(status_code=403, detail=detail)
        raise HTTPException(status_code=400, detail=detail)

    await db.commit()

    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == reschedule_request.appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()

    return {
        "id": reschedule_request.id,
        "appointment_id": reschedule_request.appointment_id,
        "status": reschedule_request.status.value,
        "responded_at": reschedule_request.responded_at.isoformat() if reschedule_request.responded_at else None,
        "response_note": reschedule_request.response_note,
        "appointment_status": appointment.status.value if appointment else None,
        "appointment_date": appointment.appointment_date.isoformat() if appointment else None,
    }


@router.post("/{appointment_id}/request-reschedule")
async def request_appointment_reschedule_legacy(
    appointment_id: str,
    reschedule_data: dict,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Legacy wrapper to the canonical reschedule-request endpoint."""
    raw_datetime = str(reschedule_data.get("new_appointment_date", ""))
    try:
        proposed_datetime = datetime.fromisoformat(raw_datetime.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid new_appointment_date format")

    payload = AppointmentRescheduleRequestCreate(
        proposed_date=proposed_datetime.date(),
        proposed_time=proposed_datetime.time().replace(second=0, microsecond=0, tzinfo=None),
        reason=reschedule_data.get("reason"),
    )
    response = await create_appointment_reschedule_request(
        appointment_id=appointment_id,
        payload=payload,
        user=user,
        db=db,
    )
    return {
        "message": "Reschedule request sent",
        "appointment": {
            "id": appointment_id,
            "status": AppointmentStatus.RESCHEDULE_REQUESTED.value,
            "proposed_date": proposed_datetime.isoformat(),
            "reschedule_request_id": response["id"],
        },
    }


@router.post("/{appointment_id}/reschedule-response")
async def respond_to_reschedule_request_legacy(
    appointment_id: str,
    response_data: dict,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Legacy wrapper that resolves pending request by appointment id."""
    appointment_result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = appointment_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    user_id = user.id
    if appointment.patient_id != user_id and appointment.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this appointment")

    pending_result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(
            AppointmentRescheduleRequest.appointment_id == appointment_id,
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
        .order_by(AppointmentRescheduleRequest.created_at.desc())
        .limit(1)
    )
    pending_request = pending_result.scalar_one_or_none()
    if not pending_request:
        raise HTTPException(status_code=404, detail="No pending reschedule request found")

    payload = AppointmentRescheduleRespond(
        accept=bool(response_data.get("accepted", False)),
        response_note=response_data.get("response_note"),
    )
    response = await respond_to_appointment_reschedule_request(
        request_id=pending_request.id,
        payload=payload,
        user=user,
        db=db,
    )
    return {
        "message": "Reschedule accepted" if payload.accept else "Reschedule rejected",
        "appointment": {
            "id": appointment_id,
            "status": response.get("appointment_status"),
            "appointment_date": response.get("appointment_date"),
            "reschedule_request_id": pending_request.id,
        },
    }


@router.post("/{appointment_id}/doctor-confirm")
async def doctor_confirm_appointment(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Doctor confirms an appointment that admin has approved.

    Moves the appointment from PENDING_DOCTOR_CONFIRMATION to
    PENDING_PATIENT_CONFIRMATION and pings the patient to finalise.
    """
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Only the assigned doctor can confirm")
    if appointment.status != AppointmentStatus.PENDING_DOCTOR_CONFIRMATION:
        raise HTTPException(
            status_code=400,
            detail=f"Appointment is not awaiting doctor confirmation (current: {appointment.status.value})",
        )

    try:
        updated = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
            performed_by_id=user.id,
            performed_by_role="doctor",
            notes="Doctor confirmed; awaiting patient confirmation",
        )
        await db.commit()
        return {
            "appointment_id": updated.id,
            "new_status": updated.status.value,
        }
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{appointment_id}/patient-confirm")
async def patient_confirm_appointment(
    appointment_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient confirms the final booking after doctor has confirmed."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=403, detail="Only the booking patient can confirm")
    if appointment.status != AppointmentStatus.PENDING_PATIENT_CONFIRMATION:
        raise HTTPException(
            status_code=400,
            detail=f"Appointment is not awaiting patient confirmation (current: {appointment.status.value})",
        )

    try:
        updated = await appointment_service.transition_status(
            db,
            appointment_id=appointment_id,
            new_status=AppointmentStatus.CONFIRMED,
            performed_by_id=user.id,
            performed_by_role="patient",
            notes="Patient confirmed; booking finalised",
        )
        await db.commit()
        return {
            "appointment_id": updated.id,
            "new_status": updated.status.value,
        }
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
