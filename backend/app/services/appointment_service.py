"""Transactional appointment booking with state machine and audit logging."""

from datetime import date, time, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

import logging
import re
import uuid

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.appointment_audit import AppointmentAuditLog
from app.db.models.appointment_request import (
    AdminApprovalStatus,
    AppointmentCancellationRequest,
    AppointmentRescheduleRequest,
    RescheduleRequestStatus,
    RequestedByRole,
)
from app.db.models.notification import NotificationPriority, NotificationType
from app.db.models.profile import Profile
from app.services import notification_service, slot_service

logger = logging.getLogger(__name__)


CANCELLATION_STATUSES: set[AppointmentStatus] = {
    AppointmentStatus.CANCELLED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.CANCELLED_BY_DOCTOR,
}
NON_OCCUPYING_STATUSES: set[AppointmentStatus] = CANCELLATION_STATUSES | {
    AppointmentStatus.NO_SHOW,
}
SLOT_OCCUPYING_STATUSES: set[AppointmentStatus] = {
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING_ADMIN_REVIEW,
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
    AppointmentStatus.RESCHEDULE_REQUESTED,
    AppointmentStatus.CANCEL_REQUESTED,
}
APPOINTMENT_CANCEL_BUFFER_MINUTES = 60
SOFT_HOLD_DURATION_MINUTES = 15
RESCHEDULE_REQUEST_TTL_HOURS = 24
SLOT_NOTE_PATTERN = re.compile(
    r"Slot:\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
    re.IGNORECASE,
)
MEDORA_TIMEZONE = ZoneInfo("Asia/Dhaka")


def get_role_based_cancel_status(performed_by_role: str) -> AppointmentStatus:
    role = (performed_by_role or "").strip().lower()
    if role == "patient":
        return AppointmentStatus.CANCELLED_BY_PATIENT
    if role == "doctor":
        return AppointmentStatus.CANCELLED_BY_DOCTOR
    return AppointmentStatus.CANCELLED


def validate_cancellation_window(
    appointment: Appointment,
    *,
    now_utc: Optional[datetime] = None,
) -> None:
    now = now_utc or datetime.now(timezone.utc)
    appointment_time = appointment.appointment_date
    if appointment_time.tzinfo is None:
        appointment_time = appointment_time.replace(tzinfo=timezone.utc)

    cutoff = now + timedelta(minutes=APPOINTMENT_CANCEL_BUFFER_MINUTES)
    if appointment_time <= cutoff:
        raise ValueError(
            f"Appointments can only be cancelled at least {APPOINTMENT_CANCEL_BUFFER_MINUTES} minutes before the scheduled time"
        )


ALLOWED_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.PENDING: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING_ADMIN_REVIEW,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.PENDING_ADMIN_REVIEW: {
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
        AppointmentStatus.CONFIRMED,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION: {
        AppointmentStatus.CONFIRMED,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION: {
        AppointmentStatus.CONFIRMED,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.CONFIRMED: {
        AppointmentStatus.COMPLETED,
        AppointmentStatus.RESCHEDULE_REQUESTED,
        AppointmentStatus.NO_SHOW,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.RESCHEDULE_REQUESTED: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.CANCEL_REQUESTED: {
        AppointmentStatus.CONFIRMED,
    }
    | CANCELLATION_STATUSES,
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
    AppointmentStatus.CANCELLED_BY_PATIENT: set(),
    AppointmentStatus.CANCELLED_BY_DOCTOR: set(),
    AppointmentStatus.NO_SHOW: set(),
}


def is_pending_hold_expired(appointment: Appointment, now_utc: Optional[datetime] = None) -> bool:
    now = now_utc or datetime.now(timezone.utc)
    if appointment.status != AppointmentStatus.PENDING:
        return False
    if appointment.hold_expires_at is None:
        return False
    hold_expires_at = appointment.hold_expires_at
    if hold_expires_at.tzinfo is None:
        hold_expires_at = hold_expires_at.replace(tzinfo=timezone.utc)
    return hold_expires_at <= now


async def _acquire_slot_lock(
    db: AsyncSession,
    *,
    doctor_id: str,
    target_date: date,
    slot_time_value: time,
) -> None:
    """Serialize bookings for the same doctor/date/time using transaction-scoped advisory lock."""
    lock_key = f"{doctor_id}:{target_date.isoformat()}:{slot_time_value.isoformat()}"
    await db.execute(
        # nosec - parameterized lock key
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": lock_key},
    )


def _slot_label_from_time(value: time) -> str:
    return datetime(2000, 1, 1, value.hour, value.minute).strftime("%I:%M %p").lstrip("0")


def _appointment_schedule_label(appointment: Appointment) -> str:
    scheduled_at = appointment.appointment_date
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    local_date_label = scheduled_at.astimezone(MEDORA_TIMEZONE).strftime("%b %d, %Y")
    if appointment.slot_time:
        time_label = _slot_label_from_time(appointment.slot_time)
    else:
        time_label = scheduled_at.astimezone(MEDORA_TIMEZONE).strftime("%I:%M %p").lstrip("0")

    return f"{local_date_label} at {time_label}"


def _replace_slot_note(notes: Optional[str], new_slot: time) -> Optional[str]:
    """Keep notes consistent with the current appointment slot to avoid stale slot references."""
    if not notes:
        return notes

    replacement = f"Slot: {_slot_label_from_time(new_slot)}"
    if SLOT_NOTE_PATTERN.search(notes):
        return SLOT_NOTE_PATTERN.sub(replacement, notes)
    return notes


def _slot_occupancy_condition(now_utc: datetime):
    return and_(
        Appointment.status.in_(list(SLOT_OCCUPYING_STATUSES)),
        or_(
            Appointment.status != AppointmentStatus.PENDING,
            Appointment.hold_expires_at.is_(None),
            Appointment.hold_expires_at > now_utc,
        ),
    )


def _build_canonical_appointment_datetime(target_date: date, slot_time_value: time) -> datetime:
    local_datetime = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        slot_time_value.hour,
        slot_time_value.minute,
        tzinfo=MEDORA_TIMEZONE,
    )
    return local_datetime.astimezone(timezone.utc)


async def _cancel_stale_old_slot_duplicates(
    db: AsyncSession,
    *,
    appointment: Appointment,
    old_date: date,
    old_slot_time: Optional[time],
    performed_by_id: str,
    now_utc: datetime,
) -> list[str]:
    """Cancel stale active duplicates on the old slot after a successful reschedule accept."""
    if old_slot_time is None:
        return []

    start_of_day = datetime(old_date.year, old_date.month, old_date.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    stale_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.id != appointment.id,
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.patient_id == appointment.patient_id,
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date < end_of_day,
            Appointment.slot_time == old_slot_time,
            _slot_occupancy_condition(now_utc),
        )
        .with_for_update()
    )
    stale_rows = stale_result.scalars().all()

    cleaned_ids: list[str] = []
    for stale in stale_rows:
        previous_status = stale.status.value if hasattr(stale.status, "value") else str(stale.status)
        stale.status = AppointmentStatus.CANCELLED
        stale.cancelled_by_id = performed_by_id
        stale.cancelled_at = stale.cancelled_at or now_utc
        stale.cancellation_reason_key = stale.cancellation_reason_key or "SYSTEM_STALE_SLOT_CLEANUP"
        stale.cancellation_reason_note = (
            stale.cancellation_reason_note
            or "Auto-cancelled stale duplicate slot row after reschedule acceptance"
        )
        stale.hold_expires_at = None
        cleaned_ids.append(stale.id)

        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=stale.id,
                action_type="stale_slot_cleanup",
                performed_by_id=performed_by_id,
                performed_by_role="system",
                previous_status=previous_status,
                new_status=AppointmentStatus.CANCELLED.value,
                notes="Auto-cancelled stale duplicate during reschedule acceptance",
            )
        )

        await sync_calendar_on_status_change(db, stale, AppointmentStatus.CANCELLED)

    if cleaned_ids:
        logger.warning(
            "Reschedule cleanup cancelled stale slot rows appointment_id=%s cleaned_ids=%s old_date=%s old_slot=%s",
            appointment.id,
            cleaned_ids,
            old_date.isoformat(),
            old_slot_time.isoformat(),
        )

    return cleaned_ids


