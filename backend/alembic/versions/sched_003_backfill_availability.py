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
# KNOWN ISSUE (not fixed here): day_time_slots is added by l0c4t10n_001, a
# parallel branch (off r3p0rt_001, not off sched_002's own lineage). On a
# fresh database, if Alembic's chosen topological order runs this branch to
# completion before l0c4t10n_001, the SELECT below fails with "column
# day_time_slots does not exist". Declaring `depends_on = ("l0c4t10n_001",)`
# fixes the ordering but made alembic/script/revision.py's
# _topological_sort effectively hang (multi-minute, possibly worse than
# exponential) on this revision graph -- reverted rather than trade one
# reproducibility bug for a much worse one. A real fix needs either a
# smaller, targeted depends_on graph or an Alembic version bump.
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


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    connection = op.get_bind()

    if "day_time_slots" not in _column_names("doctor_profiles"):
        # day_time_slots is added by d4y_t1m3_001, a parallel branch (off
        # r3p0rt_001, not off sched_002's own lineage) that a fresh database
        # may not have applied yet at this point in Alembic's chosen
        # topological order. This migration only backfills existing data
        # into doctor_availability/doctor_time_blocks; on a database where
        # the column doesn't exist yet, there is by definition no data to
        # backfill, so skipping is correct, not just convenient. (A
        # `depends_on` edge would express the ordering directly, but on
        # this migration graph it makes Alembic's topological sort hang for
        # minutes -- see the note on sched_003's own revision history.)
        return

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
