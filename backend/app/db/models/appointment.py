import enum
from sqlalchemy import (
    String, Integer, ForeignKey, DateTime, Enum, Text, Time, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class AppointmentStatus(str, enum.Enum):
    # Original statuses (kept for backward compatibility)
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    CANCELLED_BY_PATIENT = "CANCELLED_BY_PATIENT"
    CANCELLED_BY_DOCTOR = "CANCELLED_BY_DOCTOR"

    # New statuses for enhanced workflow
    PENDING_ADMIN_REVIEW = "PENDING_ADMIN_REVIEW"
    PENDING_DOCTOR_CONFIRMATION = "PENDING_DOCTOR_CONFIRMATION"
    PENDING_PATIENT_CONFIRMATION = "PENDING_PATIENT_CONFIRMATION"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    NO_SHOW = "NO_SHOW"


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_doctor_date", "doctor_id", "appointment_date"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("doctor_profiles.profile_id"), nullable=False
    )
    patient_id: Mapped[str] = mapped_column(
        String, ForeignKey("patient_profiles.profile_id"), nullable=False
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, values_callable=lambda x: [e.value for e in x]),
        default=AppointmentStatus.PENDING,
    )
    appointment_date: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    reason: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # New fields for enhanced scheduling
    slot_time: Mapped[Time | None] = mapped_column(Time, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=30
    )
    google_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    doctor_location_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("doctor_locations.id"), nullable=True, index=True
    )
    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cancellation_reason_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cancellation_reason_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("profiles.id"), nullable=True, index=True
    )
    cancelled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hold_expires_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    # Relationships
    doctor = relationship("DoctorProfile", backref="appointments")
    patient = relationship("PatientProfile", backref="appointments")
