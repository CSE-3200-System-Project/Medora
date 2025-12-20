from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.dependencies import require_admin, get_db
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import VerificationStatus
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/verify-doctor/{doctor_id}")
async def verify_doctor(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin)
):
    async with db.begin():  # 🔒 TRANSACTION
        profile = await db.get(Profile, doctor_id)
        doctor = await db.get(DoctorProfile, doctor_id)

        if not profile or not doctor:
            raise HTTPException(404)

        profile.verification_status = VerificationStatus.verified
        profile.verified_at = datetime.utcnow()
        doctor.bmdc_verified = True
        doctor.verification_method = "manual"

    return {"status": "verified"}
