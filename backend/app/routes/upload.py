import asyncio
import base64
import hashlib
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from groq import Groq
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client, create_client

from app.core.config import settings
from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.media_file import MediaFile
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.upload import MediaFileResponse, MediaUploadResponse, PrescriptionExtractionResponse

router = APIRouter()

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
groq_client = Groq(api_key=settings.GROQ_API_KEY)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15MB
BUCKET_NAME = "medora-storage"

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

PRESCRIPTION_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


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


def _extract_prescription_text_with_llm(content: bytes, content_type: str) -> str:
    data_url = f"data:{content_type};base64,{base64.b64encode(content).decode('utf-8')}"

    response = groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an OCR extraction assistant for medical prescription images. "
                    "Extract only visible text with best possible formatting. "
                    "Do not add diagnosis, treatment advice, or missing content."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract all readable text from this prescription image. "
                            "Preserve line breaks. Include medicine names, dosage, frequency, "
                            "dates, doctor details, and instructions if present."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                ],
            },
        ],
    )

    extracted = (response.choices[0].message.content or "").strip()
    if not extracted:
        raise ValueError("No text extracted from image.")
    return extracted


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
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    normalized_type = (file.content_type or "").lower()
    if normalized_type not in PRESCRIPTION_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Prescription extraction currently supports JPG, PNG, and WEBP images.")

    file_content = await _read_file_with_limit(file)
    file_record: MediaFile | None = None

    try:
        if save_file:
            safe_name = _sanitize_filename(file.filename)
            checksum = hashlib.sha256(file_content).hexdigest()
            storage_path = f"users/{user.id}/prescription_image/{uuid.uuid4()}_{safe_name}"

            await _upload_to_storage(storage_path, file_content, file.content_type)
            file_record = await _save_media_record(
                db=db,
                user_id=user.id,
                storage_path=storage_path,
                file_name=safe_name,
                original_file_name=file.filename,
                content_type=file.content_type,
                file_size=len(file_content),
                category="prescription_image",
                visibility="private",
                entity_type="medicine_extraction_demo",
                entity_id=None,
                checksum_sha256=checksum,
            )

        extracted_text = await asyncio.to_thread(_extract_prescription_text_with_llm, file_content, normalized_type)
        confidence = min(0.99, max(0.55, len(extracted_text) / 2000.0))

        await db.commit()
        if file_record is not None:
            await db.refresh(file_record)

        return PrescriptionExtractionResponse(
            extracted_text=extracted_text,
            confidence=round(confidence, 2),
            file=MediaFileResponse.model_validate(file_record) if file_record else None,
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Prescription extraction failed: {str(exc)}")
