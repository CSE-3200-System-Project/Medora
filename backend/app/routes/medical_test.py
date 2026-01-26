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
from app.schemas.medical_test import (
    MedicalTestResult,
    MedicalTestSearchResponse,
    MedicalTestDetailResponse,
)

router = APIRouter()


@router.get("/search", response_model=MedicalTestSearchResponse)
async def search_medical_tests(
    q: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search medical tests by name.
    Uses ILIKE for prefix and contains matching.
    
    Priority:
    1. Exact match
    2. Prefix match
    3. Contains match
    """
    search_term = q.strip().lower()
    
    # Build search query - only active tests
    stmt = (
        select(MedicalTest)
        .where(
            MedicalTest.is_active == True,
            MedicalTest.normalized_name.ilike(f"%{search_term}%")
        )
        .order_by(
            # Exact match gets highest priority
            (MedicalTest.normalized_name == search_term).desc(),
            # Prefix match second
            MedicalTest.normalized_name.ilike(f"{search_term}%").desc(),
            # Alphabetical order for remaining
            MedicalTest.display_name.asc()
        )
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    results: List[MedicalTestResult] = [
        MedicalTestResult(
            id=row.id,
            display_name=row.display_name,
            normalized_name=row.normalized_name,
        )
        for row in rows
    ]
    
    return MedicalTestSearchResponse(
        results=results,
        total=len(results),
        query=q
    )


@router.get("/all", response_model=List[MedicalTestResult])
async def get_all_medical_tests(
    limit: int = Query(500, ge=1, le=2000, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active medical tests.
    Useful for dropdown/autocomplete that loads all options.
    """
    stmt = (
        select(MedicalTest)
        .where(MedicalTest.is_active == True)
        .order_by(MedicalTest.display_name.asc())
        .limit(limit)
        .offset(offset)
    )
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    return [
        MedicalTestResult(
            id=row.id,
            display_name=row.display_name,
            normalized_name=row.normalized_name,
        )
        for row in rows
    ]


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
