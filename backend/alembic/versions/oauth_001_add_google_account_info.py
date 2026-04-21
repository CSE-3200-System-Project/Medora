"""add google account info columns to user_oauth_tokens

Revision ID: oauth_001_add_google_account_info
Revises: sched_004
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "oauth_001"
down_revision = "sched_004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add Google account info columns
    op.add_column("user_oauth_tokens", sa.Column("google_email", sa.String(255), nullable=True))
    op.add_column("user_oauth_tokens", sa.Column("google_sub", sa.String(255), nullable=True))
    op.add_column("user_oauth_tokens", sa.Column("google_profile", sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("user_oauth_tokens", "google_profile")
    op.drop_column("user_oauth_tokens", "google_sub")
    op.drop_column("user_oauth_tokens", "google_email")
