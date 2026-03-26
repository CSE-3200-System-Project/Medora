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
from app.schemas import OCRRequest, OCRResponse

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
    subject_token_header: Annotated[str | None, Header(alias="X-Medora-Subject-Token")] = None,
) -> OCRResponse:
    request_id = uuid.uuid4().hex[:10]
    started = time.perf_counter()
    logger.debug("ocr_request_start request_id=%s debug=%s", request_id, debug)

    payload = await _extract_json_payload(request)
    subject_token = (
        (subject_token_header or "").strip()
        or str(getattr(payload, "subject_token", "") or "").strip()
        or "anonymous_subject"
    )[:80]
    image_bytes = await _resolve_image_bytes(file=file, image_url=image_url, payload=payload)
    logger.debug(
        "ocr_request_input request_id=%s bytes=%d subject_token=%s",
        request_id,
        len(image_bytes),
        subject_token,
    )

    try:
        response = await asyncio.to_thread(pipeline.run, image_bytes, debug, subject_token)
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


async def _extract_json_payload(request: Request) -> OCRRequest | None:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return None

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from exc

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON body must be an object.")
    return OCRRequest.model_validate(body)


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
