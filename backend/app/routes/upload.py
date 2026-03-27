import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from storage3.exceptions import StorageApiError

from app.core.ai_privacy import stable_hash_token
from app.core.config import settings
from app.core.dependencies import get_db
from app.db.supabase import storage_key_role, storage_supabase
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole
from app.db.models.media_file import MediaFile
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.upload import MediaFileResponse, MediaUploadResponse, PrescriptionExtractionResponse

router = APIRouter()
logger = logging.getLogger(__name__)

supabase = storage_supabase

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15MB
BUCKET_NAME = settings.SUPABASE_STORAGE_BUCKET

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

PRESCRIPTION_EXACT_INPUT_TYPES = {
    "application/pdf",
}


def _infer_prescription_type_from_bytes(content: bytes) -> str | None:
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xFF\xD8\xFF"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if content.startswith((b"II*\x00", b"MM\x00*")):
        return "image/tiff"
    if content.startswith(b"BM"):
        return "image/bmp"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _resolve_prescription_content_type(file: UploadFile, file_content: bytes) -> str:
    normalized_type = (file.content_type or "").lower().strip()
    if normalized_type in PRESCRIPTION_EXACT_INPUT_TYPES or normalized_type.startswith("image/"):
        return normalized_type

    file_name = (file.filename or "").lower()
    if file_name.endswith(".pdf"):
        return "application/pdf"
    if file_name.endswith(".jpg") or file_name.endswith(".jpeg"):
        return "image/jpeg"
    if file_name.endswith(".png"):
        return "image/png"
    if file_name.endswith(".webp"):
        return "image/webp"
    if file_name.endswith(".gif"):
        return "image/gif"
    if file_name.endswith(".bmp"):
        return "image/bmp"
    if file_name.endswith(".tif") or file_name.endswith(".tiff"):
        return "image/tiff"
    if file_name.endswith(".heic"):
        return "image/heic"
    if file_name.endswith(".heif"):
        return "image/heif"

    inferred = _infer_prescription_type_from_bytes(file_content)
    if inferred is not None:
        return inferred

    raise HTTPException(status_code=400, detail="Prescription extraction supports image files and PDFs.")


def _sanitize_filename(name: str) -> str:
    base_name = os.path.basename(name or "file")
    allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"
    cleaned = "".join(ch if ch in allowed else "_" for ch in base_name)
    return cleaned or "file"


async def _read_file_with_limit(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total_read = 0

    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 15MB.")
        chunks.append(chunk)

    content = b"".join(chunks)
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    return content


async def _upload_to_storage(storage_path: str, content: bytes, content_type: str | None):
    def _call_upload():
        return supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type},
        )

    return await asyncio.to_thread(_call_upload)


def _raise_storage_exception(exc: StorageApiError, operation: str) -> None:
    status_code = int(exc.status) if str(exc.status).isdigit() else 400
    detail = f"Storage {operation} failed ({exc.code}): {exc.message}"
    logger.error("Supabase storage error during %s: %s", operation, exc.to_dict())
    raise HTTPException(status_code=status_code, detail=detail)


async def _remove_from_storage(storage_path: str):
    def _call_remove():
        return supabase.storage.from_(BUCKET_NAME).remove([storage_path])

    return await asyncio.to_thread(_call_remove)


def _public_url(storage_path: str) -> str:
    return supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)


