"""Add doctor_reviews table and rating aggregates on doctor_profiles.

Revision ID: rvw_001
Revises: p3rf_001
Create Date: 2026-04-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "rvw_001"
down_revision: Union[str, None] = "p3rf_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) rating aggregates on doctor_profiles (idempotent)
    op.execute(
        "ALTER TABLE doctor_profiles "
        "ADD COLUMN IF NOT EXISTS rating_avg DOUBLE PRECISION NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE doctor_profiles "
        "ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0"
    )

    # 2) doctor_reviews table
    op.create_table(
        "doctor_reviews",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "doctor_id",
            sa.String(),
            sa.ForeignKey("doctor_profiles.profile_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            sa.String(),
            sa.ForeignKey("patient_profiles.profile_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "appointment_id",
            sa.String(),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_doctor_reviews_rating_range"),
        sa.UniqueConstraint(
            "doctor_id",
            "patient_id",
            "appointment_id",
            name="uq_doctor_reviews_doctor_patient_appt",
        ),
    )
    op.create_index(
        "ix_doctor_reviews_doctor_created",
        "doctor_reviews",
        ["doctor_id", "created_at"],
    )
    op.create_index(
        "ix_doctor_reviews_patient",
        "doctor_reviews",
        ["patient_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_doctor_reviews_patient", table_name="doctor_reviews")
    op.drop_index("ix_doctor_reviews_doctor_created", table_name="doctor_reviews")
    op.drop_table("doctor_reviews")
    op.execute("ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS rating_count")
    op.execute("ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS rating_avg")
