"""
Reminder Routes

CRUD endpoints for medication and test reminders.
Supports multiple reminder times per day based on dosage.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.dependencies import get_db
from app.routes.auth import get_current_user_token
from app.db.models.reminder import Reminder, ReminderType
from app.schemas.reminder import (
    ReminderCreate,
    ReminderUpdate,
    ReminderResponse,
    ReminderListResponse,
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
        notes=reminder.notes,
        is_active=reminder.is_active,
        created_at=reminder.created_at,
        updated_at=reminder.updated_at,
    )


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    user: any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reminder for medication or test."""
    # Validate and normalize all reminder times
    validated_times = [validate_time_string(t) for t in data.reminder_times]
    
    if not validated_times:
        raise HTTPException(status_code=400, detail="At least one reminder time is required")
    
    reminder = Reminder(
        id=str(uuid.uuid4()),
        user_id=user.id,
        type=ReminderType(data.type.value),
        item_name=data.item_name,
        item_id=data.item_id,
        prescription_id=data.prescription_id,
        reminder_times=validated_times,
        days_of_week=data.days_of_week if data.days_of_week else [0,1,2,3,4,5,6],
        notes=data.notes,
        is_active=True,
    )
    
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    
    return build_reminder_response(reminder)


@router.get("/", response_model=ReminderListResponse)
async def get_reminders(
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
            reminder_type = ReminderType(type_filter)
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
    
    return ReminderListResponse(
        reminders=[build_reminder_response(r) for r in reminders],
        total=total,
    )


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
        validated_times = [validate_time_string(t) for t in data.reminder_times]
        if not validated_times:
            raise HTTPException(status_code=400, detail="At least one reminder time is required")
        reminder.reminder_times = validated_times
    if data.days_of_week is not None:
        reminder.days_of_week = data.days_of_week
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
