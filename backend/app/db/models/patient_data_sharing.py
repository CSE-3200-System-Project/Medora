"""
Patient Data Sharing Preferences.

Per-doctor, per-category access control so patients have full sovereignty
over what each doctor can see.  Every boolean defaults to False (private)
until the patient explicitly shares.

Categories
──────────
can_view_profile          – name, age, gender, blood group, photo, basic identity
can_view_conditions       – known conditions, chronic conditions
can_view_medications      – current medications
can_view_allergies        – drug / food / environmental allergies
can_view_medical_history  – surgeries, hospitalizations, treatments, past tests
can_view_family_history   – family medical history
can_view_lifestyle        – smoking, alcohol, diet, exercise, mental health, sleep
can_view_vaccinations     – vaccination records
can_view_reports          – uploaded lab reports (medical_reports)
can_view_health_metrics   – health metrics (vitals tracked over time)
can_view_prescriptions    – consultation prescriptions
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PatientDataSharingPreference(Base):
    __tablename__ = "patient_data_sharing_preferences"
    __table_args__ = (
        UniqueConstraint("patient_id", "doctor_id", name="uq_patient_doctor_sharing"),
        Index("ix_pds_patient", "patient_id"),
        Index("ix_pds_doctor", "doctor_id"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id"), nullable=False
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id"), nullable=False
    )

    # ── category toggles (all default to False = private) ──
    can_view_profile: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_conditions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_medications: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_allergies: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_medical_history: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_family_history: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_lifestyle: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_vaccinations: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_reports: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_health_metrics: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_view_prescriptions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    patient = relationship("Profile", foreign_keys=[patient_id], backref="data_sharing_given")
    doctor = relationship("Profile", foreign_keys=[doctor_id], backref="data_sharing_received")


# All boolean column names so routes can iterate / validate dynamically
SHARING_CATEGORY_FIELDS: list[str] = [
    "can_view_profile",
    "can_view_conditions",
    "can_view_medications",
    "can_view_allergies",
    "can_view_medical_history",
    "can_view_family_history",
    "can_view_lifestyle",
    "can_view_vaccinations",
    "can_view_reports",
    "can_view_health_metrics",
    "can_view_prescriptions",
]
