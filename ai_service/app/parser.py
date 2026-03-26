from __future__ import annotations

import re

from rapidfuzz import fuzz, process

from app.config import settings
from app.matcher import MedicineMatch, medicine_matcher
from app.normalize import normalize_medicine_text, normalize_prescription_text
from app.schemas import MedicationResult, OCRLine

DOSAGE_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|ml|g|mcg|iu)\b", re.IGNORECASE)
FREQUENCY_PATTERN = re.compile(
    r"\b(?:od|bd|tds|qid|hs|\d\s*[+\-xX]\s*\d\s*[+\-xX]\s*\d(?:\s*[+\-xX]\s*\d)?)\b",
    re.IGNORECASE,
)
QUANTITY_PATTERN = re.compile(
    r"(?:\b\d+\s?(?:day|days|week|weeks|month|months|দিন|সপ্তাহ|মাস)\b|\b(?:continue|continued|চলবে|চালু|চলমান)\b)",
    re.IGNORECASE,
)
MEDICINE_PREFIX_PATTERN = re.compile(r"\b(?:tab|tablet|cap|capsule|inj|injection|syp|syrup|drop|drops)\b", re.IGNORECASE)
PURE_FREQUENCY_LINE_PATTERN = re.compile(r"^\s*[\d০-৯+\-xX×*/ ]{3,}\s*$")
FREQUENCY_SPLIT_PATTERN = re.compile(r"\d\s*(?:\+|x|-)\s*\d\s*(?:\+|x|-)\s*\d(?:\s*(?:\+|x|-)\s*\d)?")
FREQUENCY_DIGIT_PATTERN = re.compile(r"(?<!\d)\d(?!\d)")
FREQUENCY_CODE_PATTERN = re.compile(r"\b(od|bd|tds|qid|hs)\b", re.IGNORECASE)
QUANTITY_DURATION_PATTERN = re.compile(
    r"\b(\d+)\s*(day|days|week|weeks|month|months|দিন|সপ্তাহ|মাস)\b",
    re.IGNORECASE,
)
QUANTITY_CONTINUE_PATTERN = re.compile(r"\b(?:continue|continued|চলবে|চালু|চলমান)\b", re.IGNORECASE)


def parse_prescription(
    lines: list[OCRLine],
    medicine_names: list[str],
    line_merge_y_px: int | None = None,
    fuzzy_threshold: int | None = None,
) -> list[MedicationResult]:
    if not lines:
        return []

    merge_y_px = line_merge_y_px or settings.LINE_MERGE_Y_PX
    threshold = fuzzy_threshold or settings.FUZZY_MATCH_THRESHOLD
    ordered_lines = _ordered_lines(lines)

    block_parsed = _parse_by_line_blocks(ordered_lines, threshold, medicine_names)
    if block_parsed:
        return block_parsed

    groups = _group_lines(ordered_lines, merge_y_px)
    medications: list[MedicationResult] = []

    for group in groups:
        group_text = " ".join(line.text for line in group).strip()
        if not group_text:
            continue

        dosage = _first_match(DOSAGE_PATTERN, group_text)
        frequency = _extract_frequency(group_text)
        quantity = _extract_quantity(group_text)
        med_name, med_score, match_meta = _match_medicine_name(group_text, medicine_names, threshold)
        if not med_name:
            med_name = _extract_medicine_candidate(group_text)

        if not med_name and not dosage and not frequency and not quantity:
            continue

        ocr_conf = _avg_confidence(group)
        regex_signal = _regex_signal(dosage, frequency, quantity)
        confidence = _combined_confidence(
            ocr_confidence=ocr_conf,
            fuzzy_confidence=med_score / 100.0,
            regex_signal=regex_signal,
        )

        medications.append(
            MedicationResult(
                name=med_name,
                matched_term=match_meta.matched_term if match_meta else med_name,
                drug_id=match_meta.drug_id if match_meta else None,
                brand_id=match_meta.brand_id if match_meta else None,
                dosage=dosage,
                frequency=frequency,
                quantity=quantity,
                confidence=confidence,
            )
        )

    if medications:
        return medications

    # Fallback: if no line groups matched anything, still return broad text parse.
    full_text = " ".join(line.text for line in ordered_lines)
    dosage = _first_match(DOSAGE_PATTERN, full_text)
    frequency = _extract_frequency(full_text)
    quantity = _extract_quantity(full_text)
    med_name, med_score, match_meta = _match_medicine_name(full_text, medicine_names, threshold)
    if not med_name:
        med_name = _extract_medicine_candidate(full_text)

    if not any([med_name, dosage, frequency, quantity]):
        return []

    return [
        MedicationResult(
            name=med_name,
            matched_term=match_meta.matched_term if match_meta else med_name,
            drug_id=match_meta.drug_id if match_meta else None,
            brand_id=match_meta.brand_id if match_meta else None,
            dosage=dosage,
            frequency=frequency,
            quantity=quantity,
            confidence=_combined_confidence(
                ocr_confidence=_avg_confidence(ordered_lines),
                fuzzy_confidence=med_score / 100.0,
                regex_signal=_regex_signal(dosage, frequency, quantity),
            ),
        )
    ]


