"""Merge heads

Revision ID: c2fee4c5a250
Revises: 51ce17656b64, c8f3a9b2d4e6
Create Date: 2026-01-14 00:58:08.387174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2fee4c5a250'
down_revision: Union[str, Sequence[str], None] = ('51ce17656b64', 'c8f3a9b2d4e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
