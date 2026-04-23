"""Merge sh4r3_t3st_001 and t35t_l1f3_001 into a single head.

Revision ID: m3rg3_001
Revises: sh4r3_t3st_001, t35t_l1f3_001
Create Date: 2026-04-23
"""

from typing import Sequence, Union


revision: str = "m3rg3_001"
down_revision: Union[str, Sequence[str], None] = ("sh4r3_t3st_001", "t35t_l1f3_001")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
