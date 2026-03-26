from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, Text
from typing import List, Optional
import logging

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
from app.services.geocoding import geocode_and_save_doctor_locations, geocode_all_doctors_missing_coordinates
from app.routes.auth import get_current_user_token
from app.core.http_cache import build_etag, is_not_modified, not_modified_response, set_cache_headers

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/testxyz")
async def test_route():
    return {"message": "Test route working"}

@router.get("/search", response_model=DoctorSearchResponse)
async def search_doctors(
    request: Request,
    response: Response,
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
        stmt = stmt.where(DoctorProfile.gender.ilike(f"%{gender}%"))

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
            hospital_latitude=doc.hospital_latitude,
            hospital_longitude=doc.hospital_longitude,
            chamber_name=doc.chamber_name,
            chamber_address=doc.chamber_address,
            chamber_city=doc.chamber_city,
            chamber_latitude=doc.chamber_latitude,
            chamber_longitude=doc.chamber_longitude,
            consultation_fee=doc.consultation_fee,
            profile_photo_url=doc.profile_photo_url,
            visiting_hours=doc.visiting_hours,
            available_days=doc.available_days,
            consultation_mode=doc.consultation_mode
        ))

    result_payload = DoctorSearchResponse(doctors=doctors, total=len(doctors))
    etag = build_etag(result_payload.model_dump(mode="json"))
    set_cache_headers(
        response,
        etag=etag,
        max_age_seconds=60,
        stale_while_revalidate_seconds=120,
        is_private=False,
    )
    if is_not_modified(request, etag):
        return not_modified_response(response)

    return result_payload


