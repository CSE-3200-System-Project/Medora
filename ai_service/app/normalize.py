from __future__ import annotations

import re

OCR_CONFUSION_TRANSLATION = str.maketrans(
    {
        "0": "o",
        "1": "l",
        "|": "l",
        "!": "l",
    }
)

BANGLA_DIGIT_TRANSLATION = str.maketrans(
    {
        "০": "0",
        "১": "1",
        "২": "2",
        "৩": "3",
        "৪": "4",
        "৫": "5",
        "৬": "6",
        "৭": "7",
        "৮": "8",
        "৯": "9",
    }
)

WHITESPACE_PATTERN = re.compile(r"\s+")
NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9+\- ]+")
DOSAGE_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|ml|g|mcg|iu)\b", re.IGNORECASE)
NOISE_TOKEN_PATTERN = re.compile(
    r"\b(?:tab|tablet|cap|capsule|inj|injection|syp|syrup|drop|drops|po|oral|take|daily)\b",
    re.IGNORECASE,
)


def normalize_medicine_text(text: str) -> str:
    """Normalize OCR text for medicine matching."""
    if not text:
        return ""

    normalized = text.lower().translate(OCR_CONFUSION_TRANSLATION)
    normalized = NON_ALNUM_PATTERN.sub(" ", normalized)
    return WHITESPACE_PATTERN.sub(" ", normalized).strip()


def normalize_prescription_text(text: str) -> str:
    """Normalize generic prescription text while preserving numeric dose/frequency signals."""
    if not text:
        return ""

    normalized = text.lower().translate(BANGLA_DIGIT_TRANSLATION)
    normalized = (
        normalized.replace("×", "x")
        .replace("*", "x")
        .replace("—", "-")
        .replace("–", "-")
        .replace("।", " ")
    )
    return WHITESPACE_PATTERN.sub(" ", normalized).strip()


def strip_medicine_noise(text: str) -> str:
    """Remove common prescription prefixes and dosage markers to isolate medicine name tokens."""
    normalized = normalize_medicine_text(text)
    if not normalized:
        return ""

    normalized = DOSAGE_PATTERN.sub(" ", normalized)
    normalized = NOISE_TOKEN_PATTERN.sub(" ", normalized)
    return WHITESPACE_PATTERN.sub(" ", normalized).strip(" -")


def extract_dosage_tokens(text: str) -> set[str]:
    normalized = normalize_medicine_text(text)
    return {WHITESPACE_PATTERN.sub("", match.group(0).lower()) for match in DOSAGE_PATTERN.finditer(normalized)}


def extract_search_terms(text: str) -> list[str]:
    """Build prioritized search candidates from noisy OCR text."""
    normalized = normalize_medicine_text(text)
    if not normalized:
        return []

    stripped = strip_medicine_noise(text)
    terms: list[str] = [normalized]
    if stripped and stripped != normalized:
        terms.append(stripped)

    base = stripped or normalized
    tokens = [token for token in base.split(" ") if len(token) > 1]

    # Prefix windows improve recall on inputs like "tab napa 500" or "napa paracetamol".
    for width in (3, 2, 1):
        if len(tokens) >= width:
            terms.append(" ".join(tokens[:width]))

    deduped: list[str] = []
    seen: set[str] = set()
    for term in terms:
        compact = WHITESPACE_PATTERN.sub(" ", term).strip()
        if not compact or compact in seen:
            continue
        seen.add(compact)
        deduped.append(compact)

    return deduped
