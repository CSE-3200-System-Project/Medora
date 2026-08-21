from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.core.admin_authorization import ScopedAdminContext
from app.db.models.enums import AdminTier, Permission, UserRole
from app.services import admin_governance as governance_service
from app.services.admin_governance import (
    break_glass_notification_copy,
    complete_admin_action,
    request_or_approve_destructive_action,
)


def _profile(identifier: str):
    return SimpleNamespace(id=identifier, role=UserRole.ADMIN)


def _context(identifier: str, *, unbounded: bool = False, scopes=()) -> ScopedAdminContext:
    return ScopedAdminContext(
        profile=_profile(identifier),
        tier=AdminTier.SUPER_ADMIN if unbounded else AdminTier.FUNCTION_ADMIN,
        permissions=frozenset({Permission.MANAGE_PATIENTS}),
        scopes=frozenset(scopes),
        unbounded=unbounded,
    )


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _SelectStub:
    def where(self, *args, **kwargs):
        return self

    def with_for_update(self):
        return self


class _AuditFactory:
    id = ""

    def __new__(cls, **values):
        return SimpleNamespace(id="approval-a", created_at=datetime.now(timezone.utc), **values)


@pytest.mark.backend
def test_scoped_context_denies_cross_scope_and_super_admin_remains_unbounded() -> None:
    scoped = _context("admin-a", scopes={("patient", "patient-a")})
    assert scoped.allows("patient", "patient-a") is True
    assert scoped.allows("patient", "patient-b") is False
    with pytest.raises(HTTPException) as denied:
        scoped.require_scope("patient", "patient-b")
    assert denied.value.status_code == 403

    super_admin = _context("admin-root", unbounded=True)
    assert super_admin.allows("patient", "patient-b") is True
    assert super_admin.accessible_ids("patient") is None

    platform_admin = _context("admin-platform", scopes={("platform", "*")})
    assert platform_admin.allows("doctor", "doctor-any") is True
    assert platform_admin.accessible_ids("appointment") is None


@pytest.mark.backend
def test_break_glass_notification_copy_is_bilingual() -> None:
    title, message = break_glass_notification_copy(datetime.now(timezone.utc))
    assert "Emergency administrative access" in title
    assert "জরুরি প্রশাসনিক অ্যাক্সেস" in title
    assert "time-limited" in message
    assert "সীমিত সময়ের" in message


@pytest.mark.backend
async def test_two_person_rule_refuses_self_approval_and_records_second_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requester = _context("admin-a", unbounded=True)
    approver = _context("admin-b", unbounded=True)
    db = SimpleNamespace(add=lambda value: None, flush=AsyncMock(), execute=AsyncMock())
    monkeypatch.setattr(
        governance_service,
        "AdminActionAudit",
        _AuditFactory,
    )
    monkeypatch.setattr(governance_service, "select", lambda entity: _SelectStub())

    pending = await request_or_approve_destructive_action(
        db,
        requester,
        permission=Permission.MANAGE_PATIENTS,
        action="ban_patient",
        target_type="patient",
        target_id="patient-a",
        reason="Repeated verified abuse",
        approval_id=None,
    )
    assert pending.approved is False
    assert pending.audit.status == "pending"

    db.execute.return_value = _ScalarResult(pending.audit)
    with pytest.raises(HTTPException, match="second administrator"):
        await request_or_approve_destructive_action(
            db,
            requester,
            permission=Permission.MANAGE_PATIENTS,
            action="ban_patient",
            target_type="patient",
            target_id="patient-a",
            reason="Repeated verified abuse",
            approval_id="approval-a",
        )

    approved = await request_or_approve_destructive_action(
        db,
        approver,
        permission=Permission.MANAGE_PATIENTS,
        action="ban_patient",
        target_type="patient",
        target_id="patient-a",
        reason="Repeated verified abuse",
        approval_id="approval-a",
    )
    assert approved.approved is True
    assert approved.audit.approved_by_profile_id == "admin-b"
    complete_admin_action(
        approved.audit,
        before_state={"status": "active"},
        after_state={"status": "banned"},
    )
    assert approved.audit.status == "completed"
    assert approved.audit.completed_at is not None


@pytest.mark.backend
async def test_two_person_approval_is_bound_to_action_target_and_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    audit = SimpleNamespace(
        id="approval-a",
        actor_profile_id="admin-a",
        permission=Permission.MANAGE_PATIENTS.value,
        action="delete_patient",
        target_type="patient",
        target_id="patient-a",
        status="pending",
        reason="Patient requested erasure",
        created_at=datetime.now(timezone.utc),
    )
    db = AsyncMock()
    db.execute.return_value = _ScalarResult(audit)
    monkeypatch.setattr(governance_service, "select", lambda entity: _SelectStub())
    with pytest.raises(HTTPException, match="does not match this action"):
        await request_or_approve_destructive_action(
            db,
            _context("admin-b", unbounded=True),
            permission=Permission.MANAGE_PATIENTS,
            action="ban_patient",
            target_type="patient",
            target_id="patient-a",
            reason="Patient requested erasure",
            approval_id="approval-a",
        )
