"""bridge missing ai_perm_002 revision

Revision ID: ai_perm_002
Revises: ai_perm_001
Create Date: 2026-03-27 00:00:00.000000
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "ai_perm_002"
down_revision: Union[str, Sequence[str], None] = "ai_perm_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This revision is a chain bridge to match existing DB state.
    pass


def downgrade() -> None:
    pass
