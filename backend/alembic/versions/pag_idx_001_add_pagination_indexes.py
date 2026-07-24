"""add pagination indexes for list endpoints

Revision ID: pag_idx_001
Revises: z9c4a1d7e2f3
Create Date: 2026-06-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "pag_idx_001"
down_revision = "z9c4a1d7e2f3"
branch_labels = None
depends_on = None


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    try:
        existing = {idx["name"] for idx in inspector.get_indexes(table_name)}
        return index_name in existing
    except Exception:
        return False


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    indexes = [
        # notifications: patients poll unread notifications constantly
        ("notifications", "ix_notifications_user_created", ["user_id", "created_at"]),
        # reminders: per-user ordered list
        ("reminders", "ix_reminders_user_created", ["user_id", "created_at"]),
        # health_metrics: per-user ordered by recorded_at
        ("health_metrics", "ix_health_metrics_user_recorded", ["user_id", "recorded_at"]),
        # doctor_actions: per-doctor ordered list
        ("doctor_actions", "ix_doctor_actions_doctor_created", ["doctor_id", "created_at"]),
        # medical_reports: per-patient ordered list
        ("medical_reports", "ix_medical_reports_patient_created", ["patient_id", "created_at"]),
        # consultations: per-doctor + per-patient ordered list
        ("consultations", "ix_consultations_doctor_created", ["doctor_id", "created_at"]),
        ("consultations", "ix_consultations_patient_created", ["patient_id", "created_at"]),
        # appointments: per-patient and per-doctor ordered by appointment_date
        ("appointments", "ix_appointments_patient_date", ["patient_id", "appointment_date"]),
        ("appointments", "ix_appointments_doctor_date", ["doctor_id", "appointment_date"]),
        # chorui_chat_messages: conversation list query groups by conversation_id, orders by created_at
        ("chorui_chat_messages", "ix_chorui_user_convo_created", ["user_id", "conversation_id", "created_at"]),
        # patient_access_logs: per-patient ordered by accessed_at
        ("patient_access_logs", "ix_patient_access_logs_patient_accessed", ["patient_id", "accessed_at"]),
        # health_data_consents: per-patient and per-doctor
        ("health_data_consents", "ix_health_data_consents_patient", ["patient_id", "granted_at"]),
        ("health_data_consents", "ix_health_data_consents_doctor", ["doctor_id", "granted_at"]),
        # patient_data_sharing_preferences: per-patient
        ("patient_data_sharing_preferences", "ix_pds_patient_created", ["patient_id", "created_at"]),
        # prescriptions: per-patient ordered list
        ("prescriptions", "ix_prescriptions_patient_created", ["patient_id", "created_at"]),
        # doctor_reviews: per-doctor filtered by status + ordered
        ("doctor_reviews", "ix_doctor_reviews_doctor_created", ["doctor_id", "created_at"]),
    ]

    for table_name, index_name, columns in indexes:
        if not _table_exists(bind, table_name):
            continue
        if _index_exists(bind, table_name, index_name):
            continue
        # Use IF NOT EXISTS via raw DDL for safety on partial runs
        cols = ", ".join(columns)
        op.execute(
            sa.text(
                f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table_name}" ({cols})'
            )
        )


def downgrade() -> None:
    bind = op.get_bind()

    index_names = [
        "ix_notifications_user_created",
        "ix_reminders_user_created",
        "ix_health_metrics_user_recorded",
        "ix_doctor_actions_doctor_created",
        "ix_medical_reports_patient_created",
        "ix_consultations_doctor_created",
        "ix_consultations_patient_created",
        "ix_appointments_patient_date",
        "ix_appointments_doctor_date",
        "ix_chorui_user_convo_created",
        "ix_patient_access_logs_patient_accessed",
        "ix_health_data_consents_patient",
        "ix_health_data_consents_doctor",
        "ix_pds_patient_created",
        "ix_prescriptions_patient_created",
        "ix_doctor_reviews_doctor_created",
    ]

    for index_name in index_names:
        op.execute(sa.text(f'DROP INDEX IF EXISTS "{index_name}"'))
