from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update
from sqlalchemy.orm import aliased
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus, UserRole, AccountStatus
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# Simple admin key for password-only access
ADMIN_PASSWORD = "admin123"

# Helper to check admin access (password-based, no account needed)
async def require_admin_access(
    x_admin_password: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Verify admin access via password (no account required)"""
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    return True

# Test endpoint
@router.get("/test")
async def test_admin(admin_access = Depends(require_admin_access)):
    """Test admin authentication"""
    return {"status": "ok", "message": "Admin authentication successful"}

# Helper to check if user is admin (legacy - for logged-in admins)
async def require_admin(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Verify that the current user is an admin"""
    result = await db.execute(
        select(Profile).where(Profile.id == user.id)
    )
    profile = result.scalar()
    
    if not profile or profile.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return profile

# Verification request model
class VerifyDoctorRequest(BaseModel):
    verification_method: str = "manual"
    notes: str | None = None
    approved: bool = True

@router.get("/pending-doctors")
async def get_pending_doctors(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get all doctors pending verification"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
        .where(Profile.verification_status == VerificationStatus.pending)
    )
    
    doctors = []
    for profile, doctor in result.all():
        doctors.append({
            "id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "phone": profile.phone,
            "bmdc_number": doctor.bmdc_number,
            "specialization": doctor.specialization,
            "bmdc_document_url": doctor.bmdc_document_url,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        })
    
    return {"doctors": doctors}

@router.post("/verify-doctor/{doctor_id}")
async def verify_doctor(
    doctor_id: str,
    request: VerifyDoctorRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Verify or reject a doctor"""
    async with db.begin():
        # Get profile and doctor
        profile_result = await db.execute(
            select(Profile).where(Profile.id == doctor_id)
        )
        profile = profile_result.scalar()
        
        doctor_result = await db.execute(
            select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
        )
        doctor = doctor_result.scalar()
        
        if not profile or not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        if profile.role != UserRole.DOCTOR:
            raise HTTPException(status_code=400, detail="User is not a doctor")
        
        # Update verification status
        if request.approved:
            profile.verification_status = VerificationStatus.verified
            profile.verified_at = datetime.utcnow()
            doctor.bmdc_verified = True
            doctor.verification_method = request.verification_method
            doctor.verification_notes = request.notes
        else:
            profile.verification_status = VerificationStatus.rejected
            doctor.bmdc_verified = False
            doctor.verification_notes = request.notes
        
        await db.commit()
    
    return {
        "status": "verified" if request.approved else "rejected",
        "doctor_id": doctor_id
    }

@router.get("/doctors")
async def get_all_doctors(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get all doctors with their verification status"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
    )
    
    doctors = []
    for profile, doctor in result.all():
        doctors.append({
            "id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "bmdc_number": doctor.bmdc_number,
            "specialization": doctor.specialization,
            "verification_status": profile.verification_status.value,
            "verified_at": profile.verified_at.isoformat() if profile.verified_at else None,
            "account_status": profile.status.value if profile.status else "active",
        })
    
    return {"doctors": doctors}

@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Get comprehensive platform statistics"""
    try:
        from app.db.models.appointment import Appointment, AppointmentStatus
        from datetime import timedelta
        total_users_result = await db.execute(select(func.count(Profile.id)))
        total_users = total_users_result.scalar() or 0

        role_counts_result = await db.execute(
            select(Profile.role, func.count(Profile.id)).group_by(Profile.role)
        )
        role_counts = {row[0]: row[1] for row in role_counts_result.all()}

        doctor_verification_result = await db.execute(
            select(Profile.verification_status, func.count(Profile.id))
            .where(Profile.role == UserRole.DOCTOR)
            .group_by(Profile.verification_status)
        )
        verification_counts = {row[0]: row[1] for row in doctor_verification_result.all()}

        patients_with_onboarding_result = await db.execute(
            select(func.count(Profile.id)).where(
                Profile.role == UserRole.PATIENT,
                Profile.onboarding_completed.is_(True),
            )
        )
        patients_with_onboarding = patients_with_onboarding_result.scalar() or 0

        appointment_stats_result = await db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.PENDING).label("pending"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.CONFIRMED).label("confirmed"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.COMPLETED).label("completed"),
                func.count(Appointment.id).filter(Appointment.status == AppointmentStatus.CANCELLED).label("cancelled"),
            )
        )
        appointment_stats = appointment_stats_result.one()

        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_users_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.created_at >= week_ago)
        )
        recent_registrations = recent_users_result.scalar() or 0

        return {
            "total_users": total_users,
            "total_doctors": role_counts.get(UserRole.DOCTOR, 0),
            "total_patients": role_counts.get(UserRole.PATIENT, 0),
            "verified_doctors": verification_counts.get(VerificationStatus.verified, 0),
            "pending_doctors": verification_counts.get(VerificationStatus.pending, 0),
            "rejected_doctors": verification_counts.get(VerificationStatus.rejected, 0),
            "patients_with_complete_profile": patients_with_onboarding,
            "total_appointments": appointment_stats.total or 0,
            "pending_appointments": appointment_stats.pending or 0,
            "confirmed_appointments": appointment_stats.confirmed or 0,
            "completed_appointments": appointment_stats.completed or 0,
            "cancelled_appointments": appointment_stats.cancelled or 0,
            "recent_registrations_7days": recent_registrations,
        }
        
    except Exception as e:
        # Return zeros if there's an error
        return {
            "total_users": 0,
            "total_doctors": 0,
            "total_patients": 0,
            "verified_doctors": 0,
            "pending_doctors": 0,
            "rejected_doctors": 0,
            "patients_with_complete_profile": 0,
            "total_appointments": 0,
            "pending_appointments": 0,
            "confirmed_appointments": 0,
            "completed_appointments": 0,
            "cancelled_appointments": 0,
            "recent_registrations_7days": 0,
        }


