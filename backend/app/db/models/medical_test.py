"""
Medical Test model for lab tests.
Maps to the medicaltest table.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.sql import func

from app.db.base import Base


class MedicalTest(Base):
    """
    Lab/medical test master list.
    Extracted from Marham.pk dataset.
    """
    __tablename__ = "medicaltest"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    display_name = Column(String(500), nullable=False)
    normalized_name = Column(String(500), unique=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
