from __future__ import annotations

import hashlib
import hmac
import logging
import re
from dataclasses import dataclass
from typing import Iterable

from app.core.config import settings
from app.core.phi_ner import SpanRecognizer, apply_spans, get_recognizer

logger = logging.getLogger(__name__)

# Distinguishes "caller said no recogniser" from "caller said nothing". `evaluate.py`
# needs the first to measure the rules alone while the flag is on; the AI path uses the
# second and gets whatever is configured.
_USE_CONFIGURED_RECOGNIZER = object()

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
    r"(?i)(?:\b(?:patient|doctor|account|record|registration|reg|bmdc|chart|mrn)\b\.?\s*(?:id|no|number)?\s*#?"
    r"|(?:রোগী|ডাক্তার)\s*(?:আইডি|নং))\s*[:#=.\-]*\s*"
    # The value must look like an identifier: it has to contain at least one digit.
    # Without this, a plain word ("Patient reports", "record contains") was consumed
    # as an ID, destroying benign clinical text.
    r"(?=[A-Za-z0-9০-৯/_-]*[0-9০-৯])[A-Z0-9০-৯][A-Z0-9০-৯/_-]{3,39}"
)
DATE_PATTERN = re.compile(
    r"(?<!\d)(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|[০-৯]{1,2}[-/.][০-৯]{1,2}[-/.][০-৯]{2,4})(?!\d)"
)
# `\b` is unreliable for Bengali labels: `ঠিকানা` ends in U+09BE (vowel sign AA),
# which is not a word character, so a trailing `\b` can never match after it.
# Lookarounds give the same "not glued to another word" guarantee in both scripts.
LABELED_NAME_PATTERN = re.compile(
    r"(?i)(?P<label>(?<!\w)(?:patient\s+name|doctor\s+name|রোগীর\s+নাম|ডাক্তারের\s+নাম|name|নাম)(?!\w)\s*[:=])"
    # A labelled value is bounded to at most three tokens. The previous 80-character
    # run swallowed the clinical remainder of the line (e.g. "Patient name: X has
    # fever and needs review"), which is a data-loss defect, not a privacy control.
    # `।` (Bengali danda) and `॥` terminate a Bengali sentence exactly as `.` does in
    # Latin script. Omitting them let the value run into the following clinical text,
    # and made redaction non-idempotent: each pass consumed one more word.
    # Refuse to start on an existing placeholder, otherwise a second pass consumes
    # `[redacted-name]` plus the next two clinical words, and redaction is not idempotent.
    r"\s*(?!\[redacted-)(?:[^\s\n,;.।॥]+(?:[ \t]+[^\s\n,;.।॥]+){0,2})"
)
LABELED_ADDRESS_PATTERN = re.compile(
    r"(?i)(?P<label>(?<!\w)(?:address|ঠিকানা)(?!\w)\s*[:=])"
    # Stop at a sentence boundary (period followed by a capital or Bengali letter)
    # so trailing clinical prose survives, while "Apt. 3B"-style internal periods do not
    # truncate the address itself.
    r"\s*(?!\[redacted-)(?:[^\n;.।॥]|\.(?!\s+[A-Zঀ-৿])){4,160}"
)

# ---------------------------------------------------------------------------
# Recall-first additions. Each targets a documented leak class from the safety
# benchmark (unlabelled names, obfuscated emails, textual dates, bare IDs,
# unlabelled addresses). The gazetteers are general common-name / place lists,
# not the benchmark strings, so coverage generalises; residual novel names still
# need the planned learned recogniser. Over-redaction is bounded by the same
# benchmark's must-preserve spans and re-checked on every run.
# ---------------------------------------------------------------------------

# Obfuscated email only (plain a@b.c is handled by EMAIL_PATTERN). Two safe shapes:
#  1) bracketed/parenthesised/spaced-@ "at" with a plain-or-bracketed dot;
#  2) the word forms "at" AND "dot" together.
# The domain excludes dots and the TLD is length-bounded, so a real domain plus a
# trailing sentence period ("...org. Complains") is not swallowed.
ADVERSARIAL_EMAIL_PATTERN = re.compile(
    r"(?i)\b[A-Za-z0-9._%+\-]+\s*(?:\[at\]|\(at\)|\s@\s)\s*[A-Za-z0-9\-]+\s*"
    r"(?:\.|\[dot\]|\(dot\))\s*[A-Za-z]{2,6}\b"
    r"|\b[A-Za-z0-9._%+\-]+\s+at\s+[A-Za-z0-9\-]+\s+dot\s+[A-Za-z]{2,6}\b"
)

