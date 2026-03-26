"""
Medical lab report parser.

Extracts structured test results from OCR text lines.
Handles common lab report formats:
  - "Hemoglobin  13.5  g/dL  13.0-17.0"
  - "WBC Count: 8000 /µL (4000 - 11000)"
  - "Blood Sugar (Fasting)    110 mg/dL    70-100    High"

Also handles table-structured reports where OCR returns individual
cells as separate lines — reconstructs rows using bounding-box
Y-coordinate proximity before parsing.
"""

from __future__ import annotations

import logging
import re
from typing import Sequence

from app.report_schemas import ReportTestResult
from app.schemas import OCRLine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Common lab test name normalization
# ---------------------------------------------------------------------------

_TEST_NAME_ALIASES: dict[str, str] = {
    "hb": "Hemoglobin",
    "hgb": "Hemoglobin",
    "haemoglobin": "Hemoglobin",
    "hemoglobin": "Hemoglobin",
    "wbc": "WBC Count",
    "wbc count": "WBC Count",
    "white blood cell": "WBC Count",
    "white blood cells": "WBC Count",
    "rbc": "RBC Count",
    "rbc count": "RBC Count",
    "red blood cell": "RBC Count",
    "red blood cells": "RBC Count",
    "platelet": "Platelet Count",
    "platelet count": "Platelet Count",
    "platelets": "Platelet Count",
    "plt": "Platelet Count",
    "esr": "ESR",
    "erythrocyte sedimentation rate": "ESR",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "hct": "Hematocrit",
    "hematocrit": "Hematocrit",
    "haematocrit": "Hematocrit",
    "pcv": "PCV",
    "packed cell volume": "PCV",
    "fbs": "Fasting Blood Sugar",
    "fasting blood sugar": "Fasting Blood Sugar",
    "fasting glucose": "Fasting Blood Sugar",
    "blood sugar fasting": "Fasting Blood Sugar",
    "blood sugar (fasting)": "Fasting Blood Sugar",
    "rbs": "Random Blood Sugar",
    "random blood sugar": "Random Blood Sugar",
    "ppbs": "Postprandial Blood Sugar",
    "blood sugar pp": "Postprandial Blood Sugar",
    "hba1c": "HbA1c",
    "glycated hemoglobin": "HbA1c",
    "glycated haemoglobin": "HbA1c",
    "creatinine": "Creatinine",
    "serum creatinine": "Creatinine",
    "s. creatinine": "Creatinine",
    "s creatinine": "Creatinine",
    "bun": "Blood Urea Nitrogen",
    "blood urea nitrogen": "Blood Urea Nitrogen",
    "blood urea": "Blood Urea",
    "urea": "Blood Urea",
    "uric acid": "Uric Acid",
    "s. uric acid": "Uric Acid",
    "sgpt": "SGPT (ALT)",
    "alt": "SGPT (ALT)",
    "alanine aminotransferase": "SGPT (ALT)",
    "alanine transaminase": "SGPT (ALT)",
    "sgot": "SGOT (AST)",
    "ast": "SGOT (AST)",
    "aspartate aminotransferase": "SGOT (AST)",
    "aspartate transaminase": "SGOT (AST)",
    "alkaline phosphatase": "Alkaline Phosphatase",
    "alp": "Alkaline Phosphatase",
    "total bilirubin": "Total Bilirubin",
    "bilirubin total": "Total Bilirubin",
    "bilirubin (total)": "Total Bilirubin",
    "direct bilirubin": "Direct Bilirubin",
    "bilirubin direct": "Direct Bilirubin",
    "indirect bilirubin": "Indirect Bilirubin",
    "total protein": "Total Protein",
    "albumin": "Albumin",
    "serum albumin": "Albumin",
    "globulin": "Globulin",
    "a/g ratio": "A/G Ratio",
    "albumin globulin ratio": "A/G Ratio",
    "total cholesterol": "Total Cholesterol",
    "cholesterol": "Total Cholesterol",
    "cholesterol total": "Total Cholesterol",
    "triglycerides": "Triglycerides",
    "triglyceride": "Triglycerides",
    "hdl": "HDL Cholesterol",
    "hdl cholesterol": "HDL Cholesterol",
    "hdl-c": "HDL Cholesterol",
    "ldl": "LDL Cholesterol",
    "ldl cholesterol": "LDL Cholesterol",
    "ldl-c": "LDL Cholesterol",
    "vldl": "VLDL Cholesterol",
    "vldl cholesterol": "VLDL Cholesterol",
    "tsh": "TSH",
    "thyroid stimulating hormone": "TSH",
    "t3": "T3",
    "triiodothyronine": "T3",
    "t4": "T4",
    "thyroxine": "T4",
    "free t3": "Free T3",
    "ft3": "Free T3",
    "free t4": "Free T4",
    "ft4": "Free T4",
    "sodium": "Sodium",
    "na": "Sodium",
    "na+": "Sodium",
    "potassium": "Potassium",
    "k": "Potassium",
    "k+": "Potassium",
    "chloride": "Chloride",
    "cl": "Chloride",
    "calcium": "Calcium",
    "ca": "Calcium",
    "phosphorus": "Phosphorus",
    "iron": "Iron",
    "serum iron": "Iron",
    "tibc": "TIBC",
    "ferritin": "Ferritin",
    "serum ferritin": "Ferritin",
    "vitamin d": "Vitamin D",
    "vit d": "Vitamin D",
    "25-oh vitamin d": "Vitamin D",
    "vitamin b12": "Vitamin B12",
    "vit b12": "Vitamin B12",
    "folate": "Folate",
    "folic acid": "Folate",
    "psa": "PSA",
    "prostate specific antigen": "PSA",
    "ggtp": "GGT",
    "ggt": "GGT",
    "gamma gt": "GGT",
    "ldh": "LDH",
    "lactate dehydrogenase": "LDH",
    "cpk": "CPK",
    "creatine kinase": "CPK",
    "ck": "CPK",
    "amylase": "Amylase",
    "lipase": "Lipase",
    "crp": "CRP",
    "c-reactive protein": "CRP",
    "c reactive protein": "CRP",
    "prothrombin time": "Prothrombin Time",
    "pt": "Prothrombin Time",
    "inr": "INR",
    "aptt": "APTT",
    "d-dimer": "D-Dimer",
    "d dimer": "D-Dimer",
    "fibrinogen": "Fibrinogen",
    "reticulocyte count": "Reticulocyte Count",
    "peripheral smear": "Peripheral Smear",
    "blood group": "Blood Group",
    "blood type": "Blood Group",
    "neutrophils": "Neutrophils",
    "lymphocytes": "Lymphocytes",
    "monocytes": "Monocytes",
    "eosinophils": "Eosinophils",
    "basophils": "Basophils",
}

