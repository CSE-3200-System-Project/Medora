"""Record what happened after an L3 surface was shown.

Lokkhon axis A needs live false-positive counts, and the whitepaper commits to a
dismissal being recorded as a labelled false-positive event. A fixture set says what the
rules do; only the deployed surface says what a person did when the takeover appeared.

The table holds the risk class, the granted tier, which screen was rendered, and the
outcome. It holds no utterance and no subject identifier - `correlation_id` is a random
token minted when the surface was produced, so an outcome joins back to its own
escalation and to nothing else.

Revision ID: ar0h0n_002
Revises: ar0h0n_001
"""

from alembic import op
import sqlalchemy as sa

revision = "ar0h0n_002"
down_revision = "ar0h0n_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "arohon_escalation_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("risk_class", sa.String(length=24), nullable=False),
        sa.Column("autonomy_tier", sa.String(length=24), nullable=False),
        sa.Column("escalation_mode", sa.String(length=32), nullable=False),
        sa.Column("outcome", sa.String(length=24), nullable=False),
        sa.Column("locale", sa.String(length=8), nullable=False, server_default="en"),
        sa.Column("surfaced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_arohon_escalation_events_correlation_id",
        "arohon_escalation_events",
        ["correlation_id"],
    )
    op.create_index(
        "ix_arohon_escalation_events_risk_class",
        "arohon_escalation_events",
        ["risk_class"],
    )
    op.create_index(
        "ix_arohon_escalation_events_outcome",
        "arohon_escalation_events",
        ["outcome"],
    )
    # One outcome per surface. Without this a client retry, a double-tap, or a page
    # restore would inflate the false-positive count that axis A reports.
    op.create_unique_constraint(
        "uq_arohon_escalation_events_correlation_id",
        "arohon_escalation_events",
        ["correlation_id"],
    )
    # The release hardening revoked the anonymous data plane and enabled deny-by-default
    # RLS. A new table must join that posture rather than quietly opting out of it; the
    # backend connects as the owner and is unaffected.
    op.execute("ALTER TABLE arohon_escalation_events ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                REVOKE ALL ON TABLE arohon_escalation_events FROM anon;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON TABLE arohon_escalation_events FROM authenticated;
            END IF;
        END $$
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_arohon_escalation_events_correlation_id",
        "arohon_escalation_events",
        type_="unique",
    )
    op.drop_index("ix_arohon_escalation_events_outcome", table_name="arohon_escalation_events")
    op.drop_index("ix_arohon_escalation_events_risk_class", table_name="arohon_escalation_events")
    op.drop_index(
        "ix_arohon_escalation_events_correlation_id",
        table_name="arohon_escalation_events",
    )
    op.drop_table("arohon_escalation_events")
