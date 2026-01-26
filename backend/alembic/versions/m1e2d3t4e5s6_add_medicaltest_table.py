"""Add medicaltest table

Revision ID: m1e2d3t4e5s6
Revises: 
Create Date: 2026-01-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm1e2d3t4e5s6'
down_revision: Union[str, None] = 'p1a2t3i4e5n6'  # After patient access tables
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create medicaltest table
    op.create_table(
        'medicaltest',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('display_name', sa.String(length=500), nullable=False),
        sa.Column('normalized_name', sa.String(length=500), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('normalized_name')
    )
    
    # Create indexes
    op.create_index(
        'idx_medicaltest_normalized_name',
        'medicaltest',
        ['normalized_name'],
        unique=False
    )
    op.create_index(
        'idx_medicaltest_is_active',
        'medicaltest',
        ['is_active'],
        unique=False,
        postgresql_where=sa.text('is_active = true')
    )


def downgrade() -> None:
    op.drop_index('idx_medicaltest_is_active', table_name='medicaltest')
    op.drop_index('idx_medicaltest_normalized_name', table_name='medicaltest')
    op.drop_table('medicaltest')
