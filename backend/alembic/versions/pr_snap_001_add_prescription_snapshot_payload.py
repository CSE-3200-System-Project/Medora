"""add immutable prescription snapshot payload fields

Revision ID: pr_snap_001
Revises: pr_html_001
Create Date: 2026-04-09 00:30:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "pr_snap_001"
down_revision = "pr_html_001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "prescriptions",
        sa.Column("rendered_prescription_snapshot", sa.JSON(), nullable=True),
    )
    op.add_column(
        "prescriptions",
        sa.Column("rendered_prescription_generated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("prescriptions", "rendered_prescription_generated_at")
    op.drop_column("prescriptions", "rendered_prescription_snapshot")
