from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, Text
from typing import List, Optional
import logging

from app.core.dependencies import get_db
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_location import DoctorLocation
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
    TimeSlotGroup,
    GeocodeLocationRequest,
    GeocodeLocationResponse,
)
from app.schemas.review import ReviewAuthor, ReviewListResponse, ReviewResponse
from app.db.models.doctor_review import DoctorReview
from app.services.geocoding import (
    geocode_and_save_doctor_locations,
    geocode_all_doctors_missing_coordinates,
    geocode_location_text_with_cache,
)
from app.services import review_service
from app.routes.auth import get_current_user_token
from app.core.http_cache import build_etag, is_not_modified, not_modified_response, set_cache_headers

router = APIRouter()
logger = logging.getLogger(__name__)


async def _build_location_payload(
    db: AsyncSession,
    doctor: DoctorProfile,
) -> list[LocationInfo]:
    location_rows = (
        (
            await db.execute(
                select(DoctorLocation)
                .where(DoctorLocation.doctor_id == doctor.profile_id)
                .order_by(DoctorLocation.is_primary.desc(), DoctorLocation.created_at.asc())
            )
        )
        .scalars()
        .all()
    )

    if location_rows:
        payload = []
        for row in location_rows:
            payload.append(
                LocationInfo(
                    id=row.id,
                    name=row.location_name,
                    location_type=row.location_type,
                    display_name=row.display_name,
                    address=row.address or "",
                    city=row.city or "",
                    country=row.country or "Bangladesh",
                    latitude=row.latitude,
                    longitude=row.longitude,
                    availability=doctor.time_slots or "",
                    available_days=row.available_days or [],
                    appointment_duration=row.appointment_duration or doctor.appointment_duration,
                    time_slots=doctor.time_slots,
                    normalized_time_slots=getattr(doctor, 'normalized_time_slots', None),
                    time_slots_needs_review=getattr(doctor, 'time_slots_needs_review', False),
                    day_time_slots=row.day_time_slots or getattr(doctor, 'day_time_slots', None),
                )
            )
        return payload

    # Legacy fallback for doctors not yet migrated to the new table.
    payload: list[LocationInfo] = []
    if doctor.hospital_name:
        payload.append(
            LocationInfo(
                name=doctor.hospital_name,
                location_type="HOSPITAL",
                address=doctor.hospital_address or "",
                city=doctor.hospital_city or "",
                country=doctor.hospital_country or "Bangladesh",
                latitude=doctor.hospital_latitude,
                longitude=doctor.hospital_longitude,
                availability=doctor.time_slots or "",
                available_days=doctor.available_days or [],
                appointment_duration=doctor.appointment_duration,
                time_slots=doctor.time_slots,
                normalized_time_slots=getattr(doctor, 'normalized_time_slots', None),
                time_slots_needs_review=getattr(doctor, 'time_slots_needs_review', False),
                day_time_slots=getattr(doctor, 'day_time_slots', None),
            )
        )
    if doctor.chamber_name and doctor.chamber_name != doctor.hospital_name:
        payload.append(
            LocationInfo(
                name=doctor.chamber_name,
                location_type="CHAMBER",
                address=doctor.chamber_address or "",
                city=doctor.chamber_city or "",
                country="Bangladesh",
                latitude=doctor.chamber_latitude,
                longitude=doctor.chamber_longitude,
                availability=doctor.time_slots or "",
                available_days=doctor.available_days or [],
                appointment_duration=doctor.appointment_duration,
                time_slots=doctor.time_slots,
                normalized_time_slots=getattr(doctor, 'normalized_time_slots', None),
                time_slots_needs_review=getattr(doctor, 'time_slots_needs_review', False),
                day_time_slots=getattr(doctor, 'day_time_slots', None),
            )
        )
    return payload


