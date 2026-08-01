from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, resolve_profile
from app.core.config import settings
from app.db.models.processing_consent import ProcessingConsentGrant
from app.routes.auth import get_current_user_token
from app.schemas.processing_consent import (
    ProcessingConsentListResponse,
    ProcessingConsentResponse,
    ProcessingConsentUpsert,
    ProcessingPurpose,
)
from app.services.processing_consent import consent_is_active

router = APIRouter()


def _default_provider(purpose: ProcessingPurpose) -> str:
    return {
        ProcessingPurpose.CLINICAL_SHARING: "medora",
        ProcessingPurpose.EXTERNAL_TEXT_AI: (settings.AI_PROVIDER or "mock").strip().lower(),
        ProcessingPurpose.CLOUD_DOCUMENT_OCR: "azure_document_intelligence",
        ProcessingPurpose.EXTERNAL_LIVE_AUDIO: "vapi",
        ProcessingPurpose.RESEARCH_EXPORT: "zenodo",
    }[purpose]


async def _require_consent_subject(db: AsyncSession, user: Any) -> None:
    profile = await resolve_profile(db, user)
    if not profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A profile is required to manage consent")


def _response(grant: ProcessingConsentGrant) -> ProcessingConsentResponse:
    return ProcessingConsentResponse(
        id=grant.id,
        subject_id=grant.subject_id,
        purpose=ProcessingPurpose(grant.purpose),
        version=grant.version,
        scopes=list(grant.scopes or []),
        provider=grant.provider,
        recipient_id=grant.recipient_id,
        policy_version=grant.policy_version,
        valid_from=grant.valid_from,
        valid_until=grant.valid_until,
        revoked_at=grant.revoked_at,
        granted_at=grant.granted_at,
        active=consent_is_active(grant),
    )


@router.get("/processing-consents", response_model=ProcessingConsentListResponse)
async def list_processing_consents(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_consent_subject(db, user)
    grants = (
        await db.execute(
            select(ProcessingConsentGrant)
            .where(ProcessingConsentGrant.subject_id == user.id)
            .order_by(ProcessingConsentGrant.purpose, ProcessingConsentGrant.version.desc())
        )
    ).scalars().all()
    return ProcessingConsentListResponse(items=[_response(grant) for grant in grants])


@router.put("/processing-consents/{purpose}", response_model=ProcessingConsentResponse)
async def grant_or_replace_processing_consent(
    purpose: ProcessingPurpose,
    payload: ProcessingConsentUpsert,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_consent_subject(db, user)
    now = datetime.now(timezone.utc)
    if payload.valid_until is not None and payload.valid_until <= now:
        raise HTTPException(status_code=422, detail="valid_until must be in the future")

    provider = payload.provider or _default_provider(purpose)
    recipient_id = payload.recipient_id or provider
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:consent_key))"),
        {"consent_key": f"processing-consent:{user.id}:{purpose.value}:{provider}:{recipient_id}"},
    )

    existing = (
        await db.execute(
            select(ProcessingConsentGrant)
            .where(
                ProcessingConsentGrant.subject_id == user.id,
                ProcessingConsentGrant.purpose == purpose.value,
                ProcessingConsentGrant.provider == provider,
                ProcessingConsentGrant.recipient_id == recipient_id,
                ProcessingConsentGrant.revoked_at.is_(None),
            )
            .with_for_update()
        )
    ).scalars().all()
    for grant in existing:
        grant.revoked_at = now
        grant.revoked_by_id = user.id

    latest_version = (
        await db.execute(
            select(func.max(ProcessingConsentGrant.version)).where(
                ProcessingConsentGrant.subject_id == user.id,
                ProcessingConsentGrant.purpose == purpose.value,
                ProcessingConsentGrant.provider == provider,
                ProcessingConsentGrant.recipient_id == recipient_id,
            )
        )
    ).scalar() or 0
    grant = ProcessingConsentGrant(
        subject_id=user.id,
        purpose=purpose.value,
        version=int(latest_version) + 1,
        scopes=payload.scopes,
        provider=provider,
        recipient_id=recipient_id,
        policy_version=payload.policy_version,
        valid_from=now,
        valid_until=payload.valid_until,
        granted_by_id=user.id,
        audit_note=payload.audit_note,
    )
    db.add(grant)
    await db.commit()
    await db.refresh(grant)
    return _response(grant)


@router.post("/processing-consents/{consent_id}/revoke", response_model=ProcessingConsentResponse)
async def revoke_processing_consent(
    consent_id: str,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_consent_subject(db, user)
    grant = (
        await db.execute(
            select(ProcessingConsentGrant).where(
                ProcessingConsentGrant.id == consent_id,
                ProcessingConsentGrant.subject_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if grant is None:
        raise HTTPException(status_code=404, detail="Processing consent not found")
    if grant.revoked_at is None:
        grant.revoked_at = datetime.now(timezone.utc)
        grant.revoked_by_id = user.id
        await db.commit()
        await db.refresh(grant)
    return _response(grant)


@router.post("/processing-consents/authorize/external-live-audio")
async def authorize_external_live_audio(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Deny a hosted voice session before the browser opens its microphone."""
    await _require_consent_subject(db, user)
    from app.services.processing_consent import require_processing_consent

    grant = await require_processing_consent(
        db,
        subject_id=user.id,
        purpose=ProcessingPurpose.EXTERNAL_LIVE_AUDIO,
        provider="vapi",
        local_option_available=True,
        required_scopes={ProcessingPurpose.EXTERNAL_LIVE_AUDIO.value},
    )
    return {
        "authorized": True,
        "consent_id": grant.id,
        "provider": "vapi",
        "local_option_available": True,
    }
