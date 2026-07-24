"""
Medical Test routes for search and detail endpoints.
Provides autocomplete/search for lab tests.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.core.dependencies import get_db
from app.db.models.medical_test import MedicalTest
from app.db.models.patient import PatientProfile
from app.routes.auth import get_current_user_token
from app.schemas.medical_test import (
    MedicalTestResult,
    MedicalTestSearchResponse,
    MedicalTestListResponse,
    MedicalTestDetailResponse,
    PatientMedicalTestPatchRequest,
    PatientMedicalTestPatchResponse,
)

router = APIRouter()


def _normalize_test_value(value: str | None) -> str:
    return (value or "").strip().lower()


@router.get("/search", response_model=MedicalTestSearchResponse)
async def search_medical_tests(
    q: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: AsyncSession = Depends(get_db)
):
    """Search medical tests by name with pagination."""
    search_term = q.strip().lower()

    where_clause = (
        MedicalTest.is_active == True,
        MedicalTest.normalized_name.ilike(f"%{search_term}%"),
    )
    total = (await db.execute(select(func.count(MedicalTest.id)).where(*where_clause))).scalar() or 0

    stmt = (
        select(MedicalTest)
        .where(*where_clause)
        .order_by(
            (MedicalTest.normalized_name == search_term).desc(),
            MedicalTest.normalized_name.ilike(f"{search_term}%").desc(),
            MedicalTest.display_name.asc()
        )
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()

    results: List[MedicalTestResult] = [
        MedicalTestResult(id=row.id, display_name=row.display_name, normalized_name=row.normalized_name)
        for row in rows
    ]

    return MedicalTestSearchResponse(
        results=results,
        items=results,
        total=total,
        query=q,
        limit=limit,
        offset=offset,
        has_more=offset + len(results) < total,
        page=(offset // limit) + 1 if limit > 0 else 1,
        page_size=limit,
    )


@router.get("/all", response_model=MedicalTestListResponse)
async def get_all_medical_tests(
    limit: int = Query(100, ge=1, le=2000, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db)
):
    """Get all active medical tests with pagination and total count."""
    where_clause = (MedicalTest.is_active == True,)
    total = (await db.execute(select(func.count(MedicalTest.id)).where(*where_clause))).scalar() or 0

    stmt = (
        select(MedicalTest)
        .where(*where_clause)
        .order_by(MedicalTest.display_name.asc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()

    test_list = [
        MedicalTestResult(id=row.id, display_name=row.display_name, normalized_name=row.normalized_name)
        for row in rows
    ]

    return MedicalTestListResponse(
        results=test_list,
        items=test_list,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(test_list) < total,
        page=(offset // limit) + 1 if limit > 0 else 1,
        page_size=limit,
    )


@router.get("/count")
async def get_medical_test_count(
    db: AsyncSession = Depends(get_db)
):
    """
    Get total count of active medical tests.
    """
    stmt = select(func.count(MedicalTest.id)).where(MedicalTest.is_active == True)
    result = await db.execute(stmt)
    count = result.scalar() or 0
    
    return {"total": count}


@router.get("/{test_id}", response_model=MedicalTestDetailResponse)
async def get_medical_test_detail(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific medical test.
    """
    stmt = select(MedicalTest).where(MedicalTest.id == test_id)
    result = await db.execute(stmt)
    test = result.scalar_one_or_none()
    
    if not test:
        raise HTTPException(status_code=404, detail="Medical test not found")
    
    return MedicalTestDetailResponse(
        id=test.id,
        display_name=test.display_name,
        normalized_name=test.normalized_name,
        is_active=test.is_active,
        created_at=test.created_at,
    )


@router.patch("/patient/tests", response_model=PatientMedicalTestPatchResponse)
async def patch_patient_medical_test(
    payload: PatientMedicalTestPatchRequest,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Upsert a patient's medical test lifecycle using the existing patient_profiles.medical_tests JSON field.
    Completion state is derived by result/status and persists in onboarding data.
    """
    test_name = (payload.test_name or "").strip()
    test_date = (payload.test_date or "").strip()
    if not test_name or not test_date:
        raise HTTPException(status_code=400, detail="test_name and test_date are required")

    result = await db.execute(select(PatientProfile).where(PatientProfile.profile_id == user.id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    tests = patient.medical_tests if isinstance(patient.medical_tests, list) else []
    tests = [dict(item) for item in tests if isinstance(item, dict)]

    target_index = None
    for index, item in enumerate(tests):
        if (
            _normalize_test_value(str(item.get("test_name", ""))) == _normalize_test_value(test_name)
            and _normalize_test_value(str(item.get("test_date", ""))) == _normalize_test_value(test_date)
        ):
            target_index = index
            break

    effective_status = payload.status
    if payload.result is not None and str(payload.result).strip():
        effective_status = "completed"
    if effective_status is None:
        effective_status = "pending"

    if target_index is None:
        next_item = {
            "test_name": test_name,
            "test_date": test_date,
            "test_id": None,
            "result": (payload.result or "").strip(),
            "notes": (payload.notes or "").strip(),
            "status": effective_status,
            "prescribing_doctor": (payload.prescribing_doctor or "").strip(),
            "hospital_lab": (payload.hospital_lab or "").strip(),
        }
        tests.insert(0, next_item)
    else:
        existing = tests[target_index]
        if payload.prescribing_doctor is not None:
            existing["prescribing_doctor"] = payload.prescribing_doctor.strip()
        if payload.hospital_lab is not None:
            existing["hospital_lab"] = payload.hospital_lab.strip()
        if payload.notes is not None:
            existing["notes"] = payload.notes.strip()
        if payload.result is not None:
            existing["result"] = payload.result.strip()

        existing["status"] = effective_status
        tests[target_index] = existing
        next_item = existing

    patient.medical_tests = tests
    patient.has_medical_tests = len(tests) > 0
    db.add(patient)
    await db.commit()

    return PatientMedicalTestPatchResponse(
        message="Medical test updated",
        test=next_item,
    )
    role_value = getattr(user.role, "value", user.role)
    if str(role_value).lower() != "patient":
        raise HTTPException(status_code=403, detail="Only patients can update medical tests")
