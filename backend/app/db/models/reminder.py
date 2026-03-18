"""
Reminder Model

Stores medication and test reminders for patients.
Supports multiple reminder times per day (e.g., 3 times a day for medication).
"""
import enum
from sqlalchemy import String, ForeignKey, Boolean, JSON, Enum, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid
from datetime import datetime


class ReminderType(str, enum.Enum):
    MEDICATION = "medication"
    TEST = "test"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False)
    
    # Type of reminder
    type: Mapped[ReminderType] = mapped_column(
        Enum(ReminderType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    
    # Item reference
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Reference to medication/test
    prescription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Reference to prescription
    
    # Multiple reminder times (e.g., ["08:00", "14:00", "20:00"] for 3 times a day)
    reminder_times: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    
    # Days of week for recurring (0=Monday, 6=Sunday). Empty array = every day.
    days_of_week: Mapped[list | None] = mapped_column(JSON, nullable=True, default=lambda: [0,1,2,3,4,5,6])
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Dhaka")
    
    # Additional details
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        onupdate=func.now()
    )

    # Relationship
    user = relationship("Profile", backref="reminders")


class ReminderDeliveryLog(Base):
    __tablename__ = "reminder_delivery_logs"
    __table_args__ = (
        UniqueConstraint("reminder_id", "scheduled_for_utc", name="uq_reminder_delivery_log_reminder_scheduled"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reminder_id: Mapped[str] = mapped_column(String, ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False)
    scheduled_for_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notification_id: Mapped[str | None] = mapped_column(String, ForeignKey("notifications.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