async def _profile_name(db: AsyncSession, profile_id: str, default: str = "User") -> str:
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return default
    full_name = f"{(profile.first_name or '').strip()} {(profile.last_name or '').strip()}".strip()
    return full_name or default


async def _emit_domain_event(
    db: AsyncSession,
    *,
    event_name: str,
    appointment: Appointment,
    actor_id: str,
    actor_role: str,
    reschedule_request: Optional[AppointmentRescheduleRequest] = None,
    reason: Optional[str] = None,
    notify_target: Optional[str] = None,
) -> None:
    actor_role_norm = (actor_role or "unknown").lower()
    actor_name = await _profile_name(db, actor_id, "User")
    doctor_name = await _profile_name(db, appointment.doctor_id, "Doctor")
    patient_name = await _profile_name(db, appointment.patient_id, "Patient")
    schedule_label = _appointment_schedule_label(appointment)

    metadata: dict[str, str | None] = {
        "appointment_id": appointment.id,
        "reschedule_request_id": reschedule_request.id if reschedule_request else None,
        "actor_role": actor_role_norm,
        "notify_target": notify_target,
        "proposed_date": reschedule_request.proposed_date.isoformat() if reschedule_request else None,
        "proposed_time": reschedule_request.proposed_time.isoformat() if reschedule_request else None,
        "reason": reason,
    }

    title = None
    message = None
    notify_user_id = None
    notification_type = None
    action_url = "/patient/appointments"

    if event_name == "appointment.created":
        # New bookings now land in PENDING_ADMIN_REVIEW; doctor is notified only after admin approval.
        # We notify the patient that their request is under review.
        notification_type = NotificationType.APPOINTMENT_BOOKED
        title = "Appointment Request Submitted"
        message = (
            f"Your appointment request with Dr. {doctor_name} on {schedule_label} "
            "has been submitted and is awaiting admin review."
        )
        notify_user_id = appointment.patient_id
        action_url = "/patient/appointments"

    elif event_name == "appointment.confirmed":
        notification_type = NotificationType.APPOINTMENT_CONFIRMED
        title = "Appointment Confirmed"
        message = f"Your appointment with Dr. {doctor_name} on {schedule_label} has been confirmed"
        notify_user_id = appointment.patient_id
        action_url = "/patient/appointments"

    elif event_name == "appointment.cancelled":
        notification_type = NotificationType.APPOINTMENT_CANCELLED
        reason_token = (appointment.cancellation_reason_key or reason or "").strip().upper()
        is_hold_expired = reason_token == "HOLD_EXPIRED" or "HOLD_EXPIRED" in reason_token

        if is_hold_expired:
            title = "Appointment Request Expired"
            message = (
                "Your appointment request expired because the doctor did not confirm in time."
            )
            notify_user_id = appointment.patient_id
            action_url = "/patient/appointments"
        elif appointment.cancelled_by_id == appointment.doctor_id:
            title = "Appointment Cancelled"
            message = f"Your appointment with Dr. {doctor_name} on {schedule_label} was cancelled"
            notify_user_id = appointment.patient_id
            action_url = "/patient/appointments"
        else:
            title = "Appointment Cancelled"
            message = f"{patient_name} cancelled the appointment on {schedule_label}"
            notify_user_id = appointment.doctor_id
            action_url = "/doctor/appointments"
        if reason and not is_hold_expired:
            message = f"{message}. Reason: {reason}"

    elif event_name == "reschedule.requested" and reschedule_request:
        # Admin-mediated: requester is notified that their request is awaiting admin review.
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_REQUEST
        title = "Reschedule Request Submitted"
        message = (
            "Your reschedule request has been submitted and is awaiting admin review."
        )
        notify_user_id = reschedule_request.requested_by_id
        action_url = (
            "/patient/appointments"
            if reschedule_request.requested_by_id == appointment.patient_id
            else "/doctor/appointments"
        )
        if reason:
            message = f"{message} Reason: {reason}"

    elif event_name == "reschedule.admin_approved" and reschedule_request:
        # Admin approved; notify either requester or counterparty based on notify_target.
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_REQUEST
        requester_is_doctor = reschedule_request.requested_by_id == appointment.doctor_id
        counterparty_id = appointment.patient_id if requester_is_doctor else appointment.doctor_id
        counterparty_action_url = "/patient/appointments" if counterparty_id == appointment.patient_id else "/doctor/appointments"
        requester_action_url = (
            "/patient/appointments"
            if reschedule_request.requested_by_id == appointment.patient_id
            else "/doctor/appointments"
        )

        if (notify_target or "counterparty").lower() == "requester":
            notify_user_id = reschedule_request.requested_by_id
            action_url = requester_action_url
            title = "Reschedule Request Approved by Admin"
            waiting_on_label = patient_name if requester_is_doctor else f"Dr. {doctor_name}"
            message = (
                f"Admin approved your request to reschedule to "
                f"{reschedule_request.proposed_date.isoformat()} at "
                f"{reschedule_request.proposed_time.strftime('%I:%M %p')}. "
                f"Waiting for {waiting_on_label} to respond."
            )
        else:
            notify_user_id = counterparty_id
            action_url = counterparty_action_url
            title = "Reschedule Request Awaiting Your Response"
            requester_label = f"Dr. {doctor_name}" if requester_is_doctor else patient_name
            message = (
                f"Admin approved {requester_label}'s request to reschedule to "
                f"{reschedule_request.proposed_date.isoformat()} at "
                f"{reschedule_request.proposed_time.strftime('%I:%M %p')}. Please confirm or reject."
            )

    elif event_name == "reschedule.admin_rejected" and reschedule_request:
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_REJECTED
        title = "Reschedule Request Rejected by Admin"
        notify_user_id = reschedule_request.requested_by_id
        action_url = (
            "/patient/appointments"
            if reschedule_request.requested_by_id == appointment.patient_id
            else "/doctor/appointments"
        )
        message = "Admin rejected your reschedule request."
        if reason:
            message = f"{message} Reason: {reason}"

    elif event_name == "reschedule.accepted" and reschedule_request:
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_ACCEPTED
        requester_id = reschedule_request.requested_by_id
        counterparty_id = appointment.patient_id if requester_id == appointment.doctor_id else appointment.doctor_id
        requester_action_url = "/patient/appointments" if requester_id == appointment.patient_id else "/doctor/appointments"
        counterparty_action_url = "/patient/appointments" if counterparty_id == appointment.patient_id else "/doctor/appointments"
        title = "Reschedule Request Accepted"

        if (notify_target or "requester").lower() == "counterparty":
            notify_user_id = counterparty_id
            action_url = counterparty_action_url
            message = f"Reschedule confirmed. The appointment is now set for {schedule_label}."
        else:
            notify_user_id = requester_id
            action_url = requester_action_url
            message = f"{actor_name} accepted your reschedule request. The appointment is now set for {schedule_label}."

    elif event_name == "reschedule.withdrawn" and reschedule_request:
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_REJECTED
        requester_id = reschedule_request.requested_by_id
        counterparty_id = appointment.patient_id if requester_id == appointment.doctor_id else appointment.doctor_id
        requester_action_url = "/patient/appointments" if requester_id == appointment.patient_id else "/doctor/appointments"
        counterparty_action_url = "/patient/appointments" if counterparty_id == appointment.patient_id else "/doctor/appointments"
        title = "Reschedule Request Withdrawn"

        if (notify_target or "counterparty").lower() == "requester":
            notify_user_id = requester_id
            action_url = requester_action_url
            message = f"You withdrew the reschedule request. The appointment remains on {schedule_label}."
        else:
            notify_user_id = counterparty_id
            action_url = counterparty_action_url
            message = f"{actor_name} withdrew the reschedule request. The appointment remains on {schedule_label}."

    elif event_name == "reschedule.rejected" and reschedule_request:
        notification_type = NotificationType.APPOINTMENT_RESCHEDULE_REJECTED
        title = "Reschedule Request Rejected"
        notify_user_id = reschedule_request.requested_by_id
        action_url = "/patient/appointments" if reschedule_request.requested_by_id == appointment.patient_id else "/doctor/appointments"
        message = f"{actor_name} rejected the reschedule request"
        if reason:
            message = f"{message}. Reason: {reason}"

    if not (notification_type and title and message and notify_user_id):
        return

    await notification_service.create_notification(
        db=db,
        user_id=notify_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        action_url=action_url,
        metadata=metadata,
        priority=NotificationPriority.HIGH,
    )


