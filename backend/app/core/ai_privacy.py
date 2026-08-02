from __future__ import annotations

import hashlib
import hmac
import re
from dataclasses import dataclass
from typing import Iterable

from app.core.config import settings

UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    flags=re.IGNORECASE,
)
LONG_ID_PATTERN = re.compile(r"\b\d{7,}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?৮৮০|\+?880|0)?[\s().-]*(?:[০-৯0-9][\s().-]*){10,11}(?!\w)")
PASSPORT_PATTERN = re.compile(r"(?i)\b(?:passport|পাসপোর্ট)\s*(?:no|number|নং)?\s*[:#=-]?\s*[A-Z]{1,2}[0-9]{6,9}\b")
NATIONAL_ID_PATTERN = re.compile(
    r"(?i)(?:\b(?:nid|national\s+id|জাতীয়\s+পরিচয়পত্র|জাতীয়\s+পরিচয়পত্র)\b\s*(?:no|number|নং)?\s*[:#=-]?\s*)[০-৯0-9 -]{7,20}"
)
ACCOUNT_ID_PATTERN = re.compile(
    r"(?i)(?:\b(?:patient|doctor|account|record|registration|bmdc)\s*(?:id|no|number)\b|(?:রোগী|ডাক্তার)\s*(?:আইডি|নং))\s*[:#=-]?\s*[A-Z0-9০-৯/_-]{5,40}"
)
DATE_PATTERN = re.compile(
    r"(?<!\d)(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|[০-৯]{1,2}[-/.][০-৯]{1,2}[-/.][০-৯]{2,4})(?!\d)"
)
LABELED_NAME_PATTERN = re.compile(
    r"(?i)(?P<label>\b(?:patient\s+name|doctor\s+name|name|নাম|রোগীর\s+নাম|ডাক্তারের\s+নাম)\b\s*[:=])\s*[^\n,;]{2,80}"
)
LABELED_ADDRESS_PATTERN = re.compile(
    r"(?i)(?P<label>\b(?:address|ঠিকানা)\b\s*[:=])\s*[^\n;]{4,160}"
)


@dataclass(frozen=True, slots=True)
class RedactionResult:
    text: str
    replacements: dict[str, int]


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
        normalized_parts = ["unspecified"]

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


def redact_pii_text(
    text: str,
    *,
    known_identifiers: Iterable[str] | None = None,
    redact_dates: bool = True,
) -> RedactionResult:
    """Remove common English/Bengali identifiers without claiming anonymization.

    Known values are replaced first, then conservative category patterns are
    applied. The function deliberately reports replacement counts so callers
    can test coverage and disclose residual risk for identifiers it cannot know.
    """
    redacted = str(text or "")
    counts: dict[str, int] = {}

    def replace_pattern(pattern: re.Pattern[str], replacement: str, category: str) -> None:
        nonlocal redacted
        redacted, count = pattern.subn(replacement, redacted)
        if count:
            counts[category] = counts.get(category, 0) + count

    for raw_value in sorted(
        {str(value).strip() for value in (known_identifiers or []) if str(value).strip()},
        key=len,
        reverse=True,
    ):
        pattern = re.compile(re.escape(raw_value), flags=re.IGNORECASE)
        replace_pattern(pattern, "[redacted-known-identifier]", "known_identifier")

    replace_pattern(EMAIL_PATTERN, "[redacted-email]", "email")
    replace_pattern(PHONE_PATTERN, "[redacted-phone]", "phone")
    replace_pattern(PASSPORT_PATTERN, "[redacted-passport]", "passport")
    replace_pattern(NATIONAL_ID_PATTERN, "[redacted-national-id]", "national_id")
    replace_pattern(ACCOUNT_ID_PATTERN, "[redacted-account-id]", "account_id")
    replace_pattern(UUID_PATTERN, "[redacted-identifier]", "uuid")
    replace_pattern(LONG_ID_PATTERN, "[redacted-numeric-id]", "long_numeric_id")
    replace_pattern(LABELED_NAME_PATTERN, r"\g<label> [redacted-name]", "labeled_name")
    replace_pattern(LABELED_ADDRESS_PATTERN, r"\g<label> [redacted-address]", "labeled_address")
    if redact_dates:
        replace_pattern(DATE_PATTERN, "[redacted-date]", "date")

    return RedactionResult(text=redacted, replacements=counts)


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
