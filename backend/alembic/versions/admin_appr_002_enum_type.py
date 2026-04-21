"""Create adminapprovalstatus enum type and convert columns.

Revision ID: admin_appr_002
Revises: admin_appr_001
Create Date: 2026-04-22

The prior revision created `admin_approval_status` as a plain VARCHAR(20),
but the ORM uses a native Postgres Enum. This migration creates the
`adminapprovalstatus` type (if missing) and converts the existing columns
to use it. Idempotent — safe to run against fresh or partially-migrated DBs.
"""
from alembic import op
import sqlalchemy as sa


revision = "admin_appr_002"
down_revision = "admin_appr_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create the enum type if it doesn't exist.
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

    # 2. Convert existing columns on both tables (only if they're still VARCHAR).
    for table in ("appointment_reschedule_requests", "appointment_cancellation_requests"):
        table_exists = bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = current_schema() AND table_name = :t"
            ),
            {"t": table},
        ).first()
        if not table_exists:
            continue

        current_type = bind.execute(
            sa.text(
                "SELECT data_type, udt_name FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = 'admin_approval_status'"
            ),
            {"t": table},
        ).first()
        if not current_type:
            continue
        if current_type[1] == "adminapprovalstatus":
            continue  # already converted

        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status DROP DEFAULT"
            )
        )
        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status TYPE adminapprovalstatus "
                "USING admin_approval_status::adminapprovalstatus"
            )
        )
        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status SET DEFAULT 'pending'::adminapprovalstatus"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table in ("appointment_reschedule_requests", "appointment_cancellation_requests"):
        table_exists = bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = current_schema() AND table_name = :t"
            ),
            {"t": table},
        ).first()
        if not table_exists:
            continue
        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status DROP DEFAULT"
            )
        )
        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status TYPE VARCHAR(20) "
                "USING admin_approval_status::text"
            )
        )
        bind.execute(
            sa.text(
                f"ALTER TABLE {table} "
                "ALTER COLUMN admin_approval_status SET DEFAULT 'pending'"
            )
        )
    op.execute("DROP TYPE IF EXISTS adminapprovalstatus")
