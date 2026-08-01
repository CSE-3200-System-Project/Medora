"""add booking idempotency and transactional outbox

Revision ID: softwarex_003
Revises: softwarex_002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "softwarex_003"
down_revision: str | None = "softwarex_002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "appointment_idempotency_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("patient_id", sa.String(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("appointment_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_appointment_idempotency_patient_key",
        "appointment_idempotency_records",
        ["patient_id", "idempotency_key"],
        unique=True,
    )
    op.create_table(
        "appointment_outbox_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("aggregate_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["aggregate_id"], ["appointments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_appointment_outbox_pending",
        "appointment_outbox_events",
        ["processed_at", "available_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointment_outbox_pending", table_name="appointment_outbox_events")
    op.drop_table("appointment_outbox_events")
    op.drop_index("uq_appointment_idempotency_patient_key", table_name="appointment_idempotency_records")
    op.drop_table("appointment_idempotency_records")
