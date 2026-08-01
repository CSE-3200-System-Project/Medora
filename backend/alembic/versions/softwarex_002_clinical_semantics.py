"""replace prescription approval semantics and gate OCR drafts

Revision ID: softwarex_002
Revises: softwarex_001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "softwarex_002"
down_revision: str | None = "softwarex_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE prescriptionstatus RENAME TO prescriptionstatus_legacy")
    op.execute(
        "CREATE TYPE prescriptionstatus AS ENUM "
        "('pending_acknowledgment', 'receipt_acknowledged', 'discrepancy_reported')"
    )
    op.execute("ALTER TABLE prescriptions ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE prescriptions
        ALTER COLUMN status TYPE prescriptionstatus
        USING (
            CASE status::text
                WHEN 'pending' THEN 'pending_acknowledgment'
                WHEN 'accepted' THEN 'receipt_acknowledged'
                WHEN 'rejected' THEN 'discrepancy_reported'
            END
        )::prescriptionstatus
        """
    )
    op.execute(
        "ALTER TABLE prescriptions ALTER COLUMN status "
        "SET DEFAULT 'pending_acknowledgment'::prescriptionstatus"
    )
    op.execute("DROP TYPE prescriptionstatus_legacy")
    op.alter_column("prescriptions", "rejection_reason", new_column_name="discrepancy_reason")
    op.alter_column("prescriptions", "accepted_at", new_column_name="acknowledged_at")
    op.alter_column("prescriptions", "rejected_at", new_column_name="discrepancy_reported_at")

    op.add_column(
        "medical_reports",
        sa.Column("processing_mode", sa.String(length=20), server_default="local", nullable=False),
    )
    op.add_column(
        "medical_reports",
        sa.Column("review_status", sa.String(length=30), server_default="pending_review", nullable=False),
    )
    op.add_column("medical_reports", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("medical_reports", sa.Column("reviewed_by_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_medical_reports_reviewed_by_id_profiles",
        "medical_reports",
        "profiles",
        ["reviewed_by_id"],
        ["id"],
    )
    op.execute("UPDATE medical_reports SET review_status = 'legacy_unverified', parsed = false WHERE raw_ocr_text IS NOT NULL")


def downgrade() -> None:
    op.drop_constraint("fk_medical_reports_reviewed_by_id_profiles", "medical_reports", type_="foreignkey")
    op.drop_column("medical_reports", "reviewed_by_id")
    op.drop_column("medical_reports", "reviewed_at")
    op.drop_column("medical_reports", "review_status")
    op.drop_column("medical_reports", "processing_mode")

    op.execute("ALTER TYPE prescriptionstatus RENAME TO prescriptionstatus_softwarex")
    op.execute("CREATE TYPE prescriptionstatus AS ENUM ('pending', 'accepted', 'rejected')")
    op.execute("ALTER TABLE prescriptions ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE prescriptions
        ALTER COLUMN status TYPE prescriptionstatus
        USING (
            CASE status::text
                WHEN 'pending_acknowledgment' THEN 'pending'
                WHEN 'receipt_acknowledged' THEN 'accepted'
                WHEN 'discrepancy_reported' THEN 'rejected'
            END
        )::prescriptionstatus
        """
    )
    op.execute("ALTER TABLE prescriptions ALTER COLUMN status SET DEFAULT 'pending'::prescriptionstatus")
    op.execute("DROP TYPE prescriptionstatus_softwarex")
    op.alter_column("prescriptions", "discrepancy_reason", new_column_name="rejection_reason")
    op.alter_column("prescriptions", "acknowledged_at", new_column_name="accepted_at")
    op.alter_column("prescriptions", "discrepancy_reported_at", new_column_name="rejected_at")
