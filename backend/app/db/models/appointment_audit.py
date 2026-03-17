import uuid
from sqlalchemy import String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class AppointmentAuditLog(Base):
    """Immutable audit trail for all appointment state changes."""

    __tablename__ = "appointment_audit_logs"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    appointment_id: Mapped[str] = mapped_column(
        String, ForeignKey("appointments.id"), nullable=False, index=True
    )
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # created, status_changed, rescheduled, cancelled, etc.

    performed_by_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id"), nullable=False
    )
    performed_by_role: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # patient, doctor, admin

    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    appointment = relationship("Appointment", backref="audit_logs")
    performed_by = relationship("Profile", foreign_keys=[performed_by_id])
