import asyncio

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, update
from app.core.dependencies import get_db
from app.schemas.auth import PatientSignup, DoctorSignup, UserLogin
from app.db.supabase import supabase, storage_supabase as admin_supabase
from pydantic import BaseModel
from app.db.models.profile import Profile 
from app.db.models.patient import PatientProfile
from app.db.models.doctor import DoctorProfile 
from app.db.models.enums import UserRole, VerificationStatus, AccountStatus
from app.core.avatar_defaults import generate_default_avatar_url
from sqlalchemy import select
import os
from types import SimpleNamespace
from app.core.security import verify_jwt

router = APIRouter()


async def _resolve_user_avatar_url(db: AsyncSession, user_id: str, role: UserRole | None) -> str:
    if role == UserRole.PATIENT:
        result = await db.execute(
            select(PatientProfile.profile_photo_url).where(PatientProfile.profile_id == user_id)
        )
        photo_url = result.scalar_one_or_none()
        return photo_url or generate_default_avatar_url(user_id)

    if role == UserRole.DOCTOR:
        result = await db.execute(
            select(DoctorProfile.profile_photo_url).where(DoctorProfile.profile_id == user_id)
        )
        photo_url = result.scalar_one_or_none()
        return photo_url or generate_default_avatar_url(user_id)

    return generate_default_avatar_url(user_id)

class AuthCode(BaseModel):
    code: str

@router.post("/signup/patient", status_code=status.HTTP_201_CREATED)
async def signup_patient(user_data: PatientSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Create user in Supabase Auth (supabase-py is sync → run in a thread).
        auth_response = await asyncio.to_thread(
            supabase.auth.sign_up,
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "first_name": user_data.first_name,
                        "last_name": user_data.last_name,
                        "role": "patient",
                    }
                },
            },
        )

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
            allergies=user_data.allergies,
            profile_photo_url=generate_default_avatar_url(user_id),
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
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signup/doctor", status_code=status.HTTP_201_CREATED)
async def signup_doctor(user_data: DoctorSignup, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Create user in Supabase Auth (supabase-py is sync → run in a thread).
        auth_response = await asyncio.to_thread(
            supabase.auth.sign_up,
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "first_name": user_data.first_name,
                        "last_name": user_data.last_name,
                        "role": "doctor",
                    }
                },
            },
        )

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
            bmdc_verified=False,  # Will be verified by admin
            specialization=None,  # Will be filled during onboarding
            profile_photo_url=generate_default_avatar_url(user_id),
        )
        db.add(new_doctor)

        await db.commit()
        
        return {
            "message": "Registration successful! Please wait 24-48 hours for BMDC verification by our admin team.",
            "user_id": user_id,
            "session": auth_response.session
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    try:
        # Avatar backfill moved to startup lifespan — don't block user login.
        # supabase-py is sync; run in a thread so we don't block the event loop.
        auth_response = await asyncio.to_thread(
            supabase.auth.sign_in_with_password,
            {"email": user_data.email, "password": user_data.password},
        )
        
        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check if user is banned
        result = await db.execute(
            select(Profile).where(Profile.id == auth_response.user.id)
        )
        profile = result.scalar_one_or_none()
        avatar_url = await _resolve_user_avatar_url(db, auth_response.user.id, profile.role if profile else None)
        
        if profile and profile.status == AccountStatus.banned:
            # Sign out the user immediately
            supabase.auth.sign_out()
            raise HTTPException(
                status_code=403, 
                detail={
                    "code": "ACCOUNT_BANNED",
                    "message": "Your account has been suspended by the administrator.",
                    "reason": profile.ban_reason or "No reason provided",
                },
            )
        
        # Return profile info including verification status
        return {
            "session": auth_response.session,
            "user": auth_response.user,
            "profile": {
                "role": profile.role.value if profile else None,
                "verification_status": profile.verification_status.value if profile else None,
                "onboarding_completed": profile.onboarding_completed if profile else False,
                "profile_photo_url": avatar_url,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
async def logout():
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def get_current_user_token(authorization: str = Header(...), db: AsyncSession = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid header format")

    token = authorization.split(" ")[1]
    try:
        payload = await verify_jwt(token)
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        user = SimpleNamespace(
            id=user_id,
            email=payload.get("email"),
            email_confirmed_at=payload.get("email_confirmed_at") or payload.get("confirmed_at"),
            profile=None,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

    # Load the profile once and attach it to `user` so downstream role-guards
    # and handlers don't have to re-query it. This is THE hot query — it runs
    # on every authenticated request in the system.
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalar_one_or_none()

    if profile and profile.status == AccountStatus.banned:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_BANNED",
                "message": "Your account has been suspended by the administrator.",
                "reason": profile.ban_reason or "No reason provided",
            },
        )

    user.profile = profile
    return user

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

    avatar_url = await _resolve_user_avatar_url(db, user_id, profile.role if profile else None)

    return {
        "id": profile.id,
        "role": profile.role,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "email": profile.email,
        "phone": profile.phone,
        "verification_status": profile.verification_status,
        "onboarding_completed": profile.onboarding_completed,
        "profile_photo_url": avatar_url,
        "email_verified": email_verified
    }

class ForgotPasswordRequest(BaseModel):
    email: str

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        # Check if user exists in database
        result = await db.execute(
            select(Profile).where(Profile.email == request.email)
        )
        user = result.scalar_one_or_none()
        
        # Always return success even if user doesn't exist (security best practice)
        # This prevents email enumeration attacks
        if not user:
            return {"message": "If an account with that email exists, a password reset link has been sent"}
        
        # Send password reset email via Supabase
        reset_response = supabase.auth.reset_password_for_email(
            request.email,
            {
                "redirect_to": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password"
            }
        )
        
        return {"message": "If an account with that email exists, a password reset link has been sent"}
        
    except Exception as e:
        # Still return success to prevent email enumeration
        return {"message": "If an account with that email exists, a password reset link has been sent"}


class ResetPasswordRequest(BaseModel):
    access_token: str
    new_password: str


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset a user's password using a Supabase recovery access token.
    The frontend exchanges the recovery token from the URL hash,
    then sends the resulting access_token here along with the new password.
    """
    try:
        # Use the recovery access token to get the user
        user_response = supabase.auth.get_user(request.access_token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired reset token")

        user_id = user_response.user.id

        # Update the password via Supabase admin API (requires service role key)
        admin_supabase.auth.admin.update_user_by_id(
            user_id,
            {"password": request.new_password}
        )

        return {"message": "Password has been reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to reset password. The link may have expired.")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(verify_jwt),
):
    """
    Change password for an authenticated user.
    Verifies the current password first, then updates to the new one.
    """
    try:
        # Get the user's email from their profile
        result = await db.execute(
            select(Profile.email).where(Profile.id == user.id)
        )
        email = result.scalar_one_or_none()
        if not email:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify current password by attempting a sign-in
        try:
            supabase.auth.sign_in_with_password({
                "email": email,
                "password": request.current_password,
            })
        except Exception:
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Update the password (requires service role key)
        admin_supabase.auth.admin.update_user_by_id(
            user.id,
            {"password": request.new_password}
        )

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to change password")