@router.get("/{profile_id}", response_model=DoctorProfileResponse)
async def get_doctor_profile(
    profile_id: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete doctor profile by profile_id for the detail page.
    Returns comprehensive information including bio, education, work experience, locations, etc.
    """
    # Join DoctorProfile, Profile, and Speciality tables
    stmt = select(DoctorProfile, Profile, Speciality).join(
        Profile, DoctorProfile.profile_id == Profile.id
    ).outerjoin(
        Speciality, DoctorProfile.speciality_id == Speciality.id
    ).where(DoctorProfile.profile_id == profile_id)

    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        logger.info("Doctor profile not found: %s", profile_id)
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
            latitude=doc.hospital_latitude,
            longitude=doc.hospital_longitude,
            availability=doc.time_slots or "",
            available_days=doc.available_days or [],
            appointment_duration=doc.appointment_duration,
            time_slots=doc.time_slots,
            normalized_time_slots=getattr(doc, 'normalized_time_slots', None),
            time_slots_needs_review=getattr(doc, 'time_slots_needs_review', False),
            day_time_slots=getattr(doc, 'day_time_slots', None)
        ))
    
    # Add chamber location if different from hospital
    if doc.chamber_name and doc.chamber_name != doc.hospital_name:
        locations.append(LocationInfo(
            name=doc.chamber_name,
            address=doc.chamber_address or "",
            city=doc.chamber_city or "",
            country="Bangladesh",
            latitude=doc.chamber_latitude,
            longitude=doc.chamber_longitude,
            availability=doc.time_slots or "",
            available_days=doc.available_days or [],
            appointment_duration=doc.appointment_duration,
            time_slots=doc.time_slots,
            normalized_time_slots=getattr(doc, 'normalized_time_slots', None),
            time_slots_needs_review=getattr(doc, 'time_slots_needs_review', False),
            day_time_slots=getattr(doc, 'day_time_slots', None)
        ))

    # Parse education from JSON
    education = None
    if doc.education:
        # Handle empty string years by converting to None
        sanitized_education = []
        for item in doc.education:
            edu_item = dict(item)
            if 'year' in edu_item and edu_item['year'] == '':
                edu_item['year'] = None
            sanitized_education.append(EducationItem(**edu_item))
        education = sanitized_education

    # Parse work experience from JSON
    work_experience = None
    if doc.work_experience:
        # Handle empty string years by converting to None
        sanitized_work = []
        for item in doc.work_experience:
            work_item = dict(item)
            if 'from_year' in work_item and work_item['from_year'] == '':
                work_item['from_year'] = None
            if 'to_year' in work_item and work_item['to_year'] == '':
                work_item['to_year'] = None
            sanitized_work.append(WorkExperienceItem(**work_item))
        work_experience = sanitized_work

    result_payload = DoctorProfileResponse(
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
        day_time_slots=getattr(doc, 'day_time_slots', None),
        education=education,
        work_experience=work_experience,
        languages_spoken=doc.languages_spoken,
        emergency_availability=doc.emergency_availability or False,
        telemedicine_available=doc.telemedicine_available or False
    )
    etag = build_etag(result_payload.model_dump(mode="json"))
    set_cache_headers(
        response,
        etag=etag,
        max_age_seconds=60,
        stale_while_revalidate_seconds=180,
        is_private=False,
    )
    if is_not_modified(request, etag):
        return not_modified_response(response)

    return result_payload


@router.get("/{profile_id}/slots", response_model=AppointmentSlotsResponse)
async def get_appointment_slots(
    profile_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    location: Optional[str] = Query(None, description="Location/hospital name"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get available appointment time slots for a doctor on a specific date.
    Delegates to slot_service which checks structured availability tables,
    then falls back to legacy day_time_slots JSON.
    """
    from datetime import datetime as dt_cls
    from app.services import slot_service

    # Verify doctor exists
    stmt = select(DoctorProfile).where(DoctorProfile.profile_id == profile_id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Parse the requested date
    try:
        target_date = dt_cls.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    slot_result = await slot_service.get_available_slots(db, profile_id, target_date)

    # Map slot_service output to the existing AppointmentSlotsResponse format
    slot_groups = []
    for group in slot_result.get("slot_groups", []):
        slots = [
            TimeSlot(time=s["time"], available=s.get("is_available", True))
            for s in group.get("slots", [])
        ]
        if slots:
            slot_groups.append(TimeSlotGroup(period=group["label"], slots=slots))

    return AppointmentSlotsResponse(
        date=date,
        location=location or doctor.hospital_name or "Not specified",
        slots=slot_groups,
    )


@router.post("/geocode-location/{doctor_id}")
async def geocode_doctor_location(
    doctor_id: str,
    force_regeocode: bool = Query(False, description="Force re-geocoding even if coordinates exist"),
    db: AsyncSession = Depends(get_db),
    user: any = Depends(get_current_user_token)
):
    """
    Geocode and save hospital and chamber locations for a specific doctor.
    Requires authentication. Doctors can only geocode their own profile.
    Admins can geocode any doctor's profile.
    """
    # Check authorization: user must be the doctor or an admin
    from app.db.models.enums import UserRole
    from app.db.models.profile import Profile as UserProfile
    
    stmt = select(UserProfile).where(UserProfile.id == user.id)
    result = await db.execute(stmt)
    user_profile = result.scalar_one_or_none()
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    is_admin = user_profile.role == UserRole.ADMIN
    is_own_profile = user.id == doctor_id
    
    if not (is_admin or is_own_profile):
        raise HTTPException(
            status_code=403,
            detail="You can only geocode your own doctor profile"
        )
    
    # Perform geocoding
    result = await geocode_and_save_doctor_locations(db, doctor_id, force_regeocode)
    
    return {
        "success": True,
        "doctor_id": doctor_id,
        "hospital_geocoded": result["hospital_geocoded"],
        "chamber_geocoded": result["chamber_geocoded"],
        "message": "Location coordinates updated successfully"
    }


@router.post("/geocode-all-missing")
async def geocode_all_missing_locations(
    limit: int = Query(50, description="Maximum number of doctors to process"),
    db: AsyncSession = Depends(get_db),
    user: any = Depends(get_current_user_token)
):
    """
    Batch geocode all doctors missing location coordinates.
    Admin only endpoint for data migration or maintenance.
    """
    # Check if user is admin
    from app.db.models.enums import UserRole
    from app.db.models.profile import Profile as UserProfile
    
    stmt = select(UserProfile).where(UserProfile.id == user.id)
    result = await db.execute(stmt)
    user_profile = result.scalar_one_or_none()
    
    if not user_profile or user_profile.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Perform batch geocoding
    stats = await geocode_all_doctors_missing_coordinates(db, limit)
    
    return {
        "success": True,
        "stats": stats,
        "message": f"Processed {stats['total_processed']} doctors"
    }
