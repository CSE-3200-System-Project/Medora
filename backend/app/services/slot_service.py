"""Dynamic slot generation and availability checking.

Core algorithm:
1. Check doctor_exceptions → if is_available=False, return empty
2. Check doctor_schedule_overrides → if exists, use override times
3. Fall back to doctor_availability + doctor_time_blocks for day_of_week
4. If no structured data, fall back to DoctorProfile.day_time_slots JSON
5. Generate individual slots from time blocks
6. Query booked appointments, remove booked slots
7. Mark past slots unavailable
8. Return categorized by period (Morning/Afternoon/Evening)
"""

from datetime import date, time, datetime, timedelta, timezone
from typing import Optional
import re

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_availability import (
    DoctorAvailability,
    DoctorTimeBlock,
    DoctorException,
    DoctorScheduleOverride,
)


# ── Slot categorization ──

def _categorize_slot(t: time) -> str:
    """Categorize a time into Morning/Afternoon/Evening/Night."""
    if t.hour < 12:
        return "Morning"
    elif t.hour < 17:
        return "Afternoon"
    elif t.hour < 21:
        return "Evening"
    return "Night"


def _format_time_label(t: time) -> str:
    """Format time as '9:00 AM' style label."""
    h = t.hour % 12 or 12
    period = "AM" if t.hour < 12 else "PM"
    return f"{h}:{t.minute:02d} {period}"


# ── Pure slot generation ──

def generate_slots_from_block(
    start_time: time,
    end_time: time,
    slot_duration_minutes: int,
) -> list[time]:
    """Generate individual slot times from a time block."""
    slots: list[time] = []
    current = datetime(2000, 1, 1, start_time.hour, start_time.minute)
    end = datetime(2000, 1, 1, end_time.hour, end_time.minute)
    delta = timedelta(minutes=slot_duration_minutes)

    while current < end:
        slots.append(current.time())
        current += delta

    return slots


def generate_slots_from_legacy_ranges(
    slot_ranges: list[str],
    duration: int,
) -> list[time]:
    """Parse legacy time ranges like '9:00 AM - 1:00 PM' and generate slots."""
    pattern = re.compile(
        r"(\d{1,2}(?::\d{2})?)\s*(AM|PM)\s*-\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)",
        re.IGNORECASE,
    )
    all_slots: list[time] = []

    for range_str in slot_ranges:
        match = pattern.search(range_str)
        if not match:
            continue

        start_time = _parse_time(match.group(1), match.group(2))
        end_time = _parse_time(match.group(3), match.group(4))
        all_slots.extend(generate_slots_from_block(start_time, end_time, duration))

    return all_slots


def _parse_time(time_str: str, period: str) -> time:
    """Convert '9:00' + 'AM' or '9' + 'PM' to a time object."""
    period = period.upper()
    if ":" in time_str:
        hours, minutes = map(int, time_str.split(":"))
    else:
        hours, minutes = int(time_str), 0

    if period == "PM" and hours != 12:
        hours += 12
    elif period == "AM" and hours == 12:
        hours = 0

    return time(hours, minutes)


# Day name mapping
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


