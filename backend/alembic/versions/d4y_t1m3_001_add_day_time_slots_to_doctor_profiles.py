"""Add doctor_profiles.day_time_slots (schema drift repair)

Revision ID: d4y_t1m3_001
Revises: r3p0rt_001
Create Date: 2026-08-04

app/db/models/doctor.py has declared DoctorProfile.day_time_slots since before this
project's Alembic history begins, and two later migrations (l0c4t10n_001, sched_003)
read it directly with raw SQL -- but no migration ever added the column itself. It
existed only in already-migrated databases where it was added by hand outside Alembic,
so `alembic upgrade head` alone could never reproduce a working schema on a fresh
database; both downstream migrations failed with "column day_time_slots does not exist".
This is schema-drift repair, not a feature change -- see CLAUDE.md's note on the
startup self-heal patches for the same class of problem.
"""

from alembic import op
import sqlalchemy as sa


revision = "d4y_t1m3_001"
down_revision = "r3p0rt_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("doctor_profiles", sa.Column("day_time_slots", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("doctor_profiles", "day_time_slots")
