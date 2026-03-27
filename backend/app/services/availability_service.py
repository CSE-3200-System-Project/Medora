"""Doctor availability CRUD operations."""

from datetime import date, time
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.doctor import DoctorProfile
from app.db.models.doctor_availability import (
    DoctorAvailability,
    DoctorTimeBlock,
    DoctorException,
    DoctorScheduleOverride,
)
import uuid


# Day name mapping for backward compat sync
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


async def get_doctor_schedule(
    db: AsyncSession,
    doctor_id: str,
) -> dict:
    """Get full structured schedule: weekly availability + exceptions + overrides."""
    # Weekly availability
    avail_result = await db.execute(
        select(DoctorAvailability)
        .where(DoctorAvailability.doctor_id == doctor_id)
        .order_by(DoctorAvailability.day_of_week)
    )
    availabilities = avail_result.scalars().all()

    days = []
    for avail in availabilities:
        blocks_result = await db.execute(
            select(DoctorTimeBlock)
            .where(DoctorTimeBlock.availability_id == avail.id)
            .order_by(DoctorTimeBlock.start_time)
        )
        blocks = blocks_result.scalars().all()

        days.append({
            "id": avail.id,
            "day_of_week": avail.day_of_week,
            "doctor_location_id": avail.doctor_location_id,
            "is_active": avail.is_active,
            "time_blocks": [
                {
                    "id": b.id,
                    "start_time": b.start_time.isoformat(),
                    "end_time": b.end_time.isoformat(),
                    "slot_duration_minutes": b.slot_duration_minutes,
                }
                for b in blocks
            ],
        })

    # Exceptions
    exc_result = await db.execute(
        select(DoctorException)
        .where(DoctorException.doctor_id == doctor_id)
        .order_by(DoctorException.exception_date)
    )
    exceptions = exc_result.scalars().all()

    # Overrides
    ovr_result = await db.execute(
        select(DoctorScheduleOverride)
        .where(DoctorScheduleOverride.doctor_id == doctor_id)
        .order_by(DoctorScheduleOverride.override_date)
    )
    overrides = ovr_result.scalars().all()

    return {
        "doctor_id": doctor_id,
        "days": days,
        "exceptions": [
            {
                "id": e.id,
                "doctor_id": e.doctor_id,
                "doctor_location_id": e.doctor_location_id,
                "exception_date": e.exception_date.isoformat(),
                "is_available": e.is_available,
                "reason": e.reason,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exceptions
        ],
        "overrides": [
            {
                "id": o.id,
                "doctor_id": o.doctor_id,
                "doctor_location_id": o.doctor_location_id,
                "override_date": o.override_date.isoformat(),
                "start_time": o.start_time.isoformat(),
                "end_time": o.end_time.isoformat(),
                "slot_duration_minutes": o.slot_duration_minutes,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in overrides
        ],
    }


async def set_weekly_availability(
    db: AsyncSession,
    doctor_id: str,
    days: list[dict],
    appointment_duration: Optional[int] = None,
) -> dict:
    """
    Replace the entire weekly schedule for a doctor.

    days: list of {day_of_week: int, is_active: bool, time_blocks: [{start_time, end_time, slot_duration_minutes}]}

    Also syncs back to DoctorProfile.day_time_slots JSON for backward compatibility.
    """
    # Delete existing availability and time blocks for this doctor
    existing = await db.execute(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id
        )
    )
    for avail in existing.scalars().all():
        await db.execute(
            delete(DoctorTimeBlock).where(
                DoctorTimeBlock.availability_id == avail.id
            )
        )
    await db.execute(
        delete(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id
        )
    )

    # Create new availability
    day_time_slots_json: dict[str, list[str]] = {}

    for day_data in days:
        day_of_week = day_data["day_of_week"]
        doctor_location_id = day_data.get("doctor_location_id")
        is_active = day_data.get("is_active", True)
        time_blocks = day_data.get("time_blocks", [])

        avail_id = str(uuid.uuid4())
        avail = DoctorAvailability(
            id=avail_id,
            doctor_id=doctor_id,
            doctor_location_id=doctor_location_id,
            day_of_week=day_of_week,
            is_active=is_active,
        )
        db.add(avail)

        day_name = DAY_NAMES[day_of_week]
        ranges: list[str] = []

        for block_data in time_blocks:
            start = block_data["start_time"]
            end = block_data["end_time"]
            duration = block_data.get("slot_duration_minutes", appointment_duration or 30)

            # Handle both time objects and strings
            if isinstance(start, str):
                start_time = time.fromisoformat(start)
            else:
                start_time = start
            if isinstance(end, str):
                end_time = time.fromisoformat(end)
            else:
                end_time = end

            block = DoctorTimeBlock(
                id=str(uuid.uuid4()),
                availability_id=avail_id,
                start_time=start_time,
                end_time=end_time,
                slot_duration_minutes=duration,
            )
            db.add(block)

            # Build legacy time range string for backward compat
            ranges.append(_format_time_range(start_time, end_time))

        if is_active and ranges:
            day_time_slots_json[day_name] = ranges

    # Sync to DoctorProfile.day_time_slots for backward compatibility
    doc_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.profile_id == doctor_id)
    )
    doctor = doc_result.scalar_one_or_none()
    if doctor:
        doctor.day_time_slots = day_time_slots_json
        if appointment_duration:
            doctor.appointment_duration = appointment_duration

    await db.flush()
    return await get_doctor_schedule(db, doctor_id)


