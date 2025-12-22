from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.schemas.onboarding import PatientOnboardingUpdate, DoctorOnboardingUpdate
from typing import Optional, List, Dict, Any
from datetime import datetime
import traceback

router = APIRouter()

@router.patch("/patient/onboarding")
async def update_patient_onboarding(
    data: PatientOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update patient profile during onboarding"""
    print(f"Received onboarding data: {data.dict(exclude_unset=True)}")
    user_id = user.id
    try:
        # 1. Update Profile table (common fields)
        profile_data = {}
        if data.first_name: profile_data['first_name'] = data.first_name
        if data.last_name: profile_data['last_name'] = data.last_name
        if data.phone: profile_data['phone'] = data.phone
        if data.onboarding_completed is not None: profile_data['onboarding_completed'] = data.onboarding_completed
        
        if profile_data:
            await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(**profile_data)
            )

        # 2. Update PatientProfile table
        patient_data = {}
        
        # Helper to convert yes/no to bool
        def to_bool(val):
            if isinstance(val, bool): return val
            if isinstance(val, str): return val.lower() == 'yes'
            return False

        if data.dob: patient_data['date_of_birth'] = datetime.strptime(data.dob, '%Y-%m-%d').date()
        if data.gender: patient_data['gender'] = data.gender
        if data.blood_group: patient_data['blood_group'] = data.blood_group
        if data.allergies: patient_data['allergies'] = data.allergies
        
        if data.height: patient_data['height'] = data.height
        if data.weight: patient_data['weight'] = data.weight
        if data.city: patient_data['city'] = data.city
        if data.country: patient_data['country'] = data.country
        if data.occupation: patient_data['occupation'] = data.occupation
        if data.medical_summary_url: patient_data['medical_summary_url'] = data.medical_summary_url
        
        if data.has_conditions is not None: patient_data['has_conditions'] = to_bool(data.has_conditions)
        if data.conditions is not None: 
            # Ensure conditions is a list of dicts, not Pydantic models
            patient_data['conditions'] = [c.model_dump() if hasattr(c, 'model_dump') else c.dict() for c in data.conditions]
        
        if data.taking_meds is not None: patient_data['taking_meds'] = to_bool(data.taking_meds)
        if data.medications is not None: 
            # Ensure medications is a list of dicts
            patient_data['medications'] = [m.model_dump() if hasattr(m, 'model_dump') else m.dict() for m in data.medications]
        if data.allergy_reaction: patient_data['allergy_reaction'] = data.allergy_reaction
        
        if data.past_surgeries is not None: patient_data['past_surgeries'] = to_bool(data.past_surgeries)
        if data.surgery_description: patient_data['surgery_description'] = data.surgery_description
        if data.ongoing_treatments is not None: patient_data['ongoing_treatments'] = to_bool(data.ongoing_treatments)
        
        if data.smoking: patient_data['smoking'] = data.smoking
        if data.alcohol: patient_data['alcohol'] = data.alcohol
        if data.activity_level: patient_data['activity_level'] = data.activity_level
        if data.sleep_duration: patient_data['sleep_duration'] = data.sleep_duration
        if data.diet: patient_data['diet'] = data.diet
        
        if data.language: patient_data['language'] = data.language
        if data.notifications is not None: patient_data['notifications'] = data.notifications
        if data.emergency_name: patient_data['emergency_name'] = data.emergency_name
        if data.emergency_relation: patient_data['emergency_relation'] = data.emergency_relation
        if data.emergency_phone: patient_data['emergency_phone'] = data.emergency_phone
        if data.consent_storage is not None: patient_data['consent_storage'] = data.consent_storage
        if data.consent_ai is not None: patient_data['consent_ai'] = data.consent_ai
        if data.consent_doctor is not None: patient_data['consent_doctor'] = data.consent_doctor

        if patient_data:
            # Check if patient profile exists
            result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == user_id))
            if not result.scalar():
                # Create if not exists (should exist from signup, but just in case)
                new_profile = PatientProfile(profile_id=user_id, **patient_data)
                db.add(new_profile)
            else:
                # Ensure JSON fields are properly serialized if needed, though SQLAlchemy + asyncpg usually handles list/dict
                # But let's make sure we aren't passing Pydantic models
                await db.execute(
                    update(PatientProfile)
                    .where(PatientProfile.profile_id == user_id)
                    .values(**patient_data)
                )
        
        await db.commit()
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error updating patient profile: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/doctor/onboarding")
async def update_doctor_onboarding(
    data: DoctorOnboardingUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Update doctor profile during onboarding"""
    user_id = user.id
    try:
        # 1. Update Profile table
        profile_data = {}
        if data.first_name: profile_data['first_name'] = data.first_name
        if data.last_name: profile_data['last_name'] = data.last_name
        if data.phone: profile_data['phone'] = data.phone
        if data.onboarding_completed is not None: profile_data['onboarding_completed'] = data.onboarding_completed
        
        if profile_data:
            await db.execute(
                update(Profile)
                .where(Profile.id == user_id)
                .values(**profile_data)
            )

        # 2. Update DoctorProfile table
        doctor_data = {}
        
        if data.registration_number: doctor_data['bmdc_number'] = data.registration_number
        if data.specialization: doctor_data['specialization'] = data.specialization
        if data.bmdc_document_url: doctor_data['bmdc_document_url'] = data.bmdc_document_url
        
        if data.experience: 
            try:
                doctor_data['years_of_experience'] = int(data.experience)
            except:
                pass
        
        if data.profile_photo_url: doctor_data['profile_photo_url'] = data.profile_photo_url
        if data.degree: doctor_data['degree'] = data.degree
        if data.degree_certificates_url: doctor_data['degree_certificates_url'] = data.degree_certificates_url
        
        if data.hospital_name: doctor_data['hospital_name'] = data.hospital_name
        if data.practice_location: doctor_data['practice_location'] = data.practice_location
        if data.consultation_mode: doctor_data['consultation_mode'] = data.consultation_mode
        if data.affiliation_letter_url: doctor_data['affiliation_letter_url'] = data.affiliation_letter_url
        
        if data.consultation_fee: 
            try:
                doctor_data['consultation_fee'] = float(data.consultation_fee)
            except:
                pass
                
        if data.available_days: doctor_data['available_days'] = data.available_days
        if data.time_slots: doctor_data['time_slots'] = data.time_slots
        if data.emergency_availability is not None: doctor_data['emergency_availability'] = data.emergency_availability
        
        if data.language: doctor_data['language'] = data.language
        if data.case_types: doctor_data['case_types'] = data.case_types
        if data.ai_assistance is not None: doctor_data['ai_assistance'] = data.ai_assistance
        if data.terms_accepted is not None: doctor_data['terms_accepted'] = data.terms_accepted

        if doctor_data:
            result = await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == user_id))
            if not result.scalar():
                new_profile = DoctorProfile(profile_id=user_id, **doctor_data)
                db.add(new_profile)
            else:
                await db.execute(
                    update(DoctorProfile)
                    .where(DoctorProfile.profile_id == user_id)
                    .values(**doctor_data)
                )
        
        await db.commit()
        return {"message": "Profile updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error updating doctor profile: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/complete-onboarding")
async def complete_onboarding(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    user_id = user.id
    await db.execute(
        update(Profile)
        .where(Profile.id == user_id)
        .values(onboarding_completed=True)
    )
    await db.commit()
    return {"message": "Onboarding completed"}

@router.get("/patient/profile")
async def get_patient_profile(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete patient profile"""
    user_id = user.id
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
            # Add other fields if needed for frontend display
        }
    }

@router.get("/doctor/profile")
async def get_doctor_profile(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    """Get complete doctor profile"""
    user_id = user.id
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
            # Add other fields if needed
        }
    }
