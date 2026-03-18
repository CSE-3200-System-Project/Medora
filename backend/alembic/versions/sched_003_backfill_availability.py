"""Backfill doctor_availability and doctor_time_blocks from day_time_slots JSON

Revision ID: sched_003
Revises: sched_002
Create Date: 2026-03-16

Data migration: reads each doctor's day_time_slots JSON (e.g.
{"Friday": ["9:00 AM - 1:00 PM", "5:00 PM - 9:00 PM"]}) and creates
corresponding DoctorAvailability + DoctorTimeBlock rows.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
import re


revision: str = "sched_003"
down_revision: Union[str, None] = "sched_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Map day names to day_of_week integers (0=Monday..6=Sunday)
DAY_NAME_TO_INT = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

TIME_RANGE_PATTERN = re.compile(
    r"(\d{1,2}(?::\d{2})?)\s*(AM|PM)\s*-\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)",
    re.IGNORECASE,
)


def _parse_time_str(time_str: str, period: str) -> str:
    """Convert '9:00 AM' or '9 AM' to 'HH:MM:SS' format for PostgreSQL Time."""
    period = period.upper()
    if ":" in time_str:
        hours, minutes = time_str.split(":")
    else:
        hours = time_str
        minutes = "00"

    hours_int = int(hours)
    if period == "PM" and hours_int != 12:
        hours_int += 12
    elif period == "AM" and hours_int == 12:
        hours_int = 0

    return f"{hours_int:02d}:{int(minutes):02d}:00"


def upgrade() -> None:
    connection = op.get_bind()

    # Fetch all doctors with day_time_slots
    result = connection.execute(
        sa.text("""
            SELECT profile_id, day_time_slots, appointment_duration
            FROM doctor_profiles
            WHERE day_time_slots IS NOT NULL
              AND day_time_slots::text != '{}'
              AND day_time_slots::text != 'null'
        """)
    )

    for row in result.fetchall():
        doctor_id = row[0]
        day_time_slots = row[1]
        appointment_duration = row[2] or 30

        if not isinstance(day_time_slots, dict):
            continue

        for day_name, slot_ranges in day_time_slots.items():
            day_int = DAY_NAME_TO_INT.get(day_name)
            if day_int is None:
                continue

            if not isinstance(slot_ranges, list) or not slot_ranges:
                continue

            # Create DoctorAvailability row
            availability_id = str(uuid.uuid4())
            connection.execute(
                sa.text("""
                    INSERT INTO doctor_availability (id, doctor_id, day_of_week, is_active)
                    VALUES (:id, :doctor_id, :day_of_week, true)
                    ON CONFLICT (doctor_id, day_of_week) DO NOTHING
                """),
                {
                    "id": availability_id,
                    "doctor_id": doctor_id,
                    "day_of_week": day_int,
                },
            )

            # Get the actual availability_id (in case ON CONFLICT hit)
            existing = connection.execute(
                sa.text("""
                    SELECT id FROM doctor_availability
                    WHERE doctor_id = :doctor_id AND day_of_week = :day_of_week
                """),
                {"doctor_id": doctor_id, "day_of_week": day_int},
            ).fetchone()

            if not existing:
                continue
            actual_availability_id = existing[0]

            # Parse each time range and create DoctorTimeBlock
            for slot_range in slot_ranges:
                match = TIME_RANGE_PATTERN.search(slot_range)
                if not match:
                    continue

                start_time = _parse_time_str(match.group(1), match.group(2))
                end_time = _parse_time_str(match.group(3), match.group(4))

                block_id = str(uuid.uuid4())
                connection.execute(
                    sa.text("""
                        INSERT INTO doctor_time_blocks
                            (id, availability_id, start_time, end_time, slot_duration_minutes)
                        VALUES (:id, :availability_id, :start_time, :end_time, :duration)
                    """),
                    {
                        "id": block_id,
                        "availability_id": actual_availability_id,
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration": appointment_duration,
                    },
                )


def downgrade() -> None:
    connection = op.get_bind()
    # Remove all backfilled data (only data created by this migration)
    connection.execute(sa.text("DELETE FROM doctor_time_blocks"))
    connection.execute(sa.text("DELETE FROM doctor_availability"))
