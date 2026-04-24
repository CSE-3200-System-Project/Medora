"""Add composite indexes for hot read paths (consultations, prescriptions, notifications, doctor_actions).

Revision ID: p3rf_001
Revises: n0t1f_r0l3_001
Create Date: 2026-04-24

Adds composite indexes to support the most-hit query shapes identified during
the backend perf sweep:

- consultations (doctor_id, status), (patient_id, status), (patient_id, created_at DESC)
- prescriptions (patient_id, status), (doctor_id, status), (patient_id, created_at DESC)
- notifications (target_role, created_at DESC) for admin feeds
- doctor_actions (doctor_id, status, priority DESC, created_at DESC) for pending top-N
- doctor_actions (doctor_id, due_date) partial index for overdue filters

All CREATE INDEX statements use IF NOT EXISTS so re-runs are idempotent and
this migration is safe to apply to environments that already have some of
these indexes out-of-band.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "p3rf_001"
down_revision: Union[str, None] = "n0t1f_r0l3_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = [
    # ── consultations ────────────────────────────────────────────────────────
    (
        "ix_consultations_doctor_status",
        "consultations",
        "CREATE INDEX IF NOT EXISTS ix_consultations_doctor_status "
        "ON consultations (doctor_id, status)",
    ),
    (
        "ix_consultations_patient_status",
        "consultations",
        "CREATE INDEX IF NOT EXISTS ix_consultations_patient_status "
        "ON consultations (patient_id, status)",
    ),
    (
        "ix_consultations_patient_created_desc",
        "consultations",
        "CREATE INDEX IF NOT EXISTS ix_consultations_patient_created_desc "
        "ON consultations (patient_id, created_at DESC)",
    ),
    # ── prescriptions ────────────────────────────────────────────────────────
    (
        "ix_prescriptions_patient_status",
        "prescriptions",
        "CREATE INDEX IF NOT EXISTS ix_prescriptions_patient_status "
        "ON prescriptions (patient_id, status)",
    ),
    (
        "ix_prescriptions_doctor_status",
        "prescriptions",
        "CREATE INDEX IF NOT EXISTS ix_prescriptions_doctor_status "
        "ON prescriptions (doctor_id, status)",
    ),
    (
        "ix_prescriptions_patient_created_desc",
        "prescriptions",
        "CREATE INDEX IF NOT EXISTS ix_prescriptions_patient_created_desc "
        "ON prescriptions (patient_id, created_at DESC)",
    ),
    # ── notifications ────────────────────────────────────────────────────────
    (
        "ix_notifications_target_role_created",
        "notifications",
        "CREATE INDEX IF NOT EXISTS ix_notifications_target_role_created "
        "ON notifications (target_role, created_at DESC) "
        "WHERE target_role IS NOT NULL",
    ),
    # ── doctor_actions ───────────────────────────────────────────────────────
    (
        "ix_doctor_actions_doctor_status_priority",
        "doctor_actions",
        "CREATE INDEX IF NOT EXISTS ix_doctor_actions_doctor_status_priority "
        "ON doctor_actions (doctor_id, status, priority DESC, created_at DESC)",
    ),
    (
        "ix_doctor_actions_doctor_due",
        "doctor_actions",
        "CREATE INDEX IF NOT EXISTS ix_doctor_actions_doctor_due "
        "ON doctor_actions (doctor_id, due_date) "
        "WHERE due_date IS NOT NULL",
    ),
]


def upgrade() -> None:
    # Verify each table exists before creating indexes — avoids failure on
    # partially-migrated environments.
    conn = op.get_bind()
    for _index_name, table_name, ddl in INDEXES:
        table_exists = conn.execute(
            sa.text(f"SELECT to_regclass('public.{table_name}')")
        ).scalar()
        if table_exists is not None:
            op.execute(ddl)


def downgrade() -> None:
    for index_name, _table_name, _ddl in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
