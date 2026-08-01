from __future__ import annotations

import asyncio
import base64
import logging
import time
import uuid
from typing import Annotated

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile

from app.config import settings
from app.input_normalization import normalize_input_to_image_bytes
from app.pipeline import OCRPipeline
from app.report_parser import parse_medical_report
from app.report_schemas import ReportOCRRequest, ReportOCRResponse, ReportOCRMeta
from app.schemas import OCRLine, OCRRequest, OCRResponse

app = FastAPI(title=settings.APP_NAME)
pipeline = OCRPipeline()
logger = logging.getLogger(__name__)

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "model_type": settings.MODEL_TYPE,
        "disable_medicine_matching": settings.DISABLE_MEDICINE_MATCHING,
        "yolo_model_path": settings.YOLO_MODEL_PATH,
    }


@app.post("/ocr/prescription", response_model=OCRResponse)
async def process_prescription(
    request: Request,
    file: Annotated[UploadFile | None, File()] = None,
    image_url: Annotated[str | None, Form()] = None,
    debug: Annotated[bool, Query(description="Return detector + OCR internals for debugging.")] = False,
    processing_mode: Annotated[str, Form()] = "cloud",
    request_id_header: Annotated[str | None, Header(alias="X-Request-ID")] = None,
) -> OCRResponse:
    request_id = (request_id_header or uuid.uuid4().hex)[:40]
    started = time.perf_counter()
    logger.debug("ocr_request_start request_id=%s debug=%s", request_id, debug)

    payload = await _extract_json_payload(request, schema_cls=OCRRequest)
    image_bytes = await _resolve_image_bytes(file=file, image_url=image_url, payload=payload)
    logger.debug(
        "ocr_request_input request_id=%s bytes=%d processing_mode=%s",
        request_id,
        len(image_bytes),
        processing_mode,
    )

    try:
        response = await asyncio.to_thread(pipeline.run, image_bytes, debug, request_id, processing_mode)
    except Exception:
        logger.exception("ocr_request_error request_id=%s", request_id)
        raise

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.debug(
        "ocr_request_done request_id=%s elapsed_ms=%d meds=%d lines=%d",
        request_id,
        elapsed_ms,
        len(response.medications),
        response.meta.ocr_line_count,
    )
    return response


