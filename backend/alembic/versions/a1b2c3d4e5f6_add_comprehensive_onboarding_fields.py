"""Add comprehensive onboarding fields

Revision ID: a1b2c3d4e5f6
Revises: d9f8a08dcfb3
Create Date: 2024-12-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd9f8a08dcfb3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === Patient Profile New Columns ===
    
    # Chronic conditions - new booleans
    op.add_column('patient_profiles', sa.Column('has_cancer', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('has_arthritis', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('has_stroke', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('has_epilepsy', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('has_mental_health', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('other_conditions', sa.Text(), nullable=True))
    op.add_column('patient_profiles', sa.Column('condition_details', sa.Text(), nullable=True))
    
    # Medical history - new fields
    op.add_column('patient_profiles', sa.Column('ongoing_treatment_details', sa.Text(), nullable=True))
    op.add_column('patient_profiles', sa.Column('previous_doctors', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('last_checkup_date', sa.String(), nullable=True))
    
    # Family history - new booleans
    op.add_column('patient_profiles', sa.Column('family_has_mental_health', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('family_has_kidney_disease', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('patient_profiles', sa.Column('family_has_thyroid', sa.Boolean(), nullable=True, server_default='false'))
    
    # Lifestyle - new fields
    op.add_column('patient_profiles', sa.Column('smoking_amount', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('alcohol_frequency', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('caffeine', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('dietary_restrictions', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('mental_health_concerns', sa.Text(), nullable=True))
    op.add_column('patient_profiles', sa.Column('currently_in_therapy', sa.Boolean(), nullable=True, server_default='false'))
    
    # Preferences - new fields
    op.add_column('patient_profiles', sa.Column('languages_spoken', sa.JSON(), nullable=True))
    op.add_column('patient_profiles', sa.Column('preferred_contact_method', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('secondary_emergency_name', sa.String(), nullable=True))
    op.add_column('patient_profiles', sa.Column('secondary_emergency_phone', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove patient profile columns
    op.drop_column('patient_profiles', 'secondary_emergency_phone')
    op.drop_column('patient_profiles', 'secondary_emergency_name')
    op.drop_column('patient_profiles', 'preferred_contact_method')
    op.drop_column('patient_profiles', 'languages_spoken')
    op.drop_column('patient_profiles', 'currently_in_therapy')
    op.drop_column('patient_profiles', 'mental_health_concerns')
    op.drop_column('patient_profiles', 'dietary_restrictions')
    op.drop_column('patient_profiles', 'caffeine')
    op.drop_column('patient_profiles', 'alcohol_frequency')
    op.drop_column('patient_profiles', 'smoking_amount')
    op.drop_column('patient_profiles', 'family_has_thyroid')
    op.drop_column('patient_profiles', 'family_has_kidney_disease')
    op.drop_column('patient_profiles', 'family_has_mental_health')
    op.drop_column('patient_profiles', 'last_checkup_date')
    op.drop_column('patient_profiles', 'previous_doctors')
    op.drop_column('patient_profiles', 'ongoing_treatment_details')
    op.drop_column('patient_profiles', 'condition_details')
    op.drop_column('patient_profiles', 'other_conditions')
    op.drop_column('patient_profiles', 'has_mental_health')
    op.drop_column('patient_profiles', 'has_epilepsy')
    op.drop_column('patient_profiles', 'has_stroke')
    op.drop_column('patient_profiles', 'has_arthritis')
    op.drop_column('patient_profiles', 'has_cancer')
