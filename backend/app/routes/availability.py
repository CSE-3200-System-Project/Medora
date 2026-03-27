"""Doctor availability management and public slot lookup endpoints."""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.profile import Profile
from app.db.models.enums import UserRole
from app.services import availability_service, slot_service
from app.schemas.availability import (
    WeeklyScheduleUpdate,
    ExceptionCreate,
    ScheduleOverrideCreate,
)
from sqlalchemy import select

router = APIRouter()


# ── Public Endpoints ──


@router.get("/{doctor_id}")
async def get_doctor_availability(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a doctor's structured weekly schedule, exceptions, and overrides."""
    schedule = await availability_service.get_doctor_schedule(db, doctor_id)
    return schedule


@router.get("/{doctor_id}/slots/{target_date}")
async def get_available_slots(
    doctor_id: str,
    target_date: date,
    db: AsyncSession = Depends(get_db),
):
    """
    Get available time slots for a doctor on a specific date.
    Public endpoint for patient booking.
    """
    result = await slot_service.get_available_slots(db, doctor_id, target_date)
    return result


# ── Doctor-only Endpoints ──


@router.put("/weekly")
async def update_weekly_schedule(
    schedule: WeeklyScheduleUpdate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Replace the entire weekly availability schedule for the current doctor."""
    doctor_id = user.id

    # Verify doctor role
    result = await db.execute(select(Profile).where(Profile.id == doctor_id))
    profile = result.scalar_one_or_none()
    if not profile or "doctor" not in str(profile.role).lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can update availability",
        )

    days_data = [
        {
            "day_of_week": d.day_of_week,
            "doctor_location_id": d.doctor_location_id,
            "is_active": d.is_active,
            "time_blocks": [
                {
                    "start_time": tb.start_time,
                    "end_time": tb.end_time,
                    "slot_duration_minutes": tb.slot_duration_minutes,
                }
                for tb in d.time_blocks
            ],
        }
        for d in schedule.days
    ]

    updated = await availability_service.set_weekly_availability(
        db, doctor_id, days_data, schedule.appointment_duration
    )
    await db.commit()
    return updated


@router.post("/exception", status_code=status.HTTP_201_CREATED)
async def add_exception(
    data: ExceptionCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Add a leave/holiday exception for the current doctor."""
    doctor_id = user.id

    result = await db.execute(select(Profile).where(Profile.id == doctor_id))
    profile = result.scalar_one_or_none()
    if not profile or "doctor" not in str(profile.role).lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can manage exceptions",
        )

    try:
        exception = await availability_service.add_exception(
            db,
            doctor_id,
            data.exception_date,
            data.doctor_location_id,
            data.is_available,
            data.reason,
        )
        await db.commit()
        return {
            "id": exception.id,
            "doctor_id": exception.doctor_id,
            "doctor_location_id": exception.doctor_location_id,
            "exception_date": exception.exception_date.isoformat(),
            "is_available": exception.is_available,
            "reason": exception.reason,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/exception/{exception_id}")
async def delete_exception(
    exception_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove a leave/holiday exception."""
    doctor_id = user.id

    removed = await availability_service.remove_exception(db, exception_id, doctor_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exception not found",
        )
    await db.commit()
    return {"detail": "Exception removed"}


@router.post("/override", status_code=status.HTTP_201_CREATED)
async def add_schedule_override(
    data: ScheduleOverrideCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Add a custom schedule override for a specific date."""
    doctor_id = user.id

    result = await db.execute(select(Profile).where(Profile.id == doctor_id))
    profile = result.scalar_one_or_none()
    if not profile or "doctor" not in str(profile.role).lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can manage overrides",
        )

    override = await availability_service.add_schedule_override(
        db,
        doctor_id,
        data.override_date,
        data.doctor_location_id,
        data.start_time,
        data.end_time,
        data.slot_duration_minutes,
    )
    await db.commit()
    return {
        "id": override.id,
        "doctor_id": override.doctor_id,
        "doctor_location_id": override.doctor_location_id,
        "override_date": override.override_date.isoformat(),
        "start_time": override.start_time.isoformat(),
        "end_time": override.end_time.isoformat(),
        "slot_duration_minutes": override.slot_duration_minutes,
    }


@router.delete("/override/{override_id}")
async def delete_schedule_override(
    override_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Remove a schedule override."""
    doctor_id = user.id

    removed = await availability_service.remove_schedule_override(
        db, override_id, doctor_id
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Override not found",
        )
    await db.commit()
    return {"detail": "Override removed"}
