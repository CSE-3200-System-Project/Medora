from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.processing_consent import ProcessingConsentGrant
from app.schemas.processing_consent import ProcessingPurpose


def consent_is_active(grant: ProcessingConsentGrant, *, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    return (
        grant.revoked_at is None
        and grant.valid_from <= current
        and (grant.valid_until is None or grant.valid_until > current)
    )


async def get_active_processing_consent(
    db: AsyncSession,
    *,
    subject_id: str,
    purpose: ProcessingPurpose,
    provider: str | None = None,
    recipient_id: str | None = None,
    required_scopes: set[str] | None = None,
) -> ProcessingConsentGrant | None:
    now = datetime.now(timezone.utc)
    filters = [
        ProcessingConsentGrant.subject_id == subject_id,
        ProcessingConsentGrant.purpose == purpose.value,
        ProcessingConsentGrant.revoked_at.is_(None),
        ProcessingConsentGrant.valid_from <= now,
        or_(ProcessingConsentGrant.valid_until.is_(None), ProcessingConsentGrant.valid_until > now),
    ]
    if provider:
        filters.append(ProcessingConsentGrant.provider == provider)
    if recipient_id:
        filters.append(ProcessingConsentGrant.recipient_id == recipient_id)
    result = await db.execute(
        select(ProcessingConsentGrant)
        .where(*filters)
        .order_by(ProcessingConsentGrant.version.desc())
        .limit(1)
    )
    grant = result.scalar_one_or_none()
    if grant is not None and required_scopes:
        granted_scopes = {str(scope).strip().lower() for scope in (grant.scopes or [])}
        if not {scope.strip().lower() for scope in required_scopes}.issubset(granted_scopes):
            return None
    return grant


async def require_processing_consent(
    db: AsyncSession,
    *,
    subject_id: str,
    purpose: ProcessingPurpose,
    provider: str | None = None,
    recipient_id: str | None = None,
    local_option_available: bool = False,
    required_scopes: set[str] | None = None,
) -> ProcessingConsentGrant:
    grant = await get_active_processing_consent(
        db,
        subject_id=subject_id,
        purpose=purpose,
        provider=provider,
        recipient_id=recipient_id,
        required_scopes=required_scopes,
    )
    if grant is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "processing_consent_required",
                "purpose": purpose.value,
                "provider": provider,
                "required_scopes": sorted(required_scopes or []),
                "local_option_available": local_option_available,
                "message": "This external processing purpose has not been granted or is no longer valid.",
            },
        )
    return grant
