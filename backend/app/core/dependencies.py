from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.db.models.profile import Profile
from app.db.models.enums import UserRole
from app.core.security import verify_jwt


async def resolve_profile(db: AsyncSession, user) -> Profile | None:
    """Return ``user.profile`` if pre-loaded by auth, else fetch from DB.

    ``get_current_user_token`` already loads the profile for every authenticated
    request (for the ban check). Route handlers should use this helper instead
    of re-querying Profile.
    """
    profile = getattr(user, "profile", None)
    if profile is not None:
        return profile
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    return result.scalar_one_or_none()


async def require_role(db: AsyncSession, user, role: UserRole, detail: str) -> Profile:
    """Validate the caller's role and return the (cached) profile."""
    profile = await resolve_profile(db, user)
    if not profile or profile.role != role:
        raise HTTPException(status_code=403, detail=detail)
    return profile

async def get_db(authorization: str | None = Header(None)):
    """Get database session with JWT context for RLS policies."""
    async with AsyncSessionLocal() as session:
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
            if token:
                try:
                    # Parameterized to avoid SQL injection via the Authorization header.
                    await session.execute(
                        text("SELECT set_config('request.jwt', :jwt, true)"),
                        {"jwt": token},
                    )
                except Exception:
                    # RLS might not be configured; continue anyway.
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
