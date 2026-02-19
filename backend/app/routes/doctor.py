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
from app.services.geocoding import geocode_and_save_doctor_locations, geocode_all_doctors_missing_coordinates
from app.routes.auth import get_current_user_token

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
        day_time_slots=getattr(doc, 'day_time_slots', None),
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
    Uses doctor's available_days (JSON array) and time_slots (string) fields.
    Generates slots based on appointment_duration.
    """
    from datetime import datetime, timedelta
    from app.db.models.appointment import Appointment, AppointmentStatus
    import re
    
    # Verify doctor exists
    stmt = select(DoctorProfile).where(DoctorProfile.profile_id == profile_id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Parse the requested date
    try:
        requested_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Get full day name from requested date
    full_day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    requested_day_full = full_day_names[requested_date.weekday()]
    
    # Check if doctor is available on requested day.
    # If day_time_slots is present, treat it as authoritative (only days present there are available)
    is_available_day = False

    if getattr(doctor, 'day_time_slots', None) and isinstance(doctor.day_time_slots, dict) and len(doctor.day_time_slots) > 0:
        day_slots = doctor.day_time_slots.get(requested_day_full, [])
        if isinstance(day_slots, list) and len(day_slots) > 0:
            is_available_day = True
        else:
            is_available_day = False
    else:
        if doctor.available_days and len(doctor.available_days) > 0:
            # available_days is JSON array like ["Saturday", "Monday", "Thursday"]
            # Match by checking if any day starts with the requested day (case-insensitive)
            is_available_day = any(
                day.strip().upper().startswith(requested_day_full[:3].upper()) 
                for day in doctor.available_days
            )
        else:
            # If no schedule set, assume available all days except Friday
            is_available_day = requested_day_full != "Friday"

    if not is_available_day:
        # Return empty slots if doctor doesn't work on this day
        return AppointmentSlotsResponse(
            date=date,
            location=location or doctor.hospital_name or "Not specified",
            slots=[]
        )
    
    # Parse time_slots field and support multiple ranges and overnight ranges
    # NEW: Check day_time_slots first for per-day schedules
    time_slots_str = ""
    
    if doctor.day_time_slots and isinstance(doctor.day_time_slots, dict):
        # Use per-day time slots
        day_slots = doctor.day_time_slots.get(requested_day_full, [])
        if isinstance(day_slots, list) and len(day_slots) > 0:
            time_slots_str = ", ".join(day_slots)
    
    # Fallback to legacy single time_slots string if no day-specific slots
    if not time_slots_str:
        time_slots_str = (getattr(doctor, 'normalized_time_slots', None) or doctor.time_slots or "").strip()

    # Split into candidate ranges by commas or semicolons (allow variations)
    raw_ranges = [r.strip() for r in re.split(r"[,;]", time_slots_str) if r.strip()]

    # Pattern to find start-end pairs (AM/PM optional — we'll handle in parser)
    range_pattern = r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)"

    found_ranges = []
    for piece in raw_ranges:
        m = re.search(range_pattern, piece, re.IGNORECASE)
        if m:
            found_ranges.append((m.group(1), m.group(2)))

    # Fallback default if no valid ranges
    if not found_ranges:
        found_ranges = [("09:00 AM", "05:00 PM")]

    # Helper to parse a time string into a datetime on a base date
    def parse_time_to_dt(time_str: str, base_date: datetime) -> datetime:
        time_str = time_str.strip()
        # Normalize AM/PM to uppercase with a space
        time_str = re.sub(r"(?i)\b(am)\b", "AM", time_str)
        time_str = re.sub(r"(?i)\b(pm)\b", "PM", time_str)
        time_str = re.sub(r"(\d)(AM|PM|am|pm)$", r"\1 \2", time_str)
        time_str = time_str.strip()

        # If it's plain 24-hour like '07:00' or '19:30', parse as 24-hour
        try:
            if re.match(r"^\d{1,2}:\d{2}$", time_str):
                t = datetime.strptime(time_str, "%H:%M")
                return datetime.combine(base_date.date(), t.time())
        except Exception:
            pass

        # Normalize '9 AM' -> '9:00 AM'
        if re.match(r"^\d{1,2}\s+(AM|PM)$", time_str):
            time_str = re.sub(r"^(\d{1,2})\s+(AM|PM)$", r"\1:00 \2", time_str)

        # Try parsing with 12-hour formats
        for fmt in ["%I:%M %p", "%I %p", "%I:%M%p"]:
            try:
                t = datetime.strptime(time_str, fmt)
                return datetime.combine(base_date.date(), t.time())
            except ValueError:
                continue

        # If nothing matches, fallback to default 09:00 AM
        t = datetime.strptime("09:00 AM", "%I:%M %p")
        return datetime.combine(base_date.date(), t.time())

    # Build list of (start_dt, end_dt) ranges relative to requested_date
    ranges_dt: list[tuple[datetime, datetime]] = []

    for s_str, e_str in found_ranges:
        start_dt = parse_time_to_dt(s_str, requested_date)
        end_dt = parse_time_to_dt(e_str, requested_date)
        # If end <= start, it crosses midnight -> add one day to end
        if end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)
        ranges_dt.append((start_dt, end_dt))

    # Generate slots across all ranges
    slots = []
    slot_duration = doctor.appointment_duration or 15

    for start_dt, end_dt in ranges_dt:
        current = start_dt
        while current < end_dt:
            slot_time = current.strftime("%I:%M %p").lstrip("0")
            slots.append({
                "time": slot_time,
                "datetime": current
            })
            current = current + timedelta(minutes=slot_duration)

    # Determine the query window for existing appointments (cover possible overnight ranges)
    overall_start = min(r[0] for r in ranges_dt)
    overall_end = max(r[1] for r in ranges_dt)

    date_start = datetime.combine(overall_start.date(), datetime.min.time())
    date_end = datetime.combine(overall_end.date(), datetime.max.time())
    
    # Fetch existing appointments for this doctor covering possible overnight ranges
    from sqlalchemy import func

    appt_stmt = select(Appointment).where(
        Appointment.doctor_id == profile_id,
        Appointment.appointment_date >= date_start,
        Appointment.appointment_date <= date_end,
        Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
    )
    appt_result = await db.execute(appt_stmt)
    existing_appointments = appt_result.scalars().all()

    # Build a set of booked slot times normalized to format like '1:00 PM'
    booked_times = set()
    note_time_pattern = re.compile(r"Slot:\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))", re.IGNORECASE)

    for appt in existing_appointments:
        # 1) If appointment_date has meaningful time component, use it
        if appt.appointment_date and (appt.appointment_date.hour != 0 or appt.appointment_date.minute != 0):
            try:
                formatted = appt.appointment_date.strftime("%I:%M %p").lstrip("0").upper()
                booked_times.add(formatted)
            except Exception:
                pass

        # 2) Parse time from notes if present
        if appt.notes:
            note_match = note_time_pattern.search(appt.notes)
            if note_match:
                note_time = note_match.group(1).strip()
                # Parse note_time into datetime for consistent formatting
                parsed_dt = parse_time_to_dt(note_time, requested_date)
                formatted = parsed_dt.strftime("%I:%M %p").lstrip("0").upper()
                booked_times.add(formatted)
    
    # Categorize slots by time period
    morning_slots = []  # Before 12 PM
    afternoon_slots = []  # 12 PM - 5 PM
    evening_slots = []  # 5 PM - 8 PM
    night_slots = []  # After 8 PM
    
    now = datetime.now()

    for slot in slots:
        slot_time = slot["time"]
        slot_dt = slot["datetime"]

        # Check if slot is booked by normalized time comparison
        is_booked = slot_dt.strftime("%I:%M %p").lstrip("0").upper() in booked_times

        # Check if slot is in the past (absolute datetime comparison)
        is_past = slot_dt < now

        time_slot = TimeSlot(time=slot_time, available=(not is_booked and not is_past))

        hour = slot_dt.hour
        if hour < 12:
            morning_slots.append(time_slot)
        elif hour < 17:
            afternoon_slots.append(time_slot)
        elif hour < 20:
            evening_slots.append(time_slot)
        else:
            night_slots.append(time_slot)
    
    slot_groups = []
    if morning_slots:
        slot_groups.append(TimeSlotGroup(period="Morning", slots=morning_slots))
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