async def create_appointment(
    db: AsyncSession,
    patient_id: str,
    doctor_id: str,
    doctor_location_id: Optional[str],
    location_name: Optional[str],
    appointment_date: datetime,
    slot_time_val: Optional[time],
    reason: str,
    notes: Optional[str] = None,
    duration_minutes: int = 30,
) -> Appointment:
    """
    Create an appointment with transactional double-booking prevention.
    Uses advisory lock + SELECT FOR UPDATE to prevent race conditions.
    """
    now_utc = datetime.now(timezone.utc)
    if appointment_date.tzinfo is None:
        normalized_input_datetime = appointment_date.replace(tzinfo=timezone.utc)
    else:
        normalized_input_datetime = appointment_date.astimezone(timezone.utc)

    requested_date = normalized_input_datetime.astimezone(MEDORA_TIMEZONE).date()

    if slot_time_val is not None:
        appointment_date = _build_canonical_appointment_datetime(requested_date, slot_time_val)
    else:
        appointment_date = normalized_input_datetime

    if slot_time_val:
        await _acquire_slot_lock(
            db,
            doctor_id=doctor_id,
            target_date=requested_date,
            slot_time_value=slot_time_val,
        )

        slot_available = await slot_service.is_slot_available(
            db,
            doctor_id,
            requested_date,
            slot_time_val,
        )
        if not slot_available:
            raise ValueError("This slot is already booked")

    appointment_id = str(uuid.uuid4())
    new_appointment = Appointment(
        id=appointment_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        appointment_date=appointment_date,
        slot_time=slot_time_val,
        duration_minutes=duration_minutes,
        doctor_location_id=doctor_location_id,
        location_name=location_name,
        reason=reason,
        notes=notes,
        # All new bookings go through admin review before reaching the doctor.
        status=AppointmentStatus.PENDING_ADMIN_REVIEW,
        hold_expires_at=None,
    )

    db.add(new_appointment)

    audit = AppointmentAuditLog(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        action_type="created",
        performed_by_id=patient_id,
        performed_by_role="patient",
        previous_status=None,
        new_status=AppointmentStatus.PENDING_ADMIN_REVIEW.value,
        notes=f"Appointment booked (awaiting admin review): {reason}",
    )
    db.add(audit)

    await db.flush()

    await _emit_domain_event(
        db,
        event_name="appointment.created",
        appointment=new_appointment,
        actor_id=patient_id,
        actor_role="patient",
    )

    return new_appointment


