"""Add scoped admin roles, scopes, and privileged-action audit.

Revision ID: steward_001
Revises: ar0h0n_002
"""

from alembic import op
import sqlalchemy as sa

revision = "steward_001"
down_revision = "ar0h0n_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_roles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier", sa.String(length=32), nullable=False),
        sa.Column("permission_set", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_profile_id", sa.String(), sa.ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("profile_id", "tier", name="uq_admin_roles_profile_tier"),
    )
    op.create_index("ix_admin_roles_profile_id", "admin_roles", ["profile_id"])
    op.execute(
        """
        INSERT INTO admin_roles (
            id, profile_id, tier, permission_set, active, created_by_profile_id
        )
        SELECT
            concat(p.id, '-super-admin'),
            p.id,
            'super_admin',
            '["platform_admin", "view_dashboard", "manage_doctors", "manage_patients",
              "manage_appointments", "moderate_reviews", "view_audit", "manage_admins",
              "break_glass"]'::json,
            true,
            NULL
        FROM profiles AS p
        WHERE p.role::text IN ('ADMIN', 'admin')
        ON CONFLICT (profile_id, tier) DO NOTHING
        """
    )

    op.create_table(
        "admin_scopes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("admin_role_id", sa.String(), sa.ForeignKey("admin_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("admin_role_id", "scope_type", "scope_id", name="uq_admin_scope_binding"),
    )
    op.create_index("ix_admin_scopes_admin_role_id", "admin_scopes", ["admin_role_id"])
    op.create_index("ix_admin_scopes_scope_id", "admin_scopes", ["scope_id"])

    op.create_table(
        "admin_action_audit",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("actor_profile_id", sa.String(), sa.ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("approved_by_profile_id", sa.String(), sa.ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("permission", sa.String(length=48), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.String(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=True),
        sa.Column("scope_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=True),
        sa.Column("before_state", sa.JSON(), nullable=True),
        sa.Column("after_state", sa.JSON(), nullable=True),
        sa.Column("autonomy_tier", sa.String(length=24), nullable=True),
        sa.Column("break_glass_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    for column in ("actor_profile_id", "approved_by_profile_id", "permission", "action", "target_type", "target_id", "status", "autonomy_tier", "created_at"):
        op.create_index(f"ix_admin_action_audit_{column}", "admin_action_audit", [column])

    for table in ("admin_roles", "admin_scopes", "admin_action_audit"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    REVOKE ALL ON TABLE {table} FROM anon;
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                    REVOKE ALL ON TABLE {table} FROM authenticated;
                END IF;
            END $$
            """
        )


def downgrade() -> None:
    op.drop_table("admin_action_audit")
    op.drop_table("admin_scopes")
    op.drop_table("admin_roles")
