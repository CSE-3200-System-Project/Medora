"""Merge the query-path and pagination index branches.

Revision ID: perf_merge_001
Revises: p3rf_002, pag_idx_001
Create Date: 2026-07-25
"""

from typing import Sequence, Union


revision: str = "perf_merge_001"
down_revision: Union[str, Sequence[str], None] = ("p3rf_002", "pag_idx_001")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Join both already-applied schema branches."""


def downgrade() -> None:
    """Split the migration graph without reverting either branch."""
