"""Shared-secret verification for Vapi tool webhooks.

Both /ai/vapi/tools/chorui and /ai/vapi/tools/doctor-search are reachable from
the open internet (Vapi calls them directly, so no user session exists yet).
This is the only gate in front of them, so it must fail closed: an
unconfigured secret means the deployment is misconfigured, not that the
webhook should accept anonymous traffic.
"""
import secrets

from fastapi import HTTPException, Request, status

from app.core.config import settings

VAPI_TOOL_SECRET_HEADER = "x-vapi-tool-secret"
VAPI_TOOL_SECRET_MAX_LENGTH = 256


def verify_vapi_tool_secret(request: Request) -> None:
    configured_secret = (settings.VAPI_TOOL_SHARED_SECRET or "").strip()[:VAPI_TOOL_SECRET_MAX_LENGTH]
    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vapi tool webhook is not configured",
        )

    provided_secret_raw = request.headers.get(VAPI_TOOL_SECRET_HEADER)
    provided_secret = (provided_secret_raw or "").strip()[:VAPI_TOOL_SECRET_MAX_LENGTH]
    if not secrets.compare_digest(provided_secret, configured_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Vapi tool secret")
