"""
Medical Report models.

Tables:
  - medical_reports: uploaded report metadata + parse status
  - medical_report_results: individual extracted test results
  - doctor_report_comments: doctor annotations on reports
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class MedicalReport(Base):
    __tablename__ = "medical_reports"
    __table_args__ = (
        Index("ix_medical_reports_patient_created", "patient_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    uploaded_by: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False)
    file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parsed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_engine: Mapped[str | None] = mapped_column(String(50), nullable=True)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    results = relationship("MedicalReportResult", back_populates="report", cascade="all, delete-orphan", lazy="selectin")
    comments = relationship("DoctorReportComment", back_populates="report", cascade="all, delete-orphan", lazy="selectin")
    patient = relationship("Profile", foreign_keys=[patient_id], backref="medical_reports")


class MedicalReportResult(Base):
    __tablename__ = "medical_report_results"
    __table_args__ = (
        Index("ix_report_results_report_id", "report_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id: Mapped[str] = mapped_column(String, ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False)
    test_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("medicaltest.id"), nullable=True)
    test_name: Mapped[str] = mapped_column(String(500), nullable=False)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # normal / high / low
    reference_range_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_range_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_range_text: Mapped[str | None] = mapped_column(String(200), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    report = relationship("MedicalReport", back_populates="results")


class DoctorReportComment(Base):
    __tablename__ = "doctor_report_comments"
    __table_args__ = (
        Index("ix_doctor_report_comments_report_id", "report_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id: Mapped[str] = mapped_column(String, ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False)
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    comment: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    report = relationship("MedicalReport", back_populates="comments")
    doctor = relationship("Profile", foreign_keys=[doctor_id])
