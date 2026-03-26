"""add medical report tables

Revision ID: r3p0rt_001
Revises: c0n53nt_001
Create Date: 2026-03-27 10:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "r3p0rt_001"
down_revision = "c0n53nt_001"
branch_labels = None
depends_on = None


def upgrade():
    # --- medical_reports ---
    op.create_table(
        "medical_reports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("uploaded_by", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("file_url", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(500), nullable=True),
        sa.Column("report_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("parsed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("raw_ocr_text", sa.Text(), nullable=True),
        sa.Column("ocr_engine", sa.String(50), nullable=True),
        sa.Column("processing_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_medical_reports_patient_id", "medical_reports", ["patient_id"])
    op.create_index("ix_medical_reports_patient_created", "medical_reports", ["patient_id", "created_at"])

    # --- medical_report_results ---
    op.create_table(
        "medical_report_results",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("report_id", sa.String(), sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_id", sa.Integer(), sa.ForeignKey("medicaltest.id"), nullable=True),
        sa.Column("test_name", sa.String(500), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("value_text", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("reference_range_min", sa.Float(), nullable=True),
        sa.Column("reference_range_max", sa.Float(), nullable=True),
        sa.Column("reference_range_text", sa.String(200), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_report_results_report_id", "medical_report_results", ["report_id"])

    # --- doctor_report_comments ---
    op.create_table(
        "doctor_report_comments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("report_id", sa.String(), sa.ForeignKey("medical_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doctor_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_doctor_report_comments_report_id", "doctor_report_comments", ["report_id"])
    op.create_index("ix_doctor_report_comments_doctor_id", "doctor_report_comments", ["doctor_id"])


def downgrade():
    op.drop_index("ix_doctor_report_comments_doctor_id", table_name="doctor_report_comments")
    op.drop_index("ix_doctor_report_comments_report_id", table_name="doctor_report_comments")
    op.drop_table("doctor_report_comments")

    op.drop_index("ix_report_results_report_id", table_name="medical_report_results")
    op.drop_table("medical_report_results")

    op.drop_index("ix_medical_reports_patient_created", table_name="medical_reports")
    op.drop_index("ix_medical_reports_patient_id", table_name="medical_reports")
    op.drop_table("medical_reports")
