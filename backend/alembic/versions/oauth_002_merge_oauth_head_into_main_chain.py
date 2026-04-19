"""Merge OAuth Google account head into the main migration chain.

Revision ID: oauth_002
Revises: e6890bb2c807, oauth_001
Create Date: 2026-04-17
"""

from typing import Sequence, Union


revision: str = "oauth_002"
down_revision: Union[str, Sequence[str], None] = ("e6890bb2c807", "oauth_001")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
