"""Add covering indexes for hot patient/doctor query paths.

Revision ID: p3rf_002
Revises: 22e4f4f87d3b
Create Date: 2026-04-26
"""
from typing import Sequence, Union

from alembic import op


revision: str = "p3rf_002"
down_revision: Union[str, Sequence[str], None] = "22e4f4f87d3b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Health metrics: aggregate-by-day reads need (user_id, metric_type, recorded_at desc)
    # The model declares ix_health_metrics_user_metric_recorded but ascending; an explicit
    # desc-ordered index speeds up the "latest unit per metric_type" DISTINCT ON query.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_health_metrics_user_metric_recorded_desc "
        "ON health_metrics (user_id, metric_type, recorded_at DESC);"
    )

    # Prescriptions list: medical-history page filters by (patient_id, status, accepted_at desc).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_prescriptions_patient_status_accepted "
        "ON prescriptions (patient_id, status, accepted_at DESC);"
    )

    # Medical reports list: patient view orders by (patient_id, created_at desc).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_medical_reports_patient_created "
        "ON medical_reports (patient_id, created_at DESC);"
    )

    # Doctor actions stats: aggregates filter by (doctor_id, created_at) frequently.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_doctor_actions_doctor_created "
        "ON doctor_actions (doctor_id, created_at DESC);"
    )

    # Per-report doctor visibility batch lookup (report_id, doctor_id).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_medical_report_doctor_access_lookup "
        "ON medical_report_doctor_access (report_id, doctor_id);"
    )

    # Patient↔doctor data sharing preference batch lookup (patient_id, doctor_id).
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patient_data_sharing_lookup "
        "ON patient_data_sharing_preferences (patient_id, doctor_id);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_patient_data_sharing_lookup;")
    op.execute("DROP INDEX IF EXISTS ix_medical_report_doctor_access_lookup;")
    op.execute("DROP INDEX IF EXISTS ix_doctor_actions_doctor_created;")
    op.execute("DROP INDEX IF EXISTS ix_medical_reports_patient_created;")
    op.execute("DROP INDEX IF EXISTS ix_prescriptions_patient_status_accepted;")
    op.execute("DROP INDEX IF EXISTS ix_health_metrics_user_metric_recorded_desc;")
