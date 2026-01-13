"""Backfill doctor specialization from speciality_id

Revision ID: c8f3a9b2d4e6
Revises: bffcf6a630a1
Create Date: 2026-01-14 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c8f3a9b2d4e6'
down_revision = 'bffcf6a630a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Populate `specialization` text field from `speciality_id` for existing rows.
    This helps keep legacy `specialization` text in sync so frontend can display the
    human-readable name without needing to resolve the relation every time.
    """
    op.execute(
        """
        UPDATE doctor_profiles
        SET specialization = (
            SELECT name FROM specialities WHERE specialities.id = doctor_profiles.speciality_id
        )
        WHERE speciality_id IS NOT NULL
        AND (specialization IS NULL OR specialization = '');
        """
    )


def downgrade() -> None:
    """Revert the backfill by clearing `specialization` where `speciality_id` is set.
    This is a safe reversible action for the purposes of this migration.
    """
    op.execute(
        """
        UPDATE doctor_profiles
        SET specialization = NULL
        WHERE speciality_id IS NOT NULL
        AND specialization IS NOT NULL;
        """
    )
