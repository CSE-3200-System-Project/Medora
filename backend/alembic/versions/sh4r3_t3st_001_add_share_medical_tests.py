"""Add share_medical_tests flag to health_data_consents.

Revision ID: sh4r3_t3st_001
Revises: admin_appr_002
Create Date: 2026-04-22

Extends the patient→doctor health-data consent record with a flag that
toggles sharing of the patient's structured medical tests alongside the
already-shared vitals and medications. Idempotent so it is safe against
fresh and partially-migrated databases.
"""
from alembic import op
import sqlalchemy as sa


revision = "sh4r3_t3st_001"
down_revision = "admin_appr_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = 'health_data_consents'"
        )
    ).first()
    if not table_exists:
        return

    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'health_data_consents' AND column_name = 'share_medical_tests'"
        )
    ).first()
    if column_exists:
        return

    op.add_column(
        "health_data_consents",
        sa.Column(
            "share_medical_tests",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    column_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'health_data_consents' AND column_name = 'share_medical_tests'"
        )
    ).first()
    if not column_exists:
        return
    op.drop_column("health_data_consents", "share_medical_tests")
