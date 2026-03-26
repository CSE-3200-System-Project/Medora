"""add health data consents table

Revision ID: c0n53nt_001
Revises: d0a1c2t3i4o5
Create Date: 2026-03-26 12:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c0n53nt_001"
down_revision = "d0a1c2t3i4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "health_data_consents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("patient_id", sa.String(), nullable=False),
        sa.Column("doctor_id", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["patient_id"], ["patient_profiles.profile_id"]),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.profile_id"]),
    )
    op.create_index("ix_health_data_consents_patient_doctor", "health_data_consents", ["patient_id", "doctor_id"], unique=True)
    op.create_index("ix_health_data_consents_doctor", "health_data_consents", ["doctor_id"])
    op.create_index("ix_health_data_consents_patient_id", "health_data_consents", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_health_data_consents_patient_id", table_name="health_data_consents")
    op.drop_index("ix_health_data_consents_doctor", table_name="health_data_consents")
    op.drop_index("ix_health_data_consents_patient_doctor", table_name="health_data_consents")
    op.drop_table("health_data_consents")
