"""Transactional appointment booking with state machine and audit logging."""

from datetime import date, time, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

import logging
import uuid

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.appointment_audit import AppointmentAuditLog
from app.db.models.appointment_request import (
    AppointmentRescheduleRequest,
    RescheduleRequestStatus,
    RequestedByRole,
)
from app.db.models.profile import Profile
from app.services import slot_service, notification_service

logger = logging.getLogger(__name__)


# ── Status State Machine ──
# Maps current status → set of allowed next statuses

ALLOWED_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.PENDING: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.PENDING_ADMIN_REVIEW,
    },
    AppointmentStatus.PENDING_ADMIN_REVIEW: {
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.PENDING_DOCTOR_CONFIRMATION: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.PENDING_PATIENT_CONFIRMATION: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.CONFIRMED: {
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.RESCHEDULE_REQUESTED,
        AppointmentStatus.NO_SHOW,
    },
    AppointmentStatus.RESCHEDULE_REQUESTED: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
    },
    AppointmentStatus.CANCEL_REQUESTED: {
        AppointmentStatus.CANCELLED,
        AppointmentStatus.CONFIRMED,
    },
    # Terminal states — no transitions out
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
    AppointmentStatus.NO_SHOW: set(),
}


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
    Uses SELECT FOR UPDATE to prevent race conditions.
    """
    # Lock any existing appointment for this doctor+date+slot to prevent double booking
    if slot_time_val:
        start_of_day = datetime(
            appointment_date.year,
            appointment_date.month,
            appointment_date.day,
            tzinfo=timezone.utc,
        )
        end_of_day = start_of_day + timedelta(days=1)

        # SELECT FOR UPDATE — holds a row lock until commit
        lock_result = await db.execute(
            select(Appointment)
            .where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date >= start_of_day,
                Appointment.appointment_date < end_of_day,
                Appointment.slot_time == slot_time_val,
                Appointment.status.notin_([
                    AppointmentStatus.CANCELLED,
                    AppointmentStatus.NO_SHOW,
                ]),
            )
            .with_for_update()
        )
        existing = lock_result.scalar_one_or_none()
        if existing:
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
        status=AppointmentStatus.PENDING,
    )

    db.add(new_appointment)

    # Create audit log
    audit = AppointmentAuditLog(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        action_type="created",
        performed_by_id=patient_id,
        performed_by_role="patient",
        previous_status=None,
        new_status=AppointmentStatus.PENDING.value,
        notes=f"Appointment booked: {reason}",
    )
    db.add(audit)

    await db.flush()
    return new_appointment


async def transition_status(
    db: AsyncSession,
    appointment_id: str,
    new_status: AppointmentStatus,
    performed_by_id: str,
    performed_by_role: str,
    notes: Optional[str] = None,
) -> Appointment:
    """
    Transition an appointment to a new status with state machine validation
    and audit logging.
    """
    # Fetch appointment with lock
    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .with_for_update()
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    current_status = appointment.status

    # Validate transition
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

    # Create audit log
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

    # Sync Google Calendar (best-effort)
    await sync_calendar_on_status_change(db, appointment, new_status)

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
    """Create a reschedule request and transition the appointment status."""
    # Verify appointment exists and can be rescheduled
    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .with_for_update()
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")

    # Transition to RESCHEDULE_REQUESTED if currently CONFIRMED
    if appointment.status == AppointmentStatus.CONFIRMED:
        appointment.status = AppointmentStatus.RESCHEDULE_REQUESTED

        # Audit log
        audit = AppointmentAuditLog(
            id=str(uuid.uuid4()),
            appointment_id=appointment_id,
            action_type="reschedule_requested",
            performed_by_id=requested_by_id,
            performed_by_role=requested_by_role,
            previous_status=AppointmentStatus.CONFIRMED.value,
            new_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
            notes=reason,
        )
        db.add(audit)

    # Map string role to enum
    role_enum = RequestedByRole(requested_by_role)

    # Create reschedule request
    reschedule_request = AppointmentRescheduleRequest(
        id=str(uuid.uuid4()),
        appointment_id=appointment_id,
        requested_by_id=requested_by_id,
        requested_by_role=role_enum,
        proposed_date=proposed_date,
        proposed_time=proposed_time,
        reason=reason,
        status=RescheduleRequestStatus.PENDING,
    )
    db.add(reschedule_request)
    await db.flush()
    return reschedule_request


async def respond_to_reschedule(
    db: AsyncSession,
    reschedule_request_id: str,
    accept: bool,
    responded_by_id: str,
    responded_by_role: str,
) -> AppointmentRescheduleRequest:
    """Accept or reject a reschedule request."""
    result = await db.execute(
        select(AppointmentRescheduleRequest)
        .where(AppointmentRescheduleRequest.id == reschedule_request_id)
    )
    reschedule_request = result.scalar_one_or_none()
    if not reschedule_request:
        raise ValueError("Reschedule request not found")

    if reschedule_request.status != RescheduleRequestStatus.PENDING:
        raise ValueError("Reschedule request is no longer pending")

    if accept:
        reschedule_request.status = RescheduleRequestStatus.ACCEPTED

        # Update the appointment with new date/time
        appt_result = await db.execute(
            select(Appointment)
            .where(Appointment.id == reschedule_request.appointment_id)
            .with_for_update()
        )
        appointment = appt_result.scalar_one_or_none()
        if appointment:
            # Build new datetime
            new_dt = datetime(
                reschedule_request.proposed_date.year,
                reschedule_request.proposed_date.month,
                reschedule_request.proposed_date.day,
                reschedule_request.proposed_time.hour,
                reschedule_request.proposed_time.minute,
                tzinfo=timezone.utc,
            )
            appointment.appointment_date = new_dt
            appointment.slot_time = reschedule_request.proposed_time
            appointment.status = AppointmentStatus.CONFIRMED

            audit = AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="rescheduled",
                performed_by_id=responded_by_id,
                performed_by_role=responded_by_role,
                previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes=f"Rescheduled to {reschedule_request.proposed_date} at {reschedule_request.proposed_time}",
            )
            db.add(audit)
    else:
        reschedule_request.status = RescheduleRequestStatus.REJECTED

        # Revert appointment to CONFIRMED
        appt_result = await db.execute(
            select(Appointment)
            .where(Appointment.id == reschedule_request.appointment_id)
            .with_for_update()
        )
        appointment = appt_result.scalar_one_or_none()
        if appointment and appointment.status == AppointmentStatus.RESCHEDULE_REQUESTED:
            appointment.status = AppointmentStatus.CONFIRMED

            audit = AppointmentAuditLog(
                id=str(uuid.uuid4()),
                appointment_id=appointment.id,
                action_type="reschedule_rejected",
                performed_by_id=responded_by_id,
                performed_by_role=responded_by_role,
                previous_status=AppointmentStatus.RESCHEDULE_REQUESTED.value,
                new_status=AppointmentStatus.CONFIRMED.value,
                notes="Reschedule request rejected",
            )
            db.add(audit)

    await db.flush()
    return reschedule_request


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

    # Get count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get logs
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
    Called after a status transition — best-effort, never raises.
    """
    try:
        from app.services import google_calendar_service

        doctor_id = appointment.doctor_id

        if new_status == AppointmentStatus.CONFIRMED:
            # Create a calendar event for the doctor
            doctor_result = await db.execute(
                select(Profile).where(Profile.id == doctor_id)
            )
            doctor_profile = doctor_result.scalar_one_or_none()

            patient_result = await db.execute(
                select(Profile).where(Profile.id == appointment.patient_id)
            )
            patient_profile = patient_result.scalar_one_or_none()

            doctor_name = f"{doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else "Doctor"
            patient_name = f"{patient_profile.first_name} {patient_profile.last_name}" if patient_profile else "Patient"

            event_id = await google_calendar_service.create_calendar_event(
                db=db,
                user_id=doctor_id,
                summary=f"Appointment with {patient_name}",
                description=f"Patient: {patient_name}\nReason: {appointment.reason or 'Consultation'}",
                start_datetime=appointment.appointment_date,
                duration_minutes=appointment.duration_minutes or 30,
            )
            if event_id:
                appointment.google_event_id = event_id
                await db.flush()

        elif new_status in (AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW):
            # Delete calendar event if it exists
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
