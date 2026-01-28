"""Add medical_tests field to patient_profiles

Revision ID: t1e2s3t4r5e6
Revises: m1e2d3t4e5s6
Create Date: 2026-01-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 't1e2s3t4r5e6'
down_revision: Union[str, None] = 'm1e2d3t4e5s6'  # After medicaltest table
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add has_medical_tests boolean flag
    op.add_column(
        'patient_profiles',
        sa.Column('has_medical_tests', sa.Boolean(), nullable=False, server_default='false')
    )
    
    # Add medical_tests JSON field to store test records
    op.add_column(
        'patient_profiles',
        sa.Column('medical_tests', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('patient_profiles', 'medical_tests')
    op.drop_column('patient_profiles', 'has_medical_tests')
