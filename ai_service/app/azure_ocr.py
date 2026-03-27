from __future__ import annotations

import logging
from io import BytesIO
from typing import Any

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
from PIL import Image, ImageEnhance, ImageOps

from app.config import settings
from app.schemas import BBox, OCRLine

logger = logging.getLogger(__name__)


class AzureReadClient:
    def __init__(self) -> None:
        if not settings.AZURE_OCR_ENDPOINT or not settings.AZURE_OCR_KEY:
            raise RuntimeError("Missing AZURE_OCR_ENDPOINT or AZURE_OCR_KEY in environment.")

        self._client = DocumentIntelligenceClient(
            endpoint=settings.AZURE_OCR_ENDPOINT,
            credential=AzureKeyCredential(settings.AZURE_OCR_KEY),
        )
        self._model_id = settings.AZURE_OCR_MODEL_ID

    def read_lines(self, image_bytes: bytes, *, subject_token: str | None = None) -> list[OCRLine]:
        prepared = _prepare_image_for_ocr(image_bytes)
        logger.debug(
            "azure_read_start original_bytes=%d prepared_bytes=%d model=%s subject_token=%s",
            len(image_bytes),
            len(prepared),
            self._model_id,
            _safe_request_id(subject_token),
        )

        result = self._run_analysis(prepared, image_bytes, subject_token)

        lines: list[OCRLine] = []
        for page_idx, page in enumerate(getattr(result, "pages", []) or [], start=1):
            page_confidence = _page_word_confidence(page)
            for line in getattr(page, "lines", []) or []:
                line_text = (getattr(line, "content", "") or "").strip()
                if not line_text:
                    continue
                lines.append(
                    OCRLine(
                        text=line_text,
                        bbox=_polygon_to_bbox(getattr(line, "polygon", None)),
                        page=page_idx,
                        confidence=page_confidence,
                    )
                )
        logger.debug("azure_read_done lines=%d", len(lines))
        return lines

    def read_lines_and_tables(
        self, image_bytes: bytes, *, subject_token: str | None = None
    ) -> tuple[list[OCRLine], list[list[list[str]]]]:
        """Return (ocr_lines, tables) where each table is a list of rows,
        each row a list of cell texts.  This gives the report parser
        structured table data instead of relying solely on line-based OCR.

        Uses ``prebuilt-layout`` model which supports table extraction,
        unlike ``prebuilt-read`` which only returns text lines.
        """
        prepared = _prepare_image_for_ocr(image_bytes)
        result = self._run_analysis(
            prepared, image_bytes, subject_token,
            model_override="prebuilt-layout",
        )

        # --- lines (same as read_lines) ---
        lines: list[OCRLine] = []
        for page_idx, page in enumerate(getattr(result, "pages", []) or [], start=1):
            page_confidence = _page_word_confidence(page)
            for line in getattr(page, "lines", []) or []:
                line_text = (getattr(line, "content", "") or "").strip()
                if not line_text:
                    continue
                lines.append(
                    OCRLine(
                        text=line_text,
                        bbox=_polygon_to_bbox(getattr(line, "polygon", None)),
                        page=page_idx,
                        confidence=page_confidence,
                    )
                )

        # --- tables ---
        tables: list[list[list[str]]] = []
        for table in getattr(result, "tables", []) or []:
            row_count = getattr(table, "row_count", 0) or 0
            col_count = getattr(table, "column_count", 0) or 0
            if row_count < 1 or col_count < 1:
                continue
            grid: list[list[str]] = [[""] * col_count for _ in range(row_count)]
            for cell in getattr(table, "cells", []) or []:
                r = getattr(cell, "row_index", 0) or 0
                c = getattr(cell, "column_index", 0) or 0
                content = (getattr(cell, "content", "") or "").strip()
                if 0 <= r < row_count and 0 <= c < col_count:
                    grid[r][c] = content
            tables.append(grid)

        logger.debug("azure_read_done lines=%d tables=%d", len(lines), len(tables))
        return lines, tables

    def _run_analysis(
        self,
        prepared: bytes,
        original: bytes,
        subject_token: str | None,
        *,
        model_override: str | None = None,
    ):
        """Run Azure analysis with retry on content-length error."""
        try:
            poller = self._begin_analyze(prepared, subject_token=subject_token, model_override=model_override)
            return poller.result(timeout=settings.AZURE_OCR_TIMEOUT_SECONDS)
        except HttpResponseError as exc:
            if _is_invalid_content_length(exc):
                logger.warning("azure_read_invalid_content_length_retry smaller_preprocess")
                smaller = _prepare_image_for_ocr(
                    original,
                    max_dimension=max(1400, settings.OCR_MAX_IMAGE_DIMENSION // 2),
                    max_bytes=max(700_000, settings.OCR_MAX_IMAGE_BYTES // 2),
                    start_quality=max(60, settings.OCR_JPEG_QUALITY - 20),
                )
                poller = self._begin_analyze(smaller, subject_token=subject_token, model_override=model_override)
                return poller.result(timeout=settings.AZURE_OCR_TIMEOUT_SECONDS)
            else:
                raise

    def _begin_analyze(
        self,
        image_bytes: bytes,
        *,
        subject_token: str | None = None,
        model_override: str | None = None,
    ):
        model_id = model_override or self._model_id
        request_headers = {"x-ms-client-request-id": _safe_request_id(subject_token)}
        # Different SDK versions accept either `body` or `analyze_request`.
        try:
            return self._client.begin_analyze_document(
                model_id=model_id,
                body=image_bytes,
                content_type="application/octet-stream",
                headers=request_headers,
            )
        except TypeError:
            try:
                return self._client.begin_analyze_document(
                    model_id=model_id,
                    analyze_request=image_bytes,
                    content_type="application/octet-stream",
                    headers=request_headers,
                )
            except TypeError:
                try:
                    return self._client.begin_analyze_document(
                        model_id=model_id,
                        body=image_bytes,
                        content_type="application/octet-stream",
                    )
                except TypeError:
                    return self._client.begin_analyze_document(
                        model_id=model_id,
                        analyze_request=image_bytes,
                        content_type="application/octet-stream",
                    )


def _polygon_to_bbox(polygon: Any) -> BBox | None:
    if not polygon:
        return None

    try:
        xs = [point.x for point in polygon]
        ys = [point.y for point in polygon]
        return BBox(x_min=min(xs), y_min=min(ys), x_max=max(xs), y_max=max(ys))
    except Exception:
        return None


def _page_word_confidence(page: Any) -> float:
    words = getattr(page, "words", None) or []
    if not words:
        return 0.65

    confidences = [float(getattr(word, "confidence", 0.65) or 0.65) for word in words]
    return round(max(0.0, min(1.0, sum(confidences) / len(confidences))), 3)


def _is_invalid_content_length(exc: HttpResponseError) -> bool:
    try:
        inner = getattr(exc, "error", None)
        inner_code = getattr(inner, "innererror", None)
        if inner_code and getattr(inner_code, "code", "") == "InvalidContentLength":
            return True
    except Exception:
        pass
    message = str(exc)
    return "InvalidContentLength" in message


def _safe_request_id(subject_token: str | None) -> str:
    token = str(subject_token or "").strip().lower()
    if not token:
        return "medora-anonymous"
    token = "".join(ch for ch in token if ch.isalnum() or ch in {"-", "_"})
    token = token[:52]
    if not token:
        return "medora-anonymous"
    return f"medora-{token}"


def _prepare_image_for_ocr(
    image_bytes: bytes,
    *,
    max_dimension: int | None = None,
    max_bytes: int | None = None,
    start_quality: int | None = None,
) -> bytes:
    max_dimension = max_dimension or settings.OCR_MAX_IMAGE_DIMENSION
    max_bytes = max_bytes or settings.OCR_MAX_IMAGE_BYTES
    start_quality = start_quality or settings.OCR_JPEG_QUALITY

    with Image.open(BytesIO(image_bytes)) as image:
        # Do NOT call exif_transpose here — the input has already been
        # transposed by normalize_input_to_image_bytes() and saved as PNG
        # (which strips EXIF).  A second transpose on certain images
        # caused an unwanted 90° rotation.
        image = image.convert("RGB")
        width, height = image.size

        # Downscale if very large.
        largest = max(width, height)
        if largest > max_dimension:
            scale = max_dimension / float(largest)
            new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        # OCR-friendly normalization.
        grayscale = ImageOps.grayscale(image)
        normalized = ImageOps.autocontrast(grayscale)
        normalized = ImageEnhance.Contrast(normalized).enhance(1.25)
        processed = normalized.convert("RGB")

    quality = int(start_quality)
    work_image = processed
    for _ in range(8):
        encoded = _encode_jpeg(work_image, quality)
        if len(encoded) <= max_bytes:
            return encoded

        if quality > 45:
            quality -= 10
            continue

        # If quality already low, shrink dimensions progressively.
        w, h = work_image.size
        work_image = work_image.resize((max(1, int(w * 0.85)), max(1, int(h * 0.85))), Image.Resampling.LANCZOS)
        quality = max(45, quality)

    return _encode_jpeg(work_image, max(40, quality))


def _encode_jpeg(image: Image.Image, quality: int) -> bytes:
    output = BytesIO()
    image.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
    return output.getvalue()
