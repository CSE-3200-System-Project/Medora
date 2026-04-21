import asyncio
import logging
from datetime import datetime, timedelta, timezone
from datetime import tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.notification import Notification, NotificationPriority, NotificationType
from app.db.models.profile import Profile
from app.db.models.reminder import Reminder, ReminderDeliveryLog, ReminderType
from app.db.session import AsyncSessionLocal
from app.services.email_service import send_appointment_reminder_email, send_item_reminder_email
from app.services.notification_service import create_notification
from app.services.push_service import send_push_to_user

logger = logging.getLogger(__name__)

_dispatcher_task: asyncio.Task | None = None
_dispatcher_stop_event: asyncio.Event | None = None


async def start_reminder_dispatcher() -> None:
    global _dispatcher_task, _dispatcher_stop_event

    if not settings.REMINDER_DISPATCH_ENABLED:
        logger.info("Reminder dispatcher is disabled by configuration.")
        return

    if _dispatcher_task and not _dispatcher_task.done():
        return

    _dispatcher_stop_event = asyncio.Event()
    _dispatcher_task = asyncio.create_task(_run_dispatcher_loop(), name="reminder-dispatcher")
    logger.info("Reminder dispatcher started.")


async def stop_reminder_dispatcher() -> None:
    global _dispatcher_task, _dispatcher_stop_event

    if _dispatcher_stop_event is not None:
        _dispatcher_stop_event.set()

    if _dispatcher_task is not None:
        try:
            await _dispatcher_task
        except Exception:
            logger.exception("Reminder dispatcher crashed while stopping.")

    _dispatcher_task = None
    _dispatcher_stop_event = None
    logger.info("Reminder dispatcher stopped.")


async def _run_dispatcher_loop() -> None:
    base_interval_seconds = max(300, settings.REMINDER_DISPATCH_INTERVAL_SECONDS)
    max_interval_seconds = max(base_interval_seconds * 12, 30 * 60)
    interval_seconds = base_interval_seconds
    lookback = timedelta(seconds=max(interval_seconds * 2, 180))
    last_scan_utc = datetime.now(timezone.utc) - lookback

    while _dispatcher_stop_event and not _dispatcher_stop_event.is_set():
        now_utc = datetime.now(timezone.utc)
        try:
            active_count, delivered_count = await _dispatch_due_reminders(last_scan_utc, now_utc)
            appointment_count, appointment_delivered = await _dispatch_due_appointment_reminders(last_scan_utc, now_utc)
            total_delivered = delivered_count + appointment_delivered
            if total_delivered > 0:
                interval_seconds = base_interval_seconds
            elif active_count == 0 and appointment_count == 0:
                interval_seconds = min(max_interval_seconds, max(interval_seconds * 2, base_interval_seconds * 2))
            else:
                interval_seconds = min(max_interval_seconds, max(base_interval_seconds, interval_seconds))
        except Exception:
            logger.exception("Reminder dispatch cycle failed.")
            interval_seconds = min(max_interval_seconds, max(interval_seconds * 2, base_interval_seconds))

        last_scan_utc = now_utc
        try:
            await asyncio.wait_for(_dispatcher_stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue


async def _dispatch_due_reminders(start_utc: datetime, end_utc: datetime) -> tuple[int, int]:
    if end_utc <= start_utc:
        return 0, 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Reminder).where(
                Reminder.is_active == True,  # noqa: E712
            )
        )
        reminders = result.scalars().all()
        if not reminders:
            return 0, 0

        delivered_count = 0
        for reminder in reminders:
            reminder_tz = _safe_timezone(reminder.timezone or settings.DEFAULT_REMINDER_TIMEZONE)
            due_slots_utc = _compute_due_slots_utc(reminder, reminder_tz, start_utc, end_utc)

            for slot_utc in due_slots_utc:
                try:
                    await _create_reminder_notification(db, reminder, slot_utc, reminder_tz)
                    await db.commit()
                    delivered_count += 1
                except IntegrityError:
                    await db.rollback()
                    continue
                except Exception:
                    await db.rollback()
                    logger.exception("Failed creating reminder notification reminder_id=%s", reminder.id)
        return len(reminders), delivered_count


async def _dispatch_due_appointment_reminders(start_utc: datetime, end_utc: datetime) -> tuple[int, int]:
    if end_utc <= start_utc:
        return 0, 0

    lead_delta = timedelta(minutes=max(0, settings.REMINDER_LEAD_MINUTES))
    appointment_start = start_utc + lead_delta
    appointment_end = end_utc + lead_delta

    active_statuses = [
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING_DOCTOR_CONFIRMATION,
        AppointmentStatus.PENDING_PATIENT_CONFIRMATION,
        AppointmentStatus.RESCHEDULE_REQUESTED,
    ]

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Appointment).where(
                Appointment.status.in_(active_statuses),
                Appointment.appointment_date >= appointment_start,
                Appointment.appointment_date <= appointment_end,
            )
        )
        appointments = result.scalars().all()
        if not appointments:
            return 0, 0

        delivered_count = 0
        appointment_tz = _safe_timezone(settings.DEFAULT_REMINDER_TIMEZONE)

        for appointment in appointments:
            scheduled_utc = _normalize_utc_datetime(appointment.appointment_date)
            if scheduled_utc is None:
                continue

            try:
                delivered_count += await _create_appointment_reminder_notifications(
                    db=db,
                    appointment=appointment,
                    scheduled_utc=scheduled_utc,
                    appointment_tz=appointment_tz,
                )
                await db.commit()
            except Exception:
                await db.rollback()
                logger.exception("Failed appointment reminder dispatch appointment_id=%s", appointment.id)

        return len(appointments), delivered_count


