import time

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db
from app.core.http_cache import build_etag, is_not_modified, not_modified_response, set_cache_headers
from app.db.models.speciality import Speciality
from app.schemas.speciality import SpecialitySchema, SpecialityListResponse

router = APIRouter()


# Specialities are a slow-moving reference list (seeded at deploy time). On
# pgBouncer/remote Supabase the DB round-trip costs ~500ms per request, so
# cache the serialized payload in-process for a short TTL. This is the hottest
# public endpoint — hit on every auth selection screen and every search page.
_SPECIALITIES_CACHE_TTL_SECONDS = 300
_specialities_cache: dict[str, object] = {"payload": None, "etag": None, "expires_at": 0.0}


@router.get("/", response_model=SpecialityListResponse)
async def get_specialities(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Get all specialities for dropdowns. Cached in-process for 5 minutes."""
    now = time.monotonic()
    cached_payload = _specialities_cache.get("payload")
    cached_etag = _specialities_cache.get("etag")
    if cached_payload is not None and now < float(_specialities_cache.get("expires_at") or 0):
        set_cache_headers(
            response,
            etag=str(cached_etag),
            max_age_seconds=_SPECIALITIES_CACHE_TTL_SECONDS,
            stale_while_revalidate_seconds=600,
            is_private=False,
        )
        if is_not_modified(request, str(cached_etag)):
            return not_modified_response(response)
        return cached_payload

    stmt = select(Speciality).order_by(Speciality.name)
    result = await db.execute(stmt)
    specialities = result.scalars().all()

    payload = SpecialityListResponse(
        specialities=[SpecialitySchema.model_validate(s) for s in specialities],
        total=len(specialities),
    )
    etag = build_etag(payload.model_dump(mode="json"))

    _specialities_cache["payload"] = payload
    _specialities_cache["etag"] = etag
    _specialities_cache["expires_at"] = now + _SPECIALITIES_CACHE_TTL_SECONDS

    set_cache_headers(
        response,
        etag=etag,
        max_age_seconds=_SPECIALITIES_CACHE_TTL_SECONDS,
        stale_while_revalidate_seconds=600,
        is_private=False,
    )
    if is_not_modified(request, etag):
        return not_modified_response(response)

    return payload