async def transition_status(
    db: AsyncSession,
    appointment_id: str,
    new_status: AppointmentStatus,
    performed_by_id: str,
    performed_by_role: str,
    notes: Optional[str] = None,
    cancellation_reason_key: Optional[str] = None,
    cancellation_reason_note: Optional[str] = None,
) -> Appointment:
    """
    Transition an appointment to a new status with state machine validation
    and audit logging.
    """
    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .with_for_update()
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    now_utc = datetime.now(timezone.utc)
    if is_pending_hold_expired(appointment, now_utc=now_utc) and new_status not in CANCELLATION_STATUSES:
        raise ValueError("The pending appointment hold has expired")

    current_status = appointment.status

    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from {current_status.value} to {new_status.value}. "
            f"Allowed: {[s.value for s in allowed]}"
        )

    previous_status = current_status.value
    appointment.status = new_status

    if notes:
        appointment.notes = notes

    if new_status == AppointmentStatus.CONFIRMED:
        appointment.hold_expires_at = None

    if new_status in CANCELLATION_STATUSES:
        appointment.cancelled_by_id = performed_by_id
        appointment.cancelled_at = appointment.cancelled_at or now_utc
        appointment.cancellation_reason_key = (
            cancellation_reason_key
            or appointment.cancellation_reason_key
            or "OTHER"
        )
        if cancellation_reason_note is not None:
            appointment.cancellation_reason_note = cancellation_reason_note
        appointment.hold_expires_at = None

    audit = AppointmentAuditLog(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        action_type="status_changed",
        performed_by_id=performed_by_id,
        performed_by_role=performed_by_role,
        previous_status=previous_status,
        new_status=new_status.value,
        notes=notes,
    )
    db.add(audit)

    await db.flush()

    await sync_calendar_on_status_change(db, appointment, new_status)

    if new_status == AppointmentStatus.CONFIRMED:
        await _emit_domain_event(
            db,
            event_name="appointment.confirmed",
            appointment=appointment,
            actor_id=performed_by_id,
            actor_role=performed_by_role,
        )
    elif new_status in CANCELLATION_STATUSES:
        await _emit_domain_event(
            db,
            event_name="appointment.cancelled",
            appointment=appointment,
            actor_id=performed_by_id,
            actor_role=performed_by_role,
            reason=cancellation_reason_note or cancellation_reason_key,
        )

    return appointment


async def request_reschedule(
    db: AsyncSession,
    appointment_id: str,
    requested_by_id: str,
    requested_by_role: str,
    proposed_date: date,
    proposed_time: time,
    reason: Optional[str] = None,
) -> AppointmentRescheduleRequest:
    """Create a reschedule request and move appointment to RESCHEDULE_REQUESTED."""
    now_utc = datetime.now(timezone.utc)

    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .with_for_update()
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    if appointment.status != AppointmentStatus.CONFIRMED:
        raise ValueError("Only confirmed appointments can be rescheduled")

    if requested_by_id not in {appointment.patient_id, appointment.doctor_id}:
        raise ValueError("Requester is not part of this appointment")

    pending_req_result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(
            AppointmentRescheduleRequest.appointment_id == appointment_id,
            AppointmentRescheduleRequest.status == RescheduleRequestStatus.PENDING,
        )
        .with_for_update()
    )
    if pending_req_result.scalar_one_or_none():
        raise ValueError("A pending reschedule request already exists")

    if await slot_service.is_slot_held_by_pending_reschedule(
        db,
        appointment.doctor_id,
        proposed_date,
        proposed_time,
        exclude_appointment_id=appointment.id,
    ):
        raise ValueError("The proposed slot is currently held by another pending reschedule request")

    is_available = await slot_service.is_slot_available(
        db,
        appointment.doctor_id,
        proposed_date,
        proposed_time,
        exclude_appointment_id=appointment.id,
    )
    if not is_available:
        raise ValueError("The proposed slot is not available")

    appointment.status = AppointmentStatus.RESCHEDULE_REQUESTED

    audit = AppointmentAuditLog(
        id=str(uuid.uuid4()),
        appointment_id=appointment.id,
        action_type="reschedule_requested",
        performed_by_id=requested_by_id,
        performed_by_role=requested_by_role,
        previous_status=AppointmentStatus.CONFIRMED.value,
        new_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
        notes=reason,
    )
    db.add(audit)

    try:
        role_enum = RequestedByRole((requested_by_role or "").lower())
    except ValueError as exc:
        raise ValueError("Invalid requester role for reschedule") from exc
    reschedule_request = AppointmentRescheduleRequest(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        requested_by_id=requested_by_id,
        requested_by_role=role_enum,
        proposed_date=proposed_date,
        proposed_time=proposed_time,
        reason=reason,
        status=RescheduleRequestStatus.PENDING,
        expires_at=now_utc + timedelta(hours=RESCHEDULE_REQUEST_TTL_HOURS),
    )
    db.add(reschedule_request)

    await db.flush()

    await _emit_domain_event(
        db,
        event_name="reschedule.requested",
        appointment=appointment,
        actor_id=requested_by_id,
        actor_role=requested_by_role,
        reschedule_request=reschedule_request,
        reason=reason,
    )

    return reschedule_request


