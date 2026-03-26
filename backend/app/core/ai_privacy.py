from __future__ import annotations

import hashlib
import hmac
import re
from typing import Iterable

from app.core.config import settings

UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    flags=re.IGNORECASE,
)
LONG_ID_PATTERN = re.compile(r"\b\d{7,}\b")


def _resolve_hash_secret() -> str:
    candidate = (
        settings.AI_ID_HASH_SECRET
        or settings.SUPABASE_SERVICE_ROLE_KEY
        or settings.SUPABASE_KEY
        or "medora-default-local-secret"
    )
    return str(candidate).strip()


def _normalize_part(value: str | None) -> str:
    return str(value or "").strip().lower()


def stable_hash_token(*parts: str | None, namespace: str = "subject", length: int = 24) -> str:
    normalized_parts = [_normalize_part(part) for part in parts if _normalize_part(part)]
    if not normalized_parts:
        normalized_parts = ["anonymous"]

    message = f"{namespace}|{'|'.join(normalized_parts)}".encode("utf-8")
    digest = hmac.new(_resolve_hash_secret().encode("utf-8"), message, hashlib.sha256).hexdigest()
    prefix = re.sub(r"[^a-z0-9]+", "", namespace.lower())[:12] or "subject"
    return f"{prefix}_{digest[:max(8, length)]}"


def anonymize_identifier_text(text: str, *, token_namespace: str = "id") -> str:
    if not text:
        return ""

    cache: dict[str, str] = {}

    def replace_uuid(match: re.Match[str]) -> str:
        raw = match.group(0)
        token = cache.get(raw)
        if token:
            return token
        token = stable_hash_token(raw, namespace=token_namespace, length=20)
        cache[raw] = token
        return token

    def replace_long_id(match: re.Match[str]) -> str:
        raw = match.group(0)
        token = cache.get(raw)
        if token:
            return token
        token = stable_hash_token(raw, namespace=f"{token_namespace}num", length=14)
        cache[raw] = token
        return token

    masked = UUID_PATTERN.sub(replace_uuid, str(text))
    masked = LONG_ID_PATTERN.sub(replace_long_id, masked)
    return masked


def pick_subject_token(payload: dict[str, object] | None, fallback_parts: Iterable[str | None]) -> str:
    if payload:
        for key in ("subject_token", "patient_token", "doctor_token", "session_token", "anonymous_subject"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        query_value = payload.get("query")
        if isinstance(query_value, str):
            token_match = re.search(r'"subject_token"\s*:\s*"([^"]+)"', query_value)
            if token_match and token_match.group(1).strip():
                return token_match.group(1).strip()[:80]
    return stable_hash_token(*list(fallback_parts), namespace="subject", length=24)
