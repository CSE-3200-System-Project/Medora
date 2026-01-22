"""
Patient Access Routes

Endpoints for:
1. Doctor viewing patient data (with security checks)
2. Patient managing who can access their data
3. Viewing access history
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.patient_access import PatientAccessLog, PatientDoctorAccess, AccessType, AccessStatus
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.routes.notification import create_notification
from datetime import datetime, date as date_type
from typing import Optional
import uuid

router = APIRouter()


async def check_doctor_patient_access(
    db: AsyncSession,
    doctor_id: str,
    patient_id: str
) -> dict:
    """
    Check if a doctor has valid access to a patient's data.
    Returns dict with access status and reason.
    """
    # Check if access has been explicitly revoked by patient
    access_control = await db.execute(
        select(PatientDoctorAccess).where(
            and_(
                PatientDoctorAccess.patient_id == patient_id,
                PatientDoctorAccess.doctor_id == doctor_id
            )
        )
    )
    access_record = access_control.scalar_one_or_none()
    
    if access_record:
        if access_record.status == AccessStatus.REVOKED:
            return {
                "allowed": False,
                "reason": "Patient has revoked your access to their medical records"
            }
        if access_record.expires_at and access_record.expires_at < datetime.utcnow():
            return {
                "allowed": False,
                "reason": "Your access to this patient's records has expired"
            }
    
    # Check if doctor has any appointment with this patient
    appointment_query = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.patient_id == patient_id,
                Appointment.status.in_([
                    AppointmentStatus.PENDING,
                    AppointmentStatus.CONFIRMED,
                    AppointmentStatus.COMPLETED
                ])
            )
        )
    )
    appointments = appointment_query.scalars().all()
    
    if not appointments:
        return {
            "allowed": False,
            "reason": "You don't have any appointment relationship with this patient"
        }
    
    return {"allowed": True, "appointments": len(appointments)}


async def log_patient_access(
    db: AsyncSession,
    patient_id: str,
    doctor_id: str,
    access_type: AccessType,
    request: Optional[Request] = None
):
    """Log when a doctor accesses patient data"""
    ip_address = None
    user_agent = None
    
    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
    
    # Use .value to store as string in database
    access_log = PatientAccessLog(
        id=str(uuid.uuid4()),
        patient_id=patient_id,
        doctor_id=doctor_id,
        access_type=access_type.value if hasattr(access_type, 'value') else str(access_type),
        accessed_at=datetime.utcnow(),
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(access_log)
    await db.commit()
    
    return access_log


@router.get("/patient/{patient_id}")
async def get_patient_for_doctor(
    patient_id: str,
    request: Request = None,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get patient's full medical profile for a doctor.
    Security checks:
    1. User must be a verified doctor
    2. Doctor must have an appointment relationship with patient
    3. Patient must not have revoked access
    """
    doctor_id = user.id
    
    # Verify user is a doctor
    doctor_profile_result = await db.execute(
        select(Profile).where(Profile.id == doctor_id)
    )
    doctor_profile = doctor_profile_result.scalar_one_or_none()
    
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(doctor_profile.role).upper()
    if "DOCTOR" not in role_str:
        raise HTTPException(status_code=403, detail="Only doctors can access patient records")
    
    # Check if doctor is verified
    doctor_details_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
    )
    doctor_details = doctor_details_result.scalar_one_or_none()
    
    if not doctor_details or not doctor_details.bmdc_verified:
        raise HTTPException(
            status_code=403,
            detail="Only verified doctors can access patient records"
        )
    
    # Check access permission
    access_check = await check_doctor_patient_access(db, doctor_id, patient_id)
    
    if not access_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=access_check["reason"]
        )
    
    # Get patient basic profile
    patient_profile_result = await db.execute(
        select(Profile).where(Profile.id == patient_id)
    )
    patient_profile = patient_profile_result.scalar_one_or_none()
    
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get patient medical profile
    patient_details_result = await db.execute(
        select(PatientProfile).where(PatientProfile.profile_id == patient_id)
    )
    patient_details = patient_details_result.scalar_one_or_none()
    
    if not patient_details:
        raise HTTPException(status_code=404, detail="Patient medical profile not found")
    
    # Log the access
    await log_patient_access(db, patient_id, doctor_id, AccessType.VIEW_FULL_RECORD, request)
    
    # Send notification to patient
    doctor_name = f"{doctor_details.title or 'Dr.'} {doctor_profile.first_name} {doctor_profile.last_name}"
    
    await create_notification(
        db=db,
        user_id=patient_id,
        notification_type=NotificationType.PROFILE_UPDATE,
        title="Your Medical Records Were Viewed",
        message=f"{doctor_name} accessed your medical records",
        action_url="/patient/privacy",
        metadata={
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "access_type": "view_full_record",
            "timestamp": datetime.utcnow().isoformat()
        },
        priority=NotificationPriority.LOW,
    )
    
    # Calculate age
    patient_age = None
    if patient_details.date_of_birth:
        today = date_type.today()
        dob = patient_details.date_of_birth
        patient_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    # Get chronic conditions list
    chronic_conditions = []
    if patient_details.has_diabetes: chronic_conditions.append("Diabetes")
    if patient_details.has_hypertension: chronic_conditions.append("Hypertension")
    if patient_details.has_heart_disease: chronic_conditions.append("Heart Disease")
    if patient_details.has_asthma: chronic_conditions.append("Asthma")
    if patient_details.has_cancer: chronic_conditions.append("Cancer")
    if patient_details.has_thyroid: chronic_conditions.append("Thyroid Disorder")
    if patient_details.has_kidney_disease: chronic_conditions.append("Kidney Disease")
    if patient_details.has_liver_disease: chronic_conditions.append("Liver Disease")
    if patient_details.has_arthritis: chronic_conditions.append("Arthritis")
    if patient_details.has_stroke: chronic_conditions.append("Stroke History")
    if patient_details.has_epilepsy: chronic_conditions.append("Epilepsy")
    if patient_details.has_mental_health: chronic_conditions.append("Mental Health Condition")
    if patient_details.other_conditions:
        chronic_conditions.append(patient_details.other_conditions)
    
    # Get appointment history with THIS doctor only
    appointments_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.patient_id == patient_id
            )
        ).order_by(Appointment.appointment_date.desc())
    )
    appointments = appointments_result.scalars().all()
    
    appointment_history = [
        {
            "id": appt.id,
            "date": appt.appointment_date.isoformat(),
            "reason": appt.reason,
            "notes": appt.notes,
            "status": appt.status.value if hasattr(appt.status, 'value') else str(appt.status)
        }
        for appt in appointments
    ]
    
    return {
        # Basic Info
        "id": patient_id,
        "first_name": patient_profile.first_name,
        "last_name": patient_profile.last_name,
        "email": patient_profile.email,
        "phone": patient_profile.phone,
        "age": patient_age,
        "date_of_birth": patient_details.date_of_birth.isoformat() if patient_details.date_of_birth else None,
        "gender": patient_details.gender,
        "marital_status": patient_details.marital_status,
        "profile_photo_url": patient_details.profile_photo_url,
        
        # Address
        "address": patient_details.address,
        "city": patient_details.city,
        "district": patient_details.district,
        "postal_code": patient_details.postal_code,
        "country": patient_details.country,
        "occupation": patient_details.occupation,
        
        # Physical
        "height": patient_details.height,
        "weight": patient_details.weight,
        "blood_group": patient_details.blood_group,
        
        # Chronic Conditions
        "chronic_conditions": chronic_conditions,
        "has_diabetes": patient_details.has_diabetes,
        "has_hypertension": patient_details.has_hypertension,
        "has_heart_disease": patient_details.has_heart_disease,
        "has_asthma": patient_details.has_asthma,
        "has_cancer": patient_details.has_cancer,
        "has_thyroid": patient_details.has_thyroid,
        "has_kidney_disease": patient_details.has_kidney_disease,
        "has_liver_disease": patient_details.has_liver_disease,
        "has_arthritis": patient_details.has_arthritis,
        "has_stroke": patient_details.has_stroke,
        "has_epilepsy": patient_details.has_epilepsy,
        "has_mental_health": patient_details.has_mental_health,
        "other_conditions": patient_details.other_conditions,
        
        # Medications & Allergies
        "taking_medications": patient_details.taking_meds,
        "medications": patient_details.medications,
        "drug_allergies": patient_details.drug_allergies,
        "food_allergies": patient_details.food_allergies,
        "environmental_allergies": patient_details.environmental_allergies,
        
        # Medical History
        "surgeries": patient_details.surgeries,
        "hospitalizations": patient_details.hospitalizations,
        "ongoing_treatments": patient_details.ongoing_treatments,
        "vaccinations": patient_details.vaccinations,
        "last_checkup_date": patient_details.last_checkup_date if patient_details.last_checkup_date else None,
        
        # Family History
        "family_has_diabetes": patient_details.family_has_diabetes,
        "family_has_heart_disease": patient_details.family_has_heart_disease,
        "family_has_cancer": patient_details.family_has_cancer,
        "family_has_hypertension": patient_details.family_has_hypertension,
        "family_has_stroke": patient_details.family_has_stroke,
        "family_has_mental_health": patient_details.family_has_mental_health,
        "family_has_kidney_disease": patient_details.family_has_kidney_disease,
        "family_has_thyroid": patient_details.family_has_thyroid,
        "family_has_asthma": patient_details.family_has_asthma,
        "family_has_blood_disorders": patient_details.family_has_blood_disorders,
        "family_history_notes": patient_details.family_history_notes,
        
        # Lifestyle
        "smoking_status": patient_details.smoking,
        "alcohol_consumption": patient_details.alcohol,
        "activity_level": patient_details.activity_level,
        "sleep_hours": patient_details.sleep_duration,
        "stress_level": patient_details.stress_level,
        "diet_type": patient_details.diet,
        "mental_health_concerns": patient_details.mental_health_concerns,
        
        # Emergency Contact
        "emergency_contact_name": patient_details.emergency_name,
        "emergency_contact_phone": patient_details.emergency_phone,
        "emergency_contact_relationship": patient_details.emergency_relation,
        
        # Appointment History (with this doctor only)
        "appointment_history": appointment_history,
        
        # Meta
        "access_timestamp": datetime.utcnow().isoformat()
    }