def _parse_by_line_blocks(
    ordered_lines: list[OCRLine],
    threshold: int,
    medicine_names: list[str],
) -> list[MedicationResult]:
    medications: list[MedicationResult] = []
    current: MedicationResult | None = None
    current_lines: list[OCRLine] = []
    current_match_score: float = 0.0

    for line in ordered_lines:
        text = (line.text or "").strip()
        if not text:
            continue

        dosage = _first_match(DOSAGE_PATTERN, text)
        frequency = _extract_frequency(text)
        quantity = _extract_quantity(text)

        if _looks_like_medicine_line(text, dosage):
            if current is not None:
                medications.append(
                    _finalize_medication(current, current_lines, current_match_score, medicine_names, threshold)
                )
            name, score, match_meta = _extract_name_with_score(text, medicine_names, threshold)
            current = MedicationResult(
                name=name,
                matched_term=match_meta.matched_term if match_meta else name,
                drug_id=match_meta.drug_id if match_meta else None,
                brand_id=match_meta.brand_id if match_meta else None,
                dosage=dosage,
                frequency=frequency,
                quantity=quantity,
                confidence=0.0,
            )
            current_lines = [line]
            current_match_score = score
            continue

        if current is None:
            continue

        current_lines.append(line)
        if not current.frequency and frequency:
            current.frequency = frequency
            continue
        if not current.quantity and quantity:
            current.quantity = quantity
            continue
        if not current.dosage and dosage:
            current.dosage = dosage
            continue

        if _looks_like_name_continuation(text) and not (current.drug_id or current.brand_id):
            continuation, continuation_score, continuation_match = _extract_name_with_score(text, medicine_names, threshold)
            if continuation:
                merged = f"{current.name or ''} {continuation}".strip()
                current.name = re.sub(r"\s+", " ", merged)[:80]
                current.matched_term = current.name
                if continuation_match:
                    current.drug_id = continuation_match.drug_id
                    current.brand_id = continuation_match.brand_id
                current_match_score = max(current_match_score, continuation_score)

    if current is not None:
        medications.append(_finalize_medication(current, current_lines, current_match_score, medicine_names, threshold))

    return [med for med in medications if med.name or med.dosage or med.frequency or med.quantity]


def _finalize_medication(
    medication: MedicationResult,
    lines: list[OCRLine],
    match_score_hint: float,
    medicine_names: list[str],
    threshold: int,
) -> MedicationResult:
    fuzzy_score = match_score_hint
    if medication.name:
        resolved_name, fuzzy_score, match_meta = _match_medicine_name(medication.name, medicine_names, threshold)
        if resolved_name:
            medication.name = resolved_name
        if match_meta:
            medication.matched_term = match_meta.matched_term
            medication.drug_id = match_meta.drug_id
            medication.brand_id = match_meta.brand_id
        elif not medication.matched_term:
            medication.matched_term = medication.name

    medication.confidence = _combined_confidence(
        ocr_confidence=_avg_confidence(lines),
        fuzzy_confidence=fuzzy_score / 100.0,
        regex_signal=_regex_signal(medication.dosage, medication.frequency, medication.quantity),
    )
    return medication


def _extract_name_with_score(
    text: str,
    medicine_names: list[str],
    threshold: int,
) -> tuple[str | None, float, MedicineMatch | None]:
    med_name, med_score, match_meta = _match_medicine_name(text, medicine_names, threshold)
    if med_name:
        return med_name, med_score, match_meta
    candidate = _extract_medicine_candidate(text)
    return candidate, med_score, match_meta


def _looks_like_medicine_line(text: str, dosage: str | None) -> bool:
    if PURE_FREQUENCY_LINE_PATTERN.match(text) and not dosage:
        return False
    if MEDICINE_PREFIX_PATTERN.search(text):
        return True
    if dosage and re.search(r"[a-zA-Z]", text):
        return True
    if re.search(r"\b[A-Za-z]{3,}\b", text) and not _extract_frequency(text):
        return True
    return False


def _looks_like_name_continuation(text: str) -> bool:
    if _extract_frequency(text):
        return False
    if _extract_quantity(text):
        return False
    return bool(re.search(r"[A-Za-z]{2,}", text))


def _ordered_lines(lines: list[OCRLine]) -> list[OCRLine]:
    return sorted(
        lines,
        key=lambda line: (
            line.page,
            line.bbox.y_min if line.bbox else 10_000.0,
            line.bbox.x_min if line.bbox else 10_000.0,
        ),
    )


def _group_lines(lines: list[OCRLine], merge_y_px: int) -> list[list[OCRLine]]:
    def sort_key(line: OCRLine):
        if line.bbox is None:
            return (line.page, 10_000.0, 10_000.0)
        return (line.page, line.bbox.y_min, line.bbox.x_min)

    ordered = sorted(lines, key=sort_key)
    groups: list[list[OCRLine]] = []
    current: list[OCRLine] = []

    for line in ordered:
        if not current:
            current = [line]
            continue

        prev = current[-1]
        if _same_group(prev, line, merge_y_px):
            current.append(line)
        else:
            groups.append(current)
            current = [line]

    if current:
        groups.append(current)
    return groups


