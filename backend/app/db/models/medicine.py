"""
Medicine models for drugs, brands, and search index.
These models map to existing Supabase tables.
"""
from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Drug(Base):
    """
    Canonical medicine identity.
    One row = one unique medicine (generic_name + strength + dosage_form)
    """
    __tablename__ = "drugs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_key = Column(Text, unique=True, nullable=False)
    generic_name = Column(Text, nullable=False)
    strength = Column(Text, nullable=False)
    dosage_form = Column(Text, nullable=False)
    common_uses = Column(Text, nullable=True)
    common_uses_disclaimer = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to brands
    brands = relationship("Brand", back_populates="drug", lazy="selectin")


class Brand(Base):
    """
    Commercial/prescribed medicine names.
    Many brands can reference one drug.
    """
    __tablename__ = "brands"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand_name = Column(Text, nullable=False)
    manufacturer = Column(Text, nullable=True)
    medicine_type = Column(Text, nullable=True)  # Allopathic, Ayurvedic, etc.
    drug_id = Column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship to drug
    drug = relationship("Drug", back_populates="brands")


class MedicineSearchIndex(Base):
    """
    Search accelerator for fast fuzzy lookups.
    Contains both generic and brand name terms.
    """
    __tablename__ = "medicine_search_index"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    term = Column(Text, nullable=False)
    drug_id = Column(UUID(as_uuid=True), ForeignKey("drugs.id"), nullable=True)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brands.id"), nullable=True)
