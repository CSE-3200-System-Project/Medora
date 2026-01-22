"""add notifications table

Revision ID: n1t2f3c4a5b6
Revises: af3b8aa23f44
Create Date: 2026-01-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n1t2f3c4a5b6'
down_revision: Union[str, None] = 'af3b8aa23f44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notification type enum
    notification_type_enum = sa.Enum(
        'appointment_booked',
        'appointment_confirmed',
        'appointment_cancelled',
        'appointment_completed',
        'appointment_reminder',
        'new_patient',
        'patient_checkin',
        'doctor_available',
        'access_requested',
        'access_granted',
        'access_revoked',
        'verification_pending',
        'verification_approved',
        'verification_rejected',
        'profile_update',
        'onboarding_reminder',
        'system_announcement',
        'welcome',
        name='notificationtype'
    )
    
    # Create priority enum
    priority_enum = sa.Enum(
        'low',
        'medium',
        'high',
        'urgent',
        name='notificationpriority'
    )
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('type', notification_type_enum, nullable=False),
        sa.Column('priority', priority_enum, server_default='medium', nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('action_url', sa.String(500), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_archived', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for faster queries
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    op.create_index('ix_notifications_user_unread', 'notifications', ['user_id', 'is_read', 'is_archived'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_notifications_user_unread', table_name='notifications')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_is_read', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    
    # Drop table
    op.drop_table('notifications')
    
    # Drop enums
    sa.Enum(name='notificationtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='notificationpriority').drop(op.get_bind(), checkfirst=True)