def _same_group(previous: OCRLine, current: OCRLine, merge_y_px: int) -> bool:
    if previous.page != current.page:
        return False

    if previous.bbox is None or current.bbox is None:
        return True

    prev_y = (previous.bbox.y_min + previous.bbox.y_max) / 2
    curr_y = (current.bbox.y_min + current.bbox.y_max) / 2
    return abs(prev_y - curr_y) <= merge_y_px


def _match_medicine_name(
    text: str,
    medicine_names: list[str],
    threshold: int,
) -> tuple[str | None, float, MedicineMatch | None]:
    if not settings.DISABLE_MEDICINE_MATCHING:
        db_match = medicine_matcher.match_best(text)
        if db_match:
            return db_match.matched_term, db_match.confidence * 100.0, db_match

    if not medicine_names:
        return None, 0.0, None

    normalized_text = normalize_medicine_text(text)
    match = process.extractOne(normalized_text, medicine_names, scorer=fuzz.WRatio)
    if not match:
        return None, 0.0, None

    matched_name, score, _ = match
    if score < threshold:
        return None, float(score), None
    return str(matched_name), float(score), None


def _first_match(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    if not match:
        return None
    value = match.group(0).strip()
    return value.strip("() ").strip()


def _extract_frequency(text: str) -> str | None:
    normalized = normalize_prescription_text(text)
    if not normalized:
        return None

    code_match = FREQUENCY_CODE_PATTERN.search(normalized)
    if code_match:
        return code_match.group(1).upper()

    combo_match = FREQUENCY_SPLIT_PATTERN.search(normalized)
    if combo_match:
        digits = FREQUENCY_DIGIT_PATTERN.findall(combo_match.group(0))
        if 3 <= len(digits) <= 4:
            return "+".join(digits)

    # Handles noisy patterns like "1 x4 1 x0" by extracting 3-4 single-dose digits.
    if "x" in normalized or "+" in normalized or "-" in normalized:
        digits = FREQUENCY_DIGIT_PATTERN.findall(normalized)
        if 3 <= len(digits) <= 4:
            return "+".join(digits[:4])

    return None


def _extract_quantity(text: str) -> str | None:
    normalized = normalize_prescription_text(text)
    if not normalized:
        return None

    if QUANTITY_CONTINUE_PATTERN.search(normalized):
        return "continue"

    duration_match = QUANTITY_DURATION_PATTERN.search(normalized)
    if not duration_match:
        return None

    amount = duration_match.group(1)
    raw_unit = duration_match.group(2).lower()
    unit = _normalize_duration_unit(raw_unit, amount)
    return f"{amount} {unit}"


def _normalize_duration_unit(raw_unit: str, amount: str) -> str:
    if raw_unit in {"দিন"}:
        return "day" if amount == "1" else "days"
    if raw_unit in {"সপ্তাহ"}:
        return "week" if amount == "1" else "weeks"
    if raw_unit in {"মাস"}:
        return "month" if amount == "1" else "months"

    if raw_unit.endswith("s"):
        singular = raw_unit[:-1]
        if amount == "1":
            return singular
        return raw_unit

    if amount == "1":
        return raw_unit
    return f"{raw_unit}s"


def _extract_medicine_candidate(text: str) -> str | None:
    cleaned = text.lower()
    cleaned = DOSAGE_PATTERN.sub(" ", cleaned)
    cleaned = FREQUENCY_PATTERN.sub(" ", cleaned)
    cleaned = QUANTITY_PATTERN.sub(" ", cleaned)
    cleaned = re.sub(r"[^a-zA-Z\s\-]", " ", cleaned)

    # Remove common medicine form prefixes/noise.
    cleaned = re.sub(r"\b(tab|tablet|cap|capsule|syp|syrup|inj|injection|drop|drops)\b", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -")
    if not cleaned:
        return None

    tokens = [token for token in cleaned.split(" ") if len(token) > 1]
    if not tokens:
        return None

    candidate = " ".join(tokens[:3]).strip()
    if not candidate:
        return None
    return candidate.title()


def _avg_confidence(lines: list[OCRLine]) -> float:
    if not lines:
        return 0.0
    values = [line.confidence for line in lines]
    return sum(values) / len(values)


def _regex_signal(dosage: str | None, frequency: str | None, quantity: str | None) -> float:
    score = 0.0
    if dosage:
        score += 0.34
    if frequency:
        score += 0.33
    if quantity:
        score += 0.33
    return min(1.0, score)


def _combined_confidence(ocr_confidence: float, fuzzy_confidence: float, regex_signal: float) -> float:
    # Weighted confidence: OCR quality + medicine match + rule certainty.
    score = (0.45 * ocr_confidence) + (0.40 * fuzzy_confidence) + (0.15 * regex_signal)
    return round(max(0.0, min(1.0, score)), 3)
