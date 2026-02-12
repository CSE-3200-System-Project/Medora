import enum
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base
import uuid


class NotificationType(str, enum.Enum):
    # Appointment related
    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_CONFIRMED = "appointment_confirmed"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_COMPLETED = "appointment_completed"
    APPOINTMENT_REMINDER = "appointment_reminder"
    
    # Patient related (for doctors)
    NEW_PATIENT = "new_patient"
    PATIENT_CHECKIN = "patient_checkin"
    
    # Doctor related (for patients)
    DOCTOR_AVAILABLE = "doctor_available"
    
    # Access related
    ACCESS_REQUESTED = "access_requested"
    ACCESS_GRANTED = "access_granted"
    ACCESS_REVOKED = "access_revoked"
    
    # Verification related
    VERIFICATION_PENDING = "verification_pending"
    VERIFICATION_APPROVED = "verification_approved"
    VERIFICATION_REJECTED = "verification_rejected"
    
    # Profile related
    PROFILE_UPDATE = "profile_update"
    ONBOARDING_REMINDER = "onboarding_reminder"
    
    # System
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    WELCOME = "welcome"
    
    # Medication & Test Reminders
    MEDICATION_REMINDER = "medication_reminder"
    TEST_REMINDER = "test_reminder"
    
    # Consultation & Prescription
    CONSULTATION_STARTED = "consultation_started"
    CONSULTATION_COMPLETED = "consultation_completed"
    PRESCRIPTION_CREATED = "prescription_created"
    PRESCRIPTION_ACCEPTED = "prescription_accepted"
    PRESCRIPTION_REJECTED = "prescription_rejected"


class NotificationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False)
    
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    priority: Mapped[NotificationPriority] = mapped_column(
        Enum(NotificationPriority, values_callable=lambda x: [e.value for e in x]), 
        default=NotificationPriority.MEDIUM
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Navigation action URL (e.g., /patient/appointments, /doctor/appointments/123)
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Additional data (e.g., appointment_id, doctor_id, patient_id)
    data: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("Profile", backref="notifications")
