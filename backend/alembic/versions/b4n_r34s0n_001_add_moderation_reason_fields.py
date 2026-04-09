"""add moderation reason fields

Revision ID: b4n_r34s0n_001
Revises: z9c4a1d7e2f3
Create Date: 2026-03-30 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b4n_r34s0n_001"
down_revision = "z9c4a1d7e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("profiles")}

    if "ban_reason" not in existing:
        op.add_column("profiles", sa.Column("ban_reason", sa.Text(), nullable=True))
    if "banned_at" not in existing:
        op.add_column("profiles", sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True))
    if "banned_by" not in existing:
        op.add_column("profiles", sa.Column("banned_by", sa.String(), nullable=True))
    if "delete_reason" not in existing:
        op.add_column("profiles", sa.Column("delete_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("profiles")}

    if "delete_reason" in existing:
        op.drop_column("profiles", "delete_reason")
    if "banned_by" in existing:
        op.drop_column("profiles", "banned_by")
    if "banned_at" in existing:
        op.drop_column("profiles", "banned_at")
    if "ban_reason" in existing:
        op.drop_column("profiles", "ban_reason")
