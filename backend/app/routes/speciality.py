from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.db.models.speciality import Speciality
from app.schemas.speciality import SpecialitySchema, SpecialityListResponse

router = APIRouter()

@router.get("/", response_model=SpecialityListResponse)
async def get_specialities(db: AsyncSession = Depends(get_db)):
    """
    Get all specialities for dropdown lists in doctor onboarding and patient search.
    """
    stmt = select(Speciality).order_by(Speciality.name)
    result = await db.execute(stmt)
    specialities = result.scalars().all()
    
    return SpecialityListResponse(
        specialities=[SpecialitySchema.model_validate(s) for s in specialities],
        total=len(specialities)
    )