async def _create_appointment_reminder_notifications(
    *,
    db,
    appointment: Appointment,
    scheduled_utc: datetime,
    appointment_tz: tzinfo,
) -> int:
    profile_result = await db.execute(
        select(Profile).where(Profile.id.in_([appointment.patient_id, appointment.doctor_id]))
    )
    profile_map = {profile.id: profile for profile in profile_result.scalars().all()}
    patient_profile = profile_map.get(appointment.patient_id)
    doctor_profile = profile_map.get(appointment.doctor_id)

    if not patient_profile or not doctor_profile:
        return 0

    lead_minutes = max(0, settings.REMINDER_LEAD_MINUTES)
    scheduled_iso = scheduled_utc.isoformat()
    schedule_label = scheduled_utc.astimezone(appointment_tz).strftime("%I:%M %p on %d %b %Y")

    doctor_name = f"Dr. {(doctor_profile.first_name or '').strip()} {(doctor_profile.last_name or '').strip()}".strip()
    patient_name = f"{(patient_profile.first_name or '').strip()} {(patient_profile.last_name or '').strip()}".strip() or "Patient"

    recipients = [
        {
            "user_id": appointment.patient_id,
            "full_name": patient_name,
            "counterpart_name": doctor_name,
            "role_label": "patient",
            "action_url": "/patient/appointments",
            "email": patient_profile.email,
            "title": "Upcoming Appointment Reminder",
            "message": f"Reminder: your appointment with {doctor_name} is at {schedule_label}.",
        },
        {
            "user_id": appointment.doctor_id,
            "full_name": doctor_name.replace("Dr. ", "").strip() or "Doctor",
            "counterpart_name": patient_name,
            "role_label": "doctor",
            "action_url": "/doctor/appointments",
            "email": doctor_profile.email,
            "title": "Upcoming Appointment Reminder",
            "message": f"Reminder: your appointment with {patient_name} is at {schedule_label}.",
        },
    ]

    delivered = 0
    for recipient in recipients:
        already_sent = await _appointment_reminder_already_sent(
            db=db,
            user_id=recipient["user_id"],
            appointment_id=appointment.id,
            scheduled_for_iso=scheduled_iso,
        )
        if already_sent:
            continue

        notification = await create_notification(
            db=db,
            user_id=recipient["user_id"],
            notification_type=NotificationType.APPOINTMENT_REMINDER,
            title=recipient["title"],
            message=recipient["message"],
            action_url=recipient["action_url"],
            metadata={
                "appointment_id": appointment.id,
                "scheduled_for_utc": scheduled_iso,
                "lead_minutes": lead_minutes,
            },
            priority=NotificationPriority.HIGH,
        )

        await send_push_to_user(
            db,
            user_id=recipient["user_id"],
            title=recipient["title"],
            body=recipient["message"],
            data={"url": recipient["action_url"], "notification_id": notification.id},
            tag=f"appt-reminder-{appointment.id}-{recipient['user_id']}",
        )

        if recipient.get("email"):
            email_sent = await asyncio.to_thread(
                send_appointment_reminder_email,
                to_email=str(recipient["email"]),
                full_name=str(recipient["full_name"]),
                counterpart_name=str(recipient["counterpart_name"]),
                appointment_time_text=schedule_label,
                role_label=str(recipient["role_label"]),
            )
            if not email_sent:
                logger.warning(
                    "Appointment reminder email failed appointment_id=%s user_id=%s email=%s",
                    appointment.id,
                    recipient["user_id"],
                    recipient["email"],
                )

        delivered += 1

    return delivered


async def _appointment_reminder_already_sent(
    *,
    db,
    user_id: str,
    appointment_id: str,
    scheduled_for_iso: str,
) -> bool:
    try:
        existing = await db.execute(
            select(Notification.id).where(
                Notification.user_id == user_id,
                Notification.type == NotificationType.APPOINTMENT_REMINDER,
                Notification.data["appointment_id"].astext == appointment_id,
                Notification.data["scheduled_for_utc"].astext == scheduled_for_iso,
            )
        )
        return existing.scalar_one_or_none() is not None
    except Exception:
        fallback = await db.execute(
            select(Notification.id).where(
                Notification.user_id == user_id,
                Notification.type == NotificationType.APPOINTMENT_REMINDER,
                Notification.created_at >= datetime.now(timezone.utc) - timedelta(hours=6),
            )
        )
        return fallback.scalar_one_or_none() is not None


