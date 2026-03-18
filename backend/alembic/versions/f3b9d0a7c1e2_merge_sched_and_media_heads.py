"""Merge scheduling and media migration heads.

Revision ID: f3b9d0a7c1e2
Revises: m3d1a_f1l35_001, sched_004
Create Date: 2026-03-18
"""

from typing import Sequence, Union


revision: str = "f3b9d0a7c1e2"
down_revision: Union[str, Sequence[str], None] = ("m3d1a_f1l35_001", "sched_004")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