@router.get("/patients")
async def get_all_patients(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0
):
    """Get all patients with pagination"""
    try:
        from app.db.models.patient import PatientProfile
        
        result = await db.execute(
            select(Profile, PatientProfile)
            .join(PatientProfile, Profile.id == PatientProfile.profile_id, isouter=True)
            .where(Profile.role == UserRole.PATIENT)
            .limit(limit)
            .offset(offset)
        )
        
        patients = []
        for profile, patient in result.all():
            patients.append({
                "id": profile.id,
                "name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "No Name",
                "email": profile.email,
                "phone": profile.phone,
                "onboarding_completed": profile.onboarding_completed,
                "created_at": profile.created_at.isoformat() if profile.created_at else None,
                "blood_group": patient.blood_group if patient else None,
                "city": patient.city if patient else None,
                "account_status": profile.status.value if profile.status else "active",
            })
        
        # Get total count
        count_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.role == UserRole.PATIENT)
        )
        total = count_result.scalar() or 0

        return {
            "patients": patients,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception:
        return {
            "patients": [],
            "total": 0,
            "limit": limit,
            "offset": offset
        }


@router.get("/appointments")
async def get_all_appointments(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 50,
    offset: int = 0
):
    """Get all appointments with doctor and patient info"""
    from app.db.models.appointment import Appointment
    doctor_alias = aliased(Profile)
    patient_alias = aliased(Profile)
    
    result = await db.execute(
        select(Appointment, doctor_alias, patient_alias)
        .join(doctor_alias, doctor_alias.id == Appointment.doctor_id, isouter=True)
        .join(patient_alias, patient_alias.id == Appointment.patient_id, isouter=True)
        .limit(limit)
        .offset(offset)
        .order_by(Appointment.appointment_date.desc())
    )
    
    appointments = []
    for appointment, doctor, patient in result.all():
        status_value = appointment.status.value if hasattr(appointment.status, "value") else str(appointment.status)
        appointments.append({
            "id": appointment.id,
            "appointment_date": appointment.appointment_date.isoformat(),
            "status": status_value.lower(),
            "reason": appointment.reason,
            "doctor": {
                "id": doctor.id if doctor else None,
                "name": f"{doctor.first_name} {doctor.last_name}" if doctor else "Unknown"
            },
            "patient": {
                "id": patient.id if patient else None,
                "name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown"
            }
        })
    
    # Get total count
    count_result = await db.execute(select(func.count(Appointment.id)))
    total = count_result.scalar() or 0
    
    return {
        "appointments": appointments,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# Schedule review endpoints
@router.get("/schedule-review")
async def get_schedules_needing_review(
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access),
    limit: int = 100,
    offset: int = 0
):
    """List doctors whose time slots need review"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.role == UserRole.DOCTOR)
        .where(DoctorProfile.time_slots_needs_review == True)
        .limit(limit)
        .offset(offset)
    )

    rows = result.all()
    doctors = []
    for profile, doctor in rows:
        doctors.append({
            "profile_id": profile.id,
            "name": f"{profile.first_name} {profile.last_name}",
            "email": profile.email,
            "time_slots": doctor.time_slots,
            "normalized_time_slots": getattr(doctor, 'normalized_time_slots', None)
        })

    return {"doctors": doctors, "total": len(doctors)}


class ScheduleFixRequest(BaseModel):
    profile_id: str
    normalized_time_slots: str


@router.post("/schedule-review/fix")
async def fix_schedule_row(
    data: ScheduleFixRequest,
    db: AsyncSession = Depends(get_db),
    admin_access = Depends(require_admin_access)
):
    """Apply a normalized time_slots for a doctor's profile and clear the review flag"""
    # Ensure doctor exists
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == data.profile_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    await db.execute(
        update(DoctorProfile)
        .where(DoctorProfile.profile_id == data.profile_id)
        .values(
            time_slots=data.normalized_time_slots,
            normalized_time_slots=data.normalized_time_slots,
            time_slots_needs_review=False
        )
    )
    await db.commit()

    return {"success": True, "profile_id": data.profile_id, "normalized_time_slots": data.normalized_time_slots}

# Ban/Unban User
class BanUserRequest(BaseModel):
    reason: str | None = None

@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    request: BanUserRequest,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db)
):
    """Ban a user by setting their account status to banned"""
    try:
        # Get user profile
        result = await db.execute(
            select(Profile).where(Profile.id == user_id)
        )
        profile = result.scalar()
        
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent banning admins
        if profile.role == UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Cannot ban admin users")
        
        # Update status to banned
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(status=AccountStatus.banned, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        return {
            "status": "success",
            "message": f"User {profile.first_name} {profile.last_name} has been banned",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to ban user: {str(e)}")

@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin_access = Depends(require_admin_access),
    db: AsyncSession = Depends(get_db)
):
    """Unban a user by setting their account status back to active"""
    try:
        # Get user profile
        result = await db.execute(
            select(Profile).where(Profile.id == user_id)
        )
        profile = result.scalar()
        
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update status to active
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(status=AccountStatus.active, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        return {
            "status": "success",
            "message": f"User {profile.first_name} {profile.last_name} has been unbanned",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to unban user: {str(e)}")
