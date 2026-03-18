import uuid
import enum
from sqlalchemy import String, Integer, Date, Time, Text, ForeignKey, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class AppointmentRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESCHEDULE_PROPOSED = "reschedule_proposed"


class RescheduleRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class RequestedByRole(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class AppointmentRequest(Base):
    """Booking proposal before admin/doctor approval."""

    __tablename__ = "appointment_requests"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("doctor_profiles.profile_id"), nullable=False, index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String, ForeignKey("patient_profiles.profile_id"), nullable=False, index=True
    )
    requested_date: Mapped[Date] = mapped_column(Date, nullable=False)
    requested_time: Mapped[Time] = mapped_column(Time, nullable=False)
    requested_duration: Mapped[int] = mapped_column(Integer, default=30)

    status: Mapped[AppointmentRequestStatus] = mapped_column(
        Enum(AppointmentRequestStatus, values_callable=lambda x: [e.value for e in x]),
        default=AppointmentRequestStatus.PENDING,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    doctor = relationship("DoctorProfile", foreign_keys=[doctor_id])
    patient = relationship("PatientProfile", foreign_keys=[patient_id])


class AppointmentRescheduleRequest(Base):
    """Tracks negotiation between patient, doctor, and admin for rescheduling."""

    __tablename__ = "appointment_reschedule_requests"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    appointment_id: Mapped[str] = mapped_column(
        String, ForeignKey("appointments.id"), nullable=False, index=True
    )
    requested_by_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id"), nullable=False
    )
    requested_by_role: Mapped[RequestedByRole] = mapped_column(
        Enum(RequestedByRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    proposed_date: Mapped[Date] = mapped_column(Date, nullable=False)
    proposed_time: Mapped[Time] = mapped_column(Time, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[RescheduleRequestStatus] = mapped_column(
        Enum(
            RescheduleRequestStatus,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=RescheduleRequestStatus.PENDING,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    appointment = relationship("Appointment", backref="reschedule_requests")
    requested_by = relationship("Profile", foreign_keys=[requested_by_id])
