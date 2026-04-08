"""add persisted rendered prescription html field

Revision ID: pr_html_001
Revises: sh4r1ng_001
Create Date: 2026-04-09 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "pr_html_001"
down_revision = "sh4r1ng_001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "prescriptions",
        sa.Column("rendered_prescription_html", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("prescriptions", "rendered_prescription_html")

