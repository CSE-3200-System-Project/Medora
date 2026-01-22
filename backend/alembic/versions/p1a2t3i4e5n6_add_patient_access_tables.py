"""Add patient access control tables

Revision ID: p1a2t3i4e5n6
Revises: n1t2f3c4a5b6
Create Date: 2026-01-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'p1a2t3i4e5n6'
down_revision = 'n1t2f3c4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create patient_access_logs table
    op.create_table(
        'patient_access_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('doctor_id', sa.String(), nullable=False),
        sa.Column('access_type', sa.String(), nullable=False),
        sa.Column('accessed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['patient_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doctor_id'], ['profiles.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_patient_access_logs_patient_id', 'patient_access_logs', ['patient_id'])
    op.create_index('ix_patient_access_logs_doctor_id', 'patient_access_logs', ['doctor_id'])
    op.create_index('ix_patient_access_logs_accessed_at', 'patient_access_logs', ['accessed_at'])

    # Create patient_doctor_access table
    op.create_table(
        'patient_doctor_access',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('doctor_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('granted_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['patient_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doctor_id'], ['profiles.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_patient_doctor_access_patient_id', 'patient_doctor_access', ['patient_id'])
    op.create_index('ix_patient_doctor_access_doctor_id', 'patient_doctor_access', ['doctor_id'])
    # Unique constraint to prevent duplicate access entries
    op.create_unique_constraint('uq_patient_doctor_access', 'patient_doctor_access', ['patient_id', 'doctor_id'])


def downgrade() -> None:
    op.drop_table('patient_doctor_access')
    op.drop_table('patient_access_logs')
