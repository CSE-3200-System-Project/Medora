"""Add consultation draft payload column

Revision ID: c0nsult_draft_001
Revises: pr3v13w_001
Create Date: 2026-04-08 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c0nsult_draft_001"
down_revision: Union[str, Sequence[str], None] = "pr3v13w_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("consultations", sa.Column("draft_payload", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("consultations", "draft_payload")
