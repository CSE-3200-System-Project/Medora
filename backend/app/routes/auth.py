from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db
from app.schemas.auth import PatientSignup, DoctorSignup, UserLogin
from app.db.supabase import supabase
from pydantic import BaseModel
# Importing YOUR existing models
from app.db.models.profile import Profile 
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile 
from app.db.models.enums import UserRole

router = APIRouter()

# Schema for the code exchange
class AuthCode(BaseModel):
    code: str

@router.post("/signup/patient", status_code=status.HTTP_201_CREATED)
async def signup_patient(user_data: PatientSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "role": "patient"
                }
            }
        })

        if not auth_response.user or not auth_response.user.id:
            raise HTTPException(status_code=400, detail="Supabase Auth Signup failed")

        user_id = auth_response.user.id

        # 2. Create Base Profile
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.PATIENT
        )
        db.add(new_profile)
        
        # 3. Create PatientProfile (Using your model)
        new_patient_profile = PatientProfile(
            profile_id=user_id,
            date_of_birth=user_data.date_of_birth,
            gender=user_data.gender,
            blood_group=user_data.blood_group,
            allergies=user_data.allergies
        )
        db.add(new_patient_profile)

        await db.commit()
        return {"message": "Patient registered successfully", "user_id": user_id}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signup/doctor", status_code=status.HTTP_201_CREATED)
async def signup_doctor(user_data: DoctorSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "role": "doctor"
                }
            }
        })

        if not auth_response.user or not auth_response.user.id:
            raise HTTPException(status_code=400, detail="Supabase Auth Signup failed")

        user_id = auth_response.user.id

        # 2. Create Base Profile
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.DOCTOR
        )
        db.add(new_profile)
        
        # 3. Create DoctorProfile (Using your model)
        new_doctor_profile = DoctorProfile(
            profile_id=user_id,
            bmdc_number=user_data.bmdc_number,
            bmdc_document=user_data.bmdc_document
        )
        db.add(new_doctor_profile)

        await db.commit()
        return {"message": "Doctor registered successfully", "user_id": user_id}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(user_data: UserLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user_data.email,
            "password": user_data.password,
        })
        return auth_response
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")

# Helper to get user_id from Supabase Token
async def get_current_user_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid header format")
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

# 1. Check if Profile Exists (Called after Google Login)
@router.get("/me")
async def get_my_profile(
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    # Check if profile exists in SQL DB
    result = await db.execute(text("SELECT role FROM profiles WHERE id = :id"), {"id": user_id})
    profile = result.fetchone()
    
    if not profile:
        # User exists in Auth but not in DB -> Needs Onboarding
        return {"status": "incomplete", "id": user_id}
    
    return {"status": "complete", "role": profile.role, "id": user_id}

# 2. Complete Profile for Google Users (Patient)
@router.post("/google/complete/patient", status_code=status.HTTP_201_CREATED)
async def complete_google_patient(
    user_data: PatientSignup, # Reusing schema, but password field might be redundant here
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    # Logic similar to signup, but we skip Supabase Auth creation
    # because the user already exists from Google.
    try:
        # Create Base Profile
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.PATIENT
        )
        db.add(new_profile)
        
        # Create Patient Profile
        new_patient = PatientProfile(
            profile_id=user_id,
            date_of_birth=user_data.date_of_birth,
            gender=user_data.gender,
            blood_group=user_data.blood_group,
            allergies=user_data.allergies
        )
        db.add(new_patient)
        
        # Update Supabase User Metadata with Role (Optional but good for sync)
        supabase.auth.update_user_attributes(user_id, {
            "data": {"role": "patient"}
        })

        await db.commit()
        return {"message": "Profile completed successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# 3. Complete Profile for Google Users (Doctor)
@router.post("/google/complete/doctor", status_code=status.HTTP_201_CREATED)
async def complete_google_doctor(
    user_data: DoctorSignup,
    user_id: str = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    try:
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=UserRole.DOCTOR
        )
        db.add(new_profile)
        
        new_doctor = DoctorProfile(
            profile_id=user_id,
            bmdc_number=user_data.bmdc_number,
            bmdc_document=user_data.bmdc_document
        )
        db.add(new_doctor)
        
        supabase.auth.update_user_attributes(user_id, {
            "data": {"role": "doctor"}
        })

        await db.commit()
        return {"message": "Profile completed successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# 1. Generate Google Auth URL
@router.get("/google/url")
async def get_google_auth_url():
    # Ensure this matches your frontend route exactly
    frontend_callback = "http://localhost:3000/auth/confirm" 
    
    try:
        res = supabase.auth.sign_in_with_oauth({
            "provider": "google",
            "options": {
                "redirect_to": frontend_callback
            }
        })
        return {"url": res.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Exchange Code & Check Profile
@router.post("/google/callback")
async def google_auth_callback(payload: AuthCode, db: AsyncSession = Depends(get_db)):
    try:
        # Exchange code for session using Backend Supabase Client
        res = supabase.auth.exchange_code_for_session(auth_code=payload.code)
        
        if not res.user:
            raise HTTPException(status_code=400, detail="Login failed")

        # Check if Profile exists in SQLAlchemy
        result = await db.execute(
            text("SELECT 1 FROM profiles WHERE id = :id"), 
            {"id": res.user.id}
        )
        profile_exists = result.scalar() is not None
        
        return {
            "session": res.session,
            "status": "complete" if profile_exists else "incomplete",
            "user": res.user
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))