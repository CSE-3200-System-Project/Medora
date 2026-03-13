import time
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings
from app.db.supabase import supabase

JWKS_CACHE_TTL_SECONDS = 300
_jwks_cache: dict[str, Any] = {"keys": {}, "expires_at": 0.0}


def _normalize_supabase_url(url: str) -> str:
    return url.rstrip("/")


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


async def verify_jwt(token: str) -> dict[str, Any]:
    # Primary path: verify locally using Supabase JWKS (recommended by current docs).
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg")
        if not kid or not alg:
            raise JWTError("Token header missing kid/alg")

        jwks = await _get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise JWTError("Signing key not found")

        issuer = f"{_normalize_supabase_url(settings.SUPABASE_URL)}/auth/v1"
        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
            issuer=issuer,
        )
    except (JWTError, httpx.HTTPError):
        # Fallback path: ask Supabase Auth to validate the token.
        try:
            user_response = supabase.auth.get_user(token)
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
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
