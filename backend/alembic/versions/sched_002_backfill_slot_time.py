"""Backfill slot_time and duration_minutes on existing appointments

Revision ID: sched_002
Revises: sched_001
Create Date: 2026-03-16

Data-only migration: extracts time component from appointment_date
and parses notes for 'Slot: X:XX AM' patterns to populate slot_time.
Sets duration_minutes from the doctor's appointment_duration or defaults to 30.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "sched_002"
down_revision: Union[str, None] = "sched_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # Step 1: Set slot_time from appointment_date time component for all rows
    # where slot_time is currently null
    connection.execute(
        sa.text("""
            UPDATE appointments
            SET slot_time = appointment_date::time
            WHERE slot_time IS NULL
        """)
    )

    # Step 2: Override slot_time from notes containing 'Slot: X:XX AM/PM'
    # pattern, which is more accurate than the DateTime for appointments
    # that were booked through the existing frontend flow
    connection.execute(
        sa.text("""
            UPDATE appointments
            SET slot_time = (
                regexp_replace(
                    substring(notes FROM 'Slot:\\s*(\\d{1,2}:\\d{2}\\s*(?:AM|PM))'),
                    '\\s+', ' ', 'g'
                )
            )::time
            WHERE notes IS NOT NULL
              AND notes ~ 'Slot:\\s*\\d{1,2}:\\d{2}\\s*(?:AM|PM)'
        """)
    )

    # Step 3: Set duration_minutes from corresponding doctor's appointment_duration
    connection.execute(
        sa.text("""
            UPDATE appointments a
            SET duration_minutes = COALESCE(d.appointment_duration, 30)
            FROM doctor_profiles d
            WHERE a.doctor_id = d.profile_id
              AND a.duration_minutes IS NULL
        """)
    )

    # Step 4: Set remaining nulls to default 30
    connection.execute(
        sa.text("""
            UPDATE appointments
            SET duration_minutes = 30
            WHERE duration_minutes IS NULL
        """)
    )


def downgrade() -> None:
    # Clear backfilled data
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE appointments SET slot_time = NULL, duration_minutes = NULL")
    )
