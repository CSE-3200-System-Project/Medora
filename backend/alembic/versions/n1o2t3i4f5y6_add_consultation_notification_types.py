"""Add consultation and prescription notification types

Revision ID: n1o2t3i4f5y6
Revises: eea362199104
Create Date: 2026-01-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n1o2t3i4f5y6'
down_revision: str = '9b75b7b76bd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new notification types to the enum
    # PostgreSQL requires ALTER TYPE to add new enum values
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'prescription_created'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'prescription_accepted'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'prescription_rejected'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'consultation_started'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'consultation_completed'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type
    pass
