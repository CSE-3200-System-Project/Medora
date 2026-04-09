"""Add dosage mode fields to medication prescriptions

Revision ID: pr3v13w_001
Revises: notif_reschedule_001
Create Date: 2026-04-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "pr3v13w_001"
down_revision: Union[str, Sequence[str], None] = "notif_reschedule_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dosage_type_enum = postgresql.ENUM("pattern", "frequency", name="dosagetype", create_type=False)
    dosage_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "medication_prescriptions",
        sa.Column("dosage_type", dosage_type_enum, nullable=True),
    )
    op.add_column(
        "medication_prescriptions",
        sa.Column("dosage_pattern", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "medication_prescriptions",
        sa.Column("frequency_text", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("medication_prescriptions", "frequency_text")
    op.drop_column("medication_prescriptions", "dosage_pattern")
    op.drop_column("medication_prescriptions", "dosage_type")

    dosage_type_enum = postgresql.ENUM("pattern", "frequency", name="dosagetype", create_type=False)
    dosage_type_enum.drop(op.get_bind(), checkfirst=True)
