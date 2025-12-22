from sqlalchemy import String, Date, Float, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date
from app.db.base import Base

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    profile_id: Mapped[str] = mapped_column(String, primary_key=True)

    date_of_birth: Mapped[date | None]
    gender: Mapped[str | None]
    blood_group: Mapped[str | None]
    allergies: Mapped[str | None]
    
    # Physical & Demographic
    height: Mapped[float | None]
    weight: Mapped[float | None]
    city: Mapped[str | None]
    country: Mapped[str | None]
    occupation: Mapped[str | None]
    medical_summary_url: Mapped[str | None]

    # Medical Conditions
    has_conditions: Mapped[bool] = mapped_column(Boolean, default=False)
    conditions: Mapped[list | None] = mapped_column(JSON)

    # Medications & Allergies
    taking_meds: Mapped[bool] = mapped_column(Boolean, default=False)
    medications: Mapped[list | None] = mapped_column(JSON)
    allergy_reaction: Mapped[str | None]

    # Medical History
    past_surgeries: Mapped[bool] = mapped_column(Boolean, default=False)
    surgery_description: Mapped[str | None]
    ongoing_treatments: Mapped[bool] = mapped_column(Boolean, default=False)

    # Lifestyle
    smoking: Mapped[str | None]
    alcohol: Mapped[str | None]
    activity_level: Mapped[str | None]
    sleep_duration: Mapped[str | None]
    diet: Mapped[str | None]

    # Preferences & Consent
    language: Mapped[str | None]
    notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    emergency_name: Mapped[str | None]
    emergency_relation: Mapped[str | None]
    emergency_phone: Mapped[str | None]
    consent_storage: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_doctor: Mapped[bool] = mapped_column(Boolean, default=False)

