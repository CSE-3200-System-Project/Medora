from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import distinct, func, select
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.enums import UserRole
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.routes.notification import create_notification
import uuid
from typing import List
from datetime import datetime, timedelta, timezone, date as date_class
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
        slot_index[_slot_label_from_datetime(appointment.appointment_date)] = appointment

        if appointment.notes:
            note_match = SLOT_NOTE_PATTERN.search(appointment.notes)
            if note_match:
                slot_index[_normalize_slot_label(note_match.group(1))] = appointment

    return slot_index

@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment_data: AppointmentCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Patient books an appointment with a doctor.
    """
    user_id = user.id
    
    # Verify user is a patient
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Handle uppercase role values from database (PATIENT, DOCTOR, ADMIN)
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail=f"Only patients can book appointments")
    
    # Verify doctor exists
    result_doc = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == appointment_data.doctor_id))
    doctor = result_doc.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Get doctor's profile for name
    doctor_profile_result = await db.execute(select(Profile).where(Profile.id == appointment_data.doctor_id))
    doctor_profile = doctor_profile_result.scalar_one_or_none()

    new_appointment = Appointment(
        id=str(uuid.uuid4()),
        doctor_id=appointment_data.doctor_id,
        patient_id=user_id,
        appointment_date=appointment_data.appointment_date,
        reason=appointment_data.reason,
        notes=appointment_data.notes,
        status=AppointmentStatus.PENDING
    )
    
    db.add(new_appointment)
    await db.commit()
    await db.refresh(new_appointment)
    
    # Create notification for doctor about new appointment
    patient_name = f"{profile.first_name} {profile.last_name}"
    appt_date = appointment_data.appointment_date.strftime("%b %d, %Y at %I:%M %p")
    
    await create_notification(
        db=db,
        user_id=appointment_data.doctor_id,
        notification_type=NotificationType.APPOINTMENT_BOOKED,
        title="New Appointment Request",
        message=f"{patient_name} has booked an appointment for {appt_date}",
        action_url="/doctor/appointments",
        metadata={
            "appointment_id": new_appointment.id,
            "patient_id": user_id,
            "patient_name": patient_name,
        },
        priority=NotificationPriority.HIGH,
    )
    
    return new_appointment

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
        query = query.where(Appointment.patient_id == user_id)
    elif "DOCTOR" in role_str:
        query = query.where(Appointment.doctor_id == user_id)
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
        patient = profiles_by_id.get(appt.patient_id)
        doctor = profiles_by_id.get(appt.doctor_id)
        patient_profile = patient_profiles_by_id.get(appt.patient_id)

        out.append({
            "id": appt.id,
            "appointment_date": appt.appointment_date.isoformat(),
            "reason": appt.reason,
            "notes": appt.notes,
            "status": _status_value(appt.status),
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "patient_phone": patient.phone if patient and "DOCTOR" in role_str else None,
            "patient_age": _calculate_age(patient_profile.date_of_birth) if patient_profile else None,
            "patient_gender": patient_profile.gender if patient_profile else None,
            "blood_group": patient_profile.blood_group if patient_profile else None,
            "chronic_conditions": _chronic_conditions_from_profile(patient_profile),
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
    
    # Get all appointments for this date
    query = select(Appointment).where(
        Appointment.doctor_id == user_id,
        Appointment.appointment_date >= start_of_day,
        Appointment.appointment_date < end_of_day
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
                "patientPhone": patient.phone if patient else None,
                "patientAge": _calculate_age(patient_profile.date_of_birth) if patient_profile else None,
                "patientGender": patient_profile.gender if patient_profile else None,
                "bloodGroup": patient_profile.blood_group if patient_profile else None,
                "chronicConditions": _chronic_conditions_from_profile(patient_profile),
                "reason": matching_appointment.reason,
                "status": _status_value(matching_appointment.status),
                "appointmentDate": matching_appointment.appointment_date.isoformat(),
            }
        )

    return slot_data


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: str,
    update_data: AppointmentUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Update appointment status (Cancel, Confirm, Complete).
     Doctor can Confirm/Complete/Cancel.
     Patient can Cancel.
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
        
    # Permission check
    is_patient = appointment.patient_id == user_id
    is_doctor = appointment.doctor_id == user_id
    
    if not (is_patient or is_doctor):
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")
        
    if update_data.status is not None:
        # Normalize status to AppointmentStatus enum
        new_status = None
        if isinstance(update_data.status, AppointmentStatus):
            new_status = update_data.status
        else:
            # Try to coerce from string
            try:
                new_status = AppointmentStatus(update_data.status)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid status value")

        # Rules
        if is_patient and new_status != AppointmentStatus.CANCELLED:
            raise HTTPException(status_code=403, detail="Patients can only cancel appointments")

        # Doctor can do anything
        appointment.status = new_status
        
    if update_data.notes and is_doctor:
        appointment.notes = update_data.notes
        
    if update_data.appointment_date:
        # Maybe allow rescheduling?
        appointment.appointment_date = update_data.appointment_date

    await db.commit()
    await db.refresh(appointment)
    
    # Send notification based on status change
    if update_data.status is not None:
        # Get both patient and doctor profiles for names
        patient_profile_result = await db.execute(select(Profile).where(Profile.id == appointment.patient_id))
        patient_profile = patient_profile_result.scalar_one_or_none()
        doctor_profile_result = await db.execute(select(Profile).where(Profile.id == appointment.doctor_id))
        doctor_profile = doctor_profile_result.scalar_one_or_none()
        
        patient_name = f"{patient_profile.first_name} {patient_profile.last_name}" if patient_profile else "Patient"
        doctor_name = f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else "Doctor"
        appt_date = appointment.appointment_date.strftime("%b %d, %Y at %I:%M %p")
        
        if new_status == AppointmentStatus.CONFIRMED:
            # Notify patient that appointment is confirmed
            await create_notification(
                db=db,
                user_id=appointment.patient_id,
                notification_type=NotificationType.APPOINTMENT_CONFIRMED,
                title="Appointment Confirmed",
                message=f"Your appointment with {doctor_name} on {appt_date} has been confirmed",
                action_url="/patient/appointments",
                metadata={"appointment_id": appointment.id, "doctor_id": appointment.doctor_id},
                priority=NotificationPriority.HIGH,
            )
        elif new_status == AppointmentStatus.CANCELLED:
            # Notify the other party about cancellation
            if is_doctor:
                await create_notification(
                    db=db,
                    user_id=appointment.patient_id,
                    notification_type=NotificationType.APPOINTMENT_CANCELLED,
                    title="Appointment Cancelled",
                    message=f"Your appointment with {doctor_name} on {appt_date} has been cancelled",
                    action_url="/patient/appointments",
                    metadata={"appointment_id": appointment.id, "doctor_id": appointment.doctor_id},
                    priority=NotificationPriority.HIGH,
                )
            else:
                await create_notification(
                    db=db,
                    user_id=appointment.doctor_id,
                    notification_type=NotificationType.APPOINTMENT_CANCELLED,
                    title="Appointment Cancelled",
                    message=f"{patient_name} has cancelled the appointment on {appt_date}",
                    action_url="/doctor/appointments",
                    metadata={"appointment_id": appointment.id, "patient_id": appointment.patient_id},
                    priority=NotificationPriority.MEDIUM,
                )
        elif new_status == AppointmentStatus.COMPLETED:
            # Notify patient that appointment is completed
            await create_notification(
                db=db,
                user_id=appointment.patient_id,
                notification_type=NotificationType.APPOINTMENT_COMPLETED,
                title="Appointment Completed",
                message=f"Your appointment with {doctor_name} has been completed. Thank you for visiting!",
                action_url="/patient/appointments",
                metadata={"appointment_id": appointment.id, "doctor_id": appointment.doctor_id},
                priority=NotificationPriority.LOW,
            )
    
    return appointment

# === Stats & Upcoming endpoints ===
from sqlalchemy import func, distinct
from datetime import datetime, timezone, timedelta

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

    query = select(Appointment).where(Appointment.appointment_date >= now)
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
    Returns slots with their booking status and appointment details.
    Public endpoint for patients to see availability.
    """
    # Get doctor profile for time slots configuration
    doc_result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id))
    doctor_profile = doc_result.scalar_one_or_none()
    
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Parse the date
    try:
        target_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
        if target_date.tzinfo is None:
            target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    
    # Get all appointments for this doctor on this date
    query = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date >= start_of_day,
        Appointment.appointment_date < end_of_day,
        Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED])
    )
    
    result = await db.execute(query)
    appointments = result.scalars().all()

    appointment_duration = doctor_profile.appointment_duration or 30
    requested_day_full = start_of_day.strftime("%A")
    time_slots: list[str] = []

    if (
        getattr(doctor_profile, "day_time_slots", None)
        and isinstance(doctor_profile.day_time_slots, dict)
        and len(doctor_profile.day_time_slots) > 0
    ):
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

    if not time_slots:
        time_slots = list(DEFAULT_TIME_SLOTS)

    appointment_by_slot = _build_appointment_slot_index(appointments)
    now = datetime.now(timezone.utc)
    slot_data = []
    for slot_time in time_slots:
        normalized_slot = _normalize_slot_label(slot_time)
        matching_appointment = appointment_by_slot.get(normalized_slot)

        slot_datetime: datetime | None = None
        try:
            parsed_time = datetime.strptime(normalized_slot, "%I:%M %p")
            slot_datetime = datetime(
                target_date.year,
                target_date.month,
                target_date.day,
                parsed_time.hour,
                parsed_time.minute,
                tzinfo=timezone.utc,
            )
        except ValueError:
            slot_datetime = None

        slot_data.append(
            {
                "time": slot_time,
                "is_past": bool(slot_datetime and slot_datetime < now),
                "is_booked": matching_appointment is not None,
                "appointment_id": matching_appointment.id if matching_appointment else None,
                "status": _status_value(matching_appointment.status) if matching_appointment else None,
                "reason": matching_appointment.reason if matching_appointment else None,
            }
        )
    
    return {
        "date": date,
        "doctor_id": doctor_id,
        "appointment_duration": doctor_profile.appointment_duration or 30,
        "slots": slot_data
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
        
        doctor = doctors_by_id.get(appt.doctor_id)
        doc_profile = doctor_profiles_by_id.get(appt.doctor_id)
        speciality = specialities_by_id.get(doc_profile.speciality_id) if doc_profile and doc_profile.speciality_id else None
        
        # Extract time from notes if available
        slot_time = None
        if appt.notes:
            slot_match = re.search(r'Slot:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))', appt.notes, re.IGNORECASE)
            if slot_match:
                slot_time = slot_match.group(1)
        
        appt_data = {
            "id": appt.id,
            "date": date_key,
            "appointment_date": appt.appointment_date.isoformat(),
            "slot_time": slot_time,
            "status": _status_value(appt.status),
            "reason": appt.reason,
            "notes": appt.notes,
            "doctor_id": appt.doctor_id,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "doctor_title": doc_profile.title if doc_profile else None,
            "doctor_specialization": (speciality.name if speciality else None) or (doc_profile.specialization if doc_profile else None),
            "doctor_photo_url": doc_profile.profile_photo_url if doc_profile else None,
            "hospital_name": doc_profile.hospital_name if doc_profile else None,
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
    
    # Mark as completed
    appointment.status = AppointmentStatus.COMPLETED
    appointment.updated_at = now
    
    await db.commit()
    await db.refresh(appointment)
    
    return {
        "message": "Appointment marked as completed",
        "appointment": {
            "id": appointment.id,
            "status": appointment.status.value
        }
    }

