"""Record the Arohon tier decision on every AI interaction.

The whitepaper's claim is that "the selected tier is logged with the correlation
identifier". Before this revision there was nowhere to put it: `ai_interactions` recorded
the feature, the provider, and the latency, but nothing about how much authority the call
was granted or what lowered it.

All five columns are nullable (or defaulted) because rows written before the tier layer
existed have no decision attached, and backfilling one would fabricate an audit entry for
a request that was never governed. An unset `autonomy_tier` reads as "pre-Arohon", which
is the truth.

`correlation_id` is the orchestrator's per-request random token — not a stable subject
identifier — so indexing it joins a tier decision to one request without creating a way
to link a patient's requests together.

Revision ID: ar0h0n_001
Revises: sec_003
"""

from alembic import op
import sqlalchemy as sa

revision = "ar0h0n_001"
down_revision = "sec_003"
branch_labels = None
depends_on = None


_COLUMNS = (
    ("correlation_id", sa.String(length=64), True, None),
    ("requested_tier", sa.String(length=24), True, None),
    ("autonomy_tier", sa.String(length=24), True, None),
    ("risk_class", sa.String(length=24), True, None),
    ("tier_ceiling_applied", sa.Boolean(), False, sa.text("false")),
)

_INDEXES = (
    ("ix_ai_interactions_correlation_id", "correlation_id"),
    ("ix_ai_interactions_autonomy_tier", "autonomy_tier"),
    ("ix_ai_interactions_risk_class", "risk_class"),
)


def upgrade() -> None:
    for name, type_, nullable, server_default in _COLUMNS:
        op.add_column(
            "ai_interactions",
            sa.Column(name, type_, nullable=nullable, server_default=server_default),
        )
    for index_name, column in _INDEXES:
        op.create_index(index_name, "ai_interactions", [column])


def downgrade() -> None:
    for index_name, _column in _INDEXES:
        op.drop_index(index_name, table_name="ai_interactions")
    for name, _type, _nullable, _default in _COLUMNS:
        op.drop_column("ai_interactions", name)