async def _serialize_review(db: AsyncSession, review: DoctorReview) -> ReviewResponse:
    author_profile = (
        await db.execute(select(Profile).where(Profile.id == review.patient_id))
    ).scalar_one_or_none()
    author = None
    if author_profile:
        author = ReviewAuthor(
            patient_id=author_profile.id,
            first_name=author_profile.first_name,
            last_name=author_profile.last_name,
            profile_photo_url=getattr(author_profile, "profile_photo_url", None),
        )
    return ReviewResponse(
        id=review.id,
        doctor_id=review.doctor_id,
        rating=review.rating,
        note=review.note,
        status=review.status,
        admin_feedback=review.admin_feedback,
        created_at=review.created_at,
        updated_at=review.updated_at,
        author=author,
    )

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
                DoctorProfile.chamber_city.ilike(f"%{city}%"),
                select(DoctorLocation.id)
                .where(
                    DoctorLocation.doctor_id == DoctorProfile.profile_id,
                    DoctorLocation.city.ilike(f"%{city}%"),
                )
                .exists(),
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
                select(DoctorLocation.id)
                .where(
                    DoctorLocation.doctor_id == DoctorProfile.profile_id,
                    or_(
                        DoctorLocation.location_name.ilike(search_term),
                        DoctorLocation.address.ilike(search_term),
                        DoctorLocation.city.ilike(search_term),
                        DoctorLocation.display_name.ilike(search_term),
                    ),
                )
                .exists(),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    # Bayesian-adjusted reputation score prevents a 5★/1-review doctor from
    # outranking a 4.8★/200-review one. Prior pulls new doctors toward the mean.
    PRIOR_MEAN = 3.5
    PRIOR_WEIGHT = 5.0

    def _reputation(avg: float, count: int) -> float:
        return ((avg or 0.0) * count + PRIOR_MEAN * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT)

    cards = []
    for doc, prof, spec in rows:
        cards.append((
            _reputation(float(doc.rating_avg or 0.0), int(doc.rating_count or 0)),
            int(doc.rating_count or 0),
            DoctorCardSchema(
                profile_id=doc.profile_id,
                first_name=prof.first_name,
                last_name=prof.last_name,
                title=doc.title,
                specialization=spec.name if spec else doc.specialization,
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
                consultation_mode=doc.consultation_mode,
                rating_avg=float(doc.rating_avg or 0.0),
                rating_count=int(doc.rating_count or 0),
            ),
        ))

    # Sort: higher reputation first, ties broken by more reviews.
    cards.sort(key=lambda t: (t[0], t[1]), reverse=True)
    doctors = [c[2] for c in cards]

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
    locations = await _build_location_payload(db, doc)

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
        telemedicine_available=doc.telemedicine_available or False,
        rating_avg=float(doc.rating_avg or 0.0),
        rating_count=int(doc.rating_count or 0),
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


@router.get("/{profile_id}/reviews", response_model=ReviewListResponse)
async def get_doctor_reviews(
    profile_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(5, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    doctor = (
        await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == profile_id))
    ).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    rows, total, has_more = await review_service.list_approved_reviews(
        db, doctor_id=profile_id, page=page, limit=limit
    )

    return ReviewListResponse(
        reviews=[await _serialize_review(db, review) for review in rows],
        total=total,
        rating_avg=float(doctor.rating_avg or 0.0),
        rating_count=int(doctor.rating_count or 0),
        page=page,
        limit=limit,
        has_more=has_more,
    )


@router.get("/{profile_id}/slots", response_model=AppointmentSlotsResponse)
async def get_appointment_slots(
    profile_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    location_id: Optional[str] = Query(None, description="Doctor location ID"),
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

    slot_result = await slot_service.get_available_slots(db, profile_id, target_date, location_id)

    # Map slot_service output to the existing AppointmentSlotsResponse format
    slot_groups = []
    for group in slot_result.get("slot_groups", []):
        slots = [
            TimeSlot(time=s["time"], available=s.get("is_available", True))
            for s in group.get("slots", [])
        ]
        if slots:
            slot_groups.append(TimeSlotGroup(period=group["label"], slots=slots))

    location_label = doctor.hospital_name or "Not specified"
    if location_id:
        location_row = (
            await db.execute(
                select(DoctorLocation).where(
                    DoctorLocation.id == location_id,
                    DoctorLocation.doctor_id == profile_id,
                )
            )
        ).scalar_one_or_none()
        location_label = location_row.location_name if location_row else location_id

    return AppointmentSlotsResponse(
        date=date,
        location=location_label,
        slots=slot_groups,
    )


@router.post("/geocode", response_model=GeocodeLocationResponse)
async def geocode_location_text(
    payload: GeocodeLocationRequest,
    db: AsyncSession = Depends(get_db),
    _: any = Depends(get_current_user_token),
):
    """Geocode a free-text location using cache-first Nominatim lookup."""
    location_text = (payload.location_text or "").strip()
    if len(location_text) < 5:
        raise HTTPException(status_code=400, detail="Location text must be at least 5 characters")

    geocoded = await geocode_location_text_with_cache(db, location_text)
    if not geocoded:
        raise HTTPException(status_code=404, detail="Location not found")

    return GeocodeLocationResponse(
        latitude=float(geocoded["lat"]),
        longitude=float(geocoded["lng"]),
        display_name=str(geocoded.get("display_name") or location_text),
        source=str(geocoded.get("source") or "nominatim"),
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
