"""
Medicine routes for search and detail endpoints.
Based on PRD: medicine-knowledge.md
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from typing import Optional, List
from uuid import UUID

from app.core.dependencies import get_db
from app.db.models.medicine import Drug, Brand, MedicineSearchIndex
from app.schemas.medicine import (
    MedicineSearchResult,
    MedicineSearchResponse,
    MedicineDetailResponse,
    BrandInfo,
    MedicineFiltersResponse,
    DosageFormCount,
    MedicineTypeCount,
)

router = APIRouter()


@router.get("/search", response_model=MedicineSearchResponse)
async def search_medicines(
    q: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    dosage_form: Optional[str] = Query(None, description="Filter by dosage form"),
    medicine_type: Optional[str] = Query(None, description="Filter by medicine type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Search medicines by brand or generic name.
    Uses medicine_search_index for fast fuzzy matching.
    
    Priority:
    1. Exact brand match
    2. Exact generic match
    3. Prefix match
    4. Fuzzy match (trigram similarity)
    """
    search_term = q.strip().lower()
    
    # Build the search query using ILIKE for prefix matching
    # First, search the index table and join with drugs and brands
    stmt = (
        select(
            MedicineSearchIndex.term,
            MedicineSearchIndex.drug_id,
            MedicineSearchIndex.brand_id,
            Drug.generic_name,
            Drug.strength,
            Drug.dosage_form,
            Brand.brand_name,
            Brand.manufacturer,
            Brand.medicine_type,
        )
        .join(Drug, MedicineSearchIndex.drug_id == Drug.id)
        .outerjoin(Brand, MedicineSearchIndex.brand_id == Brand.id)
        .where(
            MedicineSearchIndex.term.ilike(f"%{search_term}%")
        )
    )
    
    # Apply dosage form filter
    if dosage_form:
        stmt = stmt.where(Drug.dosage_form.ilike(f"%{dosage_form}%"))
    
    # Apply medicine type filter (only for brand results)
    if medicine_type:
        stmt = stmt.where(
            or_(
                Brand.medicine_type.ilike(f"%{medicine_type}%"),
                Brand.medicine_type.is_(None)  # Include generic-only results
            )
        )
    
    # Order by relevance: exact match first, then prefix, then contains
    stmt = stmt.order_by(
        # Exact match gets highest priority
        (MedicineSearchIndex.term == search_term).desc(),
        # Prefix match second
        MedicineSearchIndex.term.ilike(f"{search_term}%").desc(),
        # Alphabetical order for remaining
        MedicineSearchIndex.term.asc()
    ).limit(limit)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Build response with deduplication
    seen_combinations = set()
    results: List[MedicineSearchResult] = []
    
    for row in rows:
        # Create unique key to avoid duplicates
        key = (str(row.drug_id), str(row.brand_id) if row.brand_id else "generic")
        if key in seen_combinations:
            continue
        seen_combinations.add(key)
        
        is_brand = row.brand_id is not None
        display_name = row.brand_name if is_brand else row.generic_name
        
        results.append(MedicineSearchResult(
            drug_id=row.drug_id,
            brand_id=row.brand_id,
            display_name=display_name,
            generic_name=row.generic_name,
            strength=row.strength,
            dosage_form=row.dosage_form,
            medicine_type=row.medicine_type,
            manufacturer=row.manufacturer,
            is_brand=is_brand,
        ))
    
    return MedicineSearchResponse(
        results=results,
        total=len(results),
        query=q
    )


@router.get("/filters", response_model=MedicineFiltersResponse)
async def get_medicine_filters(
    db: AsyncSession = Depends(get_db)
):
    """
    Get available filter options for medicine search.
    Returns dosage forms and medicine types with counts.
    """
    # Get dosage forms with counts
    dosage_stmt = (
        select(Drug.dosage_form, func.count(Drug.id).label("count"))
        .group_by(Drug.dosage_form)
        .order_by(func.count(Drug.id).desc())
        .limit(50)
    )
    dosage_result = await db.execute(dosage_stmt)
    dosage_forms = [
        DosageFormCount(dosage_form=row[0], count=row[1])
        for row in dosage_result.all()
    ]
    
    # Get medicine types with counts
    type_stmt = (
        select(Brand.medicine_type, func.count(Brand.id).label("count"))
        .where(Brand.medicine_type.isnot(None))
        .group_by(Brand.medicine_type)
        .order_by(func.count(Brand.id).desc())
    )
    type_result = await db.execute(type_stmt)
    medicine_types = [
        MedicineTypeCount(medicine_type=row[0], count=row[1])
        for row in type_result.all()
    ]
    
    return MedicineFiltersResponse(
        dosage_forms=dosage_forms,
        medicine_types=medicine_types
    )


@router.get("/{drug_id}", response_model=MedicineDetailResponse)
async def get_medicine_detail(
    drug_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete medicine details by drug ID.
    Includes all associated brands.
    """
    # Fetch drug with brands
    stmt = select(Drug).where(Drug.id == drug_id)
    result = await db.execute(stmt)
    drug = result.scalar_one_or_none()
    
    if not drug:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    # Fetch all brands for this drug
    brands_stmt = select(Brand).where(Brand.drug_id == drug_id).order_by(Brand.brand_name)
    brands_result = await db.execute(brands_stmt)
    brands = brands_result.scalars().all()
    
    return MedicineDetailResponse(
        drug_id=drug.id,
        generic_name=drug.generic_name,
        strength=drug.strength,
        dosage_form=drug.dosage_form,
        common_uses=drug.common_uses,
        common_uses_disclaimer=drug.common_uses_disclaimer,
        brands=[
            BrandInfo(
                id=brand.id,
                brand_name=brand.brand_name,
                manufacturer=brand.manufacturer,
                medicine_type=brand.medicine_type,
            )
            for brand in brands
        ],
        created_at=drug.created_at,
    )


@router.get("/brand/{brand_id}", response_model=MedicineDetailResponse)
async def get_medicine_by_brand(
    brand_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get medicine details by brand ID.
    Redirects to the drug detail with all brands.
    """
    # Fetch brand to get drug_id
    stmt = select(Brand).where(Brand.id == brand_id)
    result = await db.execute(stmt)
    brand = result.scalar_one_or_none()
    
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    if not brand.drug_id:
        raise HTTPException(status_code=404, detail="No associated medicine found")
    
    # Return the drug detail
    return await get_medicine_detail(brand.drug_id, db)
