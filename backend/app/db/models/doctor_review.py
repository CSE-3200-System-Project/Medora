import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class DoctorReview(Base):
    __tablename__ = "doctor_reviews"
    __table_args__ = (
        UniqueConstraint("doctor_id", "patient_id", "appointment_id", name="uq_doctor_reviews_doctor_patient_appt"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_doctor_reviews_rating_range"),
        Index("ix_doctor_reviews_doctor_created", "doctor_id", "created_at"),
        Index("ix_doctor_reviews_patient", "patient_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("doctor_profiles.profile_id", ondelete="CASCADE"), nullable=False)
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.profile_id", ondelete="CASCADE"), nullable=False)
    appointment_id: Mapped[str | None] = mapped_column(String, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    doctor = relationship("DoctorProfile", backref="reviews")
    patient = relationship("PatientProfile", backref="reviews_given")
