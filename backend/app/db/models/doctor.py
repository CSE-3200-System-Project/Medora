from sqlalchemy import String, Boolean, DateTime, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base

class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    profile_id: Mapped[str] = mapped_column(String, primary_key=True)

    bmdc_number: Mapped[str] = mapped_column(String, unique=True)
    specialization: Mapped[str]

    bmdc_document_url: Mapped[str | None]
    bmdc_document_uploaded_at: Mapped[datetime | None]

    bmdc_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_method: Mapped[str | None]
    verification_notes: Mapped[str | None]

    years_of_experience: Mapped[int | None]
    institution: Mapped[str | None]

    # Personal Identity
    profile_photo_url: Mapped[str | None]

    # Professional Information
    degree: Mapped[str | None]
    degree_certificates_url: Mapped[str | None]

    # Practice Details
    hospital_name: Mapped[str | None]
    practice_location: Mapped[str | None]
    consultation_mode: Mapped[str | None]
    affiliation_letter_url: Mapped[str | None]

    # Consultation Setup
    consultation_fee: Mapped[float | None]
    available_days: Mapped[list | None] = mapped_column(JSON)
    time_slots: Mapped[str | None]
    emergency_availability: Mapped[bool] = mapped_column(Boolean, default=False)

    # Preferences & Consent
    language: Mapped[str | None]
    case_types: Mapped[str | None]
    ai_assistance: Mapped[bool] = mapped_column(Boolean, default=True)
    terms_accepted: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
