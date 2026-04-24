"""
OCR Dosage and Quantity Matcher

Provides intelligent parsing and matching of dosages and quantities extracted from OCR.
Uses common-sense patterns to correct OCR misreads:
- Dosage frequency is typically binary patterns like 1+0+1 (morning, noon, evening)
- Quantity is typically number of days or months
"""
import re
from typing import Optional, Dict, List, Tuple


class DosageFrequencyMatcher:
    """
    Matches dosage frequency patterns.
    Common patterns:
    - 1+0+1 (morning and evening)
    - 1+1+1 (three times daily)
    - 1+0+0 (once daily, morning)
    - 0+0+1 (once daily, evening)
    """

    # Valid frequency patterns — each slot is 0, 1/2, or 1 (morning, noon, evening)
    VALID_PATTERNS = [
        "1+0+0",    # morning only
        "0+1+0",    # afternoon only
        "0+0+1",    # evening only
        "1+1+0",    # morning and afternoon
        "1+0+1",    # morning and evening
        "0+1+1",    # afternoon and evening
        "1+1+1",    # three times daily
        "1/2+0+0",  # half morning only
        "0+1/2+0",  # half afternoon only
        "0+0+1/2",  # half evening only
        "1/2+1/2+0",
        "1/2+0+1/2",
        "0+1/2+1/2",
        "1/2+1/2+1/2",
        "1+1/2+0",
        "1+0+1/2",
        "1/2+1+0",
        "0+1+1/2",
        "1/2+0+1",
        "0+1/2+1",
        "1+1/2+1",
        "1+1+1/2",
        "1/2+1+1",
    ]

    # Mapping of frequency text to standardized pattern
    FREQUENCY_ALIASES = {
        "once daily": "1+0+0",
        "twice daily": "1+0+1",
        "thrice daily": "1+1+1",
        "three times daily": "1+1+1",
        "half tablet": "1/2+0+0",
        "half tablet twice": "1/2+0+1/2",
        "bd": "1+0+1",
        "tid": "1+1+1",
        "od": "1+0+0",
        "1-0-0": "1+0+0",
        "0-0-1": "0+0+1",
        "1-0-1": "1+0+1",
        "1-1-1": "1+1+1",
        "1/2-0-0": "1/2+0+0",
        "0-0-1/2": "0+0+1/2",
        "1/2-0-1/2": "1/2+0+1/2",
        "1/2-1/2-1/2": "1/2+1/2+1/2",
    }

    @staticmethod
    def correct_ocr_frequency(raw_text: Optional[str]) -> Optional[str]:
        """
        Correct OCR-misread dosage frequency patterns.
        Returns corrected pattern like '1+0+1' or None if unrecognizable.
        """
        if not raw_text:
            return None

        text = raw_text.strip().lower()

        # Check if it's already a valid pattern
        if text in DosageFrequencyMatcher.VALID_PATTERNS:
            return text

        # Check aliases
        if text in DosageFrequencyMatcher.FREQUENCY_ALIASES:
            return DosageFrequencyMatcher.FREQUENCY_ALIASES[text]

        # Try to extract pattern from text like "1+0+1" or "1/2+0+1/2"
        # with various separators — OCR might misread "+" as "-", "," or "|"
        # Protect "/" inside "1/2" before normalizing separators
        normalized = re.sub(r'[\s\-,|]', '+', text)
        # Replace standalone letter 'l' or 'I' that are not part of a fraction
        normalized = re.sub(r'(?<![0-9])l(?![/0-9])', '1', normalized)
        normalized = re.sub(r'(?<![0-9])I(?![/0-9])', '1', normalized)
        # Collapse double ++ that may appear after replacements
        normalized = re.sub(r'\++', '+', normalized)

        # Check if normalized matches a valid pattern
        for pattern in DosageFrequencyMatcher.VALID_PATTERNS:
            if normalized == pattern:
                return pattern

        # Try fuzzy matching on frequency aliases
        for alias_key, alias_value in DosageFrequencyMatcher.FREQUENCY_ALIASES.items():
            if alias_key in text or text in alias_key:
                return alias_value

        # If no match found, return None
        return None

    @staticmethod
    def extract_frequency_per_day(pattern: Optional[str]) -> Optional[float]:
        """
        Extract frequency per day from a valid pattern.
        '1+0+1'       -> 2
        '1+1+1'       -> 3
        '1/2+0+1/2'   -> 1.0
        '1/2+1/2+1/2' -> 1.5
        Returns a float; callers may round as needed.
        """
        if not pattern:
            return None

        total: float = 0.0
        for slot in pattern.split('+'):
            slot = slot.strip()
            if slot == '1':
                total += 1.0
            elif slot in ('1/2', '0.5'):
                total += 0.5
            # '0' contributes nothing
        return total if total > 0 else None


