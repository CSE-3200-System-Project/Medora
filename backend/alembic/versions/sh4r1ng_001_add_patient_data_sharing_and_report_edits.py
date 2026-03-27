"""add patient data sharing preferences, report edit fields, and report doctor access

Revision ID: sh4r1ng_001
Revises: l0c4t10n_001
Create Date: 2026-03-27 14:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "sh4r1ng_001"
down_revision = "l0c4t10n_001"
branch_labels = None
depends_on = None


def upgrade():
    # --- patient_data_sharing_preferences ---
    op.create_table(
        "patient_data_sharing_preferences",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("doctor_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("can_view_profile", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_conditions", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_medications", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_allergies", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_medical_history", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_family_history", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_lifestyle", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_vaccinations", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_reports", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_health_metrics", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_view_prescriptions", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("patient_id", "doctor_id", name="uq_patient_doctor_sharing"),
    )
    op.create_index("ix_pds_patient", "patient_data_sharing_preferences", ["patient_id"])
    op.create_index("ix_pds_doctor", "patient_data_sharing_preferences", ["doctor_id"])

    # --- medical_report_doctor_access ---
    op.create_table(
        "medical_report_doctor_access",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("report_id", sa.String(), sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doctor_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("can_view", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("report_id", "doctor_id", name="uq_report_doctor_access"),
    )
    op.create_index("ix_report_doctor_access_report", "medical_report_doctor_access", ["report_id"])
    op.create_index("ix_report_doctor_access_doctor", "medical_report_doctor_access", ["doctor_id"])

    # --- add columns to medical_reports ---
    op.add_column(
        "medical_reports",
        sa.Column("shared_with_doctors", sa.Boolean(), nullable=False, server_default="false"),
    )

    # --- add columns to medical_report_results ---
    op.add_column(
        "medical_report_results",
        sa.Column("is_manually_edited", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "medical_report_results",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("medical_report_results", "updated_at")
    op.drop_column("medical_report_results", "is_manually_edited")
    op.drop_column("medical_reports", "shared_with_doctors")

    op.drop_index("ix_report_doctor_access_doctor", table_name="medical_report_doctor_access")
    op.drop_index("ix_report_doctor_access_report", table_name="medical_report_doctor_access")
    op.drop_table("medical_report_doctor_access")

    op.drop_index("ix_pds_doctor", table_name="patient_data_sharing_preferences")
    op.drop_index("ix_pds_patient", table_name="patient_data_sharing_preferences")
    op.drop_table("patient_data_sharing_preferences")
