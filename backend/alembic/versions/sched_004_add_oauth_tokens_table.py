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


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


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
    # (it was declared in sched_001 but let's ensure it). A bare try/except
    # around a failing DDL statement does not work in Postgres: once one
    # statement in a transaction errors, every later statement in that same
    # transaction -- including Alembic's own version-tracking UPDATE --
    # fails with "current transaction is aborted", regardless of whether
    # Python catches the original exception. Check first instead.
    if "google_event_id" not in _column_names("appointments"):
        op.add_column(
            "appointments",
            sa.Column("google_event_id", sa.String(), nullable=True),
        )


def downgrade() -> None:
    if "google_event_id" in _column_names("appointments"):
        op.drop_column("appointments", "google_event_id")
    op.drop_table("user_oauth_tokens")
