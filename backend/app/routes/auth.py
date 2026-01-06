from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.dependencies import get_db
from app.schemas.auth import PatientSignup, DoctorSignup, UserLogin
from app.db.supabase import supabase
from pydantic import BaseModel
from app.db.models.profile import Profile 
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile 
from app.db.models.enums import UserRole, VerificationStatus

router = APIRouter()

class AuthCode(BaseModel):
    code: str

@router.post("/signup/patient", status_code=status.HTTP_201_CREATED)
async def signup_patient(user_data: PatientSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Create user in Supabase Auth
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

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Signup failed")

        user_id = auth_response.user.id

        # 2. Create base profile
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,  
            role=UserRole.PATIENT,
            verification_status=VerificationStatus.unverified,
            onboarding_completed=False
        )
        db.add(new_profile)
        
        # 3. Create patient profile with initial data
        new_patient = PatientProfile(
            profile_id=user_id,
            date_of_birth=user_data.date_of_birth,
            gender=user_data.gender,
            blood_group=user_data.blood_group,
            allergies=user_data.allergies
        )
        db.add(new_patient)

        await db.commit()
        
        return {
            "message": "Patient registered successfully",
            "user_id": user_id,
            "session": auth_response.session
        }

    except Exception as e:
        await db.rollback()
        print(f"Signup Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signup/doctor", status_code=status.HTTP_201_CREATED)
async def signup_doctor(user_data: DoctorSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Create user in Supabase Auth
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

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Signup failed")

        user_id = auth_response.user.id

        # 2. Create base profile
        new_profile = Profile(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone, 
            role=UserRole.DOCTOR,
            verification_status=VerificationStatus.pending,
            onboarding_completed=False
        )
        db.add(new_profile)
        
        # 3. Create doctor profile
        new_doctor = DoctorProfile(
            profile_id=user_id,
            bmdc_number=user_data.bmdc_number,
            bmdc_document_url=user_data.bmdc_document,
            bmdc_verified=True,  # ✅ TEMPORARY: Set to True for testing (no real BMDC verification)
            specialization=None  # Will be filled during onboarding
        )
        db.add(new_doctor)

        await db.commit()
        
        # Debug: Print session structure
        print(f"✅ Doctor signup successful - User ID: {user_id}")
        print(f"Session object type: {type(auth_response.session)}")
        if auth_response.session:
            print(f"Session has access_token: {hasattr(auth_response.session, 'access_token')}")
        
        return {
            "message": "Doctor registered successfully. Awaiting verification.",
            "user_id": user_id,
            "session": auth_response.session
        }

    except Exception as e:
        await db.rollback()
        print(f"Signup Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(user_data: UserLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user_data.email,
            "password": user_data.password,
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        return {
            "session": auth_response.session,
            "user": auth_response.user
        }
    except Exception as e:
        # Log the actual error for debugging
        print(f"Login Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
async def logout():
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from sqlalchemy import update
from app.db.models.profile import Profile

# Helper to get user from token
async def get_current_user_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid header format")
    
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

@router.get("/me")
async def get_my_profile(
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db)
):
    user_id = user.id
    
    result = await db.execute(
        text("SELECT id, role, first_name, last_name, email, phone, verification_status, onboarding_completed FROM profiles WHERE id = :id"),
        {"id": user_id}
    )
    profile = result.fetchone()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Sync verification status
    email_verified = user.email_confirmed_at is not None
    
    # If email is verified but DB says unverified, update it
    # For patients, we can mark as verified. For doctors, maybe keep as pending/unverified until admin check?
    # For now, let's assume email verification is enough to move out of "unverified" state for patients
    if email_verified and profile.verification_status == VerificationStatus.unverified:
        new_status = VerificationStatus.verified if profile.role == UserRole.PATIENT else VerificationStatus.pending
        
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(verification_status=new_status)
        )
        await db.commit()
        
        # Refresh profile data
        result = await db.execute(
            text("SELECT id, role, first_name, last_name, email, phone, verification_status, onboarding_completed FROM profiles WHERE id = :id"),
            {"id": user_id}
        )
        profile = result.fetchone()

    return {
        "id": profile.id,
        "role": profile.role,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "verification_status": profile.verification_status,
        "onboarding_completed": profile.onboarding_completed,
        "email_verified": email_verified
    }