@app.post("/ocr/medical-report", response_model=ReportOCRResponse)
async def process_medical_report(
    request: Request,
    file: Annotated[UploadFile | None, File()] = None,
    image_url: Annotated[str | None, Form()] = None,
    processing_mode: Annotated[str, Form()] = "cloud",
    request_id_header: Annotated[str | None, Header(alias="X-Request-ID")] = None,
) -> ReportOCRResponse:
    """Extract structured lab test results from a medical report image/PDF."""
    request_id = (request_id_header or uuid.uuid4().hex)[:40]
    started = time.perf_counter()
    logger.info("report_ocr_start request_id=%s", request_id)

    payload = await _extract_json_payload(request, schema_cls=ReportOCRRequest)
    processing_mode = processing_mode.lower().strip()
    if processing_mode not in {"local", "cloud"}:
        raise HTTPException(status_code=422, detail="processing_mode must be 'local' or 'cloud'")
    image_bytes = await _resolve_image_bytes(file=file, image_url=image_url, payload=payload)

    ocr_engine = "azure"
    ocr_lines: list[OCRLine] = []
    azure_tables: list[list[list[str]]] = []

    # Local mode is a strict boundary: it never falls forward to Azure.
    if processing_mode == "local":
        try:
            from app.local_ocr import paddleocr_extract_lines
            ocr_lines = await asyncio.to_thread(paddleocr_extract_lines, image_bytes)
            ocr_engine = "paddleocr"
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Local OCR extraction failed: {exc}") from exc
    else:
        try:
            from app.azure_ocr import AzureReadClient
            azure_client = AzureReadClient()

            def _azure_report_ocr():
                return azure_client.read_lines_and_tables(image_bytes, subject_token=request_id)

            ocr_lines, azure_tables = await asyncio.to_thread(_azure_report_ocr)
            logger.info(
                "report_ocr azure_lines=%d azure_tables=%d request_id=%s",
                len(ocr_lines), len(azure_tables), request_id,
            )
        except Exception as exc:
            logger.warning("report_ocr azure_failed request_id=%s error=%s", request_id, exc)
            # Cloud mode may fall back to the strictly local engine.
            try:
                from app.local_ocr import paddleocr_extract_lines
                ocr_lines = await asyncio.to_thread(paddleocr_extract_lines, image_bytes)
                ocr_engine = "paddleocr"
                logger.info("report_ocr paddleocr_lines=%d request_id=%s", len(ocr_lines), request_id)
            except Exception as paddle_exc:
                logger.exception("report_ocr paddleocr_also_failed request_id=%s", request_id)
                raise HTTPException(
                    status_code=502,
                    detail=f"OCR extraction failed: Azure={exc}, PaddleOCR={paddle_exc}",
                ) from paddle_exc

    # Parse structured results from OCR lines + table data
    tests = parse_medical_report(ocr_lines, tables=azure_tables or None)
    raw_text = "\n".join(line.text for line in ocr_lines)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "report_ocr_done request_id=%s elapsed_ms=%d tests=%d lines=%d engine=%s",
        request_id, elapsed_ms, len(tests), len(ocr_lines), ocr_engine,
    )

    return ReportOCRResponse(
        tests=tests,
        raw_text=raw_text,
        meta=ReportOCRMeta(
            model="prebuilt-layout" if ocr_engine == "azure" else "pp-ocrv4",
            processing_time_ms=elapsed_ms,
            ocr_engine=ocr_engine,
            line_count=len(ocr_lines),
            tests_extracted=len(tests),
            processing_mode=processing_mode,
            provider="paddleocr_local" if ocr_engine == "paddleocr" else "azure_document_intelligence",
            review_required=True,
            authoritative_writeback=False,
        ),
    )


async def _extract_json_payload(request: Request, *, schema_cls=None) -> OCRRequest | None:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return None

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from exc

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON body must be an object.")
    cls = schema_cls or OCRRequest
    return cls.model_validate(body)


async def _resolve_image_bytes(
    *,
    file: UploadFile | None,
    image_url: str | None,
    payload: OCRRequest | None,
) -> bytes:
    if file is not None:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        _enforce_input_size_limit(content)
        return _normalize_or_raise(content)

    resolved_url = image_url or (payload.image_url if payload else None)
    if resolved_url:
        downloaded = await _download_image(resolved_url)
        _enforce_input_size_limit(downloaded)
        return _normalize_or_raise(downloaded)

    encoded_file = payload.image_file if payload else None
    if encoded_file:
        decoded = _decode_base64_image(encoded_file)
        _enforce_input_size_limit(decoded)
        return _normalize_or_raise(decoded)

    raise HTTPException(
        status_code=400,
        detail="Provide `file`, or `image_url`, or base64 `image_file`.",
    )


async def _download_image(image_url: str) -> bytes:
    try:
        timeout = httpx.Timeout(settings.AZURE_OCR_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            if not response.content:
                raise HTTPException(status_code=400, detail="Downloaded image is empty.")
            return response.content
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image_url: {exc}") from exc


def _decode_base64_image(encoded: str) -> bytes:
    try:
        if "," in encoded:
            encoded = encoded.split(",", 1)[1]
        data = base64.b64decode(encoded, validate=True)
        if not data:
            raise ValueError("Decoded image is empty.")
        return data
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image_file: {exc}") from exc


def _enforce_input_size_limit(content: bytes) -> None:
    max_bytes = int(settings.OCR_MAX_UPLOAD_BYTES)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Input is too large. Maximum size is {max_bytes} bytes.")


def _normalize_or_raise(content: bytes) -> bytes:
    try:
        return normalize_input_to_image_bytes(content)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