async def respond_to_reschedule(
    db: AsyncSession,
    reschedule_request_id: str,
    accept: bool,
    responded_by_id: str,
    responded_by_role: str,
    response_note: Optional[str] = None,
) -> AppointmentRescheduleRequest:
    """Accept or reject a reschedule proposal with approval-time slot recheck."""
    now_utc = datetime.now(timezone.utc)

    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.id == reschedule_request_id)
        .with_for_update()
    )
    reschedule_request = result.scalar_one_or_none()
    if not reschedule_request:
        raise ValueError("Reschedule request not found")

    if reschedule_request.status != RescheduleRequestStatus.PENDING:
        raise ValueError("Reschedule request is no longer pending")

    # Admin must approve before the other party can act on the proposal.
    if reschedule_request.admin_approval_status != AdminApprovalStatus.APPROVED:
        raise ValueError(
            "Reschedule request is still awaiting admin approval"
        )

    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.id == reschedule_request.appointment_id)
        .with_for_update()
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    if responded_by_id not in {appointment.patient_id, appointment.doctor_id}:
        raise ValueError("Responder is not part of this appointment")

    if responded_by_id == reschedule_request.requested_by_id:
        raise ValueError("Requester cannot self-approve their own reschedule request")

    if appointment.status in NON_OCCUPYING_STATUSES:
        raise ValueError("Cannot respond to reschedule for an inactive appointment")

    if reschedule_request.expires_at and reschedule_request.expires_at <= now_utc:
        reschedule_request.status = RescheduleRequestStatus.REJECTED
        reschedule_request.responded_by_id = responded_by_id
        reschedule_request.responded_at = now_utc
        reschedule_request.response_note = response_note or "REQUEST_EXPIRED"
        if appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
            appointment.status = AppointmentStatus.CONFIRMED

        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="reschedule_rejected",
                performed_by_id=responded_by_id,
                performed_by_role=responded_by_role,
                previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes="Rejected because request expired",
            )
        )

        await db.flush()
        await _emit_domain_event(
            db,
            event_name="reschedule.rejected",
            appointment=appointment,
            actor_id=responded_by_id,
            actor_role=responded_by_role,
            reschedule_request=reschedule_request,
            reason=reschedule_request.response_note,
        )
        return reschedule_request

    if accept:
        old_date = appointment.appointment_date.date()
        old_slot_time = appointment.slot_time

        await _acquire_slot_lock(
            db,
            doctor_id=appointment.doctor_id,
            target_date=reschedule_request.proposed_date,
            slot_time_value=reschedule_request.proposed_time,
        )

        slot_available = await slot_service.is_slot_available(
            db,
            appointment.doctor_id,
            reschedule_request.proposed_date,
            reschedule_request.proposed_time,
            exclude_appointment_id=appointment.id,
        )

        if not slot_available:
            reschedule_request.status = RescheduleRequestStatus.REJECTED
            reschedule_request.responded_by_id = responded_by_id
            reschedule_request.responded_at = now_utc
            reschedule_request.response_note = response_note or "SLOT_NO_LONGER_AVAILABLE"
            if appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
                appointment.status = AppointmentStatus.CONFIRMED

            db.add(
                AppointmentAuditLog(
                    id=str(uuid.uuid4()),
                    appointment_id=appointment.id,
                    action_type="reschedule_rejected",
                    performed_by_id=responded_by_id,
                    performed_by_role=responded_by_role,
                    previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                    new_status=AppointmentStatus.CONFIRMED.value,
                    notes="Rejected due to approval-time slot conflict",
                )
            )

            await db.flush()

            await _emit_domain_event(
                db,
                event_name="reschedule.rejected",
                appointment=appointment,
                actor_id=responded_by_id,
                actor_role=responded_by_role,
                reschedule_request=reschedule_request,
                reason=reschedule_request.response_note,
            )

            return reschedule_request

        new_dt = _build_canonical_appointment_datetime(
            reschedule_request.proposed_date,
            reschedule_request.proposed_time,
        )
        appointment.appointment_date = new_dt
        appointment.slot_time = reschedule_request.proposed_time
        appointment.status = AppointmentStatus.CONFIRMED
        appointment.hold_expires_at = None
        appointment.notes = _replace_slot_note(appointment.notes, reschedule_request.proposed_time)

        # Safety validation after reassignment: no active duplicate occupancy may exist.
        slot_still_available = await slot_service.is_slot_available(
            db,
            appointment.doctor_id,
            reschedule_request.proposed_date,
            reschedule_request.proposed_time,
            exclude_appointment_id=appointment.id,
        )
        if not slot_still_available:
            raise ValueError("SLOT_NO_LONGER_AVAILABLE")

        cleaned_ids = await _cancel_stale_old_slot_duplicates(
            db,
            appointment=appointment,
            old_date=old_date,
            old_slot_time=old_slot_time,
            performed_by_id=responded_by_id,
            now_utc=now_utc,
        )

        reschedule_request.status = RescheduleRequestStatus.ACCEPTED
        reschedule_request.responded_by_id = responded_by_id
        reschedule_request.responded_at = now_utc
        reschedule_request.response_note = response_note

        cleanup_suffix = (
            f" | cleaned stale rows: {', '.join(cleaned_ids)}"
            if cleaned_ids
            else ""
        )

        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="rescheduled",
                performed_by_id=responded_by_id,
                performed_by_role=responded_by_role,
                previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes=(
                    f"Rescheduled from {old_date} at {old_slot_time or 'unknown'} "
                    f"to {reschedule_request.proposed_date} at {reschedule_request.proposed_time}"
                    f"{cleanup_suffix}"
                ),
            )
        )

        await db.flush()

        await _emit_domain_event(
            db,
            event_name="reschedule.accepted",
            appointment=appointment,
            actor_id=responded_by_id,
            actor_role=responded_by_role,
            reschedule_request=reschedule_request,
            reason=response_note,
            notify_target="requester",
        )
        await _emit_domain_event(
            db,
            event_name="reschedule.accepted",
            appointment=appointment,
            actor_id=responded_by_id,
            actor_role=responded_by_role,
            reschedule_request=reschedule_request,
            reason=response_note,
            notify_target="counterparty",
        )

        return reschedule_request

    reschedule_request.status = RescheduleRequestStatus.REJECTED
    reschedule_request.responded_by_id = responded_by_id
    reschedule_request.responded_at = now_utc
    reschedule_request.response_note = response_note

    if appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
        appointment.status = AppointmentStatus.CONFIRMED

    db.add(
        AppointmentAuditLog(
            id=str(uuid.uuid4()),
            appointment_id=appointment.id,
            action_type="reschedule_rejected",
            performed_by_id=responded_by_id,
            performed_by_role=responded_by_role,
            previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
            new_status=AppointmentStatus.CONFIRMED.value,
            notes=response_note or "Reschedule request rejected",
        )
    )

    await db.flush()

    await _emit_domain_event(
        db,
        event_name="reschedule.rejected",
        appointment=appointment,
        actor_id=responded_by_id,
        actor_role=responded_by_role,
        reschedule_request=reschedule_request,
        reason=response_note,
    )

    return reschedule_request


