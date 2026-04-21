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
import os
import logging

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.appointment_request import (
    AppointmentRescheduleRequest,
    RescheduleRequestStatus,
)
from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_location import DoctorLocation
from app.db.models.doctor_availability import (
    DoctorAvailability,
    DoctorTimeBlock,
    DoctorException,
    DoctorScheduleOverride,
)


logger = logging.getLogger(__name__)
SLOT_DEBUG_LOGGING = os.getenv("SLOT_DEBUG_LOGGING", "0").strip().lower() in {"1", "true", "yes", "on"}


NON_OCCUPYING_STATUSES = [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_DOCTOR,
    AppointmentStatus.NO_SHOW,
]

SLOT_OCCUPYING_STATUSES = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING_ADMIN_REVIEW,
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
    AppointmentStatus.RESCHEDULE_REQUESTED,
    AppointmentStatus.CANCEL_REQUESTED,
]


def _active_slot_occupancy_condition(now_utc: datetime):
    """Only appointments that currently occupy a slot should block availability."""
    return and_(
        Appointment.status.in_(SLOT_OCCUPYING_STATUSES),
        or_(
            Appointment.status != AppointmentStatus.PENDING,
            Appointment.hold_expires_at.is_(None),
            Appointment.hold_expires_at > now_utc,
        ),
    )


