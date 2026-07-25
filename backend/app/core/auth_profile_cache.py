"""Short-lived authenticated profile cache for the hottest database lookup."""

from __future__ import annotations

import asyncio
from time import monotonic
from types import SimpleNamespace
from typing import Any

from sqlalchemy import event, select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.db.session import AsyncSessionLocal

_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight: dict[str, asyncio.Task[dict[str, Any] | None]] = {}


def _clone(snapshot: dict[str, Any] | None) -> SimpleNamespace | None:
    return SimpleNamespace(**snapshot) if snapshot is not None else None


def invalidate_auth_profile(user_id: str | None) -> None:
    if user_id:
        _cache.pop(str(user_id), None)


def clear_auth_profile_cache() -> None:
    _cache.clear()


def _store(user_id: str, snapshot: dict[str, Any]) -> None:
    now = monotonic()
    max_entries = max(1, settings.PERF_AUTH_PROFILE_CACHE_MAX_ENTRIES)
    if len(_cache) >= max_entries:
        expired = [key for key, (expires_at, _) in _cache.items() if expires_at <= now]
        for key in expired:
            _cache.pop(key, None)
        if len(_cache) >= max_entries:
            _cache.pop(next(iter(_cache)))

    _cache[user_id] = (
        now + max(1, settings.PERF_AUTH_PROFILE_CACHE_TTL),
        snapshot,
    )


def prime_auth_profile(profile: Profile, profile_photo_url: str | None = None) -> None:
    """Seed the cache from a profile already loaded by login or a write path."""
    snapshot = {
        column.key: getattr(profile, column.key)
        for column in Profile.__table__.columns
    }
    snapshot["profile_photo_url"] = profile_photo_url
    _store(str(profile.id), snapshot)


async def _load_snapshot(
    user_id: str,
    session: AsyncSession | None = None,
) -> dict[str, Any] | None:
    statement = (
        select(
            Profile,
            PatientProfile.profile_photo_url.label("patient_photo"),
            DoctorProfile.profile_photo_url.label("doctor_photo"),
        )
        .outerjoin(PatientProfile, PatientProfile.profile_id == Profile.id)
        .outerjoin(DoctorProfile, DoctorProfile.profile_id == Profile.id)
        .where(Profile.id == user_id)
    )
    if session is not None:
        row = (await session.execute(statement)).one_or_none()
    else:
        async with AsyncSessionLocal() as owned_session:
            row = (
                await owned_session.execute(statement)
            ).one_or_none()

    if row is None:
        return None

    profile, patient_photo, doctor_photo = row
    role_value = getattr(profile.role, "value", profile.role)
    profile_photo_url = (
        doctor_photo if str(role_value).lower() == "doctor" else patient_photo
    )
    prime_auth_profile(profile, profile_photo_url)
    _, snapshot = _cache[user_id]
    return snapshot


async def get_auth_profile(
    user_id: str,
    session: AsyncSession | None = None,
) -> tuple[SimpleNamespace | None, bool]:
    """Return a fresh namespace and whether it came from the memory cache."""
    user_id = str(user_id)
    cached = _cache.get(user_id)
    now = monotonic()
    if cached is not None:
        expires_at, snapshot = cached
        if expires_at > now:
            return _clone(snapshot), True
        _cache.pop(user_id, None)

    task = _inflight.get(user_id)
    if task is None:
        load = _load_snapshot(user_id, session) if session is not None else _load_snapshot(user_id)
        task = asyncio.create_task(load)
        _inflight[user_id] = task

    try:
        snapshot = await asyncio.shield(task)
        return _clone(snapshot), False
    finally:
        if _inflight.get(user_id) is task and task.done():
            _inflight.pop(user_id, None)


@event.listens_for(Session, "after_flush")
def _invalidate_changed_profiles(session: Session, _flush_context: Any) -> None:
    for instance in session.new.union(session.dirty).union(session.deleted):
        if isinstance(instance, Profile):
            invalidate_auth_profile(getattr(instance, "id", None))
