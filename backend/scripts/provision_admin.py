"""Atomically provision an administrator role, permissions, and resource scopes.

Run from ``backend/`` after applying ``steward_001``::

    venv/Scripts/python.exe scripts/provision_admin.py --email admin@example.com --tier super_admin
"""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.admin_governance import AdminRole, AdminScope
from app.db.models.enums import AdminTier, Permission, UserRole
from app.db.models.profile import Profile
from app.db.session import AsyncSessionLocal


def parse_scope(value: str) -> tuple[str, str]:
    scope_type, separator, scope_id = value.partition(":")
    if not separator or not scope_type.strip() or not scope_id.strip():
        raise argparse.ArgumentTypeError("scope must use TYPE:ID")
    return scope_type.strip().lower(), scope_id.strip()


async def provision_admin(
    db: AsyncSession,
    *,
    email: str,
    tier: AdminTier,
    permissions: Iterable[Permission],
    scopes: Iterable[tuple[str, str]],
) -> AdminRole:
    permission_values = sorted({permission.value for permission in permissions})
    scope_values = sorted(set(scopes))
    if tier != AdminTier.SUPER_ADMIN and (not permission_values or not scope_values):
        raise ValueError("Bounded administrators require at least one permission and one scope")

    profile = (
        await db.execute(
            select(Profile)
            .where(Profile.email == email.strip().lower())
            .with_for_update()
        )
    ).scalar_one_or_none()
    if profile is None:
        raise ValueError(f"No profile exists for {email}")
    profile.role = UserRole.ADMIN

    roles = list(
        (
            await db.execute(
                select(AdminRole)
                .where(AdminRole.profile_id == profile.id)
                .with_for_update()
            )
        ).scalars().all()
    )
    role = next((item for item in roles if item.tier == tier.value), None)
    for existing in roles:
        existing.active = existing is role
    if role is None:
        role = AdminRole(profile_id=profile.id, tier=tier.value, permission_set=[])
        db.add(role)
        await db.flush()
    role.active = True
    role.permission_set = (
        [permission.value for permission in Permission]
        if tier == AdminTier.SUPER_ADMIN
        else permission_values
    )

    await db.execute(delete(AdminScope).where(AdminScope.admin_role_id == role.id))
    db.add_all(
        AdminScope(admin_role_id=role.id, scope_type=scope_type, scope_id=scope_id)
        for scope_type, scope_id in scope_values
    )
    await db.flush()
    return role


async def _run(args: argparse.Namespace) -> None:
    tier = AdminTier(args.tier)
    permissions = [Permission(value) for value in args.permission]
    async with AsyncSessionLocal() as db:
        async with db.begin():
            role = await provision_admin(
                db,
                email=args.email,
                tier=tier,
                permissions=permissions,
                scopes=args.scope,
            )
        print(
            f"Provisioned {args.email} as {role.tier} with "
            f"{len(role.permission_set)} permission(s) and {len(args.scope)} scope(s)."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--tier", choices=[item.value for item in AdminTier], required=True)
    parser.add_argument(
        "--permission",
        action="append",
        choices=[item.value for item in Permission],
        default=[],
        help="Repeat for each permission; super_admin always receives the full set.",
    )
    parser.add_argument(
        "--scope",
        action="append",
        type=parse_scope,
        default=[],
        metavar="TYPE:ID",
        help="Repeat for each exact resource scope; required for bounded tiers.",
    )
    args = parser.parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
