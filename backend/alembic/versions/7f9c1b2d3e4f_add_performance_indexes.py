"""Add performance indexes for hot query paths.

Revision ID: 7f9c1b2d3e4f
Revises: r3m1nd3r_t4bl3
Create Date: 2026-03-11
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "7f9c1b2d3e4f"
down_revision = "r3m1nd3r_t4bl3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Appointment hot-path indexes
    op.create_index(
        "ix_appointments_doctor_date_status",
        "appointments",
        ["doctor_id", "appointment_date", "status"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_patient_date_status",
        "appointments",
        ["patient_id", "appointment_date", "status"],
        unique=False,
    )
    op.create_index(
        "ix_appointments_patient_doctor",
        "appointments",
        ["patient_id", "doctor_id"],
        unique=False,
    )

    # Patient-access hot-path indexes
    op.create_index(
        "ix_patient_access_logs_patient_doctor_accessed_at",
        "patient_access_logs",
        ["patient_id", "doctor_id", "accessed_at"],
        unique=False,
    )
    op.create_index(
        "ix_patient_doctor_access_patient_doctor",
        "patient_doctor_access",
        ["patient_id", "doctor_id"],
        unique=False,
    )

    # Reminder polling/filtering index
    op.create_index(
        "ix_reminders_user_active_type",
        "reminders",
        ["user_id", "is_active", "type"],
        unique=False,
    )

    # Fuzzy medicine search index
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_term_trgm "
        "ON medicine_search_index USING gin (term gin_trgm_ops);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_medicine_search_index_term_trgm")
    op.drop_index("ix_reminders_user_active_type", table_name="reminders")
    op.drop_index("ix_patient_doctor_access_patient_doctor", table_name="patient_doctor_access")
    op.drop_index(
        "ix_patient_access_logs_patient_doctor_accessed_at",
        table_name="patient_access_logs",
    )
    op.drop_index("ix_appointments_patient_doctor", table_name="appointments")
    op.drop_index("ix_appointments_patient_date_status", table_name="appointments")
    op.drop_index("ix_appointments_doctor_date_status", table_name="appointments")
