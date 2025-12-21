from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models.profile import Profile
from app.core.security import verify_jwt

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    token = authorization.replace("Bearer ", "")
    payload = verify_jwt(token)

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
