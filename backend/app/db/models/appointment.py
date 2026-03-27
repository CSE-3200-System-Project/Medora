import enum
from sqlalchemy import (
    String, Integer, ForeignKey, DateTime, Enum, Text, Time, Index,
    UniqueConstraint,
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
        # Prevent double-booking: only one appointment per doctor+date+slot
        # Partial unique index — only enforced when slot_time is not null
        UniqueConstraint(
            "doctor_id", "appointment_date", "slot_time",
            name="uq_doctor_date_slot",
        ),
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

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    # Relationships
    doctor = relationship("DoctorProfile", backref="appointments")
    patient = relationship("PatientProfile", backref="appointments")
