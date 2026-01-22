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
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.routes.notification import create_notification
import uuid
from typing import List
from datetime import datetime, timedelta, timezone, date as date_class
import re

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
        
        # Get patient profile for additional details (if user is doctor)
        patient_age = None
        patient_gender = None
        blood_group = None
        chronic_conditions = []
        
        if "DOCTOR" in role_str:
            patient_profile_res = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == a.patient_id))
            patient_profile = patient_profile_res.scalar_one_or_none()
            
            if patient_profile:
                # Calculate age
                if patient_profile.date_of_birth:
                    today = date_class.today()
                    dob = patient_profile.date_of_birth
                    patient_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                
                patient_gender = patient_profile.gender
                blood_group = patient_profile.blood_group
                
                # Get chronic conditions
                if patient_profile.has_diabetes: chronic_conditions.append("Diabetes")
                if patient_profile.has_hypertension: chronic_conditions.append("Hypertension")
                if patient_profile.has_heart_disease: chronic_conditions.append("Heart Disease")
                if patient_profile.has_asthma: chronic_conditions.append("Asthma")
                if patient_profile.has_kidney_disease: chronic_conditions.append("Kidney Disease")

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
            "patient_phone": patient.phone if patient and "DOCTOR" in role_str else None,
            "patient_age": patient_age,
            "patient_gender": patient_gender,
            "blood_group": blood_group,
            "chronic_conditions": chronic_conditions,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
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
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
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
    
    # Generate time slots based on doctor's actual schedule from onboarding
    time_slots = []

    # Determine requested day's full name
    requested_day_full = start_of_day.strftime('%A')

    # If per-day schedules exist on the doctor (authoritative), use them
    if getattr(doctor_profile, 'day_time_slots', None) and isinstance(doctor_profile.day_time_slots, dict) and len(doctor_profile.day_time_slots) > 0:
        day_slots = doctor_profile.day_time_slots.get(requested_day_full, [])
        if not day_slots or len(day_slots) == 0:
            # No schedule for this day -> return empty slot list mapped with appointments
            # Still map appointments for any existing bookings
            slot_data = []
            # Build empty slots mapping to appointments already present
            # (doctor may have bookings outside normal schedule)
            for appt in appointments:
                slot_time = appt.appointment_date.strftime("%I:%M %p")
                slot_data.append({
                    "time": slot_time,
                    "appointmentId": appt.id,
                    "patientName": None,
                    "patientPhone": None,
                    "patientAge": None,
                    "patientGender": None,
                    "bloodGroup": None,
                    "chronicConditions": [],
                    "reason": appt.reason,
                    "status": appt.status.value if hasattr(appt.status, 'value') else str(appt.status),
                    "appointmentDate": appt.appointment_date.isoformat()
                })
            return slot_data
        else:
            # day_slots is a list of ranges like ["9:00 AM - 1:00 PM", "5:00 PM - 9:00 PM"]
            duration = doctor_profile.appointment_duration or 30
            for range_str in day_slots:
                m = re.search(r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))", range_str, re.IGNORECASE)
                if m:
                    start_time_str, end_time_str = m.group(1), m.group(2)
                    start_time = datetime.strptime(start_time_str.strip(), "%I:%M %p")
                    end_time = datetime.strptime(end_time_str.strip(), "%I:%M %p")
                    current_time = start_time
                    while current_time < end_time:
                        time_slots.append(current_time.strftime("%I:%M %p"))
                        current_time = current_time + timedelta(minutes=duration)
    else:
        # Get doctor's availability from their profile (legacy visiting_hours or time_slots)
        if doctor_profile.visiting_hours or doctor_profile.time_slots:
            # Parse visiting hours (e.g., "Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM")
            schedule_text = doctor_profile.visiting_hours or doctor_profile.time_slots

            # Extract time ranges (e.g., "03:00 PM - 08:00 PM")
            time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))'
            matches = re.findall(time_pattern, schedule_text, re.IGNORECASE)

            if matches:
                for start_time_str, end_time_str in matches:
                    # Parse start and end times
                    start_time = datetime.strptime(start_time_str.strip(), "%I:%M %p")
                    end_time = datetime.strptime(end_time_str.strip(), "%I:%M %p")

                    # Generate 30-minute slots
                    current_time = start_time
                    duration = doctor_profile.appointment_duration or 30  # Default 30 mins

                    while current_time < end_time:
                        time_slots.append(current_time.strftime("%I:%M %p"))
                        current_time = current_time + timedelta(minutes=duration)

    # Fallback to default schedule if no schedule configured
    if not time_slots:
        default_slots = [
            "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
            "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
            "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
            "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM"
        ]
        time_slots = default_slots
    
    # Map appointments to time slots
    slot_data = []
    
    # If no specific time slots configured, generate default slots
    if not time_slots or len(time_slots) == 0:
        time_slots = [
            "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
            "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
            "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
            "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM"
        ]
    
    for slot_time in time_slots:
        # Find appointment matching this time slot
        matching_appt = None
        for appt in appointments:
            # Check if notes contain the slot time
            if appt.notes and slot_time in appt.notes:
                matching_appt = appt
                break
            
            # Also try to match by appointment time
            appt_hour = appt.appointment_date.hour
            appt_minute = appt.appointment_date.minute
            
            # Convert slot_time to 24-hour format for comparison
            try:
                slot_parts = slot_time.split()
                time_parts = slot_parts[0].split(':')
                slot_hour = int(time_parts[0])
                slot_minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                
                if len(slot_parts) > 1 and slot_parts[1].upper() == 'PM' and slot_hour != 12:
                    slot_hour += 12
                elif len(slot_parts) > 1 and slot_parts[1].upper() == 'AM' and slot_hour == 12:
                    slot_hour = 0
                
                if appt_hour == slot_hour and appt_minute == slot_minute:
                    matching_appt = appt
                    break
            except:
                pass
        
        if matching_appt:
            # Get patient details
            patient_res = await db.execute(select(Profile).where(Profile.id == matching_appt.patient_id))
            patient = patient_res.scalar_one_or_none()
            
            # Get patient medical profile
            patient_profile_res = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == matching_appt.patient_id))
            patient_profile = patient_profile_res.scalar_one_or_none()
            
            status_value = matching_appt.status.value if hasattr(matching_appt.status, 'value') else str(matching_appt.status)
            
            # Calculate patient age
            age = None
            if patient_profile and patient_profile.date_of_birth:
                today = date_class.today()
                dob = patient_profile.date_of_birth
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Get chronic conditions
            conditions = []
            if patient_profile:
                if patient_profile.has_diabetes: conditions.append("Diabetes")
                if patient_profile.has_hypertension: conditions.append("Hypertension")
                if patient_profile.has_heart_disease: conditions.append("Heart Disease")
                if patient_profile.has_asthma: conditions.append("Asthma")
                if patient_profile.has_kidney_disease: conditions.append("Kidney Disease")
            
            slot_data.append({
                "time": slot_time,
                "appointmentId": matching_appt.id,
                "patientName": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
                "patientPhone": patient.phone if patient else None,
                "patientAge": age,
                "patientGender": patient_profile.gender if patient_profile else None,
                "bloodGroup": patient_profile.blood_group if patient_profile else None,
                "chronicConditions": conditions,
                "reason": matching_appt.reason,
                "status": status_value,
                "appointmentDate": matching_appt.appointment_date.isoformat()
            })
        else:
            slot_data.append({
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
                "appointmentDate": None
            })
    
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
        print(f"Debug: Changing appointment {appointment.id} status from {appointment.status} to {new_status}")
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
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        if target_date.tzinfo is None:
            target_date = datetime.strptime(date, "%Y-%m-%d")
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
    
    # Generate time slots from doctor's schedule
    time_slots = []
    
    if doctor_profile.visiting_hours or doctor_profile.time_slots:
        schedule_text = doctor_profile.visiting_hours or doctor_profile.time_slots
        time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))'
        matches = re.findall(time_pattern, schedule_text, re.IGNORECASE)
        
        if matches:
            for start_time_str, end_time_str in matches:
                start_time = datetime.strptime(start_time_str.strip(), "%I:%M %p")
                end_time = datetime.strptime(end_time_str.strip(), "%I:%M %p")
                duration = doctor_profile.appointment_duration or 30
                
                current_time = start_time
                while current_time < end_time:
                    time_slots.append(current_time.strftime("%I:%M %p"))
                    current_time = current_time + timedelta(minutes=duration)
    
    # Fallback to default slots
    if not time_slots:
        time_slots = [
            "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
            "12:00 PM", "12:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
            "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM",
            "7:00 PM", "7:30 PM", "8:00 PM"
        ]
    
    # Current time for determining if slot is in past
    now = datetime.now(timezone.utc)
    
    # Build slot data with booking status
    slot_data = []
    for slot_time in time_slots:
        # Convert slot to datetime for comparison
        try:
            slot_parts = slot_time.replace(" ", "").upper()
            slot_dt = datetime.strptime(slot_parts, "%I:%M%p")
            slot_datetime = datetime(
                target_date.year, target_date.month, target_date.day,
                slot_dt.hour, slot_dt.minute, tzinfo=timezone.utc
            )
        except:
            slot_datetime = None
        
        is_past = slot_datetime and slot_datetime < now
        
        # Find matching appointment
        matching_appt = None
        for appt in appointments:
            # Check notes for slot time
            if appt.notes and slot_time in appt.notes:
                matching_appt = appt
                break
            # Also check appointment hour/minute
            appt_hour = appt.appointment_date.hour
            appt_minute = appt.appointment_date.minute
            try:
                slot_h = slot_dt.hour
                slot_m = slot_dt.minute
                if appt_hour == slot_h and appt_minute == slot_m:
                    matching_appt = appt
                    break
            except:
                pass
        
        slot_info = {
            "time": slot_time,
            "is_past": is_past,
            "is_booked": matching_appt is not None,
            "appointment_id": matching_appt.id if matching_appt else None,
            "status": matching_appt.status.value if matching_appt else None,
        }
        
        # Include appointment details if booked (for authorized views)
        if matching_appt:
            patient_res = await db.execute(select(Profile).where(Profile.id == matching_appt.patient_id))
            patient = patient_res.scalar_one_or_none()
            slot_info["patient_name"] = f"{patient.first_name} {patient.last_name}" if patient else None
            slot_info["reason"] = matching_appt.reason
        
        slot_data.append(slot_info)
    
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
    
    # Get unique doctors from patient's appointments (prefer completed/confirmed)
    from sqlalchemy import distinct, desc
    
    query = select(Appointment).where(
        Appointment.patient_id == user_id,
        Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED])
    ).order_by(desc(Appointment.appointment_date))
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    # Get unique doctor IDs
    seen_doctors = set()
    doctors = []
    
    for appt in appointments:
        if appt.doctor_id in seen_doctors:
            continue
        seen_doctors.add(appt.doctor_id)
        
        # Get doctor profile and info
        doc_result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == appt.doctor_id))
        doc_profile = doc_result.scalar_one_or_none()
        
        doc_name_result = await db.execute(select(Profile).where(Profile.id == appt.doctor_id))
        doc_name = doc_name_result.scalar_one_or_none()
        
        if doc_profile and doc_name:
            # Get speciality name
            from app.db.models.speciality import Speciality
            spec_name = doc_profile.specialization
            if doc_profile.speciality_id:
                spec_result = await db.execute(select(Speciality).where(Speciality.id == doc_profile.speciality_id))
                spec = spec_result.scalar_one_or_none()
                if spec:
                    spec_name = spec.name
            
            doctors.append({
                "profile_id": appt.doctor_id,
                "first_name": doc_name.first_name,
                "last_name": doc_name.last_name,
                "title": doc_profile.title,
                "specialization": spec_name,
                "profile_photo_url": doc_profile.profile_photo_url,
                "hospital_name": doc_profile.hospital_name,
                "hospital_city": doc_profile.hospital_city,
                "consultation_fee": doc_profile.consultation_fee,
                "last_visit": appt.appointment_date.isoformat()
            })
        
        if len(doctors) >= 5:  # Limit to 5 suggestions
            break
    
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
    query = select(Appointment).where(
        Appointment.patient_id == user_id
    ).order_by(Appointment.appointment_date.desc())
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    # Group by date
    appointments_by_date = {}
    all_appointments = []
    
    for appt in appointments:
        date_key = appt.appointment_date.strftime("%Y-%m-%d")
        
        # Get doctor info
        doc_result = await db.execute(select(Profile).where(Profile.id == appt.doctor_id))
        doctor = doc_result.scalar_one_or_none()
        
        doc_profile_result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == appt.doctor_id))
        doc_profile = doc_profile_result.scalar_one_or_none()
        
        # Get speciality
        spec_name = None
        if doc_profile and doc_profile.speciality_id:
            from app.db.models.speciality import Speciality
            spec_result = await db.execute(select(Speciality).where(Speciality.id == doc_profile.speciality_id))
            spec = spec_result.scalar_one_or_none()
            if spec:
                spec_name = spec.name
        
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
            "status": appt.status.value if hasattr(appt.status, 'value') else str(appt.status),
            "reason": appt.reason,
            "notes": appt.notes,
            "doctor_id": appt.doctor_id,
            "doctor_name": f"{doctor.first_name} {doctor.last_name}" if doctor else None,
            "doctor_title": doc_profile.title if doc_profile else None,
            "doctor_specialization": spec_name or (doc_profile.specialization if doc_profile else None),
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
        appointments_by_date[date_key]["statuses"].append(appt.status.value)
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
    
    # Get all completed appointments
    from sqlalchemy import func, desc
    
    query = select(Appointment).where(
        Appointment.doctor_id == user_id,
        Appointment.status == AppointmentStatus.COMPLETED
    ).order_by(desc(Appointment.appointment_date))
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    # Group by patient
    seen_patients = set()
    patients = []
    
    for appt in appointments:
        if appt.patient_id in seen_patients:
            continue
        seen_patients.add(appt.patient_id)
        
        # Get patient profile
        patient_result = await db.execute(select(Profile).where(Profile.id == appt.patient_id))
        patient = patient_result.scalar_one_or_none()
        
        patient_profile_result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == appt.patient_id))
        patient_profile = patient_profile_result.scalar_one_or_none()
        
        if patient:
            # Count total visits
            visit_count_result = await db.execute(
                select(func.count()).where(
                    Appointment.doctor_id == user_id,
                    Appointment.patient_id == appt.patient_id,
                    Appointment.status == AppointmentStatus.COMPLETED
                )
            )
            visit_count = visit_count_result.scalar() or 0
            
            # Calculate age
            age = None
            if patient_profile and patient_profile.date_of_birth:
                today = date_class.today()
                dob = patient_profile.date_of_birth
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Get chronic conditions
            conditions = []
            if patient_profile:
                if patient_profile.has_diabetes: conditions.append("Diabetes")
                if patient_profile.has_hypertension: conditions.append("Hypertension")
                if patient_profile.has_heart_disease: conditions.append("Heart Disease")
                if patient_profile.has_asthma: conditions.append("Asthma")
                if patient_profile.has_kidney_disease: conditions.append("Kidney Disease")
            
            patients.append({
                "patient_id": appt.patient_id,
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "phone": patient.phone,
                "profile_photo_url": patient_profile.profile_photo_url if patient_profile else None,
                "age": age,
                "gender": patient_profile.gender if patient_profile else None,
                "blood_group": patient_profile.blood_group if patient_profile else None,
                "chronic_conditions": conditions,
                "total_visits": visit_count,
                "last_visit": appt.appointment_date.isoformat(),
                "last_reason": appt.reason
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

