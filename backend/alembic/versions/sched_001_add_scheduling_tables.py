"""Add scheduling tables and expand appointment model

Revision ID: sched_001
Revises: 7f9c1b2d3e4f
Create Date: 2026-03-16

Creates: doctor_availability, doctor_time_blocks, doctor_exceptions,
         doctor_schedule_overrides, appointment_requests,
         appointment_reschedule_requests, appointment_audit_logs.
Alters:  appointments table with slot_time, duration_minutes, google_event_id.
Expands: appointmentstatus enum with new values.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "sched_001"
down_revision: Union[str, None] = "7f9c1b2d3e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# New enum values for AppointmentStatus
NEW_APPOINTMENT_STATUSES = [
    "PENDING_ADMIN_REVIEW",
    "PENDING_DOCTOR_CONFIRMATION",
    "PENDING_PATIENT_CONFIRMATION",
    "RESCHEDULE_REQUESTED",
    "CANCEL_REQUESTED",
    "NO_SHOW",
]


def upgrade() -> None:
    # ── 1. Expand the appointmentstatus enum ──
    # PostgreSQL requires ALTER TYPE ... ADD VALUE to be outside a transaction
    # block, so we use connection.execute directly with autocommit.
    connection = op.get_bind()
    for status_val in NEW_APPOINTMENT_STATUSES:
        connection.execute(
            sa.text(
                f"ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS '{status_val}'"
            )
        )

    # ── 2. Create helper enums ──
    appointment_request_status = sa.Enum(
        "pending", "approved", "rejected", "reschedule_proposed",
        name="appointmentrequeststatus",
    )
    appointment_request_status.create(connection, checkfirst=True)

    reschedule_request_status = sa.Enum(
        "pending", "accepted", "rejected",
        name="reschedulerequeststatus",
    )
    reschedule_request_status.create(connection, checkfirst=True)

    requested_by_role = sa.Enum(
        "patient", "doctor", "admin",
        name="requestedbyrole",
    )
    requested_by_role.create(connection, checkfirst=True)

    # ── 3. Alter appointments table ──
    op.add_column("appointments", sa.Column("slot_time", sa.Time(), nullable=True))
    op.add_column(
        "appointments",
        sa.Column("duration_minutes", sa.Integer(), nullable=True, server_default="30"),
    )
    op.add_column(
        "appointments",
        sa.Column("google_event_id", sa.String(), nullable=True),
    )
    # Composite index for slot availability lookups
    op.create_index(
        "ix_appointments_doctor_date",
        "appointments",
        ["doctor_id", "appointment_date"],
        unique=False,
        if_not_exists=True,
    )

    # ── 4. Create doctor_availability table ──
    op.create_table(
        "doctor_availability",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "doctor_id",
            sa.String(),
            sa.ForeignKey("doctor_profiles.profile_id"),
            nullable=False,
        ),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("doctor_id", "day_of_week", name="uq_doctor_day_of_week"),
    )
    op.create_index(
        "ix_doctor_availability_doctor_id",
        "doctor_availability",
        ["doctor_id"],
    )

    # ── 5. Create doctor_time_blocks table ──
    op.create_table(
        "doctor_time_blocks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "availability_id",
            sa.String(),
            sa.ForeignKey("doctor_availability.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "slot_duration_minutes",
            sa.Integer(),
            server_default=sa.text("30"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_doctor_time_blocks_availability_id",
        "doctor_time_blocks",
        ["availability_id"],
    )

    # ── 6. Create doctor_exceptions table ──
    op.create_table(
        "doctor_exceptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "doctor_id",
            sa.String(),
            sa.ForeignKey("doctor_profiles.profile_id"),
            nullable=False,
        ),
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column(
            "is_available",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "doctor_id", "exception_date", name="uq_doctor_exception_date"
        ),
    )
    op.create_index(
        "ix_doctor_exceptions_doctor_id",
        "doctor_exceptions",
        ["doctor_id"],
    )

    # ── 7. Create doctor_schedule_overrides table ──
    op.create_table(
        "doctor_schedule_overrides",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "doctor_id",
            sa.String(),
            sa.ForeignKey("doctor_profiles.profile_id"),
            nullable=False,
        ),
        sa.Column("override_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "slot_duration_minutes",
            sa.Integer(),
            server_default=sa.text("30"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_doctor_schedule_overrides_doctor_id",
        "doctor_schedule_overrides",
        ["doctor_id"],
    )

    # ── 8. Create appointment_requests table ──
    op.create_table(
        "appointment_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "doctor_id",
            sa.String(),
            sa.ForeignKey("doctor_profiles.profile_id"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            sa.String(),
            sa.ForeignKey("patient_profiles.profile_id"),
            nullable=False,
        ),
        sa.Column("requested_date", sa.Date(), nullable=False),
        sa.Column("requested_time", sa.Time(), nullable=False),
        sa.Column("requested_duration", sa.Integer(), server_default=sa.text("30")),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "rejected",
                "reschedule_proposed",
                name="appointmentrequeststatus",
                create_type=False,
            ),
            server_default="pending",
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_appointment_requests_doctor_id",
        "appointment_requests",
        ["doctor_id"],
    )
    op.create_index(
        "ix_appointment_requests_patient_id",
        "appointment_requests",
        ["patient_id"],
    )

    # ── 9. Create appointment_reschedule_requests table ──
    op.create_table(
        "appointment_reschedule_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.String(),
            sa.ForeignKey("appointments.id"),
            nullable=False,
        ),
        sa.Column(
            "requested_by_id",
            sa.String(),
            sa.ForeignKey("profiles.id"),
            nullable=False,
        ),
        sa.Column(
            "requested_by_role",
            sa.Enum(
                "patient",
                "doctor",
                "admin",
                name="requestedbyrole",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("proposed_date", sa.Date(), nullable=False),
        sa.Column("proposed_time", sa.Time(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "accepted",
                "rejected",
                name="reschedulerequeststatus",
                create_type=False,
            ),
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_appointment_reschedule_requests_appointment_id",
        "appointment_reschedule_requests",
        ["appointment_id"],
    )

    # ── 10. Create appointment_audit_logs table ──
    op.create_table(
        "appointment_audit_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.String(),
            sa.ForeignKey("appointments.id"),
            nullable=False,
        ),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column(
            "performed_by_id",
            sa.String(),
            sa.ForeignKey("profiles.id"),
            nullable=False,
        ),
        sa.Column("performed_by_role", sa.String(20), nullable=False),
        sa.Column("previous_status", sa.String(50), nullable=True),
        sa.Column("new_status", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_appointment_audit_logs_appointment_id",
        "appointment_audit_logs",
        ["appointment_id"],
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("appointment_audit_logs")
    op.drop_table("appointment_reschedule_requests")
    op.drop_table("appointment_requests")
    op.drop_table("doctor_schedule_overrides")
    op.drop_table("doctor_exceptions")
    op.drop_table("doctor_time_blocks")
    op.drop_table("doctor_availability")

    # Remove new columns from appointments
    op.drop_column("appointments", "google_event_id")
    op.drop_column("appointments", "duration_minutes")
    op.drop_column("appointments", "slot_time")

    # Drop custom enums
    connection = op.get_bind()
    sa.Enum(name="requestedbyrole").drop(connection, checkfirst=True)
    sa.Enum(name="reschedulerequeststatus").drop(connection, checkfirst=True)
    sa.Enum(name="appointmentrequeststatus").drop(connection, checkfirst=True)

    # Note: PostgreSQL does not support removing individual values from an enum.
    # The new AppointmentStatus values will remain but are harmless.
