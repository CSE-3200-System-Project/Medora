from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.enums import UserRole
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
import uuid
from typing import List

router = APIRouter()

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
    
    return new_appointment

@router.get("/my-appointments", response_model=List[AppointmentResponse])
async def get_my_appointments(
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
        
    query = select(Appointment)
    
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
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    # Serialize appointments to JSON-friendly dicts and ensure status is string value
    out = []
    for a in appointments:
        patient_res = await db.execute(select(Profile).where(Profile.id == a.patient_id))
        patient = patient_res.scalar_one_or_none()
        doctor_res = await db.execute(select(Profile).where(Profile.id == a.doctor_id))
        doctor = doctor_res.scalar_one_or_none()

        status_value = a.status.value if hasattr(a.status, 'value') else str(a.status)

        out.append({
            "id": a.id,
            "appointment_date": a.appointment_date.isoformat(),
            "reason": a.reason,
            "notes": a.notes,
            "status": status_value,
            "patient_id": a.patient_id,
            "doctor_id": a.doctor_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })

    return out

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
        print(f"Debug: Changing appointment {appointment.id} status from {appointment.status} to {new_status}")
        appointment.status = new_status
        
    if update_data.notes and is_doctor:
        appointment.notes = update_data.notes
        
    if update_data.appointment_date:
        # Maybe allow rescheduling?
        appointment.appointment_date = update_data.appointment_date

    await db.commit()
    await db.refresh(appointment)
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

    # Attach simple names for frontend convenience
    out = []
    for a in appts:
        # Fetch patient name and/or doctor name
        patient_res = await db.execute(select(Profile).where(Profile.id == a.patient_id))
        patient = patient_res.scalar_one_or_none()
        doctor_res = await db.execute(select(Profile).where(Profile.id == a.doctor_id))
        doctor = doctor_res.scalar_one_or_none()

        out.append({
            "id": a.id,
            "appointment_date": a.appointment_date.isoformat(),
            "reason": a.reason,
            "notes": a.notes,
            "status": a.status,
            "patient_id": a.patient_id,
            "doctor_id": a.doctor_id,
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None
        })

    return out
