"""add soft hold metadata and scheduling consistency indexes

Revision ID: hold_001
Revises: c4ncl_001
Create Date: 2026-04-01 14:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "hold_001"
down_revision: Union[str, Sequence[str], None] = "c4ncl_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns(table_name)}
    if column.name not in existing_columns:
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    _add_column_if_missing(
        "appointments",
        sa.Column("hold_expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    _add_column_if_missing(
        "appointment_reschedule_requests",
        sa.Column("responded_by_id", sa.String(), nullable=True),
    )
    _add_column_if_missing(
        "appointment_reschedule_requests",
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column_if_missing(
        "appointment_reschedule_requests",
        sa.Column("response_note", sa.Text(), nullable=True),
    )
    _add_column_if_missing(
        "appointment_reschedule_requests",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    existing_foreign_keys = {
        fk["name"]
        for fk in inspector.get_foreign_keys("appointment_reschedule_requests")
        if fk.get("name")
    }
    if "fk_appointment_reschedule_requests_responded_by_id_profiles" not in existing_foreign_keys:
        op.create_foreign_key(
            "fk_appointment_reschedule_requests_responded_by_id_profiles",
            "appointment_reschedule_requests",
            "profiles",
            ["responded_by_id"],
            ["id"],
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("appointments")}
    if "ix_appointments_hold_expires_at" not in existing_indexes:
        op.create_index(
            "ix_appointments_hold_expires_at",
            "appointments",
            ["hold_expires_at"],
            unique=False,
        )

    existing_indexes_reschedule = {
        idx["name"] for idx in inspector.get_indexes("appointment_reschedule_requests")
    }
    if "ix_appointment_reschedule_requests_responded_by_id" not in existing_indexes_reschedule:
        op.create_index(
            "ix_appointment_reschedule_requests_responded_by_id",
            "appointment_reschedule_requests",
            ["responded_by_id"],
            unique=False,
        )

    existing_unique_constraints = {
        uq["name"]
        for uq in inspector.get_unique_constraints("appointments")
        if uq.get("name")
    }
    if "uq_doctor_date_slot" in existing_unique_constraints:
        op.drop_constraint("uq_doctor_date_slot", "appointments", type_="unique")

    # Resolve duplicates before adding partial uniqueness on active slot occupancy.
    bind.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    row_number() OVER (
                        PARTITION BY doctor_id, appointment_date, slot_time
                        ORDER BY
                            CASE status
                                WHEN 'CONFIRMED' THEN 0
                                WHEN 'PENDING_DOCTOR_CONFIRMATION' THEN 1
                                WHEN 'PENDING_PATIENT_CONFIRMATION' THEN 2
                                WHEN 'PENDING_ADMIN_REVIEW' THEN 3
                                WHEN 'RESCHEDULE_REQUESTED' THEN 4
                                WHEN 'CANCEL_REQUESTED' THEN 5
                                WHEN 'PENDING' THEN 6
                                ELSE 7
                            END,
                            created_at ASC,
                            id ASC
                    ) AS rn
                FROM appointments
                WHERE slot_time IS NOT NULL
                  AND status IN (
                    'PENDING',
                    'CONFIRMED',
                    'PENDING_ADMIN_REVIEW',
                    'PENDING_DOCTOR_CONFIRMATION',
                    'PENDING_PATIENT_CONFIRMATION',
                    'RESCHEDULE_REQUESTED',
                    'CANCEL_REQUESTED'
                  )
            )
            UPDATE appointments a
            SET
                status = 'CANCELLED',
                cancellation_reason_key = COALESCE(a.cancellation_reason_key, 'SYSTEM_DEDUPE'),
                cancellation_reason_note = COALESCE(
                    a.cancellation_reason_note,
                    'Auto-cancelled duplicate active slot during scheduling index migration'
                ),
                cancelled_at = COALESCE(a.cancelled_at, NOW()),
                hold_expires_at = NULL
            FROM ranked r
            WHERE a.id = r.id
              AND r.rn > 1
            """
        )
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
        ON appointments (doctor_id, appointment_date, slot_time)
        WHERE slot_time IS NOT NULL
          AND status IN (
            'PENDING',
            'CONFIRMED',
            'PENDING_ADMIN_REVIEW',
            'PENDING_DOCTOR_CONFIRMATION',
            'PENDING_PATIENT_CONFIRMATION',
            'RESCHEDULE_REQUESTED',
            'CANCEL_REQUESTED'
          )
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_reschedule_per_appointment
        ON appointment_reschedule_requests (appointment_id)
        WHERE status = 'pending'
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    op.execute("DROP INDEX IF EXISTS uq_pending_reschedule_per_appointment")
    op.execute("DROP INDEX IF EXISTS uq_appointments_active_slot")

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("appointment_reschedule_requests")}
    if "ix_appointment_reschedule_requests_responded_by_id" in existing_indexes:
        op.drop_index(
            "ix_appointment_reschedule_requests_responded_by_id",
            table_name="appointment_reschedule_requests",
        )

    existing_indexes_appointments = {idx["name"] for idx in inspector.get_indexes("appointments")}
    if "ix_appointments_hold_expires_at" in existing_indexes_appointments:
        op.drop_index("ix_appointments_hold_expires_at", table_name="appointments")

    existing_foreign_keys = {
        fk["name"]
        for fk in inspector.get_foreign_keys("appointment_reschedule_requests")
        if fk.get("name")
    }
    if "fk_appointment_reschedule_requests_responded_by_id_profiles" in existing_foreign_keys:
        op.drop_constraint(
            "fk_appointment_reschedule_requests_responded_by_id_profiles",
            "appointment_reschedule_requests",
            type_="foreignkey",
        )

    existing_columns_reschedule = {
        col["name"] for col in inspector.get_columns("appointment_reschedule_requests")
    }
    if "expires_at" in existing_columns_reschedule:
        op.drop_column("appointment_reschedule_requests", "expires_at")
    if "response_note" in existing_columns_reschedule:
        op.drop_column("appointment_reschedule_requests", "response_note")
    if "responded_at" in existing_columns_reschedule:
        op.drop_column("appointment_reschedule_requests", "responded_at")
    if "responded_by_id" in existing_columns_reschedule:
        op.drop_column("appointment_reschedule_requests", "responded_by_id")

    existing_columns_appointments = {col["name"] for col in inspector.get_columns("appointments")}
    if "hold_expires_at" in existing_columns_appointments:
        op.drop_column("appointments", "hold_expires_at")
