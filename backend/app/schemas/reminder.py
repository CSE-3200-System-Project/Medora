"""
Reminder Schemas

Pydantic schemas for reminder CRUD operations.
Supports multiple reminder times per day based on dosage.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import logging

from app.core.config import settings


logger = logging.getLogger(__name__)


class ReminderType(str, Enum):
    MEDICATION = "medication"
    TEST = "test"


class ReminderCreate(BaseModel):
    """Schema for creating a reminder"""
    type: ReminderType
    item_name: str = Field(..., min_length=1, max_length=255)
    item_id: Optional[str] = None
    prescription_id: Optional[str] = None  # Link to prescription
    reminder_times: List[str] = Field(..., description="List of times in HH:MM format (e.g., ['08:00', '14:00', '20:00'])")
    days_of_week: Optional[List[int]] = Field(default=[0,1,2,3,4,5,6], description="0=Monday, 6=Sunday. Default = every day")
    timezone: Optional[str] = Field(default=None, description="IANA timezone, e.g. Asia/Dhaka")
    notes: Optional[str] = Field(None, max_length=500)


class ReminderUpdate(BaseModel):
    """Schema for updating a reminder"""
    item_name: Optional[str] = Field(None, min_length=1, max_length=255)
    reminder_times: Optional[List[str]] = Field(None, description="List of times in HH:MM format")
    days_of_week: Optional[List[int]] = None
    timezone: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ReminderResponse(BaseModel):
    """Schema for reminder response"""
    id: str
    user_id: str
    type: ReminderType
    item_name: str
    item_id: Optional[str] = None
    prescription_id: Optional[str] = None
    reminder_times: List[str] = []  # Multiple times per day
    days_of_week: List[int] = [0,1,2,3,4,5,6]
    timezone: str = "Asia/Dhaka"
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReminderListResponse(BaseModel):
    """Schema for paginated reminder list"""
    reminders: List[ReminderResponse]
    total: int


def validate_timezone_name(timezone_name: str) -> str:
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        # On Windows, missing tzdata can make valid IANA names fail lookup.
        try:
            ZoneInfo("UTC")
        except ZoneInfoNotFoundError:
            if timezone_name in {"UTC", settings.DEFAULT_REMINDER_TIMEZONE}:
                logger.warning(
                    "Timezone database is unavailable; accepting timezone '%s'. Install tzdata for full validation.",
                    timezone_name,
                )
                return timezone_name

            raise ValueError(
                "Timezone database is unavailable on the server. Install tzdata or use UTC."
            ) from exc

        raise ValueError(f"Invalid timezone '{timezone_name}'") from exc
    return timezone_name
