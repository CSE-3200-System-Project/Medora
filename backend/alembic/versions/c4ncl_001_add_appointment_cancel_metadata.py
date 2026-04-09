"""add ownership-aware appointment cancellation metadata

Revision ID: c4ncl_001
Revises: c91b5fbe2a10
Create Date: 2026-04-01 10:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4ncl_001"
down_revision: Union[str, Sequence[str], None] = "c91b5fbe2a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus') THEN
                ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'CANCELLED_BY_PATIENT';
                ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'CANCELLED_BY_DOCTOR';
            END IF;
        END
        $$;
        """
    )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("appointments")}

    if "cancellation_reason_key" not in existing_columns:
        op.add_column(
            "appointments",
            sa.Column("cancellation_reason_key", sa.String(length=80), nullable=True),
        )
    if "cancellation_reason_note" not in existing_columns:
        op.add_column(
            "appointments",
            sa.Column("cancellation_reason_note", sa.Text(), nullable=True),
        )
    if "cancelled_by_id" not in existing_columns:
        op.add_column(
            "appointments",
            sa.Column("cancelled_by_id", sa.String(), nullable=True),
        )
    if "cancelled_at" not in existing_columns:
        op.add_column(
            "appointments",
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        )

    existing_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("appointments") if fk.get("name")}
    if "fk_appointments_cancelled_by_id_profiles" not in existing_foreign_keys:
        op.create_foreign_key(
            "fk_appointments_cancelled_by_id_profiles",
            "appointments",
            "profiles",
            ["cancelled_by_id"],
            ["id"],
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("appointments")}
    if "ix_appointments_cancelled_by_id" not in existing_indexes:
        op.create_index(
            "ix_appointments_cancelled_by_id",
            "appointments",
            ["cancelled_by_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = {index["name"] for index in inspector.get_indexes("appointments")}
    if "ix_appointments_cancelled_by_id" in existing_indexes:
        op.drop_index("ix_appointments_cancelled_by_id", table_name="appointments")

    existing_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("appointments") if fk.get("name")}
    if "fk_appointments_cancelled_by_id_profiles" in existing_foreign_keys:
        op.drop_constraint(
            "fk_appointments_cancelled_by_id_profiles",
            "appointments",
            type_="foreignkey",
        )

    existing_columns = {column["name"] for column in inspector.get_columns("appointments")}
    if "cancelled_at" in existing_columns:
        op.drop_column("appointments", "cancelled_at")
    if "cancelled_by_id" in existing_columns:
        op.drop_column("appointments", "cancelled_by_id")
    if "cancellation_reason_note" in existing_columns:
        op.drop_column("appointments", "cancellation_reason_note")
    if "cancellation_reason_key" in existing_columns:
        op.drop_column("appointments", "cancellation_reason_key")

    # Postgres enum value removal is intentionally skipped for safety.
