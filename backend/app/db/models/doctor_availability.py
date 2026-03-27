import uuid
from sqlalchemy import (
    String, Integer, Boolean, Date, Time, ForeignKey, UniqueConstraint, Text,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class DoctorAvailability(Base):
    """Recurring weekly availability for a doctor. One row per day of week."""

    __tablename__ = "doctor_availability"
    __table_args__ = (
        UniqueConstraint("doctor_id", "day_of_week", name="uq_doctor_day_of_week"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("doctor_profiles.profile_id"), nullable=False, index=True
    )
    doctor_location_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("doctor_locations.id"), nullable=True, index=True
    )
    day_of_week: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 0=Monday .. 6=Sunday
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    time_blocks = relationship(
        "DoctorTimeBlock", back_populates="availability", cascade="all, delete-orphan"
    )


class DoctorTimeBlock(Base):
    """A continuous visiting-hour block within a day. Multiple blocks per day allowed."""

    __tablename__ = "doctor_time_blocks"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    availability_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("doctor_availability.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[Time] = mapped_column(Time, nullable=False)
    end_time: Mapped[Time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(
        Integer, default=30, server_default="30"
    )

    # Relationships
    availability = relationship("DoctorAvailability", back_populates="time_blocks")


class DoctorException(Base):
    """Doctor leave or holiday — overrides weekly availability for a specific date."""

    __tablename__ = "doctor_exceptions"
    __table_args__ = (
        UniqueConstraint("doctor_id", "exception_date", name="uq_doctor_exception_date"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("doctor_profiles.profile_id"), nullable=False, index=True
    )
    doctor_location_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("doctor_locations.id"), nullable=True, index=True
    )
    exception_date: Mapped[Date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DoctorScheduleOverride(Base):
    """Custom schedule for a specific date — overrides weekly availability entirely."""

    __tablename__ = "doctor_schedule_overrides"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String, ForeignKey("doctor_profiles.profile_id"), nullable=False, index=True
    )
    doctor_location_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("doctor_locations.id"), nullable=True, index=True
    )
    override_date: Mapped[Date] = mapped_column(Date, nullable=False)
    start_time: Mapped[Time] = mapped_column(Time, nullable=False)
    end_time: Mapped[Time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(
        Integer, default=30, server_default="30"
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
