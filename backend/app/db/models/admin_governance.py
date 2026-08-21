"""Persistence for scoped administrator roles and durable privileged-action evidence."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AdminRole(Base):
    __tablename__ = "admin_roles"
    __table_args__ = (
        UniqueConstraint("profile_id", "tier", name="uq_admin_roles_profile_tier"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tier: Mapped[str] = mapped_column(String(32), nullable=False)
    permission_set: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_by_profile_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    scopes = relationship("AdminScope", back_populates="admin_role", cascade="all, delete-orphan")


class AdminScope(Base):
    __tablename__ = "admin_scopes"
    __table_args__ = (
        UniqueConstraint("admin_role_id", "scope_type", "scope_id", name="uq_admin_scope_binding"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_role_id: Mapped[str] = mapped_column(
        String, ForeignKey("admin_roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Generic until organizations/facilities land: patient, doctor, appointment,
    # organization, or facility. Unknown types fail closed in the authorization layer.
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    admin_role = relationship("AdminRole", back_populates="scopes")


class AdminActionAudit(Base):
    __tablename__ = "admin_action_audit"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_profile_id: Mapped[str] = mapped_column(
        String, ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    approved_by_profile_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    permission: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    scope_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    scope_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    request_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    before_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    autonomy_tier: Mapped[str | None] = mapped_column(String(24), nullable=True, index=True)
    break_glass_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