# Bare passport / document number: 1-2 letters + 6-9 digits with no label.
BARE_DOCUMENT_ID_PATTERN = re.compile(r"\b[A-Z]{1,2}[0-9]{6,9}\b")

# Common Bangladeshi name components (given names and surnames), both scripts.
# A general gazetteer, deliberately not the benchmark's exact strings.
_NAME_TOKENS = [
    "Rahima", "Rahim", "Karim", "Kamrul", "Kamal", "Nusrat", "Shahin", "Ayesha", "Tariq",
    "Farzana", "Fatema", "Jahanara", "Nazma", "Shahana", "Rina", "Abdul", "Mohammad", "Md",
    "Hasan", "Hossain", "Ahmed", "Ahamed", "Islam", "Uddin", "Khan", "Akter", "Aktar",
    "Begum", "Jahan", "Chowdhury", "Siddiqui", "Alam", "Miah", "Mia", "Sarkar", "Das",
    "Roy", "Sheikh", "Bhuiyan", "Rahman", "Sultana", "Haque", "Chy",
    "রহিমা", "রহিম", "করিম", "কামরুল", "কামাল", "নুসরাত", "শাহিন", "আয়েশা", "তারিক",
    "ফারজানা", "হাসান", "হোসেন", "আহমেদ", "ইসলাম", "উদ্দিন", "খান", "আক্তার", "আকতার",
    "বেগম", "জাহান", "চৌধুরী", "আলম", "মিয়া", "দাস", "রায়", "শেখ", "রহমান",
]
_NAME_ALT = "|".join(sorted((re.escape(t) for t in _NAME_TOKENS), key=len, reverse=True))
# One to three consecutive gazetteer tokens = a name span.
NAME_GAZETTEER_PATTERN = re.compile(
    rf"(?i)(?<!\w)(?:{_NAME_ALT})(?:[ \t]+(?:{_NAME_ALT})){{0,2}}(?!\w)"
)

# Honorific/role trigger: redact the 1-3 name tokens that follow it, keep the honorific.
HONORIFIC_NAME_PATTERN = re.compile(
    r"(?P<hon>(?<!\w)(?:Dr|Prof|Mr|Mrs|Ms|Md|ডা|ডাঃ|ড|প্রফেসর)\.?)\s+"
    r"(?!\[redacted-)(?:[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){0,2}|[ঀ-৿]+(?:\s+[ঀ-৿]+){0,2})"
)

# Textual dates: "12 January 2026", "Jan 12, 2026", and the Bengali form.
_MONTHS_EN = (r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
              r"Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?")
_MONTHS_BN = r"জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর"
TEXTUAL_DATE_PATTERN = re.compile(
    rf"(?i)(?:\b\d{{1,2}}\s+(?:{_MONTHS_EN})\.?,?\s+\d{{4}}\b"
    rf"|\b(?:{_MONTHS_EN})\.?\s+\d{{1,2}},?\s+\d{{4}}\b"
    rf"|[০-৯]{{1,2}}\s+(?:{_MONTHS_BN})\s+[০-৯]{{4}})"
)

# Unlabelled addresses: structural "House 12, Road 5, ..." runs and known areas/districts.
_AREAS = [
    "Dhaka", "Chittagong", "Chattogram", "Khulna", "Rajshahi", "Sylhet", "Barisal",
    "Rangpur", "Mymensingh", "Dhanmondi", "Mirpur", "Gulshan", "Uttara", "Banani",
    "Mohakhali", "Motijheel", "Bashundhara", "Jatrabari",
    "ঢাকা", "চট্টগ্রাম", "খুলনা", "রাজশাহী", "সিলেট", "বরিশাল", "রংপুর", "ময়মনসিংহ",
    "ধানমন্ডি", "মিরপুর", "গুলশান", "উত্তরা",
]
_AREA_ALT = "|".join(sorted((re.escape(a) for a in _AREAS), key=len, reverse=True))
ADDRESS_UNLABELED_PATTERN = re.compile(
    # Only specific address shapes, never a free "Address + N chars" run (that ate
    # benign sentences like "No address was recorded for this patient").
    r"(?i)(?:(?:House|Rd|Road|Flat|Apt|Apartment|Block|Sector|Holding|Lane|Plot)\s*#?\s*\d+[A-Za-z]?"
    rf"(?:[,\s]+(?:House|Rd|Road|Flat|Apt|Apartment|Block|Sector|Holding|Lane|Plot|{_AREA_ALT})\s*#?\s*\d*[A-Za-z]?)*"
    rf"(?:[,\s]+(?:{_AREA_ALT}))?"
    rf"|(?:{_AREA_ALT})\s+\d+[,\s]+(?:{_AREA_ALT}))"
)