async def admin_approve_reschedule_request(
    db: AsyncSession,
    reschedule_request_id: str,
    admin_id: str,
    notes: Optional[str] = None,
) -> AppointmentRescheduleRequest:
    """Admin approves a reschedule proposal so the other party can respond."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.id == reschedule_request_id)
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req:
        raise ValueError("Reschedule request not found")
    if req.status != RescheduleRequestStatus.PENDING:
        raise ValueError("Reschedule request is no longer pending")
    if req.admin_approval_status != AdminApprovalStatus.PENDING:
        raise ValueError("Reschedule request has already been decided by admin")

    req.admin_approval_status = AdminApprovalStatus.APPROVED
    req.admin_notes = notes
    req.admin_decided_at = now_utc

    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == req.appointment_id)
    )
    appointment = appt_result.scalar_one_or_none()
    if appointment:
        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="reschedule_admin_approved",
                performed_by_id=admin_id,
                performed_by_role="admin",
                previous_status=appointment.status.value,
                new_status=appointment.status.value,
                notes=notes or "Admin approved reschedule request",
            )
        )
        await db.flush()
        await _emit_domain_event(
            db,
            event_name="reschedule.admin_approved",
            appointment=appointment,
            actor_id=admin_id,
            actor_role="admin",
            reschedule_request=req,
            reason=notes,
        )
        await _emit_domain_event(
            db,
            event_name="reschedule.admin_approved",
            appointment=appointment,
            actor_id=admin_id,
            actor_role="admin",
            reschedule_request=req,
            reason=notes,
            notify_target="requester",
        )
    return req


async def withdraw_reschedule_request(
    db: AsyncSession,
    reschedule_request_id: str,
    requester_id: str,
    requester_role: str,
    response_note: Optional[str] = None,
) -> AppointmentRescheduleRequest:
    """Allow requester to withdraw their own pending reschedule request."""
    now_utc = datetime.now(timezone.utc)

    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.id == reschedule_request_id)
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req:
        raise ValueError("Reschedule request not found")
    if req.status != RescheduleRequestStatus.PENDING:
        raise ValueError("Reschedule request is no longer pending")
    if req.requested_by_id != requester_id:
        raise ValueError("Only the requester can withdraw this reschedule request")

    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.id == req.appointment_id)
        .with_for_update()
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")
    if requester_id not in {appointment.patient_id, appointment.doctor_id}:
        raise ValueError("Requester is not part of this appointment")
    if appointment.status in NON_OCCUPYING_STATUSES:
        raise ValueError("Cannot withdraw reschedule for an inactive appointment")

    previous_status = appointment.status
    req.status = RescheduleRequestStatus.REJECTED
    req.responded_by_id = requester_id
    req.responded_at = now_utc
    req.response_note = response_note or "WITHDRAWN_BY_REQUESTER"

    if appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
        appointment.status = AppointmentStatus.CONFIRMED

    db.add(
        AppointmentAuditLog(
            id=str(uuid.uuid4()),
            appointment_id=appointment.id,
            action_type="reschedule_withdrawn",
            performed_by_id=requester_id,
            performed_by_role=requester_role,
            previous_status=previous_status.value,
            new_status=appointment.status.value,
            notes=req.response_note,
        )
    )

    await db.flush()
    await _emit_domain_event(
        db,
        event_name="reschedule.withdrawn",
        appointment=appointment,
        actor_id=requester_id,
        actor_role=requester_role,
        reschedule_request=req,
        reason=req.response_note,
        notify_target="counterparty",
    )
    await _emit_domain_event(
        db,
        event_name="reschedule.withdrawn",
        appointment=appointment,
        actor_id=requester_id,
        actor_role=requester_role,
        reschedule_request=req,
        reason=req.response_note,
        notify_target="requester",
    )

    return req


async def admin_reject_reschedule_request(
    db: AsyncSession,
    reschedule_request_id: str,
    admin_id: str,
    notes: Optional[str] = None,
) -> AppointmentRescheduleRequest:
    """Admin rejects a reschedule proposal; appointment returns to CONFIRMED."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.id == reschedule_request_id)
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req:
        raise ValueError("Reschedule request not found")
    if req.status != RescheduleRequestStatus.PENDING:
        raise ValueError("Reschedule request is no longer pending")
    if req.admin_approval_status != AdminApprovalStatus.PENDING:
        raise ValueError("Reschedule request has already been decided by admin")

    req.admin_approval_status = AdminApprovalStatus.REJECTED
    req.admin_notes = notes
    req.admin_decided_at = now_utc
    req.status = RescheduleRequestStatus.REJECTED
    req.responded_by_id = admin_id
    req.responded_at = now_utc
    req.response_note = notes or "Rejected by admin"

    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == req.appointment_id).with_for_update()
    )
    appointment = appt_result.scalar_one_or_none()
    if appointment and appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
        appointment.status = AppointmentStatus.CONFIRMED
        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="reschedule_admin_rejected",
                performed_by_id=admin_id,
                performed_by_role="admin",
                previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes=notes or "Admin rejected reschedule request",
            )
        )
        await db.flush()
        await _emit_domain_event(
            db,
            event_name="reschedule.admin_rejected",
            appointment=appointment,
            actor_id=admin_id,
            actor_role="admin",
            reschedule_request=req,
            reason=notes,
        )
    return req


