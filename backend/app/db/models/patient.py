from sqlalchemy import String, Date
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
    
