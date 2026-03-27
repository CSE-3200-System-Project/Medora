"""add chorui ai permission fields

Revision ID: ai_perm_001
Revises: sh4r1ng_001
Create Date: 2026-03-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ai_perm_001"
down_revision: Union[str, Sequence[str], None] = "sh4r1ng_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patient_data_sharing_preferences",
        sa.Column("can_use_ai", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "doctor_profiles",
        sa.Column("allow_patient_ai_visibility", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("doctor_profiles", "allow_patient_ai_visibility")
    op.drop_column("patient_data_sharing_preferences", "can_use_ai")
