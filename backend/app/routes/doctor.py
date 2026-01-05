from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, Text
from typing import List, Optional

from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.schemas.doctor import DoctorSearchResponse, DoctorCardSchema

router = APIRouter()

@router.get("/search", response_model=DoctorSearchResponse)
async def search_doctors(
    query: Optional[str] = Query(None, description="Search by name, specialization, or symptoms"),
    speciality_id: Optional[int] = Query(None, description="Filter by speciality ID"),
    specialization: Optional[str] = Query(None, description="Legacy: filter by specialization text"),
    city: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    consultation_mode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for doctors based on various criteria.
    Supports both new speciality_id and legacy specialization text search.
    """
    # Join DoctorProfile, Profile, and Speciality tables
    stmt = select(DoctorProfile, Profile, Speciality).join(
        Profile, DoctorProfile.profile_id == Profile.id
    ).outerjoin(
        Speciality, DoctorProfile.speciality_id == Speciality.id
    )

    # Only show BMDC verified doctors
    stmt = stmt.where(DoctorProfile.bmdc_verified == True)

    # Filter by speciality ID (new method)
    if speciality_id:
        stmt = stmt.where(DoctorProfile.speciality_id == speciality_id)

    # Legacy: filter by specialization text
    if specialization:
        stmt = stmt.where(
            or_(
                DoctorProfile.specialization.ilike(f"%{specialization}%"),
                Speciality.name.ilike(f"%{specialization}%")
            )
        )

    # Filter by city
    if city:
        stmt = stmt.where(
            or_(
                DoctorProfile.hospital_city.ilike(f"%{city}%"),
                DoctorProfile.chamber_city.ilike(f"%{city}%")
            )
        )

    # Filter by gender
    if gender:
        stmt = stmt.where(Profile.gender.ilike(f"%{gender}%"))

    # Filter by consultation mode
    if consultation_mode:
        stmt = stmt.where(DoctorProfile.consultation_mode.ilike(f"%{consultation_mode}%"))

    # General text search
    if query:
        search_term = f"%{query}%"
        stmt = stmt.where(
            or_(
                Profile.first_name.ilike(search_term),
                Profile.last_name.ilike(search_term),
                DoctorProfile.specialization.ilike(search_term),
                Speciality.name.ilike(search_term),
                DoctorProfile.about.ilike(search_term),
                DoctorProfile.hospital_name.ilike(search_term),
                DoctorProfile.hospital_city.ilike(search_term),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    doctors = []
    for doc, prof, spec in rows:
        doctors.append(DoctorCardSchema(
            profile_id=doc.profile_id,
            first_name=prof.first_name,
            last_name=prof.last_name,
            title=doc.title,
            specialization=spec.name if spec else doc.specialization,  # Use speciality name if available
            qualifications=doc.qualifications,
            years_of_experience=doc.years_of_experience,
            hospital_name=doc.hospital_name,
            hospital_address=doc.hospital_address,
            hospital_city=doc.hospital_city,
            consultation_fee=doc.consultation_fee,
            profile_photo_url=doc.profile_photo_url,
            visiting_hours=doc.visiting_hours,
            available_days=doc.available_days,
            consultation_mode=doc.consultation_mode
        ))

    return DoctorSearchResponse(doctors=doctors, total=len(doctors))
