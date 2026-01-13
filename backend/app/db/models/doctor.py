from sqlalchemy import String, Boolean, DateTime, Float, JSON, Text, Date, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from app.db.base import Base

class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    profile_id: Mapped[str] = mapped_column(String, primary_key=True)

    # === PERSONAL IDENTITY (Step 1) ===
    title: Mapped[str | None]  # Prof., Assoc. Prof., Dr., Brig. Gen., etc.
    gender: Mapped[str | None]
    date_of_birth: Mapped[date | None]
    profile_photo_url: Mapped[str | None]
    nid_number: Mapped[str | None]  # National ID

    # === PROFESSIONAL CREDENTIALS (Step 2) ===
    bmdc_number: Mapped[str] = mapped_column(String, unique=True)
    bmdc_document_url: Mapped[str | None]
    bmdc_document_uploaded_at: Mapped[datetime | None]
    bmdc_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')
    verification_method: Mapped[str | None]
    verification_notes: Mapped[str | None]
    
    # Qualifications - multiple degrees stored as structured JSON
    # e.g., "MBBS(CMC), BCS(Health), MD(Nephrology, BSMMU)"
    qualifications: Mapped[str | None] = mapped_column(Text)
    degree: Mapped[str | None]  # Primary degree (e.g., MBBS)
    degree_certificates_url: Mapped[str | None]
    
    # Education history as JSON array: [{degree, institution, year, country}]
    education: Mapped[list | None] = mapped_column(JSON)
    
    # === SPECIALIZATION (Step 3) ===
    speciality_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("specialities.id"))
    specialization: Mapped[str | None]  # Legacy text field, kept for backwards compatibility
    sub_specializations: Mapped[list | None] = mapped_column(JSON)  # Additional specialties
    services: Mapped[list | None] = mapped_column(JSON)  # Services offered
    
    # === EXPERIENCE (Step 4) ===
    years_of_experience: Mapped[int | None]
    # Work experience as JSON array: [{position, hospital, from_year, to_year, current}]
    work_experience: Mapped[list | None] = mapped_column(JSON)
    
    # === PRACTICE DETAILS (Step 5) ===
    # Primary hospital/clinic
    hospital_name: Mapped[str | None]
    hospital_address: Mapped[str | None]
    hospital_city: Mapped[str | None]
    hospital_country: Mapped[str | None] = mapped_column(String, default="Bangladesh")
    
    # Chamber details (can be same or different from hospital)
    chamber_name: Mapped[str | None]
    chamber_address: Mapped[str | None]
    chamber_city: Mapped[str | None]
    
    # Geolocation for distance-based ranking (PRD: location-aware search)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    
    practice_location: Mapped[str | None]  # Legacy field
    consultation_mode: Mapped[str | None]  # online, in-person, both
    affiliation_letter_url: Mapped[str | None]
    institution: Mapped[str | None]  # Current primary institution
    
    # === CONSULTATION SETUP (Step 6) ===
    consultation_fee: Mapped[float | None]
    follow_up_fee: Mapped[float | None]
    
    # Visiting hours as JSON: [{day, start_time, end_time}] 
    # e.g., "Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM"
    visiting_hours: Mapped[str | None]
    available_days: Mapped[list | None] = mapped_column(JSON)
    time_slots: Mapped[str | None]
    
    appointment_duration: Mapped[int | None]  # Minutes per appointment
    emergency_availability: Mapped[bool] = mapped_column(Boolean, default=False)
    emergency_contact: Mapped[str | None]
    
    # === ABOUT & BIO (Step 7) ===
    about: Mapped[str | None] = mapped_column(Text)  # Bio/description
    
    # === PREFERENCES & CONSENT (Step 8) ===
    language: Mapped[str | None]
    languages_spoken: Mapped[list | None] = mapped_column(JSON)  # Multiple languages
    case_types: Mapped[str | None]  # Types of cases handled
    ai_assistance: Mapped[bool] = mapped_column(Boolean, default=True)
    terms_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Telemedicine preferences
    telemedicine_available: Mapped[bool] = mapped_column(Boolean, default=False)
    telemedicine_platforms: Mapped[list | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=datetime.utcnow
    )
