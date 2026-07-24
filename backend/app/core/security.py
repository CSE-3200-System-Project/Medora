import asyncio
import hashlib
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
_jwks_lock = asyncio.Lock()
_ASYMMETRIC_ALGORITHMS = {"RS256", "ES256"}

# The Auth-API fallback costs a network round trip per request. Report it at most
# once a minute so a systemic failure is visible without flooding the log.
_FALLBACK_LOG_INTERVAL_SECONDS = 60
_fallback_log_state: dict[str, float] = {"count": 0, "next_log_at": 0.0}
_FALLBACK_CACHE_TTL_SECONDS = 60
_FALLBACK_CACHE_MAX_ENTRIES = 2048
_fallback_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_fallback_inflight: dict[str, asyncio.Task[dict[str, Any]]] = {}


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


def _token_cache_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_cached_fallback(token: str) -> dict[str, Any] | None:
    key = _token_cache_key(token)
    cached = _fallback_cache.get(key)
    if not cached:
        return None
    expires_at, payload = cached
    if expires_at <= time.time():
        _fallback_cache.pop(key, None)
        return None
    return payload


def _cache_fallback(token: str, payload: dict[str, Any]) -> None:
    now = time.time()
    expires_at = now + _FALLBACK_CACHE_TTL_SECONDS
    try:
        token_expiry = float(jwt.get_unverified_claims(token).get("exp", expires_at))
        expires_at = min(expires_at, token_expiry)
    except (JWTError, TypeError, ValueError):
        pass

    if expires_at <= now:
        return

    if len(_fallback_cache) >= _FALLBACK_CACHE_MAX_ENTRIES:
        expired = [
            key
            for key, (entry_expiry, _) in _fallback_cache.items()
            if entry_expiry <= now
        ]
        for key in expired:
            _fallback_cache.pop(key, None)
        if len(_fallback_cache) >= _FALLBACK_CACHE_MAX_ENTRIES:
            _fallback_cache.pop(next(iter(_fallback_cache)))

    _fallback_cache[_token_cache_key(token)] = (expires_at, payload)


async def _verify_via_auth_api(token: str) -> dict[str, Any]:
    cached = _get_cached_fallback(token)
    if cached is not None:
        return cached

    key = _token_cache_key(token)
    task = _fallback_inflight.get(key)
    if task is None:

        async def fetch() -> dict[str, Any]:
            user_response = await asyncio.to_thread(supabase.auth.get_user, token)
            if not user_response or not user_response.user:
                raise ValueError("Supabase Auth returned no user")

            user = user_response.user
            payload = {
                "sub": user.id,
                "email": getattr(user, "email", None),
                "email_confirmed_at": getattr(user, "email_confirmed_at", None),
                "confirmed_at": getattr(user, "confirmed_at", None),
            }
            _cache_fallback(token, payload)
            return payload

        task = asyncio.create_task(fetch())
        _fallback_inflight[key] = task

    try:
        return await task
    finally:
        if _fallback_inflight.get(key) is task and task.done():
            _fallback_inflight.pop(key, None)


async def _get_jwks() -> dict[str, Any]:
    now = time.time()
    # Empty key sets are meaningful for Supabase projects still using the
    # legacy HS256 secret. Cache that negative result too; otherwise every
    # request fetches the empty JWKS before falling back to the Auth API.
    if now < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]

    async with _jwks_lock:
        now = time.time()
        if now < _jwks_cache["expires_at"]:
            return _jwks_cache["keys"]

        jwks_url = (
            f"{_normalize_supabase_url(settings.SUPABASE_URL)}"
            "/auth/v1/.well-known/jwks.json"
        )
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            jwks = response.json()

        if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
            raise ValueError("JWKS response is missing a keys array")

        _jwks_cache["keys"] = jwks
        _jwks_cache["expires_at"] = now + JWKS_CACHE_TTL_SECONDS
        return jwks


def _decode_token(token: str, key: Any, algorithm: str) -> dict[str, Any]:
    issuer = f"{_normalize_supabase_url(settings.SUPABASE_URL)}/auth/v1"
    return jwt.decode(
        token,
        key,
        algorithms=[algorithm],
        audience="authenticated",
        issuer=issuer,
    )


async def _verify_with_jwks(token: str) -> dict[str, Any]:
    """Verify locally against the Supabase JWKS.

    Raises ``_LocalVerificationUnavailable`` when the token cannot be checked
    locally at all, and ``JWTError`` when it was checked and found invalid.
    """
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise _LocalVerificationUnavailable(f"unreadable token header: {exc}") from exc

    alg = header.get("alg")
    if not alg:
        raise JWTError("token header missing alg")

    if alg == "HS256":
        if not settings.SUPABASE_JWT_SECRET:
            raise _LocalVerificationUnavailable(
                "legacy HS256 token received but SUPABASE_JWT_SECRET is not configured"
            )
        return _decode_token(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )

    if alg not in _ASYMMETRIC_ALGORITHMS:
        raise JWTError(f"unsupported signing algorithm '{alg}'")

    kid = header.get("kid")
    if not kid:
        raise JWTError("asymmetric token header missing kid")

    try:
        jwks = await _get_jwks()
    except (httpx.HTTPError, ValueError) as exc:
        raise _LocalVerificationUnavailable(f"JWKS fetch failed: {exc}") from exc

    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        raise _LocalVerificationUnavailable(f"signing key '{kid}' not present in JWKS")

    # A JWTError past this point is a real rejection (bad signature, expired,
    # wrong audience/issuer) and must not trigger the network fallback.
    return _decode_token(token, key, algorithm=alg)


async def verify_jwt(token: str) -> dict[str, Any]:
    cached_fallback = _get_cached_fallback(token)
    if cached_fallback is not None:
        return cached_fallback

    try:
        return await _verify_with_jwks(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except _LocalVerificationUnavailable as exc:
        _log_fallback(str(exc))

    # Successful fallbacks are cached briefly (never past JWT expiry), and
    # concurrent requests with the same token share one Auth API call.
    try:
        return await _verify_via_auth_api(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
