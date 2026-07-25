import asyncio

import pytest

from app.core import auth_profile_cache


@pytest.fixture(autouse=True)
def empty_profile_cache():
    auth_profile_cache.clear_auth_profile_cache()
    auth_profile_cache._inflight.clear()
    yield
    auth_profile_cache.clear_auth_profile_cache()
    auth_profile_cache._inflight.clear()


@pytest.mark.asyncio
async def test_cached_profiles_are_cloned(monkeypatch):
    snapshot = {
        "id": "patient-1",
        "role": "patient",
        "status": "active",
        "profile_photo_url": "avatar.png",
    }
    auth_profile_cache._store("patient-1", snapshot)

    first, first_hit = await auth_profile_cache.get_auth_profile("patient-1")
    first.status = "banned"
    second, second_hit = await auth_profile_cache.get_auth_profile("patient-1")

    assert first_hit is True
    assert second_hit is True
    assert second.status == "active"


def test_prime_auth_profile_uses_loaded_columns(monkeypatch):
    profile = type(
        "LoadedProfile",
        (),
        {
            column.key: f"value-{column.key}"
            for column in auth_profile_cache.Profile.__table__.columns
        },
    )()
    profile.id = "patient-primed"

    auth_profile_cache.prime_auth_profile(profile, "avatar.png")

    _, snapshot = auth_profile_cache._cache["patient-primed"]
    assert snapshot["id"] == "patient-primed"
    assert snapshot["profile_photo_url"] == "avatar.png"


@pytest.mark.asyncio
async def test_concurrent_cold_loads_are_coalesced(monkeypatch):
    load_count = 0
    snapshot = {
        "id": "doctor-1",
        "role": "doctor",
        "status": "active",
        "profile_photo_url": None,
    }

    async def fake_load(user_id):
        nonlocal load_count
        load_count += 1
        await asyncio.sleep(0)
        auth_profile_cache._store(user_id, snapshot)
        return snapshot

    monkeypatch.setattr(auth_profile_cache, "_load_snapshot", fake_load)

    results = await asyncio.gather(
        auth_profile_cache.get_auth_profile("doctor-1"),
        auth_profile_cache.get_auth_profile("doctor-1"),
        auth_profile_cache.get_auth_profile("doctor-1"),
    )

    assert load_count == 1
    assert all(profile.id == "doctor-1" for profile, _ in results)
    assert all(hit is False for _, hit in results)


@pytest.mark.asyncio
async def test_invalidation_forces_reload(monkeypatch):
    auth_profile_cache._store(
        "patient-2",
        {"id": "patient-2", "status": "active", "profile_photo_url": None},
    )
    auth_profile_cache.invalidate_auth_profile("patient-2")

    async def fake_load(user_id):
        snapshot = {"id": user_id, "status": "banned", "profile_photo_url": None}
        auth_profile_cache._store(user_id, snapshot)
        return snapshot

    monkeypatch.setattr(auth_profile_cache, "_load_snapshot", fake_load)
    profile, hit = await auth_profile_cache.get_auth_profile("patient-2")

    assert hit is False
    assert profile.status == "banned"
