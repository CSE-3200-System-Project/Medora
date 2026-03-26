import asyncio
import logging
from datetime import datetime, timedelta, timezone
from datetime import tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.db.models.notification import NotificationPriority, NotificationType
from app.db.models.reminder import Reminder, ReminderDeliveryLog, ReminderType
from app.db.session import AsyncSessionLocal
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
            if delivered_count > 0:
                interval_seconds = base_interval_seconds
            elif active_count == 0:
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

    notification_type = (
        NotificationType.MEDICATION_REMINDER if is_medication else NotificationType.TEST_REMINDER
    )
    title = "Medicine Reminder" if is_medication else "Test Reminder"
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


def _compute_due_slots_utc(
    reminder: Reminder,
    reminder_tz: tzinfo,
    start_utc: datetime,
    end_utc: datetime,
) -> list[datetime]:
    results: list[datetime] = []
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
                if start_utc < slot_utc <= end_utc:
                    results.append(slot_utc)
        current_date = current_date + timedelta(days=1)

    return results


def _parse_hhmm(value: str) -> tuple[int, int]:
    hour_s, minute_s = value.split(":")
    return int(hour_s), int(minute_s)


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
