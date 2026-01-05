from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus, UserRole
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

# Helper to check if user is admin
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
    admin = Depends(require_admin)
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
    admin = Depends(require_admin)
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
    admin = Depends(require_admin)
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
        })
    
    return {"doctors": doctors}

@router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_admin)
):
    """Get platform statistics"""
    # Count doctors by status
    doctors_result = await db.execute(
        select(Profile.verification_status)
        .where(Profile.role == UserRole.DOCTOR)
    )
    
    # Count patients
    patients_result = await db.execute(
        select(Profile).where(Profile.role == UserRole.PATIENT)
    )
    
    return {
        "total_doctors": len(doctors_result.all()),
        "total_patients": len(patients_result.all()),
        "pending_verifications": len([r for r in doctors_result.all() if r[0] == VerificationStatus.pending]),
    }
