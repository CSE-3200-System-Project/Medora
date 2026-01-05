from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from typing import List, Optional

from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.schemas.doctor import DoctorSearchResponse, DoctorCardSchema

router = APIRouter()

@router.get("/search", response_model=DoctorSearchResponse)
async def search_doctors(
    query: Optional[str] = Query(None, description="Search by name, specialization, or symptoms"),
    specialization: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    consultation_mode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for doctors based on various criteria.
    """
    # Start with a join between DoctorProfile and Profile to get names
    stmt = select(DoctorProfile, Profile).join(Profile, DoctorProfile.profile_id == Profile.id)
    
    # Filter by verified doctors only (assuming there's a verification flag, checking model...)
    # In DoctorProfile: bmdc_verified
    stmt = stmt.where(DoctorProfile.bmdc_verified == True)

    if query:
        search_term = f"%{query}%"
        # Basic search: Name, Specialization, About
        stmt = stmt.where(
            or_(
                Profile.first_name.ilike(search_term),
                Profile.last_name.ilike(search_term),
                DoctorProfile.specialization.ilike(search_term),
                DoctorProfile.about.ilike(search_term),
                DoctorProfile.services.cast(str).ilike(search_term) # Simple cast for JSON search
            )
        )
    
    if specialization:
        stmt = stmt.where(DoctorProfile.specialization.ilike(f"%{specialization}%"))
    
    if city:
        stmt = stmt.where(
            or_(
                DoctorProfile.hospital_city.ilike(f"%{city}%"),
                DoctorProfile.chamber_city.ilike(f"%{city}%")
            )
        )
        
    if gender:
        stmt = stmt.where(DoctorProfile.gender.ilike(gender))
        
    if consultation_mode:
        stmt = stmt.where(DoctorProfile.consultation_mode.ilike(f"%{consultation_mode}%"))

    result = await db.execute(stmt)
    rows = result.all()
    
    doctors = []
    for doc, prof in rows:
        doctors.append(DoctorCardSchema(
            profile_id=doc.profile_id,
            first_name=prof.first_name,
            last_name=prof.last_name,
            title=doc.title,
            specialization=doc.specialization,
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