async def get_available_slots(
    db: AsyncSession,
    doctor_id: str,
    target_date: date,
) -> dict:
    """
    Get available time slots for a doctor on a specific date.

    Returns dict with keys:
      - date: str
      - doctor_id: str
      - appointment_duration: int
      - slot_groups: list of {label, slots}
      - total_available: int
    """
    # 1. Check for exceptions (leave/holiday)
    exception_result = await db.execute(
        select(DoctorException).where(
            DoctorException.doctor_id == doctor_id,
            DoctorException.exception_date == target_date,
        )
    )
    exception = exception_result.scalar_one_or_none()
    if exception and not exception.is_available:
        return _empty_response(doctor_id, target_date)

    # 2. Check for schedule overrides
    override_result = await db.execute(
        select(DoctorScheduleOverride).where(
            DoctorScheduleOverride.doctor_id == doctor_id,
            DoctorScheduleOverride.override_date == target_date,
        )
    )
    overrides = override_result.scalars().all()

    all_slots: list[time] = []
    appointment_duration = 30

    if overrides:
        # Use overrides instead of weekly schedule
        for override in overrides:
            slots = generate_slots_from_block(
                override.start_time,
                override.end_time,
                override.slot_duration_minutes,
            )
            all_slots.extend(slots)
            appointment_duration = override.slot_duration_minutes
    else:
        # 3. Check structured availability
        day_of_week = target_date.weekday()  # 0=Monday
        avail_result = await db.execute(
            select(DoctorAvailability).where(
                DoctorAvailability.doctor_id == doctor_id,
                DoctorAvailability.day_of_week == day_of_week,
                DoctorAvailability.is_active == True,
            )
        )
        availability = avail_result.scalar_one_or_none()

        if availability:
            # Load time blocks
            blocks_result = await db.execute(
                select(DoctorTimeBlock).where(
                    DoctorTimeBlock.availability_id == availability.id,
                )
            )
            time_blocks = blocks_result.scalars().all()

            for block in time_blocks:
                slots = generate_slots_from_block(
                    block.start_time,
                    block.end_time,
                    block.slot_duration_minutes,
                )
                all_slots.extend(slots)
                appointment_duration = block.slot_duration_minutes
        else:
            # 4. Fall back to DoctorProfile.day_time_slots JSON
            doc_result = await db.execute(
                select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
            )
            doctor = doc_result.scalar_one_or_none()
            if not doctor:
                return _empty_response(doctor_id, target_date)

            appointment_duration = doctor.appointment_duration or 30
            day_name = DAY_NAMES[day_of_week]

            if (
                doctor.day_time_slots
                and isinstance(doctor.day_time_slots, dict)
                and doctor.day_time_slots.get(day_name)
            ):
                ranges = doctor.day_time_slots[day_name]
                if isinstance(ranges, list) and ranges:
                    all_slots = generate_slots_from_legacy_ranges(
                        ranges, appointment_duration
                    )
            elif doctor.visiting_hours or doctor.time_slots:
                # Oldest legacy: parse visiting_hours text
                schedule_text = doctor.visiting_hours or doctor.time_slots or ""
                legacy_ranges = [
                    f"{start} - {end}"
                    for start, end in re.findall(
                        r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))",
                        schedule_text,
                        re.IGNORECASE,
                    )
                ]
                if legacy_ranges:
                    all_slots = generate_slots_from_legacy_ranges(
                        legacy_ranges, appointment_duration
                    )

    if not all_slots:
        return _empty_response(doctor_id, target_date, appointment_duration)

    # Deduplicate and sort
    all_slots = sorted(set(all_slots))

    # 5. Remove booked slots
    start_of_day = datetime(
        target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc
    )
    end_of_day = start_of_day + timedelta(days=1)

    booked_result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date < end_of_day,
            Appointment.status.notin_([
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            ]),
        )
    )
    booked_appointments = booked_result.scalars().all()

    # Build set of booked slot times
    booked_times: set[str] = set()
    for appt in booked_appointments:
        if appt.slot_time:
            booked_times.add(_format_time_label(appt.slot_time))
        # Also check the datetime component
        appt_time_label = appt.appointment_date.strftime("%I:%M %p").lstrip("0").upper()
        booked_times.add(appt_time_label)
        # Parse from notes as fallback
        if appt.notes:
            note_match = re.search(
                r"Slot:\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
                appt.notes,
                re.IGNORECASE,
            )
            if note_match:
                booked_times.add(
                    _normalize_slot_label(note_match.group(1))
                )

    # 6. Mark past slots
    now = datetime.now(timezone.utc)

    # 7. Build categorized response
    groups: dict[str, list] = {}
    total_available = 0

    for slot_time in all_slots:
        label = _format_time_label(slot_time)
        is_booked = label.upper() in {bt.upper() for bt in booked_times}

        slot_datetime = datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            slot_time.hour,
            slot_time.minute,
            tzinfo=timezone.utc,
        )
        is_past = slot_datetime < now

        is_available = not is_booked and not is_past
        if is_available:
            total_available += 1

        category = _categorize_slot(slot_time)
        if category not in groups:
            groups[category] = []

        groups[category].append({
            "time": label,
            "is_available": is_available,
            "is_past": is_past,
        })

    # Build ordered slot_groups
    slot_groups = []
    for cat_label in ["Morning", "Afternoon", "Evening", "Night"]:
        if cat_label in groups:
            slot_groups.append({
                "label": cat_label,
                "slots": groups[cat_label],
            })

    return {
        "date": target_date.isoformat(),
        "doctor_id": doctor_id,
        "appointment_duration": appointment_duration,
        "slot_groups": slot_groups,
        "total_available": total_available,
    }


async def is_slot_available(
    db: AsyncSession,
    doctor_id: str,
    target_date: date,
    slot_time_val: time,
) -> bool:
    """Check if a specific slot is available (not booked, not in the past, not an exception)."""
    # Check exception
    exception_result = await db.execute(
        select(DoctorException).where(
            DoctorException.doctor_id == doctor_id,
            DoctorException.exception_date == target_date,
            DoctorException.is_available == False,
        )
    )
    if exception_result.scalar_one_or_none():
        return False

    # Check past
    slot_datetime = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        slot_time_val.hour,
        slot_time_val.minute,
        tzinfo=timezone.utc,
    )
    if slot_datetime < datetime.now(timezone.utc):
        return False

    # Check for existing booking
    start_of_day = datetime(
        target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc
    )
    end_of_day = start_of_day + timedelta(days=1)

    booked_result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date < end_of_day,
            Appointment.slot_time == slot_time_val,
            Appointment.status.notin_([
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            ]),
        )
    )
    if booked_result.scalar_one_or_none():
        return False

    return True


def _normalize_slot_label(time_label: str) -> str:
    """Normalize a slot label like '9 AM' -> '9:00 AM'."""
    cleaned = " ".join(time_label.strip().upper().split())
    cleaned = re.sub(r"^(\d{1,2})(AM|PM)$", r"\1 \2", cleaned)
    cleaned = re.sub(r"^(\d{1,2})\s+(AM|PM)$", r"\1:00 \2", cleaned)

    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%I:%M %p").lstrip("0").upper()
        except ValueError:
            continue
    return cleaned


def _empty_response(
    doctor_id: str, target_date: date, duration: int = 30
) -> dict:
    return {
        "date": target_date.isoformat(),
        "doctor_id": doctor_id,
        "appointment_duration": duration,
        "slot_groups": [],
        "total_available": 0,
    }
