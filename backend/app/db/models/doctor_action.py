import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.db.models.enums import DoctorActionPriority, DoctorActionStatus, DoctorActionType


class DoctorAction(Base):
    __tablename__ = "doctor_actions"
    __table_args__ = (
        Index("ix_doctor_actions_doctor_status", "doctor_id", "status"),
        Index("ix_doctor_actions_doctor_created", "doctor_id", "created_at"),
        Index("ix_doctor_actions_doctor_type", "doctor_id", "action_type"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id: Mapped[str] = mapped_column(String, ForeignKey("doctor_profiles.profile_id"), nullable=False, index=True)
    action_type: Mapped[DoctorActionType] = mapped_column(
        Enum(DoctorActionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[DoctorActionPriority] = mapped_column(
        Enum(DoctorActionPriority, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DoctorActionPriority.MEDIUM,
    )
    status: Mapped[DoctorActionStatus] = mapped_column(
        Enum(DoctorActionStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DoctorActionStatus.PENDING,
    )

    related_patient_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("patient_profiles.profile_id"),
        nullable=True,
        index=True,
    )
    related_appointment_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("appointments.id"),
        nullable=True,
        index=True,
    )

    revenue_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    doctor = relationship("DoctorProfile", backref="doctor_actions")
    appointment = relationship("Appointment", backref="doctor_actions")
