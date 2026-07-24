import asyncio
import logging
import time
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings
from app.db.supabase import supabase

logger = logging.getLogger(__name__)

JWKS_CACHE_TTL_SECONDS = 300
_jwks_cache: dict[str, Any] = {"keys": {}, "expires_at": 0.0}

# The Auth-API fallback costs a network round trip per request. Report it at most
# once a minute so a systemic failure is visible without flooding the log.
_FALLBACK_LOG_INTERVAL_SECONDS = 60
_fallback_log_state: dict[str, float] = {"count": 0, "next_log_at": 0.0}


class _LocalVerificationUnavailable(Exception):
    """Local JWKS verification could not be attempted.

    Distinct from a JWTError, which means the token *was* checked locally and
    rejected. Only this exception justifies falling back to the Auth API.
    """


def _normalize_supabase_url(url: str) -> str:
    return url.rstrip("/")


def _log_fallback(reason: str) -> None:
    _fallback_log_state["count"] += 1
    now = time.time()
    if now < _fallback_log_state["next_log_at"]:
        return
    logger.warning(
        "JWT verified via Supabase Auth API fallback (%s) — %s occurrence(s) since last report. "
        "Sustained fallback means tokens cannot be verified locally and every request pays a "
        "network round trip.",
        reason,
        int(_fallback_log_state["count"]),
    )
    _fallback_log_state["count"] = 0
    _fallback_log_state["next_log_at"] = now + _FALLBACK_LOG_INTERVAL_SECONDS


async def _get_jwks() -> dict[str, Any]:
    now = time.time()
    if _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]

    jwks_url = f"{_normalize_supabase_url(settings.SUPABASE_URL)}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        jwks = response.json()

    _jwks_cache["keys"] = jwks
    _jwks_cache["expires_at"] = now + JWKS_CACHE_TTL_SECONDS
    return jwks


async def _verify_with_jwks(token: str) -> dict[str, Any]:
    """Verify locally against the Supabase JWKS.

    Raises ``_LocalVerificationUnavailable`` when the token cannot be checked
    locally at all, and ``JWTError`` when it was checked and found invalid.
    """
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise _LocalVerificationUnavailable(f"unreadable token header: {exc}") from exc

    kid = header.get("kid")
    alg = header.get("alg")
    if not kid or not alg:
        # Projects still on the legacy HS256 shared secret sign without a kid;
        # only the Auth API can validate those.
        raise _LocalVerificationUnavailable("token header missing kid/alg")

    try:
        jwks = await _get_jwks()
    except (httpx.HTTPError, ValueError) as exc:
        raise _LocalVerificationUnavailable(f"JWKS fetch failed: {exc}") from exc

    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        raise _LocalVerificationUnavailable(f"signing key '{kid}' not present in JWKS")

    issuer = f"{_normalize_supabase_url(settings.SUPABASE_URL)}/auth/v1"
    # A JWTError past this point is a real rejection (bad signature, expired,
    # wrong audience/issuer) and must not trigger the network fallback.
    return jwt.decode(
        token,
        key,
        algorithms=[alg],
        audience="authenticated",
        issuer=issuer,
    )


async def verify_jwt(token: str) -> dict[str, Any]:
    try:
        return await _verify_with_jwks(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except _LocalVerificationUnavailable as exc:
        _log_fallback(str(exc))

    # Fallback: ask Supabase Auth to validate the token. supabase-py is
    # synchronous, so this must run off the event loop — calling it inline
    # would serialize every request that reaches this path.
    try:
        user_response = await asyncio.to_thread(supabase.auth.get_user, token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = user_response.user
    return {
        "sub": user.id,
        "email": getattr(user, "email", None),
        "email_confirmed_at": getattr(user, "email_confirmed_at", None),
        "confirmed_at": getattr(user, "confirmed_at", None),
    }
