"""Add admin approval fields for reschedule requests and cancellation requests table.

Revision ID: admin_appr_001
Revises: oauth_002
Create Date: 2026-04-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "admin_appr_001"
down_revision = "oauth_002"
branch_labels = None
depends_on = None


ADMIN_APPROVAL_VALUES = ("pending", "approved", "rejected")
REQUESTED_BY_ROLE_VALUES = ("patient", "doctor", "admin")


def upgrade() -> None:
    bind = op.get_bind()

    # Create adminapprovalstatus enum type if missing.
    bind.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adminapprovalstatus') THEN
                    CREATE TYPE adminapprovalstatus AS ENUM ('pending', 'approved', 'rejected');
                END IF;
            END
            $$;
            """
        )
    )

    admin_approval_enum = postgresql.ENUM(
        *ADMIN_APPROVAL_VALUES, name="adminapprovalstatus", create_type=False
    )
    requested_by_role_enum = postgresql.ENUM(
        *REQUESTED_BY_ROLE_VALUES, name="requestedbyrole", create_type=False
    )

    # Detect previously applied version (plain string columns) and convert them.
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("appointment_reschedule_requests")}

    if "admin_approval_status" in existing_cols:
        # Drop server default first so the USING cast works cleanly.
        op.alter_column(
            "appointment_reschedule_requests",
            "admin_approval_status",
            server_default=None,
        )
        bind.execute(
            sa.text(
                "ALTER TABLE appointment_reschedule_requests "
                "ALTER COLUMN admin_approval_status TYPE adminapprovalstatus "
                "USING admin_approval_status::adminapprovalstatus"
            )
        )
        op.alter_column(
            "appointment_reschedule_requests",
            "admin_approval_status",
            server_default=sa.text("'pending'::adminapprovalstatus"),
            existing_nullable=False,
        )
    else:
        op.add_column(
            "appointment_reschedule_requests",
            sa.Column(
                "admin_approval_status",
                admin_approval_enum,
                nullable=False,
                server_default=sa.text("'pending'::adminapprovalstatus"),
            ),
        )
        op.add_column(
            "appointment_reschedule_requests",
            sa.Column("admin_notes", sa.Text(), nullable=True),
        )
        op.add_column(
            "appointment_reschedule_requests",
            sa.Column("admin_decided_at", sa.DateTime(timezone=True), nullable=True),
        )

    # Cancellation request table — create if missing.
    if not inspector.has_table("appointment_cancellation_requests"):
        op.create_table(
            "appointment_cancellation_requests",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "appointment_id",
                sa.String(),
                sa.ForeignKey("appointments.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "requested_by_id",
                sa.String(),
                sa.ForeignKey("profiles.id"),
                nullable=False,
            ),
            sa.Column("requested_by_role", requested_by_role_enum, nullable=False),
            sa.Column("reason_key", sa.String(80), nullable=True),
            sa.Column("reason_note", sa.Text(), nullable=True),
            sa.Column(
                "admin_approval_status",
                admin_approval_enum,
                nullable=False,
                server_default=sa.text("'pending'::adminapprovalstatus"),
            ),
            sa.Column("admin_notes", sa.Text(), nullable=True),
            sa.Column("admin_decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )


def downgrade() -> None:
    op.drop_table("appointment_cancellation_requests")
    op.drop_column("appointment_reschedule_requests", "admin_decided_at")
    op.drop_column("appointment_reschedule_requests", "admin_notes")
    op.drop_column("appointment_reschedule_requests", "admin_approval_status")
    op.execute("DROP TYPE IF EXISTS adminapprovalstatus")
