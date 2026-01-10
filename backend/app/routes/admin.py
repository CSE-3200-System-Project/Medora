from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus, UserRole, AccountStatus
from datetime import datetime
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()

# Simple admin key for password-only access
ADMIN_PASSWORD = "admin123"

# Helper to check admin access (password-based, no account needed)
async def require_admin_access(
    x_admin_password: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Verify admin access via password (no account required)"""
    print(f"Received admin password header: {x_admin_password}")  # Debug logging
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
        from app.db.models.patient import PatientProfile
        from app.db.models.appointment import Appointment, AppointmentStatus
        from sqlalchemy import func, and_
        from datetime import timedelta
        from datetime import timedelta
        
        print("Fetching admin stats...")  # Debug log
        
        # Count all users by role
        total_users_result = await db.execute(select(func.count(Profile.id)))
        total_users = total_users_result.scalar() or 0
        
        # Count doctors
        doctors_result = await db.execute(
            select(Profile).where(Profile.role == UserRole.DOCTOR)
        )
        all_doctors = doctors_result.scalars().all()
        total_doctors = len(all_doctors)
        
        verified_doctors = len([d for d in all_doctors if d.verification_status == VerificationStatus.verified])
        pending_doctors = len([d for d in all_doctors if d.verification_status == VerificationStatus.pending])
        rejected_doctors = len([d for d in all_doctors if d.verification_status == VerificationStatus.rejected])
        
        # Count patients
        patients_result = await db.execute(
            select(Profile).where(Profile.role == UserRole.PATIENT)
        )
        all_patients = patients_result.scalars().all()
        total_patients = len(all_patients)
        
        # Patients with completed onboarding
        patients_with_onboarding = len([p for p in all_patients if p.onboarding_completed])
        
        # Count appointments - with error handling
        try:
            from app.db.models.appointment import Appointment, AppointmentStatus
            
            total_appointments_result = await db.execute(select(func.count(Appointment.id)))
            total_appointments = total_appointments_result.scalar() or 0
            
            # Appointments by status - use enum values
            pending_appointments_result = await db.execute(
                select(func.count(Appointment.id)).where(Appointment.status == AppointmentStatus.PENDING)
            )
            pending_appointments = pending_appointments_result.scalar() or 0
            
            confirmed_appointments_result = await db.execute(
                select(func.count(Appointment.id)).where(Appointment.status == AppointmentStatus.CONFIRMED)
            )
            confirmed_appointments = confirmed_appointments_result.scalar() or 0
            
            completed_appointments_result = await db.execute(
                select(func.count(Appointment.id)).where(Appointment.status == AppointmentStatus.COMPLETED)
            )
            completed_appointments = completed_appointments_result.scalar() or 0
            
            cancelled_appointments_result = await db.execute(
                select(func.count(Appointment.id)).where(Appointment.status == AppointmentStatus.CANCELLED)
            )
            cancelled_appointments = cancelled_appointments_result.scalar() or 0
        except Exception as e:
            print(f"Error fetching appointments: {e}")
            total_appointments = 0
            pending_appointments = 0
            confirmed_appointments = 0
            completed_appointments = 0
            cancelled_appointments = 0
        
        # Recent registrations (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_users_result = await db.execute(
            select(func.count(Profile.id)).where(Profile.created_at >= week_ago)
        )
        recent_registrations = recent_users_result.scalar() or 0
        
        stats = {
            "total_users": total_users,
            "total_doctors": total_doctors,
            "total_patients": total_patients,
            "verified_doctors": verified_doctors,
            "pending_doctors": pending_doctors,
            "rejected_doctors": rejected_doctors,
            "patients_with_complete_profile": patients_with_onboarding,
            "total_appointments": total_appointments,
            "pending_appointments": pending_appointments,
            "confirmed_appointments": confirmed_appointments,
            "completed_appointments": completed_appointments,
            "cancelled_appointments": cancelled_appointments,
            "recent_registrations_7days": recent_registrations,
        }
        
        print(f"Admin stats retrieved successfully: {stats}")
        return stats
        
    except Exception as e:
        print(f"Error in get_admin_stats: {str(e)}")
        import traceback
        traceback.print_exc()
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
        from sqlalchemy import func
        
        print(f"Fetching patients with limit={limit}, offset={offset}")
        
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
        
        print(f"Found {len(patients)} patients, total: {total}")
        
        return {
            "patients": patients,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        print(f"Error fetching patients: {str(e)}")
        import traceback
        traceback.print_exc()
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
    from sqlalchemy import func
    
    result = await db.execute(
        select(Appointment)
        .limit(limit)
        .offset(offset)
        .order_by(Appointment.appointment_date.desc())
    )
    
    appointments = []
    for appointment in result.scalars().all():
        # Get doctor info
        doctor_result = await db.execute(
            select(Profile).where(Profile.id == appointment.doctor_id)
        )
        doctor = doctor_result.scalar()
        
        # Get patient info
        patient_result = await db.execute(
            select(Profile).where(Profile.id == appointment.patient_id)
        )
        patient = patient_result.scalar()
        
        appointments.append({
            "id": appointment.id,
            "appointment_date": appointment.appointment_date.isoformat(),
            "status": appointment.status.lower(),
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
