"""
Medical Report endpoints.

Upload medical test reports, OCR-extract lab data, view results, doctor comments,
patient-side inline editing of results, and per-report / per-doctor visibility.
"""

import asyncio
import hashlib
import logging
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from storage3.exceptions import StorageApiError

from app.core.ai_privacy import stable_hash_token
from app.core.config import settings
from app.core.dependencies import get_db, require_doctor
from app.db.models.medical_report import (
    DoctorReportComment,
    MedicalReport,
    MedicalReportDoctorAccess,
    MedicalReportResult,
)
from app.db.models.medical_test import MedicalTest
from app.db.models.patient_data_sharing import PatientDataSharingPreference
from app.db.models.profile import Profile
from app.db.supabase import storage_key_role, storage_supabase
from app.routes.auth import get_current_user_token
from app.schemas.medical_report import (
    DoctorCommentCreate,
    DoctorCommentResponse,
    MedicalReportListItem,
    MedicalReportResponse,
    MedicalReportUploadResponse,
    ReportDoctorAccessItem,
    ReportDoctorAccessUpdate,
    ReportResultCreate,
    ReportResultUpdate,
    ReportTestResultResponse,
    ReportVisibilityResponse,
    ReportVisibilityUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)

supabase = storage_supabase
BUCKET_NAME = settings.SUPABASE_STORAGE_BUCKET
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

ALLOWED_REPORT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf",
}


# ── helpers ──────────────────────────────────────────────────────────────────


def _sanitize_filename(name: str) -> str:
    import os
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
    def _call():
        return supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type},
        )
    return await asyncio.to_thread(_call)


def _public_url(storage_path: str) -> str:
    return supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)


async def _call_report_ocr(file_name: str, content: bytes, content_type: str, subject_token: str | None) -> dict:
    """Call AI OCR service for medical report extraction."""
    endpoint = settings.AI_OCR_SERVICE_URL.rstrip("/") + "/ocr/medical-report"
    timeout = httpx.Timeout(connect=5.0, read=settings.AI_OCR_TIMEOUT_SECONDS, write=30.0, pool=5.0)

    logger.info("Calling AI report OCR endpoint=%s bytes=%d", endpoint, len(content))

    retries = 2
    last_exc = None
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    endpoint,
                    files={"file": (file_name, content, content_type)},
                    headers=(
                        {"X-Medora-Subject-Token": str(subject_token).strip()[:80]}
                        if subject_token else None
                    ),
                )
            break
        except httpx.TimeoutException as exc:
            last_exc = exc
            logger.warning("Report OCR timeout attempt=%d/%d", attempt + 1, retries)
            if attempt == retries - 1:
                raise HTTPException(status_code=504, detail="AI OCR service timed out.") from exc
        except httpx.HTTPError as exc:
            last_exc = exc
            logger.warning("Report OCR HTTP error attempt=%d/%d: %s", attempt + 1, retries, exc)
            if attempt == retries - 1:
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
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="AI OCR returned invalid JSON.") from exc

    logger.info("Report OCR response: tests=%d", len(data.get("tests") or []))
    return data


async def _match_test_ids(db: AsyncSession, test_names: list[str]) -> dict[str, int]:
    """Try to match extracted test names to medicaltest table."""
    if not test_names:
        return {}

    normalized = [n.lower().strip() for n in test_names]
    result = await db.execute(
        select(MedicalTest).where(
            func.lower(MedicalTest.normalized_name).in_(normalized),
            MedicalTest.is_active == True,
        )
    )
    tests = result.scalars().all()
    return {t.normalized_name.lower(): t.id for t in tests}


async def _require_report_owner(report: MedicalReport, user_id: str):
    """Raise 403 if the current user is not the report's patient."""
    if report.patient_id != user_id:
        raise HTTPException(status_code=403, detail="Only the patient who owns this report can perform this action")


