"""Centralized notification dispatch for appointment events."""

from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.notification import Notification, NotificationType, NotificationPriority
from app.db.models.profile import Profile
import uuid


async def create_notification(
    db: AsyncSession,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    target_role: Optional[str] = None,
    dedup_window_seconds: int = 0,
) -> Notification:
    """Create and persist a notification. Core helper used by all notify_* functions.

    Args:
        dedup_window_seconds: If > 0, skip creation if same type/user notification exists within this window.
    """
    # Check for recent duplicate notifications if dedup window is specified
    if dedup_window_seconds > 0:
        cutoff_time = datetime.utcnow() - timedelta(seconds=dedup_window_seconds)
        recent_dup = await db.execute(
            select(Notification).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.type == notification_type,
                    Notification.created_at >= cutoff_time,
                )
            ).limit(1)
        )
        if recent_dup.scalar_one_or_none():
            # Duplicate found, return empty notification (or you could return the existing one)
            # Create a "dummy" notification object for consistency
            dummy = Notification(
                id=str(uuid.uuid4()),
                user_id=user_id,
                type=notification_type,
                priority=priority,
                title=title,
                message=message,
                action_url=action_url,
                data=metadata,
                target_role=target_role,
            )
            return dummy

    if target_role is None:
        # Derive from the owning profile so admin UIs can filter by role
        # without a join on every read.
        result = await db.execute(select(Profile.role).where(Profile.id == user_id))
        role_value = result.scalar_one_or_none()
        target_role = str(role_value).lower() if role_value else None

    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=notification_type,
        priority=priority,
        title=title,
        message=message,
        action_url=action_url,
        data=metadata,
        target_role=target_role,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_all_admins(
    db: AsyncSession,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
) -> int:
    """Fan a single event out to every admin account. Returns how many rows were created."""
    result = await db.execute(select(Profile.id).where(Profile.role == "admin"))
    admin_ids = [row[0] for row in result.all()]
    if not admin_ids:
        return 0

    # Build all notifications in one pass, add them as a batch, flush once.
    # Previously we called create_notification() per admin, which issued one
    # flush round-trip per recipient.
    notifications = [
        Notification(
            id=str(uuid.uuid4()),
            user_id=admin_id,
            type=notification_type,
            priority=priority,
            title=title,
            message=message,
            action_url=action_url,
            data=metadata,
            target_role="admin",
        )
        for admin_id in admin_ids
    ]
    db.add_all(notifications)
    await db.flush()
    return len(notifications)


async def notify_appointment_created(
    db: AsyncSession,
    doctor_id: str,
    patient_name: str,
    appointment_id: str,
    patient_id: str,
    appt_date_str: str,
) -> None:
    """Notify doctor about a new appointment booking."""
    await create_notification(
        db=db,
        user_id=doctor_id,
        notification_type=NotificationType.APPOINTMENT_BOOKED,
        title="New Appointment Request",
        message=f"{patient_name} has booked an appointment for {appt_date_str}",
        action_url="/doctor/appointments",
        metadata={
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
        },
        priority=NotificationPriority.HIGH,
    )


async def notify_appointment_confirmed(
    db: AsyncSession,
    patient_id: str,
    doctor_name: str,
    appointment_id: str,
    doctor_id: str,
    appt_date_str: str,
) -> None:
    """Notify patient that appointment is confirmed."""
    await create_notification(
        db=db,
        user_id=patient_id,
        notification_type=NotificationType.APPOINTMENT_CONFIRMED,
        title="Appointment Confirmed",
        message=f"Your appointment with {doctor_name} on {appt_date_str} has been confirmed",
        action_url="/patient/appointments",
        metadata={"appointment_id": appointment_id, "doctor_id": doctor_id},
        priority=NotificationPriority.HIGH,
    )


async def notify_appointment_cancelled(
    db: AsyncSession,
    notify_user_id: str,
    other_party_name: str,
    appointment_id: str,
    other_party_id: str,
    appt_date_str: str,
    cancelled_by_role: str,
    cancellation_reason: Optional[str] = None,
) -> None:
    """Notify the other party about a cancellation."""
    if cancelled_by_role == "doctor":
        message = f"Your appointment with {other_party_name} on {appt_date_str} has been cancelled"
        action_url = "/patient/appointments"
    else:
        message = f"{other_party_name} has cancelled the appointment on {appt_date_str}"
        action_url = "/doctor/appointments"

    if cancellation_reason:
        message = f"{message}. Reason: {cancellation_reason}"

    await create_notification(
        db=db,
        user_id=notify_user_id,
        notification_type=NotificationType.APPOINTMENT_CANCELLED,
        title="Appointment Cancelled",
        message=message,
        action_url=action_url,
        metadata={"appointment_id": appointment_id, "other_party_id": other_party_id},
        priority=NotificationPriority.HIGH,
    )


async def notify_appointment_completed(
    db: AsyncSession,
    patient_id: str,
    doctor_name: str,
    appointment_id: str,
    doctor_id: str,
) -> None:
    """Notify patient that appointment is completed."""
    await create_notification(
        db=db,
        user_id=patient_id,
        notification_type=NotificationType.APPOINTMENT_COMPLETED,
        title="Appointment Completed",
        message=f"Your appointment with {doctor_name} has been completed. Thank you for visiting!",
        action_url="/patient/appointments",
        metadata={"appointment_id": appointment_id, "doctor_id": doctor_id},
        priority=NotificationPriority.LOW,
    )


async def notify_reschedule_requested(
    db: AsyncSession,
    notify_user_id: str,
    requester_name: str,
    appointment_id: str,
    proposed_date_str: str,
    reason: Optional[str] = None,
) -> None:
    """Notify the other party about a reschedule request."""
    message = f"{requester_name} has requested to reschedule the appointment to {proposed_date_str}"
    if reason:
        message += f". Reason: {reason}"

    await create_notification(
        db=db,
        user_id=notify_user_id,
        notification_type=NotificationType.APPOINTMENT_BOOKED,
        title="Reschedule Requested",
        message=message,
        action_url="/patient/appointments",
        metadata={"appointment_id": appointment_id},
        priority=NotificationPriority.HIGH,
    )


async def notify_reschedule_responded(
    db: AsyncSession,
    notify_user_id: str,
    responder_name: str,
    appointment_id: str,
    accepted: bool,
    new_date_str: Optional[str] = None,
) -> None:
    """Notify requester about reschedule accept/reject."""
    if accepted:
        title = "Reschedule Accepted"
        message = f"{responder_name} has accepted the reschedule request"
        if new_date_str:
            message += f" for {new_date_str}"
    else:
        title = "Reschedule Rejected"
        message = f"{responder_name} has rejected the reschedule request"

    await create_notification(
        db=db,
        user_id=notify_user_id,
        notification_type=NotificationType.APPOINTMENT_CONFIRMED if accepted else NotificationType.APPOINTMENT_CANCELLED,
        title=title,
        message=message,
        action_url="/patient/appointments",
        metadata={"appointment_id": appointment_id},
        priority=NotificationPriority.HIGH,
    )
