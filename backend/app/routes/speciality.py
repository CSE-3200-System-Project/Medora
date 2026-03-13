from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.core.http_cache import build_etag, is_not_modified, not_modified_response, set_cache_headers
from app.db.models.speciality import Speciality
from app.schemas.speciality import SpecialitySchema, SpecialityListResponse

router = APIRouter()

@router.get("/", response_model=SpecialityListResponse)
async def get_specialities(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all specialities for dropdown lists in doctor onboarding and patient search.
    """
    stmt = select(Speciality).order_by(Speciality.name)
    result = await db.execute(stmt)
    specialities = result.scalars().all()

    payload = SpecialityListResponse(
        specialities=[SpecialitySchema.model_validate(s) for s in specialities],
        total=len(specialities)
    )
    etag = build_etag(payload.model_dump(mode="json"))
    set_cache_headers(
        response,
        etag=etag,
        max_age_seconds=300,
        stale_while_revalidate_seconds=600,
        is_private=False,
    )
    if is_not_modified(request, etag):
        return not_modified_response(response)

    return payload
