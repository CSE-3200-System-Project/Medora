"""Reconcile scheduling schema drift.

Revision ID: b7d2e6a4c9f1
Revises: f3b9d0a7c1e2
Create Date: 2026-03-18

This migration is intentionally idempotent. It repairs environments where
revision history and physical schema drifted out of sync.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d2e6a4c9f1"
down_revision: Union[str, Sequence[str], None] = "f3b9d0a7c1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure appointmentstatus enum contains workflow states.
    for status_val in [
        "PENDING_ADMIN_REVIEW",
        "PENDING_DOCTOR_CONFIRMATION",
        "PENDING_PATIENT_CONFIRMATION",
        "RESCHEDULE_REQUESTED",
        "CANCEL_REQUESTED",
        "NO_SHOW",
    ]:
        conn.execute(
            sa.text(
                f"ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS '{status_val}'"
            )
        )

    # Ensure helper enums exist.
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentrequeststatus') THEN
                    CREATE TYPE appointmentrequeststatus AS ENUM
                        ('pending', 'approved', 'rejected', 'reschedule_proposed');
                END IF;
            END
            $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reschedulerequeststatus') THEN
                    CREATE TYPE reschedulerequeststatus AS ENUM
                        ('pending', 'accepted', 'rejected');
                END IF;
            END
            $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requestedbyrole') THEN
                    CREATE TYPE requestedbyrole AS ENUM
                        ('patient', 'doctor', 'admin');
                END IF;
            END
            $$;
            """
        )
    )

    # Ensure appointments schema expected by ORM.
    conn.execute(
        sa.text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS slot_time TIME")
    )
    conn.execute(
        sa.text(
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id VARCHAR"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_appointments_doctor_date ON appointments (doctor_id, appointment_date)"
        )
    )

    # Ensure scheduling tables.
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS doctor_availability (
                id VARCHAR PRIMARY KEY,
                doctor_id VARCHAR NOT NULL REFERENCES doctor_profiles(profile_id),
                day_of_week INTEGER NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_doctor_day_of_week UNIQUE (doctor_id, day_of_week)
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS doctor_time_blocks (
                id VARCHAR PRIMARY KEY,
                availability_id VARCHAR NOT NULL REFERENCES doctor_availability(id) ON DELETE CASCADE,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                slot_duration_minutes INTEGER NOT NULL DEFAULT 30
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS doctor_exceptions (
                id VARCHAR PRIMARY KEY,
                doctor_id VARCHAR NOT NULL REFERENCES doctor_profiles(profile_id),
                exception_date DATE NOT NULL,
                is_available BOOLEAN NOT NULL DEFAULT false,
                reason VARCHAR(500),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_doctor_exception_date UNIQUE (doctor_id, exception_date)
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS doctor_schedule_overrides (
                id VARCHAR PRIMARY KEY,
                doctor_id VARCHAR NOT NULL REFERENCES doctor_profiles(profile_id),
                override_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )

    # Ensure appointment workflow tables.
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS appointment_requests (
                id VARCHAR PRIMARY KEY,
                doctor_id VARCHAR NOT NULL REFERENCES doctor_profiles(profile_id),
                patient_id VARCHAR NOT NULL REFERENCES patient_profiles(profile_id),
                requested_date DATE NOT NULL,
                requested_time TIME NOT NULL,
                requested_duration INTEGER DEFAULT 30,
                status appointmentrequeststatus DEFAULT 'pending',
                admin_notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
                id VARCHAR PRIMARY KEY,
                appointment_id VARCHAR NOT NULL REFERENCES appointments(id),
                requested_by_id VARCHAR NOT NULL REFERENCES profiles(id),
                requested_by_role requestedbyrole NOT NULL,
                proposed_date DATE NOT NULL,
                proposed_time TIME NOT NULL,
                reason TEXT,
                status reschedulerequeststatus DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS appointment_audit_logs (
                id VARCHAR PRIMARY KEY,
                appointment_id VARCHAR NOT NULL REFERENCES appointments(id),
                action_type VARCHAR(50) NOT NULL,
                performed_by_id VARCHAR NOT NULL REFERENCES profiles(id),
                performed_by_role VARCHAR(20) NOT NULL,
                previous_status VARCHAR(50),
                new_status VARCHAR(50),
                notes TEXT,
                metadata JSON,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )

    # Ensure hot-path indexes.
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_doctor_availability_doctor_id ON doctor_availability (doctor_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_doctor_time_blocks_availability_id ON doctor_time_blocks (availability_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_doctor_exceptions_doctor_id ON doctor_exceptions (doctor_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_doctor_schedule_overrides_doctor_id ON doctor_schedule_overrides (doctor_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_appointment_requests_doctor_id ON appointment_requests (doctor_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_appointment_requests_patient_id ON appointment_requests (patient_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_appointment_reschedule_requests_appointment_id ON appointment_reschedule_requests (appointment_id)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_appointment_audit_logs_appointment_id ON appointment_audit_logs (appointment_id)"
        )
    )


def downgrade() -> None:
    # Intentionally no-op: this migration reconciles drifted environments.
    pass

