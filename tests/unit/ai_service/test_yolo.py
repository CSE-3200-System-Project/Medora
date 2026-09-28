from __future__ import annotations

from io import BytesIO

import pytest

pytest.importorskip("PIL")
pytest.importorskip("onnxruntime")

from PIL import Image

from app.config import settings
from app.yolo import _label_for_class
from app.yolo import detect_regions


def _dummy_png(width: int = 256, height: int = 128) -> bytes:
    image = Image.new("RGB", (width, height), color=(255, 255, 255))
    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def test_yolo_class_indices_match_exported_model_metadata() -> None:
    class_names = [name.strip() for name in settings.YOLO_CLASS_NAMES.split(",") if name.strip()]

    assert class_names == [
        "Date",
        "Frequency",
        "Lines",
        "Medication",
        "Passport-as2v",
        "Pilgrim",
        "Quantity",
    ]
    assert _label_for_class(0, class_names) == "Date"
    assert _label_for_class(3, class_names) == "Medication"
    assert _label_for_class(6, class_names) == "Quantity"
    assert settings.YOLO_PARENT_CLASSES == "Medication"


def test_detect_regions_falls_back_to_full_image_when_detector_unavailable(monkeypatch) -> None:
    monkeypatch.setattr("app.yolo._get_detector", lambda: None)

    result = detect_regions(_dummy_png(), use_full_image_fallback=True)

    assert len(result) == 1
    assert result[0].label == "prescription"
    assert result[0].bbox.x_max > result[0].bbox.x_min


def test_detect_regions_can_return_empty_without_fallback(monkeypatch) -> None:
    monkeypatch.setattr("app.yolo._get_detector", lambda: None)

    result = detect_regions(_dummy_png(), use_full_image_fallback=False)

    assert result == []
