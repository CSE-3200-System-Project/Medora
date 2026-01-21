"""
Medicine Pydantic schemas for API request/response.
"""
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime


# --- Response Schemas ---

class BrandInfo(BaseModel):
    """Brand information for medicine detail view."""
    id: UUID
    brand_name: str
    manufacturer: Optional[str] = None
    medicine_type: Optional[str] = None
    
    class Config:
        from_attributes = True


class MedicineSearchResult(BaseModel):
    """Single result in medicine search."""
    drug_id: UUID
    brand_id: Optional[UUID] = None
    display_name: str  # Brand name or generic name
    generic_name: str
    strength: str
    dosage_form: str
    medicine_type: Optional[str] = None  # Allopathic, Ayurvedic, etc.
    manufacturer: Optional[str] = None
    is_brand: bool = False  # True if result is a brand match
    
    class Config:
        from_attributes = True


class MedicineSearchResponse(BaseModel):
    """Response for medicine search endpoint."""
    results: List[MedicineSearchResult]
    total: int
    query: str


class MedicineDetailResponse(BaseModel):
    """Complete medicine details for detail view."""
    drug_id: UUID
    generic_name: str
    strength: str
    dosage_form: str
    common_uses: Optional[str] = None
    common_uses_disclaimer: Optional[str] = None
    brands: List[BrandInfo] = []
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DosageFormCount(BaseModel):
    """Dosage form with count for filters."""
    dosage_form: str
    count: int


class MedicineTypeCount(BaseModel):
    """Medicine type with count for filters."""
    medicine_type: str
    count: int


class MedicineFiltersResponse(BaseModel):
    """Available filters for medicine search."""
    dosage_forms: List[DosageFormCount]
    medicine_types: List[MedicineTypeCount]