async def _pending_reschedule_appointment_ids(
    db: AsyncSession,
    appointment_ids: list[str],
) -> set[str]:
    if not appointment_ids:
        return set()

    result = await db.execute(
        select(AppointmentRescheduleRequest.appointment_id).where(
            AppointmentRescheduleRequest.appointment_id.in_(appointment_ids),
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
    )
    return {appointment_id for appointment_id in result.scalars().all() if appointment_id}


async def _filter_stale_reschedule_rows(
    db: AsyncSession,
    appointments: list[Appointment],
) -> list[Appointment]:
    """Ignore stale RESCHEDULE_REQUESTED rows that have no pending request."""
    if not appointments:
        return appointments

    reschedule_requested_ids = [
        appt.id
        for appt in appointments
        if appt.status == AppointmentStatus.RESCHEDULE_REQUESTED
    ]
    if not reschedule_requested_ids:
        return appointments

    pending_ids = await _pending_reschedule_appointment_ids(db, reschedule_requested_ids)
    return [
        appt
        for appt in appointments
        if appt.status != AppointmentStatus.RESCHEDULE_REQUESTED or appt.id in pending_ids
    ]


async def is_slot_held_by_pending_reschedule(
    db: AsyncSession,
    doctor_id: str,
    target_date: date,
    slot_time_val: time,
    exclude_appointment_id: Optional[str] = None,
) -> bool:
    """Return True when a pending reschedule request already holds the proposed slot."""
    now_utc = datetime.now(timezone.utc)

    predicates = [
        Appointment.doctor_id == doctor_id,
        AppointmentRescheduleRequest.proposed_date == target_date,
        AppointmentRescheduleRequest.proposed_time == slot_time_val,
        AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        or_(
            AppointmentRescheduleRequest.expires_at.is_(None),
            AppointmentRescheduleRequest.expires_at > now_utc,
        ),
        _active_slot_occupancy_condition(now_utc),
    ]
    if exclude_appointment_id:
        predicates.append(Appointment.id != exclude_appointment_id)

    result = await db.execute(
        select(AppointmentRescheduleRequest.id)
        .join(Appointment, Appointment.id == AppointmentRescheduleRequest.appointment_id)
        .where(*predicates)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _pending_reschedule_hold_labels_for_date(
    db: AsyncSession,
    doctor_id: str,
    target_date: date,
) -> set[str]:
    """Collect slot labels held by non-expired pending reschedule requests for a date."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(AppointmentRescheduleRequest.proposed_time)
        .join(Appointment, Appointment.id == AppointmentRescheduleRequest.appointment_id)
        .where(
            Appointment.doctor_id == doctor_id,
            AppointmentRescheduleRequest.proposed_date == target_date,
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
            or_(
                AppointmentRescheduleRequest.expires_at.is_(None),
                AppointmentRescheduleRequest.expires_at > now_utc,
            ),
            _active_slot_occupancy_condition(now_utc),
        )
    )
    held_times = result.scalars().all()
    return {_format_time_label(slot_time) for slot_time in held_times if slot_time}


def _slot_label_from_appointment(appt: Appointment) -> str:
    if appt.slot_time:
        return _format_time_label(appt.slot_time).upper()
    return appt.appointment_date.strftime("%I:%M %p").lstrip("0").upper()


def _debug_slot_appointments(
    *,
    doctor_id: str,
    target_date: date,
    phase: str,
    appointments: list[Appointment],
) -> None:
    if not SLOT_DEBUG_LOGGING:
        return

    payload = [
        {
            "id": appt.id,
            "status": appt.status.value if hasattr(appt.status, "value") else str(appt.status),
            "appointment_date": appt.appointment_date.isoformat() if appt.appointment_date else None,
            "slot_time": appt.slot_time.isoformat() if appt.slot_time else None,
            "label": _slot_label_from_appointment(appt),
        }
        for appt in appointments
    ]
    logger.info(
        "slot-occupancy-debug phase=%s doctor_id=%s date=%s appointments=%s",
        phase,
        doctor_id,
        target_date.isoformat(),
        payload,
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
    doctor_location_id: Optional[str] = None,
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
            or_(
                DoctorException.doctor_location_id == doctor_location_id,
                DoctorException.doctor_location_id.is_(None),
            ) if doctor_location_id else True,
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
            or_(
                DoctorScheduleOverride.doctor_location_id == doctor_location_id,
                DoctorScheduleOverride.doctor_location_id.is_(None),
            ) if doctor_location_id else True,
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
        availability_predicates = [
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_active == True,
        ]
        if doctor_location_id:
            availability_predicates.append(DoctorAvailability.doctor_location_id == doctor_location_id)

        avail_result = await db.execute(select(DoctorAvailability).where(*availability_predicates))
        availability = avail_result.scalar_one_or_none()

        if doctor_location_id and not availability:
            avail_result = await db.execute(
                select(DoctorAvailability).where(
                    DoctorAvailability.doctor_id == doctor_id,
                    DoctorAvailability.day_of_week == day_of_week,
                    DoctorAvailability.is_active == True,
                    DoctorAvailability.doctor_location_id.is_(None),
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

            location = None
            if doctor_location_id:
                location_result = await db.execute(
                    select(DoctorLocation).where(
                        DoctorLocation.id == doctor_location_id,
                        DoctorLocation.doctor_id == doctor_id,
                    )
                )
                location = location_result.scalar_one_or_none()

            appointment_duration = (
                (location.appointment_duration if location else None)
                or doctor.appointment_duration
                or 30
            )
            day_name = DAY_NAMES[day_of_week]

            location_day_slots = (
                location.day_time_slots
                if location and isinstance(location.day_time_slots, dict)
                else None
            )

            if location_day_slots and location_day_slots.get(day_name):
                ranges = location_day_slots[day_name]
                if isinstance(ranges, list) and ranges:
                    all_slots = generate_slots_from_legacy_ranges(
                        ranges, appointment_duration
                    )
            elif (
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

    now_utc = datetime.now(timezone.utc)
    booked_result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date < end_of_day,
            _active_slot_occupancy_condition(now_utc),
        )
    )
    booked_appointments = booked_result.scalars().all()
    _debug_slot_appointments(
        doctor_id=doctor_id,
        target_date=target_date,
        phase="raw",
        appointments=booked_appointments,
    )
    booked_appointments = await _filter_stale_reschedule_rows(db, booked_appointments)
    _debug_slot_appointments(
        doctor_id=doctor_id,
        target_date=target_date,
        phase="filtered",
        appointments=booked_appointments,
    )

    # Build set of booked slot times
    booked_times: set[str] = set()
    for appt in booked_appointments:
        # Treat the canonical slot_time column as source-of-truth.
        # Fall back to appointment_date/notes only for legacy rows that do not have slot_time.
        if appt.slot_time:
            booked_times.add(_format_time_label(appt.slot_time))
            continue

        appt_time_label = appt.appointment_date.strftime("%I:%M %p").lstrip("0").upper()
        booked_times.add(appt_time_label)

        if appt.notes:
            note_match = re.search(
                r"Slot:\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
                appt.notes,
                re.IGNORECASE,
            )
            if note_match:
                booked_times.add(_normalize_slot_label(note_match.group(1)))

    # Pending reschedule proposals also hold their proposed slots until resolved/expired.
    held_slot_labels = await _pending_reschedule_hold_labels_for_date(
        db,
        doctor_id=doctor_id,
        target_date=target_date,
    )
    booked_times.update(held_slot_labels)

    # 6. Mark past slots
    now = datetime.now(timezone.utc)
    booked_labels_upper = {bt.upper() for bt in booked_times}

    # 7. Build categorized response
    groups: dict[str, list] = {}
    total_available = 0

    for slot_time in all_slots:
        label = _format_time_label(slot_time)
        is_booked = label.upper() in booked_labels_upper

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
    exclude_appointment_id: Optional[str] = None,
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

    if await is_slot_held_by_pending_reschedule(
        db,
        doctor_id,
        target_date,
        slot_time_val,
        exclude_appointment_id=exclude_appointment_id,
    ):
        return False

    # Check for existing booking
    start_of_day = datetime(
        target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc
    )
    end_of_day = start_of_day + timedelta(days=1)

    predicates = [
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date >= start_of_day,
        Appointment.appointment_date < end_of_day,
        Appointment.slot_time == slot_time_val,
        _active_slot_occupancy_condition(datetime.now(timezone.utc)),
    ]
    if exclude_appointment_id:
        predicates.append(Appointment.id != exclude_appointment_id)

    booked_result = await db.execute(select(Appointment).where(*predicates))
    booked_appointments = booked_result.scalars().all()
    if not booked_appointments:
        return True

    booked_appointments = await _filter_stale_reschedule_rows(db, booked_appointments)
    if booked_appointments:
        _debug_slot_appointments(
            doctor_id=doctor_id,
            target_date=target_date,
            phase="availability-blocked",
            appointments=booked_appointments,
        )
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
