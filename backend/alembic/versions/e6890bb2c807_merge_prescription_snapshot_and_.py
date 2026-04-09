"""merge prescription snapshot and consultation draft heads

Revision ID: e6890bb2c807
Revises: c0nsult_draft_002, pr_snap_001
Create Date: 2026-04-09 02:42:11.296711

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6890bb2c807'
down_revision: Union[str, Sequence[str], None] = ('c0nsult_draft_002', 'pr_snap_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
