"""Add user_oauth_tokens table for Google Calendar integration.

Revision ID: sched_004
Revises: sched_003
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "sched_004"
down_revision = "sched_003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_oauth_tokens",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scopes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Also add google_event_id to appointments if not already there
    # (it was declared in sched_001 but let's ensure it)
    try:
        op.add_column(
            "appointments",
            sa.Column("google_event_id", sa.String(), nullable=True),
        )
    except Exception:
        pass  # Column may already exist from sched_001


def downgrade() -> None:
    try:
        op.drop_column("appointments", "google_event_id")
    except Exception:
        pass
    op.drop_table("user_oauth_tokens")