@dataclass(frozen=True, slots=True)
class RedactionResult:
    text: str
    replacements: dict[str, int]


def _resolve_hash_secret() -> str:
    # SUPABASE_KEY (the anon key) is not a valid fallback: it ships to the
    # browser, so deriving pseudonym hashes from it makes them reversible by
    # anyone with the client bundle. Fail loudly instead of silently using a
    # public or hardcoded value.
    candidate = settings.AI_ID_HASH_SECRET or settings.SUPABASE_SERVICE_ROLE_KEY
    if not candidate:
        raise RuntimeError(
            "AI_ID_HASH_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured "
            "before pseudonymising identifiers for AI processing."
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
    recognizer: SpanRecognizer | None | object = _USE_CONFIGURED_RECOGNIZER,
) -> RedactionResult:
    """Remove common English/Bengali identifiers without claiming anonymization.

    Known values are replaced first, then conservative category patterns are
    applied. The function deliberately reports replacement counts so callers
    can test coverage and disclose residual risk for identifiers it cannot know.

    When `PHI_NER_ENABLED` is set and a model bundle is present, a learned span pass runs
    between the known-identifier pass and the rules, making the whole function a union
    ensemble: a span is redacted if either system claims it. The learned pass runs *before*
    the rules because its character offsets are computed against the incoming text, and a
    rule substitution would invalidate them. Pass `recognizer=None` to force rules-only
    behaviour regardless of configuration — `tools/phi_ner/evaluate.py` scores all three
    configurations through this one function rather than reimplementing two of them.
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

    active_recognizer = (
        get_recognizer() if recognizer is _USE_CONFIGURED_RECOGNIZER else recognizer
    )
    if active_recognizer is not None:
        try:
            spans = active_recognizer.predict(redacted)
        except Exception:  # noqa: BLE001
            # The rules below still run, so a model failure degrades to today's shipped
            # behaviour rather than to no redaction at all. Never re-raise here: the
            # alternative is an AI endpoint that 500s instead of redacting conservatively.
            logger.warning("Learned PHI recogniser failed; using rule-based redaction only.",
                           exc_info=True)
        else:
            redacted, learned_counts = apply_spans(redacted, spans, redact_dates=redact_dates)
            for category, count in learned_counts.items():
                counts[category] = counts.get(category, 0) + count

    # Obfuscated emails must run before the plain pattern so "a (at) b (dot) c" is caught.
    replace_pattern(ADVERSARIAL_EMAIL_PATTERN, "[redacted-email]", "email")
    replace_pattern(EMAIL_PATTERN, "[redacted-email]", "email")
    replace_pattern(PHONE_PATTERN, "[redacted-phone]", "phone")
    replace_pattern(PASSPORT_PATTERN, "[redacted-passport]", "passport")
    replace_pattern(NATIONAL_ID_PATTERN, "[redacted-national-id]", "national_id")
    replace_pattern(ACCOUNT_ID_PATTERN, "[redacted-account-id]", "account_id")
    replace_pattern(UUID_PATTERN, "[redacted-identifier]", "uuid")
    replace_pattern(LONG_ID_PATTERN, "[redacted-numeric-id]", "long_numeric_id")
    # Bare document/passport IDs (no label) after the labelled and numeric ID passes.
    replace_pattern(BARE_DOCUMENT_ID_PATTERN, "[redacted-passport]", "passport")
    # Names: honorific-triggered first (keeps the honorific), then the gazetteer, then labelled.
    replace_pattern(HONORIFIC_NAME_PATTERN, r"\g<hon> [redacted-name]", "honorific_name")
    replace_pattern(NAME_GAZETTEER_PATTERN, "[redacted-name]", "name")
    replace_pattern(LABELED_NAME_PATTERN, r"\g<label> [redacted-name]", "labeled_name")
    replace_pattern(LABELED_ADDRESS_PATTERN, r"\g<label> [redacted-address]", "labeled_address")
    replace_pattern(ADDRESS_UNLABELED_PATTERN, "[redacted-address]", "address")
    if redact_dates:
        replace_pattern(DATE_PATTERN, "[redacted-date]", "date")
        replace_pattern(TEXTUAL_DATE_PATTERN, "[redacted-date]", "date")

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
