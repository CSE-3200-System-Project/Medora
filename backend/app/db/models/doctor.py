from sqlalchemy import String, Boolean, DateTime
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

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
