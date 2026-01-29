"""merge_consultation_and_test_migrations

Revision ID: 9b75b7b76bd7
Revises: p1r2e3s4c5r6, t1e2s3t4r5e6
Create Date: 2026-01-30 00:27:17.837007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b75b7b76bd7'
down_revision: Union[str, Sequence[str], None] = ('p1r2e3s4c5r6', 't1e2s3t4r5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
