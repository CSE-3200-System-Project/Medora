from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.db.models.profile import Profile
from app.core.security import verify_jwt

async def get_db(authorization: str | None = Header(None)):
    """Get database session with JWT context for RLS policies."""
    async with AsyncSessionLocal() as session:
        # Set JWT context for RLS from Authorization header
        if authorization:
            token = authorization.replace("Bearer ", "")
            try:
                # Set request.jwt for Supabase RLS policies
                await session.execute(text(f"SELECT set_config('request.jwt', '{token}', true)"))
            except Exception:
                # RLS might not be configured, continue anyway
                pass
        yield session

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    token = authorization.replace("Bearer ", "")
    payload = await verify_jwt(token)

    user_id = payload.get("sub")
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(401, "Profile not found")

    return profile

async def require_doctor(profile=Depends(get_current_user)):
    if profile.role.value != "doctor":
        raise HTTPException(403)
    if profile.verification_status.value != "verified":
        raise HTTPException(403, "Doctor not verified")
    return profile