async def _create_reminder_notification(
    db,
    reminder: Reminder,
    scheduled_utc: datetime,
    reminder_tz: tzinfo,
) -> None:
    existing = await db.execute(
        select(ReminderDeliveryLog.id).where(
            ReminderDeliveryLog.reminder_id == reminder.id,
            ReminderDeliveryLog.scheduled_for_utc == scheduled_utc,
        )
    )
    if existing.scalar_one_or_none():
        return

    local_time_text = scheduled_utc.astimezone(reminder_tz).strftime("%I:%M %p")
    is_medication = reminder.type == ReminderType.MEDICATION
    lead_minutes = max(0, settings.REMINDER_LEAD_MINUTES)

    notification_type = (
        NotificationType.MEDICATION_REMINDER if is_medication else NotificationType.TEST_REMINDER
    )
    title = "Medicine Reminder" if is_medication else "Test Reminder"
    if lead_minutes > 0:
        message = f"Reminder for {local_time_text} (in {lead_minutes} minutes): {reminder.item_name}"
    else:
        message = f"It's {local_time_text}. {reminder.item_name}"
    if reminder.notes:
        message += f" - {reminder.notes}"

    notification = await create_notification(
        db=db,
        user_id=reminder.user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        action_url="/patient/reminders",
        metadata={
            "reminder_id": reminder.id,
            "reminder_type": reminder.type.value,
            "scheduled_for_utc": scheduled_utc.isoformat(),
            "timezone": _timezone_key(reminder_tz),
            "lead_minutes": lead_minutes,
        },
        priority=NotificationPriority.HIGH,
    )

    db.add(
        ReminderDeliveryLog(
            reminder_id=reminder.id,
            user_id=reminder.user_id,
            scheduled_for_utc=scheduled_utc,
            notification_id=notification.id,
        )
    )
    await db.flush()

    # Fire web push in parallel path. Failures do not block in-app notification creation.
    await send_push_to_user(
        db,
        user_id=reminder.user_id,
        title=title,
        body=message,
        data={"url": "/patient/reminders", "notification_id": notification.id},
        tag=f"reminder-{reminder.id}",
    )

    profile_result = await db.execute(select(Profile).where(Profile.id == reminder.user_id))
    profile = profile_result.scalar_one_or_none()
    if profile and profile.email:
        full_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Medora User"
        reminder_label = "medication" if is_medication else "test"
        email_sent = await asyncio.to_thread(
            send_item_reminder_email,
            to_email=profile.email,
            full_name=full_name,
            item_name=reminder.item_name,
            reminder_time_text=local_time_text,
            reminder_type_label=reminder_label,
            notes=reminder.notes,
        )
        if not email_sent:
            logger.warning(
                "Reminder email failed reminder_id=%s user_id=%s email=%s",
                reminder.id,
                reminder.user_id,
                profile.email,
            )


def _compute_due_slots_utc(
    reminder: Reminder,
    reminder_tz: tzinfo,
    start_utc: datetime,
    end_utc: datetime,
) -> list[datetime]:
    results: list[datetime] = []
    lead_delta = timedelta(minutes=max(0, settings.REMINDER_LEAD_MINUTES))
    local_start_date = start_utc.astimezone(reminder_tz).date()
    local_end_date = end_utc.astimezone(reminder_tz).date()

    current_date = local_start_date
    while current_date <= local_end_date:
        local_weekday = current_date.weekday()  # Monday=0..Sunday=6
        days = reminder.days_of_week or [0, 1, 2, 3, 4, 5, 6]
        if local_weekday in days:
            for time_str in reminder.reminder_times or []:
                hour, minute = _parse_hhmm(time_str)
                slot_local = datetime(
                    current_date.year,
                    current_date.month,
                    current_date.day,
                    hour,
                    minute,
                    tzinfo=reminder_tz,
                )
                slot_utc = slot_local.astimezone(timezone.utc).replace(second=0, microsecond=0)
                notify_utc = slot_utc - lead_delta
                if start_utc <= notify_utc <= end_utc:
                    results.append(slot_utc)
        current_date = current_date + timedelta(days=1)

    return results


def _parse_hhmm(value: str) -> tuple[int, int]:
    hour_s, minute_s = value.split(":")
    return int(hour_s), int(minute_s)


def _normalize_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).replace(second=0, microsecond=0)
    return value.astimezone(timezone.utc).replace(second=0, microsecond=0)


def _safe_timezone(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        logger.warning(
            "Invalid reminder timezone '%s', falling back to %s",
            name,
            settings.DEFAULT_REMINDER_TIMEZONE,
        )

    try:
        return ZoneInfo(settings.DEFAULT_REMINDER_TIMEZONE)
    except ZoneInfoNotFoundError:
        logger.error(
            "Fallback reminder timezone '%s' is unavailable. Using UTC. Install tzdata to enable IANA timezones.",
            settings.DEFAULT_REMINDER_TIMEZONE,
        )
        return timezone.utc


def _timezone_key(value: tzinfo) -> str:
    return getattr(value, "key", "UTC")
