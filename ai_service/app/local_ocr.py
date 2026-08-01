from __future__ import annotations

from functools import lru_cache
from io import BytesIO
import os
from typing import Any

import numpy as np
from PIL import Image

from app.schemas import BBox, OCRLine


@lru_cache(maxsize=1)
def _paddle_engine():
    """Build the local PaddleOCR 3.x pipeline once per process."""
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError("Local OCR is unavailable because PaddleOCR is not installed") from exc

    return PaddleOCR(
        device="cpu",
        engine="paddle_static",
        enable_mkldnn=False,
        text_detection_model_name="PP-OCRv4_mobile_det",
        text_recognition_model_name="en_PP-OCRv4_mobile_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def _result_payload(page: Any) -> dict[str, Any]:
    value = getattr(page, "json", page)
    if callable(value):
        value = value()
    if not isinstance(value, dict):
        return {}
    nested = value.get("res")
    return nested if isinstance(nested, dict) else value


def _v3_lines(result: list[Any]) -> list[OCRLine]:
    lines: list[OCRLine] = []
    for page_number, page in enumerate(result, start=1):
        payload = _result_payload(page)
        texts = payload.get("rec_texts")
        scores = payload.get("rec_scores")
        boxes = payload.get("rec_polys")
        if texts is None:
            texts = []
        if scores is None:
            scores = []
        if boxes is None:
            boxes = payload.get("dt_polys")
        if boxes is None:
            boxes = []
        for index, raw_text in enumerate(texts):
            text = str(raw_text or "").strip()
            if not text or index >= len(boxes):
                continue
            box = boxes[index]
            if box is None or len(box) < 2:
                continue
            xs = [float(point[0]) for point in box]
            ys = [float(point[1]) for point in box]
            confidence = float(scores[index]) if index < len(scores) else 0.0
            lines.append(
                OCRLine(
                    text=text,
                    bbox=BBox(x_min=min(xs), y_min=min(ys), x_max=max(xs), y_max=max(ys)),
                    page=page_number,
                    confidence=round(confidence, 3),
                )
            )
    return lines


def paddleocr_extract_lines(image_bytes: bytes) -> list[OCRLine]:
    """Run PaddleOCR locally. This function never calls a hosted provider."""
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    result = _paddle_engine().predict(np.array(image))
    return _v3_lines(result)
