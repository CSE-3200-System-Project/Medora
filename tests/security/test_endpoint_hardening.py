from __future__ import annotations

import pytest

from app.core.config import settings

pytestmark = [pytest.mark.backend, pytest.mark.integration, pytest.mark.security]


@pytest.mark.asyncio
async def test_vapi_chorui_webhook_fails_closed_when_secret_unset(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", None)
    response = await backend_client.post("/ai/vapi/tools/chorui", json={})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_vapi_chorui_webhook_rejects_wrong_secret(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", "correct-secret")
    response = await backend_client.post(
        "/ai/vapi/tools/chorui",
        json={},
        headers={"x-vapi-tool-secret": "wrong-secret"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_vapi_chorui_webhook_accepts_correct_secret(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", "correct-secret")
    response = await backend_client.post(
        "/ai/vapi/tools/chorui",
        json={},
        headers={"x-vapi-tool-secret": "correct-secret"},
    )
    # An empty payload has no tool calls, so the handler returns its
    # no-op acknowledgement -- the point here is that it gets past the
    # auth gate (not 401/503), not that it does anything further.
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_vapi_doctor_search_webhook_fails_closed_when_secret_unset(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", None)
    response = await backend_client.post("/ai/vapi/tools/doctor-search", json={})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_vapi_doctor_search_webhook_rejects_wrong_secret(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", "correct-secret")
    response = await backend_client.post(
        "/ai/vapi/tools/doctor-search",
        json={},
        headers={"x-vapi-tool-secret": "wrong-secret"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_normalize_voice_requires_authentication(backend_client) -> None:
    files = {"audio_file": ("test.webm", b"not-real-audio", "audio/webm")}
    response = await backend_client.post("/ai/normalize/voice", files=files)
    assert response.status_code in {401, 422}


@pytest.mark.asyncio
async def test_legacy_upload_requires_authentication(backend_client) -> None:
    files = {"file": ("test.txt", b"hello", "text/plain")}
    response = await backend_client.post("/upload/", files=files)
    assert response.status_code in {401, 422}


@pytest.mark.asyncio
async def test_debug_testxyz_route_removed(backend_client) -> None:
    response = await backend_client.get("/doctor/testxyz")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_rate_limit_returns_429_with_cors_and_retry_after(backend_client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "VAPI_TOOL_SHARED_SECRET", "correct-secret")
    headers = {
        "x-vapi-tool-secret": "correct-secret",
        "Origin": "http://localhost:3000",
    }

    # DEFAULT_RATE_LIMIT_RULES allows 30 requests/60s for POST /ai/vapi/tools/,
    # shared across every /ai/vapi/tools/* call in this process. Looping well
    # past that guarantees a 429 regardless of what earlier tests already
    # consumed from the same bucket.
    last_response = None
    for _ in range(40):
        last_response = await backend_client.post("/ai/vapi/tools/chorui", json={}, headers=headers)

    assert last_response.status_code == 429
    assert "Retry-After" in last_response.headers
    assert last_response.headers.get("access-control-allow-origin") == "http://localhost:3000"
