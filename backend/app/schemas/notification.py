from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class NotificationType(str, Enum):
    # Appointment related
    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_CONFIRMED = "appointment_confirmed"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_COMPLETED = "appointment_completed"
    APPOINTMENT_REMINDER = "appointment_reminder"
    APPOINTMENT_RESCHEDULE_REQUEST = "appointment_reschedule_request"
    APPOINTMENT_RESCHEDULE_ACCEPTED = "appointment_reschedule_accepted"
    APPOINTMENT_RESCHEDULE_REJECTED = "appointment_reschedule_rejected"
    
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


class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationCreate(BaseModel):
    """Schema for creating a notification (internal use)"""
    user_id: str
    type: NotificationType
    priority: NotificationPriority = NotificationPriority.MEDIUM
    title: str = Field(..., max_length=255)
    message: str
    action_url: Optional[str] = None
    metadata: Optional[dict] = None


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str
    user_id: str
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    action_url: Optional[str] = None
    metadata: Optional[dict] = None
    is_read: bool
    is_archived: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class NotificationMarkRead(BaseModel):
    """Schema for marking notifications as read"""
    notification_ids: List[str]


class NotificationUpdate(BaseModel):
    """Schema for updating notification"""
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None


class UnreadCountResponse(BaseModel):
    """Schema for unread count response"""
    unread_count: int


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str
