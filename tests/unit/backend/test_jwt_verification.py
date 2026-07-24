from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from jose import jwt

import app.core.security as security


def _legacy_token(secret: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": "patient-1",
            "aud": "authenticated",
            "iss": f"{security.settings.SUPABASE_URL.rstrip('/')}/auth/v1",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        },
        secret,
        algorithm="HS256",
    )


def test_legacy_hs256_token_is_verified_locally(monkeypatch) -> None:
    secret = "test-only-jwt-secret-with-sufficient-length"
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", secret)

    def unexpected_fallback(_token):
        raise AssertionError("Supabase Auth fallback should not be called")

    monkeypatch.setattr(security.supabase.auth, "get_user", unexpected_fallback)

    payload = asyncio.run(security.verify_jwt(_legacy_token(secret)))

    assert payload["sub"] == "patient-1"


def test_invalid_hs256_signature_does_not_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        security.settings,
        "SUPABASE_JWT_SECRET",
        "configured-secret",
    )

    def unexpected_fallback(_token):
        raise AssertionError("Invalid local tokens must not use network fallback")

    monkeypatch.setattr(security.supabase.auth, "get_user", unexpected_fallback)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(security.verify_jwt(_legacy_token("different-secret")))

    assert exc.value.status_code == 401


def test_empty_jwks_result_is_negatively_cached(monkeypatch) -> None:
    monkeypatch.setitem(security._jwks_cache, "keys", {"keys": []})
    monkeypatch.setitem(
        security._jwks_cache,
        "expires_at",
        datetime.now(timezone.utc).timestamp() + 60,
    )

    class UnexpectedClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("cached empty JWKS must not trigger another request")

    monkeypatch.setattr(security.httpx, "AsyncClient", UnexpectedClient)

    assert asyncio.run(security._get_jwks()) == {"keys": []}


def test_auth_api_fallback_is_cached_and_single_flight(monkeypatch) -> None:
    token = _legacy_token("token-signing-secret")
    calls = 0

    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", None)
    security._fallback_cache.clear()
    security._fallback_inflight.clear()

    def get_user(_token):
        nonlocal calls
        calls += 1
        return SimpleNamespace(
            user=SimpleNamespace(
                id="patient-1",
                email="patient@example.com",
                email_confirmed_at=None,
                confirmed_at=None,
            )
        )

    monkeypatch.setattr(security.supabase.auth, "get_user", get_user)

    async def run():
        first, second = await asyncio.gather(
            security.verify_jwt(token),
            security.verify_jwt(token),
        )
        third = await security.verify_jwt(token)
        return first, second, third

    payloads = asyncio.run(run())

    assert calls == 1
    assert all(payload["sub"] == "patient-1" for payload in payloads)
