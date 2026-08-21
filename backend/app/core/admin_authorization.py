"""RBAC + resource-scope dependency for the stewardship layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, resolve_profile
from app.db.models.admin_governance import AdminActionAudit, AdminRole, AdminScope
from app.db.models.enums import AdminTier, Permission, UserRole
from app.db.models.profile import Profile


@dataclass(frozen=True, slots=True)
class ScopedAdminContext:
    profile: Profile
    tier: AdminTier
    permissions: frozenset[Permission]
    scopes: frozenset[tuple[str, str]] = field(default_factory=frozenset)
    break_glass_scopes: frozenset[tuple[str, str]] = field(default_factory=frozenset)
    unbounded: bool = False

    @property
    def id(self) -> str:
        """Compatibility with the Profile returned by the previous dependency."""
        return self.profile.id

    def allows(self, scope_type: str, scope_id: str) -> bool:
        key = (scope_type.strip().lower(), str(scope_id))
        explicit = self.scopes | self.break_glass_scopes
        return self.unbounded or ("platform", "*") in explicit or key in explicit

    def require_scope(self, scope_type: str, scope_id: str) -> None:
        if not self.allows(scope_type, scope_id):
            raise HTTPException(status_code=403, detail="Administrative scope does not include this resource")

    def require_any_scope(self, *resources: tuple[str, str]) -> None:
        if not any(self.allows(scope_type, scope_id) for scope_type, scope_id in resources):
            raise HTTPException(status_code=403, detail="Administrative scope does not include this resource")

    def accessible_ids(self, scope_type: str) -> set[str] | None:
        if self.unbounded or ("platform", "*") in self.scopes | self.break_glass_scopes:
            return None
        normalized = scope_type.strip().lower()
        return {
            scope_id
            for kind, scope_id in self.scopes | self.break_glass_scopes
            if kind == normalized
        }


def _permission_values(values: list[str] | None) -> frozenset[Permission]:
    out = set()
    for value in values or []:
        try:
            out.add(Permission(value))
        except ValueError:
            # A removed/unknown permission must never broaden authority.
            continue
    return frozenset(out)


async def resolve_admin_context(
    db: AsyncSession,
    user: Any,
    required_permission: Permission,
) -> ScopedAdminContext:
    profile = user if isinstance(user, Profile) else await resolve_profile(db, user)
    if not profile or profile.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    roles = list(
        (await db.execute(select(AdminRole).where(
            AdminRole.profile_id == profile.id,
            AdminRole.active.is_(True),
        ))).scalars().all()
    )
    if not roles:
        # The migration backfills every existing admin as an explicit super-admin. A later
        # admin profile without a role row is a provisioning error and must fail closed.
        raise HTTPException(
            status_code=403,
            detail="Administrator role is not provisioned",
        )

    if any(role.tier == AdminTier.SUPER_ADMIN.value for role in roles):
        return ScopedAdminContext(
            profile=profile,
            tier=AdminTier.SUPER_ADMIN,
            permissions=frozenset(Permission),
            unbounded=True,
        )

    permissions = frozenset().union(*(_permission_values(role.permission_set) for role in roles))
    if required_permission not in permissions:
        raise HTTPException(status_code=403, detail=f"Missing admin permission: {required_permission.value}")

    role_ids = [role.id for role in roles]
    bindings = list(
        (await db.execute(select(AdminScope).where(AdminScope.admin_role_id.in_(role_ids)))).scalars().all()
    )
    now = datetime.now(timezone.utc)
    grants = list(
        (await db.execute(select(AdminActionAudit).where(
            AdminActionAudit.actor_profile_id == profile.id,
            AdminActionAudit.action == "break_glass",
            AdminActionAudit.status == "completed",
            AdminActionAudit.break_glass_expires_at > now,
        ))).scalars().all()
    )
    tier_order = {
        AdminTier.FUNCTION_ADMIN: 0,
        AdminTier.FACILITY_ADMIN: 1,
        AdminTier.ORG_ADMIN: 2,
        AdminTier.SUPER_ADMIN: 3,
    }
    tiers = [AdminTier(role.tier) for role in roles]
    context = ScopedAdminContext(
        profile=profile,
        tier=max(tiers, key=tier_order.get),
        permissions=permissions,
        scopes=frozenset((scope.scope_type.lower(), scope.scope_id) for scope in bindings),
        break_glass_scopes=frozenset(
            (grant.scope_type.lower(), grant.scope_id)
            for grant in grants
            if grant.scope_type and grant.scope_id
        ),
        unbounded=False,
    )
    if required_permission == Permission.PLATFORM_ADMIN:
        context.require_scope("platform", "*")
    return context


def require_admin(perm: Permission) -> Callable:
    # Import lazily so importing the authorization policy by itself does not pull the
    # route/model graph into unit tests. Admin routes already use this established token
    # dependency, and the integration test harness patches it at its owning module.
    from app.routes.auth import get_current_user_token

    async def dependency(
        user: Any = Depends(get_current_user_token),
        db: AsyncSession = Depends(get_db),
    ) -> ScopedAdminContext:
        return await resolve_admin_context(db, user, perm)

    dependency.__name__ = f"require_admin_{perm.value}"
    return dependency