async def _can_doctor_see_report(db: AsyncSession, report: MedicalReport, doctor_id: str) -> bool:
    """Check if a doctor is allowed to see this specific report.

    Logic:
    1. If a per-report doctor-access override exists → use it.
    2. If the report-level can_view_reports sharing pref is True → check report.shared_with_doctors.
    3. Otherwise → denied.
    """
    # Per-report override takes highest priority
    override = (
        await db.execute(
            select(MedicalReportDoctorAccess).where(
                MedicalReportDoctorAccess.report_id == report.id,
                MedicalReportDoctorAccess.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()
    if override:
        return override.can_view

    # Check category-level sharing preference (can_view_reports)
    pref = (
        await db.execute(
            select(PatientDataSharingPreference).where(
                PatientDataSharingPreference.patient_id == report.patient_id,
                PatientDataSharingPreference.doctor_id == doctor_id,
            )
        )
    ).scalar_one_or_none()

    if not pref or not pref.can_view_reports:
        return False

    # Category access is granted — now check the report-level flag
    return report.shared_with_doctors


# ── Upload ───────────────────────────────────────────────────────────────────


@router.post("/upload", response_model=MedicalReportUploadResponse)
async def upload_medical_report(
    file: UploadFile = File(...),
    report_date: str | None = Form(None),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Upload a medical test report for OCR extraction."""
    if storage_key_role == "anon":
        raise HTTPException(status_code=500, detail="Storage requires service role key.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    normalized_type = (file.content_type or "").lower()
    if normalized_type and normalized_type not in ALLOWED_REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_content = await _read_file_with_limit(file)
    safe_name = _sanitize_filename(file.filename)
    storage_path = f"users/{user.id}/medical_report/{uuid.uuid4()}_{safe_name}"

    # Parse report_date
    parsed_report_date = None
    if report_date:
        try:
            parsed_report_date = datetime.fromisoformat(report_date)
        except ValueError:
            pass

    report_id = str(uuid.uuid4())

    try:
        # 1. Upload file to storage
        await _upload_to_storage(storage_path, file_content, file.content_type)
        file_url = _public_url(storage_path)

        # 2. Create report record (unparsed initially)
        report = MedicalReport(
            id=report_id,
            patient_id=user.id,
            uploaded_by=user.id,
            file_url=file_url,
            file_name=safe_name,
            report_date=parsed_report_date,
            parsed=False,
        )
        db.add(report)
        await db.flush()

        # 3. Call AI OCR service
        subject_token = stable_hash_token(str(user.id), namespace="report_ocr", length=22)
        ocr_result = await _call_report_ocr(
            file_name=file.filename,
            content=file_content,
            content_type=normalized_type or "application/octet-stream",
            subject_token=subject_token,
        )

        tests = ocr_result.get("tests") or []
        raw_text = str(ocr_result.get("raw_text") or "")
        meta = ocr_result.get("meta") or {}

        # 4. Match test names to database
        test_names = [t.get("test_name", "") for t in tests if isinstance(t, dict)]
        name_to_id = await _match_test_ids(db, test_names)

        # 5. Store parsed results
        for t in tests:
            if not isinstance(t, dict):
                continue
            test_name = t.get("test_name", "Unknown")
            matched_id = name_to_id.get(test_name.lower().strip())

            result_record = MedicalReportResult(
                id=str(uuid.uuid4()),
                report_id=report_id,
                test_id=matched_id,
                test_name=test_name,
                value=t.get("value"),
                value_text=t.get("value_text"),
                unit=t.get("unit"),
                status=t.get("status"),
                reference_range_min=t.get("reference_range_min"),
                reference_range_max=t.get("reference_range_max"),
                reference_range_text=t.get("reference_range_text"),
                confidence=t.get("confidence"),
                is_manually_edited=False,
            )
            db.add(result_record)

        # 6. Update report as parsed
        report.parsed = bool(tests)
        report.raw_ocr_text = raw_text[:50000] if raw_text else None
        report.ocr_engine = meta.get("ocr_engine", "unknown")
        report.processing_time_ms = meta.get("processing_time_ms")

        await db.commit()
        await db.refresh(report)

        # Load relationships
        report_with_rels = await db.execute(
            select(MedicalReport)
            .options(selectinload(MedicalReport.results), selectinload(MedicalReport.comments))
            .where(MedicalReport.id == report_id)
        )
        report = report_with_rels.scalar_one()

        return MedicalReportUploadResponse(
            report=MedicalReportResponse.model_validate(report),
            file_url=file_url,
        )

    except HTTPException:
        await db.rollback()
        raise
    except StorageApiError as exc:
        await db.rollback()
        status_code = int(exc.status) if str(exc.status).isdigit() else 400
        raise HTTPException(status_code=status_code, detail=f"Storage error: {exc.message}")
    except Exception as exc:
        await db.rollback()
        logger.exception("Medical report upload failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


# ── List reports ─────────────────────────────────────────────────────────────


@router.get("", response_model=list[MedicalReportListItem])
async def list_medical_reports(
    patient_id: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """List medical reports. Patients see their own; doctors see only shared ones."""
    # Determine target patient
    target_patient = patient_id or user.id
    is_doctor_query = target_patient != user.id

    # Check permission: if querying another patient, must be a doctor
    if is_doctor_query:
        profile_result = await db.execute(select(Profile).where(Profile.id == user.id))
        profile = profile_result.scalar_one_or_none()
        if not profile or str(profile.role.value) != "doctor":
            raise HTTPException(status_code=403, detail="Only doctors can view other patients' reports")

    stmt = (
        select(MedicalReport)
        .options(selectinload(MedicalReport.results), selectinload(MedicalReport.comments))
        .where(MedicalReport.patient_id == target_patient)
        .order_by(MedicalReport.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    reports = result.scalars().all()

    # If doctor is querying, filter to only reports they're allowed to see
    if is_doctor_query:
        visible_reports = []
        for r in reports:
            if await _can_doctor_see_report(db, r, user.id):
                visible_reports.append(r)
        reports = visible_reports

    items = []
    for r in reports:
        # Build summary from first few test results
        summary_parts = []
        for res in (r.results or [])[:3]:
            status_icon = {"normal": "Normal", "high": "High", "low": "Low"}.get(res.status or "", "")
            summary_parts.append(f"{res.test_name}: {res.value_text or res.value or '?'} {status_icon}".strip())
        summary = "; ".join(summary_parts) if summary_parts else None

        items.append(MedicalReportListItem(
            id=r.id,
            patient_id=r.patient_id,
            file_url=r.file_url,
            file_name=r.file_name,
            report_date=r.report_date,
            parsed=r.parsed,
            shared_with_doctors=r.shared_with_doctors,
            created_at=r.created_at,
            result_count=len(r.results or []),
            comment_count=len(r.comments or []),
            summary=summary,
        ))

    return items


# ── Get single report ────────────────────────────────────────────────────────


@router.get("/{report_id}", response_model=MedicalReportResponse)
async def get_medical_report(
    report_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get full report details with test results and comments."""
    stmt = (
        select(MedicalReport)
        .options(selectinload(MedicalReport.results), selectinload(MedicalReport.comments))
        .where(MedicalReport.id == report_id)
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check permission
    if report.patient_id != user.id:
        profile_result = await db.execute(select(Profile).where(Profile.id == user.id))
        profile = profile_result.scalar_one_or_none()
        if not profile or str(profile.role.value) != "doctor":
            raise HTTPException(status_code=403, detail="Access denied")
        # Doctor: check sharing preferences
        if not await _can_doctor_see_report(db, report, user.id):
            raise HTTPException(
                status_code=403,
                detail="This patient has not shared this report with you",
            )

    # Enrich comments with doctor names
    response = MedicalReportResponse.model_validate(report)
    if report.comments:
        doctor_ids = [c.doctor_id for c in report.comments]
        profiles_result = await db.execute(
            select(Profile).where(Profile.id.in_(doctor_ids))
        )
        profiles_map = {p.id: p for p in profiles_result.scalars().all()}

        enriched_comments = []
        for c in report.comments:
            doc_profile = profiles_map.get(c.doctor_id)
            doctor_name = None
            if doc_profile:
                first = getattr(doc_profile, "first_name", "") or ""
                last = getattr(doc_profile, "last_name", "") or ""
                doctor_name = f"{first} {last}".strip() or None

            enriched_comments.append(DoctorCommentResponse(
                id=c.id,
                report_id=c.report_id,
                doctor_id=c.doctor_id,
                doctor_name=doctor_name,
                comment=c.comment,
                created_at=c.created_at,
                updated_at=c.updated_at,
            ))
        response.comments = enriched_comments

    return response


# ── Doctor comment ───────────────────────────────────────────────────────────


@router.post("/{report_id}/comment", response_model=DoctorCommentResponse)
async def add_report_comment(
    report_id: str,
    body: DoctorCommentCreate,
    user: any = Depends(require_doctor),
    db: AsyncSession = Depends(get_db),
):
    """Doctor adds a comment/note on a medical report."""
    # Verify report exists
    report_result = await db.execute(
        select(MedicalReport).where(MedicalReport.id == report_id)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Doctor must have access to this report
    if not await _can_doctor_see_report(db, report, user.id):
        raise HTTPException(status_code=403, detail="This patient has not shared this report with you")

    comment = DoctorReportComment(
        id=str(uuid.uuid4()),
        report_id=report_id,
        doctor_id=user.id,
        comment=body.comment,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    # Get doctor name
    doc_profile = await db.execute(select(Profile).where(Profile.id == user.id))
    doc = doc_profile.scalar_one_or_none()
    doctor_name = None
    if doc:
        first = getattr(doc, "first_name", "") or ""
        last = getattr(doc, "last_name", "") or ""
        doctor_name = f"{first} {last}".strip() or None

    return DoctorCommentResponse(
        id=comment.id,
        report_id=comment.report_id,
        doctor_id=comment.doctor_id,
        doctor_name=doctor_name,
        comment=comment.comment,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


# ── Patient: edit a test result ──────────────────────────────────────────────


@router.patch("/{report_id}/results/{result_id}", response_model=ReportTestResultResponse)
async def update_report_result(
    report_id: str,
    result_id: str,
    body: ReportResultUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient manually edits an OCR-extracted (or manually-added) test result."""
    report = (
        await db.execute(select(MedicalReport).where(MedicalReport.id == report_id))
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    result_row = (
        await db.execute(
            select(MedicalReportResult).where(
                MedicalReportResult.id == result_id,
                MedicalReportResult.report_id == report_id,
            )
        )
    ).scalar_one_or_none()
    if not result_row:
        raise HTTPException(status_code=404, detail="Result not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(result_row, field, value)
    result_row.is_manually_edited = True

    await db.commit()
    await db.refresh(result_row)
    return ReportTestResultResponse.model_validate(result_row)


# ── Patient: add a new test result row manually ──────────────────────────────


@router.post("/{report_id}/results", response_model=ReportTestResultResponse)
async def add_report_result(
    report_id: str,
    body: ReportResultCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient manually adds a test result row to a report."""
    report = (
        await db.execute(select(MedicalReport).where(MedicalReport.id == report_id))
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    # Try to match the test name
    name_to_id = await _match_test_ids(db, [body.test_name])
    matched_id = name_to_id.get(body.test_name.lower().strip())

    new_result = MedicalReportResult(
        id=str(uuid.uuid4()),
        report_id=report_id,
        test_id=matched_id,
        test_name=body.test_name,
        value=body.value,
        value_text=body.value_text,
        unit=body.unit,
        status=body.status,
        reference_range_min=body.reference_range_min,
        reference_range_max=body.reference_range_max,
        reference_range_text=body.reference_range_text,
        confidence=None,
        is_manually_edited=True,
    )
    db.add(new_result)
    await db.commit()
    await db.refresh(new_result)
    return ReportTestResultResponse.model_validate(new_result)


# ── Patient: delete a test result row ────────────────────────────────────────


@router.delete("/{report_id}/results/{result_id}", status_code=204)
async def delete_report_result(
    report_id: str,
    result_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient deletes a test result row from a report."""
    report = (
        await db.execute(select(MedicalReport).where(MedicalReport.id == report_id))
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    result_row = (
        await db.execute(
            select(MedicalReportResult).where(
                MedicalReportResult.id == result_id,
                MedicalReportResult.report_id == report_id,
            )
        )
    ).scalar_one_or_none()
    if not result_row:
        raise HTTPException(status_code=404, detail="Result not found")

    await db.delete(result_row)
    await db.commit()


# ── Report visibility ────────────────────────────────────────────────────────


@router.get("/{report_id}/visibility", response_model=ReportVisibilityResponse)
async def get_report_visibility(
    report_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get visibility settings for a report (patient only)."""
    report = (
        await db.execute(
            select(MedicalReport)
            .options(selectinload(MedicalReport.doctor_access))
            .where(MedicalReport.id == report_id)
        )
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    overrides = [
        ReportDoctorAccessItem(doctor_id=a.doctor_id, can_view=a.can_view)
        for a in (report.doctor_access or [])
    ]
    return ReportVisibilityResponse(
        report_id=report.id,
        shared_with_doctors=report.shared_with_doctors,
        doctor_overrides=overrides,
    )


@router.patch("/{report_id}/visibility", response_model=ReportVisibilityResponse)
async def update_report_visibility(
    report_id: str,
    body: ReportVisibilityUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the shared_with_doctors flag on a report (patient only)."""
    report = (
        await db.execute(
            select(MedicalReport)
            .options(selectinload(MedicalReport.doctor_access))
            .where(MedicalReport.id == report_id)
        )
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    report.shared_with_doctors = body.shared_with_doctors
    await db.commit()
    await db.refresh(report)

    overrides = [
        ReportDoctorAccessItem(doctor_id=a.doctor_id, can_view=a.can_view)
        for a in (report.doctor_access or [])
    ]
    return ReportVisibilityResponse(
        report_id=report.id,
        shared_with_doctors=report.shared_with_doctors,
        doctor_overrides=overrides,
    )


@router.put("/{report_id}/visibility/doctors", response_model=ReportVisibilityResponse)
async def set_report_doctor_overrides(
    report_id: str,
    body: ReportDoctorAccessUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Set per-doctor visibility overrides for a report (patient only).
    Replaces all existing overrides with the provided list."""
    report = (
        await db.execute(
            select(MedicalReport)
            .options(selectinload(MedicalReport.doctor_access))
            .where(MedicalReport.id == report_id)
        )
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await _require_report_owner(report, user.id)

    # Delete existing overrides
    for existing in list(report.doctor_access or []):
        await db.delete(existing)
    await db.flush()

    # Insert new overrides
    for item in body.overrides:
        access = MedicalReportDoctorAccess(
            id=str(uuid.uuid4()),
            report_id=report_id,
            doctor_id=item.doctor_id,
            can_view=item.can_view,
        )
        db.add(access)

    await db.commit()

    # Reload
    report = (
        await db.execute(
            select(MedicalReport)
            .options(selectinload(MedicalReport.doctor_access))
            .where(MedicalReport.id == report_id)
        )
    ).scalar_one()

    overrides = [
        ReportDoctorAccessItem(doctor_id=a.doctor_id, can_view=a.can_view)
        for a in (report.doctor_access or [])
    ]
    return ReportVisibilityResponse(
        report_id=report.id,
        shared_with_doctors=report.shared_with_doctors,
        doctor_overrides=overrides,
    )
