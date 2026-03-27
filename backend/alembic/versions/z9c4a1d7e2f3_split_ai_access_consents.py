"""split ai access consents

Revision ID: z9c4a1d7e2f3
Revises: ai_perm_002
Create Date: 2026-03-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "z9c4a1d7e2f3"
down_revision = "ai_perm_002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("patient_profiles")}

    if "ai_personal_context_enabled" not in existing:
        op.add_column(
            "patient_profiles",
            sa.Column(
                "ai_personal_context_enabled",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )
    if "ai_general_chat_enabled" not in existing:
        op.add_column(
            "patient_profiles",
            sa.Column(
                "ai_general_chat_enabled",
                sa.Boolean(),
                nullable=False,
                server_default="false",
            ),
        )

    # Preserve existing behavior for users who already granted legacy consent.
    op.execute(
        """
        UPDATE patient_profiles
        SET ai_personal_context_enabled = consent_ai,
            ai_general_chat_enabled = consent_ai
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {column["name"] for column in inspector.get_columns("patient_profiles")}

    if "ai_general_chat_enabled" in existing:
        op.drop_column("patient_profiles", "ai_general_chat_enabled")
    if "ai_personal_context_enabled" in existing:
        op.drop_column("patient_profiles", "ai_personal_context_enabled")
