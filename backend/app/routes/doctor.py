from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, Text
from typing import List, Optional

from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.schemas.doctor import (
    DoctorSearchResponse, 
    DoctorCardSchema, 
    DoctorProfileResponse, 
    LocationInfo, 
    EducationItem, 
    WorkExperienceItem,
    AppointmentSlotsResponse,
    TimeSlot,
    TimeSlotGroup
)

router = APIRouter()

@router.get("/testxyz")
async def test_route():
    return {"message": "Test route working"}

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


@router.get("/{profile_id}", response_model=DoctorProfileResponse)
async def get_doctor_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete doctor profile by profile_id for the detail page.
    Returns comprehensive information including bio, education, work experience, locations, etc.
    """
    with open("debug_log.txt", "a") as f:
        f.write(f"Fetching doctor profile for ID: '{profile_id}'\n")
    
    # Join DoctorProfile, Profile, and Speciality tables
    stmt = select(DoctorProfile, Profile, Speciality).join(
        Profile, DoctorProfile.profile_id == Profile.id
    ).outerjoin(
        Speciality, DoctorProfile.speciality_id == Speciality.id
    ).where(DoctorProfile.profile_id == profile_id)

    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        with open("debug_log.txt", "a") as f:
            f.write(f"Doctor not found for ID: {profile_id}\n")
        
        # Check if it exists in doctor_profiles table at least
        check_stmt = select(DoctorProfile).where(DoctorProfile.profile_id == profile_id)
        check_result = await db.execute(check_stmt)
        if check_result.first():
             with open("debug_log.txt", "a") as f:
                 f.write("Doctor exists in doctor_profiles table but join failed (missing Profile?)\n")
        else:
             with open("debug_log.txt", "a") as f:
                 f.write("Doctor does not exist in doctor_profiles table\n")
        
        raise HTTPException(status_code=404, detail="Doctor not found")

    doc, prof, spec = row

    # Build locations list
    locations = []
    
    # Add hospital location if available
    if doc.hospital_name:
        locations.append(LocationInfo(
            name=doc.hospital_name,
            address=doc.hospital_address or "",
            city=doc.hospital_city or "",
            country=doc.hospital_country or "Bangladesh",
            availability=doc.visiting_hours
        ))
    
    # Add chamber location if different from hospital
    if doc.chamber_name and doc.chamber_name != doc.hospital_name:
        locations.append(LocationInfo(
            name=doc.chamber_name,
            address=doc.chamber_address or "",
            city=doc.chamber_city or "",
            country="Bangladesh",
            availability=doc.visiting_hours
        ))

    # Parse education from JSON
    education = None
    if doc.education:
        education = [EducationItem(**item) for item in doc.education]

    # Parse work experience from JSON
    work_experience = None
    if doc.work_experience:
        work_experience = [WorkExperienceItem(**item) for item in doc.work_experience]

    return DoctorProfileResponse(
        profile_id=doc.profile_id,
        first_name=prof.first_name,
        last_name=prof.last_name,
        title=doc.title,
        gender=doc.gender,
        profile_photo_url=doc.profile_photo_url,
        bmdc_number=doc.bmdc_number,
        bmdc_verified=doc.bmdc_verified,
        qualifications=doc.qualifications,
        specialization=doc.specialization,
        speciality_name=spec.name if spec else None,
        years_of_experience=doc.years_of_experience,
        about=doc.about,
        services=doc.services,
        sub_specializations=doc.sub_specializations,
        locations=locations,
        consultation_fee=doc.consultation_fee,
        follow_up_fee=doc.follow_up_fee,
        consultation_mode=doc.consultation_mode,
        appointment_duration=doc.appointment_duration,
        visiting_hours=doc.visiting_hours,
        available_days=doc.available_days,
        education=education,
        work_experience=work_experience,
        languages_spoken=doc.languages_spoken,
        emergency_availability=doc.emergency_availability or False,
        telemedicine_available=doc.telemedicine_available or False
    )


@router.get("/{profile_id}/slots", response_model=AppointmentSlotsResponse)
async def get_appointment_slots(
    profile_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    location: Optional[str] = Query(None, description="Location/hospital name"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get available appointment time slots for a doctor on a specific date.
    This is a simplified version - in production, this would check actual bookings.
    """
    # Verify doctor exists
    stmt = select(DoctorProfile).where(DoctorProfile.profile_id == profile_id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Generate time slots based on doctor's visiting hours
    # This is a mock implementation - in production, this would:
    # 1. Parse visiting_hours to get actual available times
    # 2. Check existing appointments in database
    # 3. Mark booked slots as unavailable
    
    afternoon_slots = []
    evening_slots = []
    night_slots = []
    
    # Afternoon (12:00 PM - 5:00 PM)
    afternoon_times = ["03:00 PM", "03:10 PM", "03:20 PM", "03:30 PM", "03:40 PM", "03:50 PM",
                      "04:00 PM", "04:10 PM", "04:20 PM", "04:30 PM", "04:40 PM", "04:50 PM"]
    for time in afternoon_times:
        afternoon_slots.append(TimeSlot(time=time, available=True))
    
    # Evening (5:00 PM - 8:00 PM)
    evening_times = ["05:00 PM", "05:10 PM", "05:20 PM", "05:30 PM", "05:40 PM", "05:50 PM",
                    "06:00 PM", "06:10 PM", "06:20 PM", "06:30 PM", "06:40 PM", "06:50 PM",
                    "07:00 PM", "07:10 PM", "07:20 PM", "07:30 PM", "07:40 PM", "07:50 PM"]
    for time in evening_times:
        evening_slots.append(TimeSlot(time=time, available=True))
    
    # Night (8:00 PM onwards)
    night_times = ["08:00 PM"]
    for time in night_times:
        night_slots.append(TimeSlot(time=time, available=True))
    
    slot_groups = []
    if afternoon_slots:
        slot_groups.append(TimeSlotGroup(period="Afternoon", slots=afternoon_slots))
    if evening_slots:
        slot_groups.append(TimeSlotGroup(period="Evening", slots=evening_slots))
    if night_slots:
        slot_groups.append(TimeSlotGroup(period="Night", slots=night_slots))
    
    return AppointmentSlotsResponse(
        date=date,
        location=location or doctor.hospital_name or "Not specified",
        slots=slot_groups
    )