async def _save_media_record(
    *,
    db: AsyncSession,
    user_id: str,
    storage_path: str,
    file_name: str,
    original_file_name: str,
    content_type: str | None,
    file_size: int,
    category: str,
    visibility: str,
    entity_type: str | None,
    entity_id: str | None,
    checksum_sha256: str,
) -> MediaFile:
    public_url = _public_url(storage_path)
    extension = file_name.split(".")[-1].lower() if "." in file_name else None

    record = MediaFile(
        id=str(uuid.uuid4()),
        owner_profile_id=user_id,
        bucket=BUCKET_NAME,
        storage_path=storage_path,
        public_url=public_url,
        file_name=file_name,
        original_file_name=original_file_name,
        content_type=content_type,
        file_extension=extension,
        file_size=file_size,
        checksum_sha256=checksum_sha256,
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        visibility=visibility,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def _sync_profile_media_field(db: AsyncSession, user_id: str, category: str, url: str):
    if category not in {"profile_photo", "profile_banner"}:
        return

    profile_result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return

    field_name = "profile_photo_url" if category == "profile_photo" else "profile_banner_url"

    if str(profile.role).endswith("DOCTOR"):
        await db.execute(
            update(DoctorProfile)
            .where(DoctorProfile.profile_id == user_id)
            .values(**{field_name: url})
        )
    else:
        await db.execute(
            update(PatientProfile)
            .where(PatientProfile.profile_id == user_id)
            .values(**{field_name: url})
        )


async def _require_user_ai_consent_for_ocr(db: AsyncSession, user_id: str) -> None:
    role_result = await db.execute(select(Profile.role).where(Profile.id == user_id))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    if role == UserRole.PATIENT:
        consent_result = await db.execute(
            select(
                PatientProfile.consent_ai,
                PatientProfile.ai_personal_context_enabled,
            ).where(PatientProfile.profile_id == user_id)
        )
        consent_row = consent_result.first()
        if consent_row is None:
            raise HTTPException(status_code=404, detail="Patient medical profile not found")
        legacy_consent = bool(consent_row[0]) if consent_row[0] is not None else False
        personal_context_enabled = legacy_consent if consent_row[1] is None else bool(consent_row[1])
        if not personal_context_enabled:
            raise HTTPException(
                status_code=403,
                detail="Document analysis requires patient AI personal-context sharing.",
            )
        return

    if role == UserRole.DOCTOR:
        ai_result = await db.execute(
            select(DoctorProfile.ai_assistance).where(DoctorProfile.profile_id == user_id)
        )
        ai_assistance = ai_result.scalar_one_or_none()
        if ai_assistance is None:
            raise HTTPException(status_code=404, detail="Doctor profile not found")
        if not ai_assistance:
            raise HTTPException(
                status_code=403,
                detail="Doctor has disabled Chorui AI assistance.",
            )
        return

    raise HTTPException(status_code=403, detail="Chorui AI extraction is not available for this account role")


async def _extract_prescription_with_ai_service(
    *,
    file_name: str,
    content: bytes,
    content_type: str,
    subject_token: str | None = None,
) -> dict:
    endpoint = settings.AI_OCR_SERVICE_URL.rstrip("/") + "/ocr/prescription"
    timeout = httpx.Timeout(
        connect=5.0,
        read=settings.AI_OCR_TIMEOUT_SECONDS,
        write=30.0,
        pool=5.0,
    )
    logger.info(
        "Calling AI OCR service endpoint=%s bytes=%d read_timeout_seconds=%s",
        endpoint,
        len(content),
        settings.AI_OCR_TIMEOUT_SECONDS,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                endpoint,
                files={"file": (file_name, content, content_type)},
                headers=(
                    {"X-Medora-Subject-Token": str(subject_token).strip()[:80]}
                    if subject_token
                    else None
                ),
            )
    except httpx.TimeoutException as exc:
        logger.exception(
            "AI OCR service timed out endpoint=%s read_timeout_seconds=%s",
            endpoint,
            settings.AI_OCR_TIMEOUT_SECONDS,
        )
        raise HTTPException(status_code=504, detail="AI OCR service timed out.") from exc
    except httpx.HTTPError as exc:
        logger.exception("AI OCR service call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI OCR service is unavailable.") from exc

    if response.status_code >= 400:
        detail = f"AI OCR service failed with status {response.status_code}."
        try:
            payload = response.json()
            if isinstance(payload, dict) and payload.get("detail"):
                detail = f"AI OCR service error: {payload['detail']}"
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail)

    try:
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("Invalid AI OCR response type.")
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="AI OCR service returned invalid JSON.") from exc

    logger.info(
        "AI OCR service response ok status=%d meds=%d raw_chars=%d",
        response.status_code,
        len(data.get("medications") or []),
        len(str(data.get("raw_text") or "")),
    )

    return data


