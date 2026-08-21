"""Two-person destructive-action workflow and durable admin audit helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_authorization import ScopedAdminContext
from app.db.models.admin_governance import AdminActionAudit
from app.db.models.enums import Permission


APPROVAL_WINDOW = timedelta(hours=24)

BREAK_GLASS_COPY = {
    "en": {
        "title": "Emergency administrative access granted",
        "message": (
            "A time-limited administrator access grant was created for a resource linked to "
            "your account. It expires at {expires_at}."
        ),
    },
    "bn": {
        "title": "জরুরি প্রশাসনিক অ্যাক্সেস মঞ্জুর হয়েছে",
        "message": (
            "আপনার অ্যাকাউন্টের সঙ্গে যুক্ত একটি রিসোর্সের জন্য সীমিত সময়ের প্রশাসনিক "
            "অ্যাক্সেস তৈরি হয়েছে। এর মেয়াদ {expires_at}-এ শেষ হবে।"
        ),
    },
}


def break_glass_notification_copy(expires_at: datetime) -> tuple[str, str]:
    """Return bilingual safety copy when a recipient locale is not reliably available."""
    timestamp = expires_at.isoformat()
    title = f'{BREAK_GLASS_COPY["en"]["title"]} / {BREAK_GLASS_COPY["bn"]["title"]}'
    message = " / ".join(
        BREAK_GLASS_COPY[locale]["message"].format(expires_at=timestamp)
        for locale in ("en", "bn")
    )
    return title, message


@dataclass(frozen=True, slots=True)
class TwoPersonDecision:
    audit: AdminActionAudit
    approved: bool


async def request_or_approve_destructive_action(
    db: AsyncSession,
    admin: ScopedAdminContext,
    *,
    permission: Permission,
    action: str,
    target_type: str,
    target_id: str,
    reason: str,
    approval_id: str | None,
    request_payload: dict | None = None,
    scope_already_checked: bool = False,
) -> TwoPersonDecision:
    if not scope_already_checked:
        admin.require_scope(target_type, target_id)
    now = datetime.now(timezone.utc)
    if not approval_id:
        audit = AdminActionAudit(
            actor_profile_id=admin.id,
            permission=permission.value,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            scope_type=target_type,
            scope_id=str(target_id),
            status="pending",
            reason=reason,
            request_payload=request_payload,
        )
        db.add(audit)
        await db.flush()
        return TwoPersonDecision(audit=audit, approved=False)

    audit = (
        await db.execute(
            select(AdminActionAudit)
            .where(AdminActionAudit.id == approval_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=404, detail="Admin approval request not found")
    if audit.status != "pending":
        raise HTTPException(status_code=409, detail="Admin approval request is no longer pending")
    created_at = audit.created_at
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if created_at is not None and now - created_at > APPROVAL_WINDOW:
        audit.status = "expired"
        raise HTTPException(status_code=409, detail="Admin approval request expired")
    if audit.actor_profile_id == admin.id:
        raise HTTPException(status_code=403, detail="A second administrator must approve this action")
    if (
        audit.permission != permission.value
        or audit.action != action
        or audit.target_type != target_type
        or audit.target_id != str(target_id)
    ):
        raise HTTPException(status_code=409, detail="Approval request does not match this action")
    if audit.reason != reason:
        raise HTTPException(status_code=409, detail="Approval request reason does not match")
    audit.approved_by_profile_id = admin.id
    audit.approved_at = now
    audit.status = "approved"
    return TwoPersonDecision(audit=audit, approved=True)


def complete_admin_action(
    audit: AdminActionAudit,
    *,
    before_state: dict | None,
    after_state: dict | None,
) -> None:
    audit.before_state = before_state
    audit.after_state = after_state
    audit.status = "completed"
    audit.completed_at = datetime.now(timezone.utc)