async def add_exception(
    db: AsyncSession,
    doctor_id: str,
    exception_date: date,
    doctor_location_id: Optional[str] = None,
    is_available: bool = False,
    reason: Optional[str] = None,
) -> DoctorException:
    """Add an exception date (leave/holiday) for a doctor."""
    exception = DoctorException(
        id=str(uuid.uuid4()),
        doctor_id=doctor_id,
        doctor_location_id=doctor_location_id,
        exception_date=exception_date,
        is_available=is_available,
        reason=reason,
    )
    db.add(exception)
    await db.flush()
    return exception


async def remove_exception(
    db: AsyncSession,
    exception_id: str,
    doctor_id: str,
) -> bool:
    """Remove an exception date. Returns True if found and deleted."""
    result = await db.execute(
        select(DoctorException).where(
            DoctorException.id == exception_id,
            DoctorException.doctor_id == doctor_id,
        )
    )
    exception = result.scalar_one_or_none()
    if not exception:
        return False
    await db.delete(exception)
    await db.flush()
    return True


async def add_schedule_override(
    db: AsyncSession,
    doctor_id: str,
    override_date: date,
    doctor_location_id: Optional[str],
    start_time: time,
    end_time: time,
    slot_duration_minutes: int = 30,
) -> DoctorScheduleOverride:
    """Add a custom schedule for a specific date."""
    override = DoctorScheduleOverride(
        id=str(uuid.uuid4()),
        doctor_id=doctor_id,
        doctor_location_id=doctor_location_id,
        override_date=override_date,
        start_time=start_time,
        end_time=end_time,
        slot_duration_minutes=slot_duration_minutes,
    )
    db.add(override)
    await db.flush()
    return override


async def remove_schedule_override(
    db: AsyncSession,
    override_id: str,
    doctor_id: str,
) -> bool:
    """Remove a schedule override. Returns True if found and deleted."""
    result = await db.execute(
        select(DoctorScheduleOverride).where(
            DoctorScheduleOverride.id == override_id,
            DoctorScheduleOverride.doctor_id == doctor_id,
        )
    )
    override = result.scalar_one_or_none()
    if not override:
        return False
    await db.delete(override)
    await db.flush()
    return True


def _format_time_range(start: time, end: time) -> str:
    """Format a time range as '9:00 AM - 1:00 PM'."""
    def _fmt(t: time) -> str:
        h = t.hour % 12 or 12
        period = "AM" if t.hour < 12 else "PM"
        return f"{h}:{t.minute:02d} {period}"
    return f"{_fmt(start)} - {_fmt(end)}"
