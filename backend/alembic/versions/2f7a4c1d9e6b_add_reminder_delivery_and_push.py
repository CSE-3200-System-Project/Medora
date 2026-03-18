"""Add reminder delivery logs, push subscriptions, and reminder timezone.

Revision ID: 2f7a4c1d9e6b
Revises: b7d2e6a4c9f1
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f7a4c1d9e6b"
down_revision: Union[str, Sequence[str], None] = "b7d2e6a4c9f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Dhaka'"
        )
    )
    conn.execute(
        sa.text("CREATE INDEX IF NOT EXISTS ix_reminders_timezone ON reminders(timezone)")
    )

    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL REFERENCES profiles(id),
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent VARCHAR(500),
                is_active BOOLEAN NOT NULL DEFAULT true,
                failure_count INTEGER NOT NULL DEFAULT 0,
                last_success_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_active ON push_subscriptions(user_id, is_active)"
        )
    )

    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS reminder_delivery_logs (
                id VARCHAR PRIMARY KEY,
                reminder_id VARCHAR NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
                user_id VARCHAR NOT NULL REFERENCES profiles(id),
                scheduled_for_utc TIMESTAMPTZ NOT NULL,
                notification_id VARCHAR REFERENCES notifications(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_reminder_delivery_log_reminder_scheduled
                    UNIQUE (reminder_id, scheduled_for_utc)
            )
            """
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_reminder_delivery_logs_user_scheduled ON reminder_delivery_logs(user_id, scheduled_for_utc)"
        )
    )


def downgrade() -> None:
    # Keep downgrade non-destructive for production safety.
    pass
