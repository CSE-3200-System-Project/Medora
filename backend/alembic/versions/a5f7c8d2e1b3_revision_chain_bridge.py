"""bridge missing historical revision id

Revision ID: a5f7c8d2e1b3
Revises: 2f7a4c1d9e6b
Create Date: 2026-03-24 22:20:00.000000

This is a no-op compatibility bridge to restore migration chain continuity
for environments where `a5f7c8d2e1b3` exists in `alembic_version`.
"""

from typing import Sequence, Union


revision: str = "a5f7c8d2e1b3"
down_revision: Union[str, Sequence[str], None] = "2f7a4c1d9e6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