def _calculate_prescription_confidence(medications: list[dict]) -> float:
    if not medications:
        return 0.0

    scores: list[float] = []
    for medication in medications:
        if not isinstance(medication, dict):
            continue
        value = medication.get("confidence")
        if isinstance(value, (int, float)):
            scores.append(float(value))

    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 2)


@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    """Legacy upload endpoint retained for backward compatibility."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Invalid file name")

        content_type = (file.content_type or "").lower()
        if content_type and content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

        safe_name = _sanitize_filename(file.filename)
        ext = safe_name.split(".")[-1] if "." in safe_name else "bin"
        file_name = f"legacy/{uuid.uuid4()}.{ext}"
        file_content = await _read_file_with_limit(file)

        await _upload_to_storage(file_name, file_content, file.content_type)
        public_url = _public_url(file_name)
        return {"url": public_url}
    except HTTPException:
        raise
    except StorageApiError as exc:
        _raise_storage_exception(exc, "upload")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(exc)}")


@router.post("/files", response_model=MediaUploadResponse)
async def upload_media_file(
    file: UploadFile = File(...),
    category: str = Form("general"),
    visibility: str = Form("public"),
    entity_type: str | None = Form(None),
    entity_id: str | None = Form(None),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    if storage_key_role == "anon":
        raise HTTPException(
            status_code=500,
            detail="Server storage client is using anon key. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    normalized_type = (file.content_type or "").lower()
    if normalized_type and normalized_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    safe_name = _sanitize_filename(file.filename)
    file_content = await _read_file_with_limit(file)
    checksum = hashlib.sha256(file_content).hexdigest()

    storage_path = f"users/{user.id}/{category}/{uuid.uuid4()}_{safe_name}"

    try:
        await _upload_to_storage(storage_path, file_content, file.content_type)

        record = await _save_media_record(
            db=db,
            user_id=user.id,
            storage_path=storage_path,
            file_name=safe_name,
            original_file_name=file.filename,
            content_type=file.content_type,
            file_size=len(file_content),
            category=category,
            visibility=visibility,
            entity_type=entity_type,
            entity_id=entity_id,
            checksum_sha256=checksum,
        )

        await _sync_profile_media_field(db, user.id, category, record.public_url or "")
        await db.commit()
        await db.refresh(record)

        return MediaUploadResponse(url=record.public_url, file=MediaFileResponse.model_validate(record))
    except HTTPException:
        await db.rollback()
        raise
    except StorageApiError as exc:
        await db.rollback()
        _raise_storage_exception(exc, "upload")
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Media upload failed: {str(exc)}")


@router.get("/files", response_model=list[MediaFileResponse])
async def list_media_files(
    category: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    include_deleted: bool = Query(False),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MediaFile).where(MediaFile.owner_profile_id == user.id)

    if category:
        stmt = stmt.where(MediaFile.category == category)
    if entity_type:
        stmt = stmt.where(MediaFile.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(MediaFile.entity_id == entity_id)
    if not include_deleted:
        stmt = stmt.where(MediaFile.deleted_at.is_(None))

    stmt = stmt.order_by(MediaFile.created_at.desc())

    result = await db.execute(stmt)
    files = result.scalars().all()
    return [MediaFileResponse.model_validate(item) for item in files]


@router.put("/files/{file_id}", response_model=MediaUploadResponse)
async def replace_media_file(
    file_id: str,
    file: UploadFile = File(...),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MediaFile).where(MediaFile.id == file_id, MediaFile.owner_profile_id == user.id, MediaFile.deleted_at.is_(None))
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="File not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    normalized_type = (file.content_type or "").lower()
    if normalized_type and normalized_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    safe_name = _sanitize_filename(file.filename)
    file_content = await _read_file_with_limit(file)
    checksum = hashlib.sha256(file_content).hexdigest()
    new_storage_path = f"users/{user.id}/{media.category}/{uuid.uuid4()}_{safe_name}"

    try:
        await _upload_to_storage(new_storage_path, file_content, file.content_type)
        await _remove_from_storage(media.storage_path)

        media.storage_path = new_storage_path
        media.public_url = _public_url(new_storage_path)
        media.file_name = safe_name
        media.original_file_name = file.filename
        media.file_extension = safe_name.split(".")[-1].lower() if "." in safe_name else None
        media.file_size = len(file_content)
        media.content_type = file.content_type
        media.checksum_sha256 = checksum
        media.updated_at = datetime.utcnow()

        await _sync_profile_media_field(db, user.id, media.category, media.public_url or "")
        await db.commit()
        await db.refresh(media)

        return MediaUploadResponse(url=media.public_url, file=MediaFileResponse.model_validate(media))
    except HTTPException:
        await db.rollback()
        raise
    except StorageApiError as exc:
        await db.rollback()
        _raise_storage_exception(exc, "replace")
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Media replace failed: {str(exc)}")


@router.delete("/files/{file_id}")
async def delete_media_file(
    file_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MediaFile).where(MediaFile.id == file_id, MediaFile.owner_profile_id == user.id, MediaFile.deleted_at.is_(None))
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        await _remove_from_storage(media.storage_path)
        media.deleted_at = datetime.utcnow()
        media.updated_at = datetime.utcnow()
        await db.commit()
        return {"message": "File deleted successfully"}
    except StorageApiError as exc:
        await db.rollback()
        _raise_storage_exception(exc, "delete")
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Media delete failed: {str(exc)}")


@router.post("/prescription/extract", response_model=PrescriptionExtractionResponse)
async def extract_prescription_text(
    file: UploadFile = File(...),
    save_file: bool = Form(True),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    if save_file and storage_key_role == "anon":
        raise HTTPException(
            status_code=500,
            detail="Server storage client is using anon key. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    file_content = await _read_file_with_limit(file)
    normalized_type = _resolve_prescription_content_type(file, file_content)
    file_record: MediaFile | None = None
    await _require_user_ai_consent_for_ocr(db, user.id)

    try:
        if save_file:
            safe_name = _sanitize_filename(file.filename)
            checksum = hashlib.sha256(file_content).hexdigest()
            storage_path = f"users/{user.id}/prescription_image/{uuid.uuid4()}_{safe_name}"

            await _upload_to_storage(storage_path, file_content, normalized_type)
            file_record = await _save_media_record(
                db=db,
                user_id=user.id,
                storage_path=storage_path,
                file_name=safe_name,
                original_file_name=file.filename,
                content_type=normalized_type,
                file_size=len(file_content),
                category="prescription_image",
                visibility="private",
                entity_type="medicine_extraction_demo",
                entity_id=None,
                checksum_sha256=checksum,
            )

        ai_result = await _extract_prescription_with_ai_service(
            file_name=file.filename,
            content=file_content,
            content_type=normalized_type,
            subject_token=stable_hash_token(str(user.id), namespace="ocr", length=22),
        )
        medications = ai_result.get("medications") if isinstance(ai_result.get("medications"), list) else []
        raw_text = str(ai_result.get("raw_text") or "").strip()
        meta = ai_result.get("meta") if isinstance(ai_result.get("meta"), dict) else None
        extracted_text = raw_text
        confidence = _calculate_prescription_confidence(medications)
        if confidence == 0.0 and raw_text:
            confidence = round(min(0.95, max(0.4, len(raw_text) / 1500.0)), 2)

        await db.commit()
        if file_record is not None:
            await db.refresh(file_record)

        return PrescriptionExtractionResponse(
            extracted_text=extracted_text,
            confidence=confidence,
            medications=medications,
            raw_text=raw_text,
            meta=meta,
            file=MediaFileResponse.model_validate(file_record) if file_record else None,
        )
    except HTTPException:
        await db.rollback()
        raise
    except StorageApiError as exc:
        await db.rollback()
        _raise_storage_exception(exc, "upload")
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Prescription extraction failed: {str(exc)}")
