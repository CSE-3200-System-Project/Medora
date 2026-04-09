"""add banned to accountstatus enum

Revision ID: c91b5fbe2a10
Revises: b4n_r34s0n_001
Create Date: 2026-03-30 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c91b5fbe2a10"
down_revision: Union[str, Sequence[str], None] = "b4n_r34s0n_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ensure accountstatus supports banned for moderation actions."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accountstatus') THEN
                ALTER TYPE accountstatus ADD VALUE IF NOT EXISTS 'banned';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    """No-op: PostgreSQL enum value removal is unsafe for downgrade."""
    pass