class QuantityMatcher:
    """
    Matches dosage quantity (duration or total count).
    Common formats:
    - Numbers followed by 'days' or 'months'
    - Bangla numbers
    - Written-out numbers in English and Bangla
    """

    # Bangla number mapping
    BANGLA_DIGITS = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    }

    # Duration units
    DURATION_UNITS = {
        'day': 1,
        'days': 1,
        'week': 7,
        'weeks': 7,
        'month': 30,
        'months': 30,
        'দিন': 1,  # Bangla
        'সপ্তাহ': 7,  # Bangla
        'মাস': 30,  # Bangla
    }

    # Written number words
    NUMBER_WORDS = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'twenty': 20,
        'thirty': 30, 'forty': 40, 'fifty': 50, 'hundred': 100,
    }

    BANGLA_NUMBER_WORDS = {
        'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4,
        'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9,
        'দশ': 10, 'এগার': 11, 'বারো': 12, 'কুড়ি': 20,
        'ত্রিশ': 30, 'চল্লিশ': 40, 'পঞ্চাশ': 50, 'একশ': 100,
    }

    @staticmethod
    def _convert_bangla_to_english(text: str) -> str:
        """Convert Bangla digits to English digits."""
        for bangla, english in QuantityMatcher.BANGLA_DIGITS.items():
            text = text.replace(bangla, english)
        return text

    @staticmethod
    def parse_quantity(raw_text: Optional[str]) -> Optional[str]:
        """
        Parse quantity from OCR text.
        Returns a standardized quantity string like "10 days" or "1 month"
        or None if unparseable.
        """
        if not raw_text:
            return None

        text = raw_text.strip().lower()

        # Convert Bangla digits to English
        text = QuantityMatcher._convert_bangla_to_english(text)

        # Pattern 1: "number days/months/weeks"
        match = re.search(r'(\d+)\s*(day|days|week|weeks|month|months|দিন|সপ্তাহ|মাস)', text)
        if match:
            quantity = match.group(1)
            unit = match.group(2).lower()
            unit_key = next((k for k in QuantityMatcher.DURATION_UNITS.keys() if k in unit), None)
            if unit_key:
                return f"{quantity} {unit_key}"

        # Pattern 2: "written number days" (e.g., "ten days", "দশ দিন")
        for word, num in {**QuantityMatcher.NUMBER_WORDS, **QuantityMatcher.BANGLA_NUMBER_WORDS}.items():
            word_pattern = r'\b' + word + r'\b'
            if re.search(word_pattern, text):
                for unit_word in QuantityMatcher.DURATION_UNITS.keys():
                    if unit_word in text:
                        return f"{num} {unit_word}"

        # Pattern 3: Just a number (assume days)
        match = re.search(r'^\d+$', text.strip())
        if match:
            return f"{match.group(0)} days"

        return None

    @staticmethod
    def quantity_to_days(quantity_str: Optional[str]) -> Optional[int]:
        """
        Convert a quantity string to number of days.
        '10 days' -> 10
        '1 month' -> 30
        '2 weeks' -> 14
        """
        if not quantity_str:
            return None

        text = quantity_str.strip().lower()
        text = QuantityMatcher._convert_bangla_to_english(text)

        # Extract number and unit
        match = re.search(r'(\d+)\s*(\w+)', text)
        if not match:
            return None

        number = int(match.group(1))
        unit = match.group(2).lower()

        # Find matching unit
        for unit_key, multiplier in QuantityMatcher.DURATION_UNITS.items():
            if unit_key in unit:
                return number * multiplier

        return None


class MedicineMatcher:
    """
    Matches medicine names from OCR with database medicines.
    Uses fuzzy matching to find best candidates.
    """

    @staticmethod
    def normalize_medicine_name(name: str) -> str:
        """Normalize medicine name for matching."""
        # Remove spaces, convert to lowercase
        normalized = name.strip().lower()
        # Remove special characters but keep hyphens and apostrophes
        normalized = re.sub(r'[^a-z0-9\s\-\']', '', normalized)
        # Collapse multiple spaces
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized

    @staticmethod
    def similarity_ratio(str1: str, str2: str) -> float:
        """
        Calculate similarity between two strings (0 to 1).
        Simple implementation based on character overlap.
        """
        s1 = MedicineMatcher.normalize_medicine_name(str1)
        s2 = MedicineMatcher.normalize_medicine_name(str2)

        if s1 == s2:
            return 1.0

        # Check if one is substring of other
        if s1 in s2 or s2 in s1:
            return 0.9

        # Levenshtein-like check (simplified)
        max_len = max(len(s1), len(s2))
        if max_len == 0:
            return 0.0

        # Count matching characters at same positions
        matching = sum(1 for c1, c2 in zip(s1, s2) if c1 == c2)
        return matching / max_len

    @staticmethod
    def find_best_match(
        ocr_name: str,
        available_medicines: List[Dict[str, str]]
    ) -> Optional[Dict[str, str]]:
        """
        Find best matching medicine from available list.
        available_medicines: List of dicts with 'generic_name', 'brand_name', etc.
        Returns the best match dict or None.
        """
        if not ocr_name or not available_medicines:
            return None

        normalized_ocr = MedicineMatcher.normalize_medicine_name(ocr_name)

        best_match = None
        best_score = 0.7  # Minimum threshold

        for medicine in available_medicines:
            generic = medicine.get('generic_name', '')
            brand = medicine.get('brand_name', '')

            # Check both generic and brand names
            generic_score = MedicineMatcher.similarity_ratio(normalized_ocr, generic)
            brand_score = MedicineMatcher.similarity_ratio(normalized_ocr, brand)

            max_score = max(generic_score, brand_score)

            if max_score > best_score:
                best_score = max_score
                best_match = medicine

        return best_match
