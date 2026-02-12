"""
Reminder Schemas

Pydantic schemas for reminder CRUD operations.
Supports multiple reminder times per day based on dosage.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


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
    days_of_week: Optional[List[int]] = Field(default=[0,1,2,3,4,5,6], description="0=Sunday, 6=Saturday. Default = every day")
    notes: Optional[str] = Field(None, max_length=500)


class ReminderUpdate(BaseModel):
    """Schema for updating a reminder"""
    item_name: Optional[str] = Field(None, min_length=1, max_length=255)
    reminder_times: Optional[List[str]] = Field(None, description="List of times in HH:MM format")
    days_of_week: Optional[List[int]] = None
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
