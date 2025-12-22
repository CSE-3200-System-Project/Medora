from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()

class PatientOnboardingUpdate(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None
    occupation: Optional[str] = None
    blood_group: Optional[str] = None
    # Add other fields as needed to match frontend
    
class DoctorOnboardingUpdate(BaseModel):
    degree: Optional[str] = None
    specialization: Optional[str] = None
    experience: Optional[int] = None
    hospital_name: Optional[str] = None
    practice_location: Optional[str] = None
    consultation_fee: Optional[float] = None
    # Add other fields as needed

@router.patch("/patient/onboarding")
async def update_patient_onboarding(
    data: Dict[str, Any], # Using Dict to be flexible with fields for now
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update patient profile during onboarding"""
    try:
        # Filter out fields that don't belong to PatientProfile
        # For simplicity, we'll just try to update what matches
        # In a real app, use a proper Pydantic model
        
        # We also need to handle 'onboarding_completed' which is on Profile model
        onboarding_completed = data.pop('onboarding_completed', False)
        
        if onboarding_completed:
             await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(onboarding_completed=True)
            )

        if data:
            # This is a bit loose, ideally we map fields explicitly
            # But for the sake of getting it working with the large frontend form:
            valid_columns = PatientProfile.__table__.columns.keys()
            filtered_data = {k: v for k, v in data.items() if k in valid_columns}
            
            if filtered_data:
                await db.execute(
                    update(PatientProfile)
                    .where(PatientProfile.profile_id == user_id)
                    .values(**filtered_data)
                )
        
        await db.commit()
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/doctor/onboarding")
async def update_doctor_onboarding(
    data: Dict[str, Any],
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update doctor profile during onboarding"""
    try:
        onboarding_completed = data.pop('onboarding_completed', False)
        
        if onboarding_completed:
             await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(onboarding_completed=True)
            )

        if data:
            valid_columns = DoctorProfile.__table__.columns.keys()
            filtered_data = {k: v for k, v in data.items() if k in valid_columns}
            
            if filtered_data:
                await db.execute(
                    update(DoctorProfile)
                    .where(DoctorProfile.profile_id == user_id)
                    .values(**filtered_data)
                )
        
        await db.commit()
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/patient/profile")
async def get_patient_profile(
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete patient profile"""
    result = await db.execute(
        select(Profile, PatientProfile)
        .join(PatientProfile, Profile.id == PatientProfile.profile_id)
        .where(Profile.id == user_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile, patient = row
    return {
        "profile": {
            "id": profile.id,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "role": profile.role,
            "onboarding_completed": profile.onboarding_completed
        },
        "patient_data": {
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies,
        }
    }

@router.get("/doctor/profile")
async def get_doctor_profile(
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete doctor profile"""
    result = await db.execute(
        select(Profile, DoctorProfile)
        .join(DoctorProfile, Profile.id == DoctorProfile.profile_id)
        .where(Profile.id == user_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile, doctor = row
    return {
        "profile": {
            "id": profile.id,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "role": profile.role,
            "verification_status": profile.verification_status,
            "onboarding_completed": profile.onboarding_completed
        },
        "doctor_data": {
            "bmdc_number": doctor.bmdc_number,
            "specialization": doctor.specialization,
            "bmdc_verified": doctor.bmdc_verified,
            "years_of_experience": doctor.years_of_experience,
            "institution": doctor.institution,
        }
    }

@router.post("/complete-onboarding")
async def complete_onboarding(
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    try:
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(onboarding_completed=True)
        )
        await db.commit()
        return {"message": "Onboarding completed"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
