"""Add reminders table and notification types

Revision ID: r3m1nd3r_t4bl3
Revises: n1o2t3i4f5y6
Create Date: 2026-02-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'r3m1nd3r_t4bl3'
down_revision = 'n1o2t3i4f5y6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new notification types to enum
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'medication_reminder'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'test_reminder'")
    
    # Create ReminderType enum only if it doesn't exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'remindertype') THEN
                CREATE TYPE remindertype AS ENUM ('medication', 'test');
            END IF;
        END
        $$;
    """)
    
    # Create reminders table only if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id VARCHAR NOT NULL PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES profiles(id),
            type remindertype NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            item_id VARCHAR(255),
            prescription_id VARCHAR(255),
            reminder_times JSON NOT NULL DEFAULT '[]',
            days_of_week JSON DEFAULT '[0,1,2,3,4,5,6]',
            notes VARCHAR(500),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP
        )
    """)
    
    # Create indexes only if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_reminders_user_id ON reminders(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reminders_type ON reminders(type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reminders_is_active ON reminders(is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reminders_prescription_id ON reminders(prescription_id)")


def downgrade() -> None:
    op.drop_index('ix_reminders_is_active')
    op.drop_index('ix_reminders_type')
    op.drop_index('ix_reminders_user_id')
    op.drop_table('reminders')
    
    # Drop ReminderType enum
    op.execute('DROP TYPE IF EXISTS remindertype')
