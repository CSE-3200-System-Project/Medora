import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class HealthDataConsent(Base):
    """Tracks patient consent for sharing health metrics with specific doctors."""

    __tablename__ = "health_data_consents"
    __table_args__ = (
        Index("ix_health_data_consents_patient_doctor", "patient_id", "doctor_id", unique=True),
        Index("ix_health_data_consents_doctor", "doctor_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.profile_id"), nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("doctor_profiles.profile_id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient = relationship("PatientProfile", backref="health_data_consents_given")
    doctor = relationship("DoctorProfile", backref="health_data_consents_received")
