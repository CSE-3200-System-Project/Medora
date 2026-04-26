"""
Reminder Routes

CRUD endpoints for medication and test reminders.
Supports multiple reminder times per day based on dosage.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.dependencies import get_db
from app.core.config import settings
from app.core.http_cache import build_etag, is_not_modified, set_cache_headers, not_modified_response
from app.routes.auth import get_current_user_token
from app.db.models.reminder import Reminder, ReminderType
from app.schemas.reminder import (
    ReminderCreate,
    ReminderUpdate,
    ReminderResponse,
    ReminderListResponse,
    validate_timezone_name,
)
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter()


def validate_time_string(time_str: str) -> str:
    """Validate HH:MM format and return normalized string."""
    try:
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("Invalid time")
        return f"{hour:02d}:{minute:02d}"
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time format '{time_str}'. Use HH:MM (e.g., 09:00)"
        )


def normalize_reminder_times(reminder_times: list[str]) -> list[str]:
    normalized = sorted({validate_time_string(time_str) for time_str in reminder_times})
    if not normalized:
        raise HTTPException(status_code=400, detail="At least one reminder time is required")
    return normalized


def normalize_days_of_week(days: list[int] | None) -> list[int]:
    if days is None or len(days) == 0:
        return [0, 1, 2, 3, 4, 5, 6]

    normalized = sorted(set(days))
    if any(day < 0 or day > 6 for day in normalized):
        raise HTTPException(status_code=400, detail="days_of_week values must be between 0 and 6 (0=Monday, 6=Sunday)")
    return normalized


def resolve_timezone(explicit_timezone: str | None, request: Request) -> str:
    candidate = explicit_timezone or request.headers.get("x-timezone") or settings.DEFAULT_REMINDER_TIMEZONE
    try:
        return validate_timezone_name(candidate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def build_reminder_response(reminder: Reminder) -> ReminderResponse:
    """Build response object from reminder model."""
    return ReminderResponse(
        id=reminder.id,
        user_id=reminder.user_id,
        type=reminder.type,
        item_name=reminder.item_name,
        item_id=reminder.item_id,
        prescription_id=reminder.prescription_id,
        reminder_times=reminder.reminder_times or [],
        days_of_week=reminder.days_of_week or [0,1,2,3,4,5,6],
        timezone=reminder.timezone or settings.DEFAULT_REMINDER_TIMEZONE,
        notes=reminder.notes,
        is_active=reminder.is_active,
        created_at=reminder.created_at,
        updated_at=reminder.updated_at,
    )


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reminder for medication or test."""
    validated_times = normalize_reminder_times(data.reminder_times)
    normalized_days = normalize_days_of_week(data.days_of_week)
    timezone_name = resolve_timezone(data.timezone, request)
    
    reminder = Reminder(
        id=str(uuid.uuid4()),
        user_id=user.id,
        type=ReminderType(data.type.value),
        item_name=data.item_name,
        item_id=data.item_id,
        prescription_id=data.prescription_id,
        reminder_times=validated_times,
        days_of_week=normalized_days,
        timezone=timezone_name,
        notes=data.notes,
        is_active=True,
    )
    
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    
    return build_reminder_response(reminder)


@router.get("/", response_model=ReminderListResponse)
async def get_reminders(
    request: Request,
    response: Response,
    type_filter: Optional[str] = Query(None, description="Filter by type: medication, test"),
    active_only: bool = Query(True, description="Only return active reminders"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get all reminders for the current user."""
    conditions = [Reminder.user_id == user.id]

    if active_only:
        conditions.append(Reminder.is_active == True)

    if type_filter:
        try:
            reminder_type = ReminderType(type_filter.lower())
            conditions.append(Reminder.type == reminder_type)
        except ValueError:
            pass  # Ignore invalid type filter

    # Get reminders
    query = (
        select(Reminder)
        .where(and_(*conditions))
        .order_by(Reminder.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    reminders = result.scalars().all()

    # Get total count
    count_query = select(func.count(Reminder.id)).where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    payload = ReminderListResponse(
        reminders=[build_reminder_response(r) for r in reminders],
        total=total,
    )
    body_for_etag = payload.model_dump(mode="json")
    etag = build_etag(body_for_etag)
    if is_not_modified(request, etag):
        return not_modified_response(response)
    set_cache_headers(response, etag=etag, max_age_seconds=15, stale_while_revalidate_seconds=120)
    return payload


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific reminder by ID."""
    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.id == reminder_id,
                Reminder.user_id == user.id,
            )
        )
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    return build_reminder_response(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: str,
    data: ReminderUpdate,
    request: Request,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Update a reminder."""
    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.id == reminder_id,
                Reminder.user_id == user.id,
            )
        )
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    # Update fields
    if data.item_name is not None:
        reminder.item_name = data.item_name
    if data.reminder_times is not None:
        validated_times = normalize_reminder_times(data.reminder_times)
        reminder.reminder_times = validated_times
    if data.days_of_week is not None:
        reminder.days_of_week = normalize_days_of_week(data.days_of_week)
    if data.timezone is not None:
        reminder.timezone = resolve_timezone(data.timezone, request)
    if data.notes is not None:
        reminder.notes = data.notes
    if data.is_active is not None:
        reminder.is_active = data.is_active
    
    reminder.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(reminder)
    
    return build_reminder_response(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a reminder."""
    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.id == reminder_id,
                Reminder.user_id == user.id,
            )
        )
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    await db.delete(reminder)
    await db.commit()


@router.post("/{reminder_id}/toggle", response_model=ReminderResponse)
async def toggle_reminder(
    reminder_id: str,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Toggle a reminder's active status."""
    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.id == reminder_id,
                Reminder.user_id == user.id,
            )
        )
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    reminder.is_active = not reminder.is_active
    reminder.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(reminder)
    
    return build_reminder_response(reminder)
