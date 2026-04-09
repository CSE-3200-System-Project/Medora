"""Add reschedule notification types to notificationtype enum

Revision ID: notif_reschedule_001
Revises: hold_001
Create Date: 2026-04-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "notif_reschedule_001"
down_revision: Union[str, Sequence[str], None] = "hold_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_reschedule_request'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_reschedule_accepted'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_reschedule_rejected'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type
    pass