# ============ PATIENT ACCESS MANAGEMENT ENDPOINTS ============

@router.get("/my-access-history")
async def get_my_access_history(
    limit: int = 50,
    offset: int = 0,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    For patients: Get list of who has accessed their medical records
    """
    patient_id = user.id
    
    # Verify user is a patient
    profile_result = await db.execute(
        select(Profile).where(Profile.id == patient_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    # Get access logs
    logs_query = await db.execute(
        select(PatientAccessLog)
        .where(PatientAccessLog.patient_id == patient_id)
        .order_by(PatientAccessLog.accessed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = logs_query.scalars().all()
    
    # Get total count
    count_result = await db.execute(
        select(func.count(PatientAccessLog.id))
        .where(PatientAccessLog.patient_id == patient_id)
    )
    total = count_result.scalar() or 0
    
    # Build response with doctor details
    access_history = []
    for log in logs:
        # Get doctor info
        doctor_result = await db.execute(
            select(Profile).where(Profile.id == log.doctor_id)
        )
        doctor = doctor_result.scalar_one_or_none()
        
        doctor_details_result = await db.execute(
            select(DoctorProfile).where(DoctorProfile.profile_id == log.doctor_id)
        )
        doctor_details = doctor_details_result.scalar_one_or_none()
        
        access_history.append({
            "id": log.id,
            "doctor_id": log.doctor_id,
            "doctor_name": f"{doctor_details.title or 'Dr.'} {doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            "doctor_specialization": doctor_details.specialization if doctor_details else None,
            "doctor_photo_url": doctor_details.profile_photo_url if doctor_details else None,
            "access_type": log.access_type.value if hasattr(log.access_type, 'value') else str(log.access_type),
            "accessed_at": log.accessed_at.isoformat()
        })
    
    return {
        "access_history": access_history,
        "total": total
    }


@router.get("/my-doctor-access")
async def get_my_doctor_access_settings(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    For patients: Get list of doctors who have/had access to their records
    with their access status (active/revoked)
    """
    patient_id = user.id
    
    # Verify user is a patient
    profile_result = await db.execute(
        select(Profile).where(Profile.id == patient_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    # Get all doctors who have appointments with this patient
    appointments_result = await db.execute(
        select(Appointment.doctor_id).distinct()
        .where(Appointment.patient_id == patient_id)
    )
    doctor_ids = [row[0] for row in appointments_result.fetchall()]
    
    doctors_list = []
    for doctor_id in doctor_ids:
        # Get doctor info
        doctor_result = await db.execute(
            select(Profile).where(Profile.id == doctor_id)
        )
        doctor = doctor_result.scalar_one_or_none()
        
        doctor_details_result = await db.execute(
            select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
        )
        doctor_details = doctor_details_result.scalar_one_or_none()
        
        # Get access control record if exists
        access_result = await db.execute(
            select(PatientDoctorAccess).where(
                and_(
                    PatientDoctorAccess.patient_id == patient_id,
                    PatientDoctorAccess.doctor_id == doctor_id
                )
            )
        )
        access_record = access_result.scalar_one_or_none()
        
        # Count appointments
        appt_count_result = await db.execute(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.patient_id == patient_id,
                    Appointment.doctor_id == doctor_id
                )
            )
        )
        appt_count = appt_count_result.scalar() or 0
        
        # Get last access
        last_access_result = await db.execute(
            select(PatientAccessLog)
            .where(
                and_(
                    PatientAccessLog.patient_id == patient_id,
                    PatientAccessLog.doctor_id == doctor_id
                )
            )
            .order_by(PatientAccessLog.accessed_at.desc())
            .limit(1)
        )
        last_access = last_access_result.scalar_one_or_none()
        
        doctors_list.append({
            "doctor_id": doctor_id,
            "doctor_name": f"{doctor_details.title or 'Dr.'} {doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            "doctor_specialization": doctor_details.specialization if doctor_details else None,
            "doctor_photo_url": doctor_details.profile_photo_url if doctor_details else None,
            "hospital_name": doctor_details.hospital_name if doctor_details else None,
            "access_status": access_record.status.value if access_record else "active",
            "appointment_count": appt_count,
            "last_access": last_access.accessed_at.isoformat() if last_access else None,
            "revoked_at": access_record.revoked_at.isoformat() if access_record and access_record.revoked_at else None
        })
    
    return {"doctors": doctors_list}


@router.post("/revoke-access/{doctor_id}")
async def revoke_doctor_access(
    doctor_id: str,
    reason: str = None,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    For patients: Revoke a doctor's access to their medical records
    """
    patient_id = user.id
    
    # Verify user is a patient
    profile_result = await db.execute(
        select(Profile).where(Profile.id == patient_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    # Check if access record exists
    access_result = await db.execute(
        select(PatientDoctorAccess).where(
            and_(
                PatientDoctorAccess.patient_id == patient_id,
                PatientDoctorAccess.doctor_id == doctor_id
            )
        )
    )
    access_record = access_result.scalar_one_or_none()
    
    if access_record:
        # Update existing record
        access_record.status = AccessStatus.REVOKED
        access_record.revoked_at = datetime.utcnow()
        access_record.revocation_reason = reason
    else:
        # Create new revoked record
        access_record = PatientDoctorAccess(
            id=str(uuid.uuid4()),
            patient_id=patient_id,
            doctor_id=doctor_id,
            status=AccessStatus.REVOKED,
            granted_at=datetime.utcnow(),
            revoked_at=datetime.utcnow(),
            revocation_reason=reason
        )
        db.add(access_record)
    
    await db.commit()
    
    return {"message": "Access revoked successfully", "status": "revoked"}


@router.post("/restore-access/{doctor_id}")
async def restore_doctor_access(
    doctor_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """
    For patients: Restore a doctor's access that was previously revoked
    """
    patient_id = user.id
    
    # Verify user is a patient
    profile_result = await db.execute(
        select(Profile).where(Profile.id == patient_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    role_str = str(profile.role).upper()
    if "PATIENT" not in role_str:
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")
    
    # Check if access record exists
    access_result = await db.execute(
        select(PatientDoctorAccess).where(
            and_(
                PatientDoctorAccess.patient_id == patient_id,
                PatientDoctorAccess.doctor_id == doctor_id
            )
        )
    )
    access_record = access_result.scalar_one_or_none()
    
    if not access_record:
        raise HTTPException(status_code=404, detail="No access record found for this doctor")
    
    access_record.status = AccessStatus.ACTIVE
    access_record.revoked_at = None
    access_record.revocation_reason = None
    
    await db.commit()
    
    return {"message": "Access restored successfully", "status": "active"}
