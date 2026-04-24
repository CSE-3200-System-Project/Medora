import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.notification import PushSubscription

logger = logging.getLogger(__name__)

try:
    from pywebpush import WebPushException, webpush
except Exception:  # pragma: no cover - optional dependency at runtime
    WebPushException = Exception  # type: ignore[assignment]
    webpush = None


def is_web_push_configured() -> bool:
    return bool(
        settings.WEB_PUSH_VAPID_PUBLIC_KEY
        and settings.WEB_PUSH_VAPID_PRIVATE_KEY
        and settings.WEB_PUSH_VAPID_SUBJECT
    )


def get_vapid_public_key() -> str | None:
    return settings.WEB_PUSH_VAPID_PUBLIC_KEY


async def send_push_to_user(
    db: AsyncSession,
    *,
    user_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    tag: str | None = None,
) -> int:
    """Send web push notifications to all active subscriptions for a user."""
    if webpush is None:
        logger.warning("pywebpush is not installed. Skipping push dispatch.")
        return 0

    if not is_web_push_configured():
        return 0

    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active == True,  # noqa: E712
        )
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return 0

    payload = {
        "title": title,
        "body": body,
        "icon": "/icons/icon-192x192.png",
        "tag": tag or "medora-reminder",
        "data": data or {},
    }

    # Dispatch all pushes concurrently. Each _send_single_push offloads its
    # blocking webpush call to a thread, so gather() lets N devices deliver in
    # parallel instead of serially (typical users have 2-5 subscriptions).
    results = await asyncio.gather(
        *(_send_single_push(sub, payload) for sub in subscriptions),
        return_exceptions=True,
    )

    sent_count = 0
    now = datetime.now(timezone.utc)
    for subscription, outcome in zip(subscriptions, results):
        if isinstance(outcome, WebPushException):  # type: ignore[misc]
            _mark_push_failure(subscription, outcome)
        elif isinstance(outcome, Exception):
            logger.warning("Unexpected push dispatch error: %s", outcome)
            _mark_push_failure(subscription, outcome)
        else:
            subscription.failure_count = 0
            subscription.last_success_at = now
            sent_count += 1

    return sent_count


async def _send_single_push(subscription: PushSubscription, payload: dict[str, Any]) -> None:
    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }
    await asyncio.to_thread(
        webpush,
        subscription_info=subscription_info,
        data=json.dumps(payload),
        vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
        vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
    )


def _mark_push_failure(subscription: PushSubscription, exc: Exception) -> None:
    subscription.failure_count = (subscription.failure_count or 0) + 1
    status_code = getattr(getattr(exc, "response", None), "status_code", None)
    if status_code in (404, 410):
        subscription.is_active = False
    logger.warning(
        "Push delivery failed endpoint=%s status=%s failures=%s",
        subscription.endpoint,
        status_code,
        subscription.failure_count,
    )
