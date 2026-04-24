"""Add review moderation fields and review notification enum values.

Revision ID: rvw_002
Revises: rvw_001
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "rvw_002"
down_revision: Union[str, None] = "rvw_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    review_status_enum = sa.Enum(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="reviewmoderationstatus",
    )
    review_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "doctor_reviews",
        sa.Column(
            "status",
            review_status_enum,
            nullable=False,
            server_default="APPROVED",
        ),
    )
    op.add_column(
        "doctor_reviews",
        sa.Column("admin_feedback", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_doctor_reviews_status_created",
        "doctor_reviews",
        ["status", "created_at"],
    )

    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'review_approved'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'review_rejected'")

    # Existing reviews were already public before moderation existed, so keep
    # them published after the migration.
    op.execute(
        "UPDATE doctor_reviews SET status = 'APPROVED' WHERE status IS NULL OR status::text = 'APPROVED'"
    )

    op.alter_column("doctor_reviews", "status", server_default="PENDING")


def downgrade() -> None:
    op.drop_index("ix_doctor_reviews_status_created", table_name="doctor_reviews")
    op.drop_column("doctor_reviews", "admin_feedback")
    op.drop_column("doctor_reviews", "status")
    sa.Enum(name="reviewmoderationstatus").drop(op.get_bind(), checkfirst=True)
