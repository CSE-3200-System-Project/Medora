"""Add target_role column to notifications.

Revision ID: n0t1f_r0l3_001
Revises: m3rg3_001
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n0t1f_r0l3_001"
down_revision: Union[str, Sequence[str], None] = "m3rg3_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = 'notifications'"
        )
    ).first()
    if not table_exists:
        return

    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'notifications' AND column_name = 'target_role'"
        )
    ).first()
    if not column_exists:
        op.add_column(
            "notifications",
            sa.Column("target_role", sa.String(length=32), nullable=True),
        )
        op.create_index(
            "ix_notifications_target_role",
            "notifications",
            ["target_role"],
        )

    # Backfill target_role from the owning profile's role so the column is
    # immediately useful for existing rows.
    op.execute(
        """
        UPDATE notifications n
        SET target_role = p.role
        FROM profiles p
        WHERE n.user_id = p.id AND n.target_role IS NULL
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'notifications' AND column_name = 'target_role'"
        )
    ).first()
    if not column_exists:
        return
    op.drop_index("ix_notifications_target_role", table_name="notifications")
    op.drop_column("notifications", "target_role")
