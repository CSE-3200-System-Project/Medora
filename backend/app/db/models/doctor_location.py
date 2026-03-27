import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DoctorLocation(Base):
    __tablename__ = "doctor_locations"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    doctor_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("doctor_profiles.profile_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Raw user-entered text used for caching and geocoding replay.
    location_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_location_text: Mapped[str | None] = mapped_column(String(500), index=True)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geocoded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    geocode_source: Mapped[str | None] = mapped_column(String(30), nullable=True)

    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Location-specific scheduling payload (used by onboarding and booking views).
    available_days: Mapped[list | None] = mapped_column(JSON)
    day_time_slots: Mapped[dict | None] = mapped_column(JSON)
    appointment_duration: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=datetime.utcnow
    )