# ---------------------------------------------------------------------------
# Unit aliases / normalization
# ---------------------------------------------------------------------------

_UNIT_ALIASES: dict[str, str] = {
    "g/dl": "g/dL",
    "gm/dl": "g/dL",
    "mg/dl": "mg/dL",
    "mg/l": "mg/L",
    "iu/l": "IU/L",
    "u/l": "U/L",
    "iu/ml": "IU/mL",
    "miu/l": "mIU/L",
    "miu/ml": "mIU/mL",
    "uiu/ml": "µIU/mL",
    "µiu/ml": "µIU/mL",
    "ng/ml": "ng/mL",
    "ng/dl": "ng/dL",
    "pg/ml": "pg/mL",
    "nmol/l": "nmol/L",
    "pmol/l": "pmol/L",
    "mmol/l": "mmol/L",
    "meq/l": "mEq/L",
    "µg/dl": "µg/dL",
    "ug/dl": "µg/dL",
    "cells/cumm": "cells/cumm",
    "/cumm": "/cumm",
    "/µl": "/µL",
    "/ul": "/µL",
    "thou/cumm": "thou/cumm",
    "mill/cumm": "mill/cumm",
    "lakh/cumm": "lakh/cumm",
    "x10^3/µl": "x10³/µL",
    "x10^6/µl": "x10⁶/µL",
    "x10^9/l": "x10⁹/L",
    "x10^12/l": "x10¹²/L",
    "mm/hr": "mm/hr",
    "mm/1st hr": "mm/hr",
    "mm 1st hr": "mm/hr",
    "sec": "sec",
    "seconds": "sec",
    "%": "%",
    "fl": "fL",
    "pg": "pg",
    "g%": "g%",
    "ratio": "ratio",
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Numeric value: integer or decimal, optional leading negative
_NUM = r"[-+]?\d+(?:\.\d+)?"

# Reference range patterns
_RANGE_PATTERNS = [
    # "13.0 - 17.0" or "13.0-17.0"
    re.compile(rf"({_NUM})\s*[-–—]\s*({_NUM})"),
    # "(4000 - 11000)" or "( 4000 - 11000 )"
    re.compile(rf"\(\s*({_NUM})\s*[-–—]\s*({_NUM})\s*\)"),
    # "< 200" or "> 40"
    re.compile(rf"[<>≤≥]\s*({_NUM})"),
    # "Up to 200" or "Upto 40"
    re.compile(rf"(?:up\s*to|upto)\s+({_NUM})", re.IGNORECASE),
]

# Unit pattern: common lab units
_UNIT_PATTERN = re.compile(
    r"("
    r"g/d[lL]|gm/d[lL]|mg/d[lL]|mg/[lL]|µg/d[lL]|ug/d[lL]"
    r"|IU/[lL]|U/[lL]|IU/m[lL]|mIU/[lL]|mIU/m[lL]|µIU/m[lL]|uIU/m[lL]"
    r"|ng/m[lL]|ng/d[lL]|pg/m[lL]"
    r"|nmol/[lL]|pmol/[lL]|mmol/[lL]|mEq/[lL]|meq/[lL]"
    r"|cells/cumm|/cumm|/µ[lL]|/u[lL]"
    r"|thou/cumm|mill/cumm|lakh/cumm"
    r"|x10\^?\d+/µ?[lL]"
    r"|mm/(?:1st\s*)?hr|mm\s+1st\s+hr"
    r"|sec(?:onds?)?"
    r"|f[lL]|pg|g%|%|ratio"
    r")",
    re.IGNORECASE,
)

# Status keywords — only match standalone flags
_STATUS_HIGH = re.compile(r"(?<![/a-zA-Z])\b(high|above|elevated|H)\b(?![/a-zA-Z])")
_STATUS_LOW = re.compile(r"(?<![/a-zA-Z])\b(low|below|decreased|L)\b(?![/a-zA-Z])")
_STATUS_NORMAL = re.compile(r"(?<![/a-zA-Z])\b(normal|N|within\s*normal)\b(?![/a-zA-Z])", re.IGNORECASE)

# Lines to skip (headers, footers, metadata).
# IMPORTANT: Only use ^ anchored patterns here.  Using .search() on
# un-anchored patterns kills valid data rows that happen to contain
# a keyword like "hospital" or "department" somewhere in the merged
# OCR text.  The _should_skip_line() function uses .search(), so
# every pattern MUST be anchored to the START of the line (^\s*...).
_SKIP_PATTERNS = [
    re.compile(r"^\s*(test\s*name|investigation|parameter)\s*", re.IGNORECASE),
    re.compile(r"^\s*(result|value|unit|reference|normal)\s*(range|value)?\s*$", re.IGNORECASE),
    re.compile(r"^\s*(date|time|report\b|patient\b|sample|specimen|doctor|lab\b)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(collected|received|reported|printed|verified|approved|checked)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(mr\.?|mrs\.?|ms\.?|dr\.?)\s", re.IGNORECASE),
    re.compile(r"^\s*\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\s*$"),
    re.compile(r"^\s*page\s+\d", re.IGNORECASE),
    re.compile(r"^\s*[-=_*]{3,}\s*$"),
    re.compile(r"^\s*$"),
    # Patient / report metadata fields commonly found in headers
    re.compile(r"^\s*(id\s*no|id\s*number|patient\s*id|reg\.?\s*no|regi\.?\s*no|registration)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(cell|phone|mobile|tel|fax|contact|e-?mail)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(sex|gender|age|dob|date\s*of\s*birth)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(patient\s*name|address|city|district|ward|bed)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(requested\s*by|referred\s*by|ref\.?\s*by|consultant)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(cid|barcode|bill|invoice|receipt|uhid|opd|ipd|mrn)\s*[:.]?\s", re.IGNORECASE),
    re.compile(r"^\s*(biochemistry|haematology|hematology|pathology|microbiology|serology|immunology|radiology|urine\s*analysis)\s*[-:]\s*\S+\s*(report)?\s*$", re.IGNORECASE),
    # Lines that are ONLY diagnostic center / hospital names (no numbers → no test data)
    re.compile(r"^\s*(diagnostic|hospital|laboratory|clinic|center|centre|medical\s*college)\b[^0-9]*$", re.IGNORECASE),
    re.compile(r"^\s*(road|street|lane|block|sector|floor|building)\b[^0-9]*$", re.IGNORECASE),
    re.compile(r"^\s*.*(mbbs|fcps|frcs|md\b|m\.?phil)\b.*$", re.IGNORECASE),
    # Lines that are just long numbers (IDs, phone numbers, barcodes)
    re.compile(r"^\s*\d[\d\s]{6,}\s*$"),
]

# Metadata keywords that should NOT appear as test names.
_METADATA_NAME_PATTERNS = re.compile(
    r"^("
    r"id\s*no|id\s*number|patient\s*id|reg\.?\s*no|regi\.?\s*no|registration"
    r"|cell|phone|mobile|tel|fax|contact|e-?mail"
    r"|sex|gender|age|dob|date\s*of\s*birth"
    r"|name|patient\s*name|address|city|district|ward|bed"
    r"|requested\s*by|referred\s*by|ref\.?\s*by|ref\.?\s*no|consultant"
    r"|cid|tr|barcode|bill|invoice|receipt|uhid|opd|ipd|mrn"
    r"|sample\s*(date|id|no)|specimen|collected|received|reported"
    r"|sex\s*:\s*\w+\s*age"
    r")$",
    re.IGNORECASE,
)

# Table header keywords — used to detect the column-header row of a table
_TABLE_HEADER_RE = re.compile(
    r"(test\s*name|investigation|parameter|result|value|unit|reference|normal\s*range|normal\s*value)",
    re.IGNORECASE,
)

# Line with a numeric value (candidate for test result)
_VALUE_IN_LINE = re.compile(rf"\b({_NUM})\b")


def normalize_test_name(raw_name: str) -> str:
    """Normalize a test name using the alias table."""
    cleaned = raw_name.strip().rstrip(":").strip()
    key = cleaned.lower().strip()
    return _TEST_NAME_ALIASES.get(key, cleaned)


def normalize_unit(raw_unit: str) -> str:
    """Normalize a unit string."""
    key = raw_unit.strip().lower()
    return _UNIT_ALIASES.get(key, raw_unit.strip())


# ---------------------------------------------------------------------------
# Table row reconstruction from bounding-box coordinates
# ---------------------------------------------------------------------------

def _reconstruct_table_rows(ocr_lines: Sequence[OCRLine]) -> list[OCRLine]:
    """
    Group OCR lines that sit on the same horizontal band (same table row)
    into single combined lines, sorted left-to-right.

    This is critical for table-structured reports where the OCR engine
    returns individual cells ("HbA1C", "4.0", "%", "4.0% - 6.0%") as
    separate OCRLine objects instead of one merged row.

    Lines without bounding boxes are passed through unchanged.
    """
    with_bbox: list[OCRLine] = []
    without_bbox: list[OCRLine] = []

    for line in ocr_lines:
        if line.bbox is not None:
            with_bbox.append(line)
        else:
            without_bbox.append(line)

    if not with_bbox:
        return list(ocr_lines)

    # Sort by vertical midpoint
    def y_mid(line: OCRLine) -> float:
        b = line.bbox
        assert b is not None
        return (b.y_min + b.y_max) / 2.0

    with_bbox.sort(key=y_mid)

    # Group lines whose vertical midpoints are within a tolerance.
    # Tolerance = fraction of the average line height.
    heights = [l.bbox.y_max - l.bbox.y_min for l in with_bbox if l.bbox]  # type: ignore[union-attr]
    avg_height = sum(heights) / len(heights) if heights else 20.0
    y_tolerance = max(avg_height * 0.5, 5.0)

    rows: list[list[OCRLine]] = []
    current_row: list[OCRLine] = [with_bbox[0]]
    current_y = y_mid(with_bbox[0])

    for line in with_bbox[1:]:
        mid = y_mid(line)
        if abs(mid - current_y) <= y_tolerance:
            current_row.append(line)
        else:
            rows.append(current_row)
            current_row = [line]
            current_y = mid
    rows.append(current_row)

    # Merge each row: sort cells left-to-right, join text with spaces
    merged: list[OCRLine] = []
    for row in rows:
        if len(row) == 1:
            merged.append(row[0])
            continue

        row.sort(key=lambda l: l.bbox.x_min if l.bbox else 0)  # type: ignore[union-attr]
        combined_text = "  ".join(l.text.strip() for l in row if l.text.strip())
        avg_conf = sum(l.confidence for l in row) / len(row)

        from app.schemas import BBox
        merged_bbox = BBox(
            x_min=min(l.bbox.x_min for l in row if l.bbox),  # type: ignore[union-attr]
            y_min=min(l.bbox.y_min for l in row if l.bbox),  # type: ignore[union-attr]
            x_max=max(l.bbox.x_max for l in row if l.bbox),  # type: ignore[union-attr]
            y_max=max(l.bbox.y_max for l in row if l.bbox),  # type: ignore[union-attr]
        )
        merged.append(OCRLine(
            text=combined_text,
            bbox=merged_bbox,
            page=row[0].page,
            confidence=round(avg_conf, 3),
        ))

    # Append lines that had no bbox at the end
    merged.extend(without_bbox)
    return merged


def _should_skip_line(text: str) -> bool:
    # All skip patterns are now ^ anchored, so .match() is sufficient
    # and prevents false positives on data rows that contain metadata
    # keywords mid-line (e.g. "Hemoglobin ... Department of Pathology").
    for pat in _SKIP_PATTERNS:
        if pat.match(text):
            logger.debug("report_parser: skip_line pattern=%r line=%r", pat.pattern[:40], text[:80])
            return True
    return False


def _extract_reference_range(text: str) -> tuple[float | None, float | None, str | None]:
    """Extract reference range min/max from text fragment."""
    for pat in _RANGE_PATTERNS[:2]:
        m = pat.search(text)
        if m:
            try:
                lo = float(m.group(1))
                hi = float(m.group(2))
                return lo, hi, m.group(0)
            except (ValueError, IndexError):
                continue

    # < or > pattern
    for pat in _RANGE_PATTERNS[2:]:
        m = pat.search(text)
        if m:
            try:
                val = float(m.group(1))
                raw = m.group(0).strip()
                if raw.startswith(("<", "≤")):
                    return None, val, raw
                elif raw.startswith((">", "≥")):
                    return val, None, raw
                else:
                    return None, val, raw
            except (ValueError, IndexError):
                continue
    return None, None, None


def _determine_status(
    value: float | None,
    ref_min: float | None,
    ref_max: float | None,
    line_text: str,
) -> str | None:
    """Determine if a result is normal/high/low."""
    if _STATUS_HIGH.search(line_text):
        return "high"
    if _STATUS_LOW.search(line_text):
        return "low"
    if _STATUS_NORMAL.search(line_text):
        return "normal"

    if value is not None:
        if ref_min is not None and value < ref_min:
            return "low"
        if ref_max is not None and value > ref_max:
            return "high"
        if ref_min is not None and ref_max is not None:
            return "normal"

    return None


def _parse_single_line(line_text: str, confidence: float) -> ReportTestResult | None:
    """
    Attempt to parse a single OCR line into a test result.
    Expected formats (after table row reconstruction):
      "Hemoglobin  13.5  g/dL  13.0 - 17.0"
      "WBC Count : 8000 /µL  4000 - 11000  Normal"
      "HbA1C  4.0  %  4.0% - 6.0%"
    """
    if _should_skip_line(line_text):
        return None

    # Skip table header rows (e.g. "Test Name  Result  Unit  Reference Value")
    header_matches = _TABLE_HEADER_RE.findall(line_text)
    if len(header_matches) >= 2:
        return None

    # Find all numeric values in the line
    numbers = list(_VALUE_IN_LINE.finditer(line_text))
    if not numbers:
        return None

    # Find unit
    unit_match = _UNIT_PATTERN.search(line_text)
    unit_str = unit_match.group(1) if unit_match else None

    # The first number is usually the result value.
    # Test name comes before the first number.
    first_num = numbers[0]
    name_part = line_text[:first_num.start()].strip()

    if not name_part or len(name_part) < 2:
        return None

    # Clean up test name
    name_part = re.sub(r"[:\-|]+$", "", name_part).strip()
    if not name_part:
        return None

    # Reject lines where the extracted "test name" is actually a metadata field
    name_cleaned = re.sub(r"\s*:\s*\S+", "", name_part).strip()
    if _METADATA_NAME_PATTERNS.match(name_cleaned):
        return None

    # Parse numeric value
    try:
        value = float(first_num.group(1))
    except ValueError:
        return None

    # The portion after the first number may contain unit + reference range + status
    after_value = line_text[first_num.end():]

    # Extract reference range from the portion after value
    ref_min, ref_max, ref_text = _extract_reference_range(after_value)

    normalized_name = normalize_test_name(name_part)
    normalized_unit = normalize_unit(unit_str) if unit_str else None

    # -------------------------------------------------------------------
    # Validation gate: only accept a result if we have confidence it is
    # a real test result, not random metadata that happens to have a number.
    # Accept the line if ANY of these hold:
    #   1. The test name matches a known alias (exact or substring).
    #   2. A recognized lab unit was found on the line.
    #   3. A reference range was found on the line.
    # Otherwise, discard — it is almost certainly metadata.
    # -------------------------------------------------------------------
    name_key = name_part.strip().rstrip(":").strip().lower()
    is_known_test = name_key in _TEST_NAME_ALIASES
    # Also check if any known alias is a substring of the name or vice versa
    if not is_known_test:
        for alias in _TEST_NAME_ALIASES:
            if alias in name_key or name_key in alias:
                is_known_test = True
                break
    has_unit = normalized_unit is not None
    has_ref_range = ref_min is not None or ref_max is not None

    if not (is_known_test or has_unit or has_ref_range):
        logger.debug("report_parser: skipping unrecognized line: %r", line_text)
        return None

    # Determine status
    status = _determine_status(value, ref_min, ref_max, line_text)

    return ReportTestResult(
        test_name=normalized_name,
        value=value,
        value_text=first_num.group(0),
        unit=normalized_unit,
        reference_range_min=ref_min,
        reference_range_max=ref_max,
        reference_range_text=ref_text,
        status=status,
        confidence=round(confidence, 3),
    )


def _parse_table_rows(
    tables: Sequence[list[list[str]]],
) -> list[ReportTestResult]:
    """
    Parse structured table data (from Azure Document Intelligence) directly.

    Each table is a grid of rows × cols.  We detect which column holds
    the test name, value, unit, and reference range by checking the header
    row, then iterate data rows.
    """
    _HEADER_NAME = re.compile(r"(test\s*name|investigation|parameter|test|analyte)", re.IGNORECASE)
    _HEADER_RESULT = re.compile(r"(result|value|observed)", re.IGNORECASE)
    _HEADER_UNIT = re.compile(r"(unit|units)", re.IGNORECASE)
    _HEADER_REF = re.compile(r"(reference|normal|range|biological\s*ref)", re.IGNORECASE)

    results: list[ReportTestResult] = []
    seen: set[str] = set()

    for table in tables:
        if len(table) < 2:
            continue

        # Try to identify columns from header row
        header = table[0]
        name_col = result_col = unit_col = ref_col = -1

        for ci, cell in enumerate(header):
            cell_lower = cell.lower().strip()
            if _HEADER_NAME.search(cell_lower) and name_col == -1:
                name_col = ci
            elif _HEADER_RESULT.search(cell_lower) and result_col == -1:
                result_col = ci
            elif _HEADER_UNIT.search(cell_lower) and unit_col == -1:
                unit_col = ci
            elif _HEADER_REF.search(cell_lower) and ref_col == -1:
                ref_col = ci

        # If we can't find name + result columns, try a heuristic:
        # first text column = name, first column with a number in row 1 = result
        if name_col == -1 or result_col == -1:
            # Fall back: try parsing rows as concatenated lines
            continue

        start_row = 1  # skip header

        for row in table[start_row:]:
            if name_col >= len(row) or result_col >= len(row):
                continue

            raw_name = row[name_col].strip()
            raw_value = row[result_col].strip()

            if not raw_name or not raw_value:
                continue

            # Skip sub-header rows
            if _TABLE_HEADER_RE.search(raw_name):
                continue

            # Parse numeric value
            val_match = _VALUE_IN_LINE.search(raw_value)
            if not val_match:
                continue

            try:
                value = float(val_match.group(1))
            except ValueError:
                continue

            # Unit
            unit_str = None
            if unit_col != -1 and unit_col < len(row) and row[unit_col].strip():
                unit_str = row[unit_col].strip()
            else:
                um = _UNIT_PATTERN.search(raw_value)
                if um:
                    unit_str = um.group(1)

            # Reference range
            ref_text = ""
            if ref_col != -1 and ref_col < len(row):
                ref_text = row[ref_col].strip()
            ref_min, ref_max, ref_range_text = _extract_reference_range(ref_text)

            normalized_name = normalize_test_name(raw_name)
            normalized_unit = normalize_unit(unit_str) if unit_str else None
            status = _determine_status(value, ref_min, ref_max, ref_text + " " + raw_value)

            key = normalized_name.lower()
            if key in seen:
                continue
            seen.add(key)

            results.append(ReportTestResult(
                test_name=normalized_name,
                value=value,
                value_text=val_match.group(0),
                unit=normalized_unit,
                reference_range_min=ref_min,
                reference_range_max=ref_max,
                reference_range_text=ref_range_text,
                status=status,
                confidence=0.9,
            ))

    logger.info("report_parser: extracted %d results from %d Azure tables", len(results), len(tables))
    return results


def parse_medical_report(
    ocr_lines: Sequence[OCRLine],
    tables: Sequence[list[list[str]]] | None = None,
) -> list[ReportTestResult]:
    """
    Parse OCR lines from a medical lab report into structured test results.

    Step 0: If structured table data is available (from Azure Document
            Intelligence), parse it directly — this is far more reliable
            than regex on concatenated OCR text.
    Step 1: Reconstruct table rows by grouping OCR cells on the same
            Y-coordinate (handles table-structured reports).
    Step 2: Parse each reconstructed line for test name, value, unit,
            reference range, and status.
    Step 3: Validate — only keep results with a known test name, recognized
            unit, or reference range. Rejects metadata/header noise.
    """
    # --- Try structured table parsing first ---
    if tables:
        table_results = _parse_table_rows(tables)
        if table_results:
            return table_results

    # --- Fallback: line-based parsing ---
    # Reconstruct table rows from fragmented OCR cells
    merged_lines = _reconstruct_table_rows(ocr_lines)
    logger.info(
        "report_parser: %d raw OCR lines → %d after table row reconstruction",
        len(ocr_lines), len(merged_lines),
    )

    results: list[ReportTestResult] = []
    seen_names: set[str] = set()

    for line in merged_lines:
        text = line.text.strip()
        if not text:
            continue

        result = _parse_single_line(text, line.confidence)
        if result is None:
            continue

        # Deduplicate by normalized test name
        key = result.test_name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        results.append(result)

    logger.info("report_parser extracted %d test results from %d lines", len(results), len(merged_lines))
    return results
