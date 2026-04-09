from __future__ import annotations

import pytest

pytest.importorskip("rapidfuzz")

from app.parser import parse_prescription
from app.schemas import BBox, OCRLine


def _line(text: str, y: float, confidence: float = 0.9) -> OCRLine:
    return OCRLine(
        text=text,
        bbox=BBox(x_min=10, y_min=y, x_max=300, y_max=y + 12),
        page=1,
        confidence=confidence,
    )


def test_parse_prescription_extracts_medicine_dose_frequency_and_duration() -> None:
    lines = [
        _line("Tab Napa 500mg", y=10),
        _line("1+0+1", y=25),
        _line("7 days", y=40),
    ]

    medications = parse_prescription(lines, medicine_names=["napa", "metformin"])

    assert medications
    first = medications[0]
    assert first.name is not None
    assert "Napa" in first.name or "Napa" in (first.matched_term or "")
    assert first.dosage == "500mg"
    assert first.frequency == "1+0+1"
    assert first.quantity == "7 days"
    assert 0.0 <= first.confidence <= 1.0


def test_parse_prescription_handles_noisy_ocr_without_crashing() -> None:
    lines = [
        _line("..@@", y=10, confidence=0.6),
        _line("x x x", y=20, confidence=0.6),
        _line("unknown tokens", y=30, confidence=0.6),
    ]
    medications = parse_prescription(lines, medicine_names=[])
    assert isinstance(medications, list)
