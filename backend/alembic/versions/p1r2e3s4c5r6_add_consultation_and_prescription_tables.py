"""add consultation and prescription tables

Revision ID: p1r2e3s4c5r6
Revises: eea362199104
Create Date: 2026-01-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p1r2e3s4c5r6'
down_revision: Union[str, None] = 'eea362199104'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create consultations table
    op.create_table(
        'consultations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('doctor_id', sa.String(), nullable=False),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('appointment_id', sa.String(), nullable=True),
        sa.Column('chief_complaint', sa.Text(), nullable=True),
        sa.Column('diagnosis', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('open', 'completed', name='consultationstatus'), nullable=True, server_default='open'),
        sa.Column('consultation_date', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctor_profiles.profile_id'], ),
        sa.ForeignKeyConstraint(['patient_id'], ['patient_profiles.profile_id'], ),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consultations_doctor_id'), 'consultations', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_consultations_patient_id'), 'consultations', ['patient_id'], unique=False)
    op.create_index(op.f('ix_consultations_status'), 'consultations', ['status'], unique=False)

    # Create prescriptions table
    op.create_table(
        'prescriptions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('consultation_id', sa.String(), nullable=False),
        sa.Column('doctor_id', sa.String(), nullable=False),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('type', sa.Enum('medication', 'test', 'surgery', name='prescriptiontype'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'accepted', 'rejected', name='prescriptionstatus'), nullable=True, server_default='pending'),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('added_to_history', sa.Boolean(), nullable=True, server_default='false'),
        sa.ForeignKeyConstraint(['consultation_id'], ['consultations.id'], ),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctor_profiles.profile_id'], ),
        sa.ForeignKeyConstraint(['patient_id'], ['patient_profiles.profile_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prescriptions_doctor_id'), 'prescriptions', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_prescriptions_patient_id'), 'prescriptions', ['patient_id'], unique=False)
    op.create_index(op.f('ix_prescriptions_status'), 'prescriptions', ['status'], unique=False)

    # Create medication_prescriptions table
    op.create_table(
        'medication_prescriptions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('prescription_id', sa.String(), nullable=False),
        sa.Column('medicine_name', sa.String(255), nullable=False),
        sa.Column('generic_name', sa.String(255), nullable=True),
        sa.Column('medicine_type', sa.Enum('tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'suppository', 'other', name='medicinetype'), nullable=True, server_default='tablet'),
        sa.Column('strength', sa.String(100), nullable=True),
        sa.Column('dose_morning', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('dose_afternoon', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('dose_evening', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('dose_night', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('dose_morning_amount', sa.String(20), nullable=True),
        sa.Column('dose_afternoon_amount', sa.String(20), nullable=True),
        sa.Column('dose_evening_amount', sa.String(20), nullable=True),
        sa.Column('dose_night_amount', sa.String(20), nullable=True),
        sa.Column('frequency_per_day', sa.Integer(), nullable=True),
        sa.Column('duration_value', sa.Integer(), nullable=True),
        sa.Column('duration_unit', sa.Enum('days', 'weeks', 'months', name='durationunit'), nullable=True, server_default='days'),
        sa.Column('meal_instruction', sa.Enum('before_meal', 'after_meal', 'with_meal', 'empty_stomach', 'any_time', name='mealinstruction'), nullable=True, server_default='after_meal'),
        sa.Column('special_instructions', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('refills', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['prescription_id'], ['prescriptions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_medication_prescriptions_prescription_id'), 'medication_prescriptions', ['prescription_id'], unique=False)

    # Create test_prescriptions table
    op.create_table(
        'test_prescriptions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('prescription_id', sa.String(), nullable=False),
        sa.Column('test_name', sa.String(255), nullable=False),
        sa.Column('test_type', sa.String(100), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('urgency', sa.Enum('normal', 'urgent', name='testurgency'), nullable=True, server_default='normal'),
        sa.Column('preferred_lab', sa.String(255), nullable=True),
        sa.Column('expected_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['prescription_id'], ['prescriptions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_test_prescriptions_prescription_id'), 'test_prescriptions', ['prescription_id'], unique=False)

    # Create surgery_recommendations table
    op.create_table(
        'surgery_recommendations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('prescription_id', sa.String(), nullable=False),
        sa.Column('procedure_name', sa.String(255), nullable=False),
        sa.Column('procedure_type', sa.String(100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('urgency', sa.Enum('immediate', 'scheduled', name='surgeryurgency'), nullable=True, server_default='scheduled'),
        sa.Column('recommended_date', sa.Date(), nullable=True),
        sa.Column('estimated_cost_min', sa.Float(), nullable=True),
        sa.Column('estimated_cost_max', sa.Float(), nullable=True),
        sa.Column('pre_op_instructions', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('preferred_facility', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['prescription_id'], ['prescriptions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_surgery_recommendations_prescription_id'), 'surgery_recommendations', ['prescription_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_surgery_recommendations_prescription_id'), table_name='surgery_recommendations')
    op.drop_table('surgery_recommendations')
    
    op.drop_index(op.f('ix_test_prescriptions_prescription_id'), table_name='test_prescriptions')
    op.drop_table('test_prescriptions')
    
    op.drop_index(op.f('ix_medication_prescriptions_prescription_id'), table_name='medication_prescriptions')
    op.drop_table('medication_prescriptions')
    
    op.drop_index(op.f('ix_prescriptions_status'), table_name='prescriptions')
    op.drop_index(op.f('ix_prescriptions_patient_id'), table_name='prescriptions')
    op.drop_index(op.f('ix_prescriptions_doctor_id'), table_name='prescriptions')
    op.drop_table('prescriptions')
    
    op.drop_index(op.f('ix_consultations_status'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_patient_id'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_doctor_id'), table_name='consultations')
    op.drop_table('consultations')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS surgeryurgency")
    op.execute("DROP TYPE IF EXISTS testurgency")
    op.execute("DROP TYPE IF EXISTS mealinstruction")
    op.execute("DROP TYPE IF EXISTS durationunit")
    op.execute("DROP TYPE IF EXISTS medicinetype")
    op.execute("DROP TYPE IF EXISTS prescriptionstatus")
    op.execute("DROP TYPE IF EXISTS prescriptiontype")
    op.execute("DROP TYPE IF EXISTS consultationstatus")