# ========== CANCELLATION REQUEST FLOW ==========


async def request_cancellation(
    db: AsyncSession,
    appointment_id: str,
    requested_by_id: str,
    requested_by_role: str,
    reason_key: Optional[str] = None,
    reason_note: Optional[str] = None,
) -> AppointmentCancellationRequest:
    """Party requests cancellation; appointment moves to CANCEL_REQUESTED pending admin review."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id).with_for_update()
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    if appointment.status not in {AppointmentStatus.CONFIRMED}:
        raise ValueError("Only confirmed appointments can be cancelled")

    if requested_by_id not in {appointment.patient_id, appointment.doctor_id}:
        raise ValueError("Requester is not part of this appointment")

    # Block if there is already a pending cancellation request.
    pending_result = await db.execute(
        select(AppointmentCancellationRequest).where(
            AppointmentCancellationRequest.appointment_id == appointment_id,
            AppointmentCancellationRequest.admin_approval_status == AdminApprovalStatus.PENDING,
        )
    )
    if pending_result.scalar_one_or_none():
        raise ValueError("A cancellation request is already pending admin review")

    previous_status = appointment.status.value
    appointment.status = AppointmentStatus.CANCEL_REQUESTED

    try:
        role_enum = RequestedByRole((requested_by_role or "").lower())
    except ValueError as exc:
        raise ValueError("Invalid requester role for cancellation") from exc

    cancel_request = AppointmentCancellationRequest(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        requested_by_id=requested_by_id,
        requested_by_role=role_enum,
        reason_key=reason_key,
        reason_note=reason_note,
        admin_approval_status=AdminApprovalStatus.PENDING,
    )
    db.add(cancel_request)

    db.add(
        AppointmentAuditLog(
            id=str(uuid.uuid4()),
            appointment_id=appointment_id,
            action_type="cancellation_requested",
            performed_by_id=requested_by_id,
            performed_by_role=requested_by_role,
            previous_status=previous_status,
            new_status=AppointmentStatus.CANCEL_REQUESTED.value,
            notes=reason_note or reason_key,
        )
    )

    await db.flush()

    # Notify requester that request is submitted.
    actor_name = await _profile_name(db, requested_by_id, "User")
    schedule_label = _appointment_schedule_label(appointment)
    await notification_service.create_notification(
        db=db,
        user_id=requested_by_id,
        notification_type=NotificationType.APPOINTMENT_CANCELLED,
        title="Cancellation Request Submitted",
        message=(
            f"Your request to cancel the appointment on {schedule_label} is awaiting admin review."
        ),
        action_url=(
            "/patient/appointments" if requested_by_id == appointment.patient_id else "/doctor/appointments"
        ),
        metadata={
            "appointment_id": appointment.id,
            "cancellation_request_id": cancel_request.id,
        },
        priority=NotificationPriority.MEDIUM,
    )

    return cancel_request


async def admin_approve_cancellation_request(
    db: AsyncSession,
    cancellation_request_id: str,
    admin_id: str,
    notes: Optional[str] = None,
) -> AppointmentCancellationRequest:
    """Admin approves cancellation; appointment transitions to cancelled-by-role state, slot freed."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(AppointmentCancellationRequest)
        .where(AppointmentCancellationRequest.id == cancellation_request_id)
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req:
        raise ValueError("Cancellation request not found")
    if req.admin_approval_status != AdminApprovalStatus.PENDING:
        raise ValueError("Cancellation request has already been decided")

    req.admin_approval_status = AdminApprovalStatus.APPROVED
    req.admin_notes = notes
    req.admin_decided_at = now_utc

    cancel_status = get_role_based_cancel_status(req.requested_by_role.value)
    await transition_status(
        db,
        appointment_id=req.appointment_id,
        new_status=cancel_status,
        performed_by_id=req.requested_by_id,
        performed_by_role=req.requested_by_role.value,
        notes=notes or "Cancellation approved by admin",
        cancellation_reason_key=req.reason_key or "ADMIN_APPROVED_CANCEL",
        cancellation_reason_note=req.reason_note,
    )
    return req


async def admin_reject_cancellation_request(
    db: AsyncSession,
    cancellation_request_id: str,
    admin_id: str,
    notes: Optional[str] = None,
) -> AppointmentCancellationRequest:
    """Admin rejects cancellation; appointment returns to CONFIRMED."""
    now_utc = datetime.now(timezone.utc)
    result = await db.execute(
        select(AppointmentCancellationRequest)
        .where(AppointmentCancellationRequest.id == cancellation_request_id)
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req:
        raise ValueError("Cancellation request not found")
    if req.admin_approval_status != AdminApprovalStatus.PENDING:
        raise ValueError("Cancellation request has already been decided")

    req.admin_approval_status = AdminApprovalStatus.REJECTED
    req.admin_notes = notes
    req.admin_decided_at = now_utc

    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == req.appointment_id).with_for_update()
    )
    appointment = appt_result.scalar_one_or_none()
    if appointment and appointment.status == AppointmentStatus.CANCEL_REQUESTED:
        appointment.status = AppointmentStatus.CONFIRMED
        db.add(
            AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="cancellation_admin_rejected",
                performed_by_id=admin_id,
                performed_by_role="admin",
                previous_status=AppointmentStatus.CANCEL_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes=notes or "Admin rejected cancellation request",
            )
        )
        await db.flush()

        # Notify requester that cancellation was rejected.
        await notification_service.create_notification(
            db=db,
            user_id=req.requested_by_id,
            notification_type=NotificationType.APPOINTMENT_CANCELLED,
            title="Cancellation Request Rejected",
            message=(
                "Your cancellation request was rejected by admin. The appointment remains confirmed."
            ),
            action_url=(
                "/patient/appointments"
                if req.requested_by_id == appointment.patient_id
                else "/doctor/appointments"
            ),
            metadata={
                "appointment_id": appointment.id,
                "cancellation_request_id": req.id,
            },
            priority=NotificationPriority.MEDIUM,
        )

    return req


async def expire_pending_holds(
    db: AsyncSession,
    *,
    now_utc: Optional[datetime] = None,
    limit: int = 200,
) -> int:
    now = now_utc or datetime.now(timezone.utc)
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.status == AppointmentStatus.PENDING,
            Appointment.hold_expires_at.is_not(None),
            Appointment.hold_expires_at <= now,
        )
        .order_by(Appointment.hold_expires_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    stale_appointments = result.scalars().all()

    expired_count = 0
    for appointment in stale_appointments:
        try:
            await transition_status(
                db,
                appointment_id=appointment.id,
                new_status=AppointmentStatus.CANCELLED_BY_PATIENT,
                performed_by_id=appointment.patient_id,
                performed_by_role="system",
                notes="HOLD_EXPIRED",
                cancellation_reason_key="HOLD_EXPIRED",
                cancellation_reason_note="Soft hold expired before confirmation",
            )
            expired_count += 1
        except ValueError:
            continue

    return expired_count


async def get_audit_logs(
    db: AsyncSession,
    appointment_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AppointmentAuditLog], int]:
    """Get audit logs, optionally filtered by appointment_id."""
    from sqlalchemy import func

    base_query = select(AppointmentAuditLog)
    count_query = select(func.count()).select_from(AppointmentAuditLog)

    if appointment_id:
        base_query = base_query.where(
            AppointmentAuditLog.appointment_id == appointment_id
        )
        count_query = count_query.where(
            AppointmentAuditLog.appointment_id == appointment_id
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        base_query.order_by(AppointmentAuditLog.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()

    return logs, total


async def sync_calendar_on_status_change(
    db: AsyncSession,
    appointment: Appointment,
    new_status: AppointmentStatus,
) -> None:
    """
    Sync Google Calendar events based on appointment status changes.
    Called after a status transition - best-effort, never raises.
    Enhanced to sync to both patient and doctor calendars.
    """
    try:
        from app.services import google_calendar_service

        doctor_id = appointment.doctor_id
        patient_id = appointment.patient_id

        if new_status == AppointmentStatus.CONFIRMED:
            # Get doctor profile
            doctor_result = await db.execute(
                select(Profile).where(Profile.id == doctor_id)
            )
            doctor_profile = doctor_result.scalar_one_or_none()

            # Get patient profile
            patient_result = await db.execute(
                select(Profile).where(Profile.id == patient_id)
            )
            patient_profile = patient_result.scalar_one_or_none()

            doctor_name = f"{doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else "Doctor"
            patient_name = f"{patient_profile.first_name} {patient_profile.last_name}" if patient_profile else "Patient"

            # Sync to doctor's calendar
            doctor_event_id = await google_calendar_service.sync_appointment_to_calendar(
                db=db,
                user_id=doctor_id,
                appointment_id=appointment.id,
                summary=f"Appointment with {patient_name}",
                description=f"Patient: {patient_name}\nReason: {appointment.reason or 'Consultation'}\nType: {appointment.consultation_type or 'General'}",
                start_datetime=appointment.appointment_date,
                duration_minutes=appointment.duration_minutes or 30,
            )

            # Sync to patient's calendar
            patient_event_id = await google_calendar_service.sync_appointment_to_calendar(
                db=db,
                user_id=patient_id,
                appointment_id=appointment.id,
                summary=f"Appointment with {doctor_name}",
                description=f"Doctor: {doctor_name}\nReason: {appointment.reason or 'Consultation'}\nType: {appointment.consultation_type or 'General'}",
                start_datetime=appointment.appointment_date,
                duration_minutes=appointment.duration_minutes or 30,
            )

            # Store doctor's event ID (primary owner)
            if doctor_event_id:
                appointment.google_event_id = doctor_event_id
                await db.flush()

            logger.info(
                f"Calendar sync completed for appointment {appointment.id}: "
                f"doctor_event={doctor_event_id}, patient_event={patient_event_id}"
            )

        elif new_status in NON_OCCUPYING_STATUSES:
            # Delete doctor's calendar event
            if appointment.google_event_id:
                await google_calendar_service.delete_calendar_event(
                    db=db,
                    user_id=doctor_id,
                    event_id=appointment.google_event_id,
                )
                appointment.google_event_id = None
                await db.flush()

    except Exception as e:
        logger.warning(f"Calendar sync failed for appointment {appointment.id}: {e}")
