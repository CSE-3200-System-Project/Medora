"""Create drugs, brands, and medicine_search_index tables.

Revision ID: med_001
Revises: sec_002
Create Date: 2026-08-04

app/db/models/medicine.py has mapped to these tables since the medicine routes were
first added, with a comment stating they map to "existing Supabase tables" -- but no
migration ever created them, so `alembic upgrade head` alone could not reproduce a
working medicine reference on a fresh database. This migration closes that gap and is
paired with backend/scripts/seed_medicine_reference.py, which loads
data/medicine_reference/Final_Medicine_Dataset.csv into the three tables created here.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "med_001"
down_revision = "sec_002"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return bind.dialect.has_table(bind, name)


def upgrade() -> None:
    # The three tables were loaded into the live database out of band, before this
    # migration existed, so a straight create_table aborts the whole upgrade there and
    # the indexes below never get created. That is why the deployed database was missing
    # ix_medicine_search_index_drug_id and _brand_id while the table itself was present.
    # Creating them only when absent lets the same revision run against a fresh database
    # and against the one that was populated by hand.
    if _table_exists("drugs"):
        _upgrade_indexes_only()
        return

    op.create_table(
        "drugs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("drug_key", sa.Text(), nullable=False),
        sa.Column("generic_name", sa.Text(), nullable=False),
        sa.Column("strength", sa.Text(), nullable=False),
        sa.Column("dosage_form", sa.Text(), nullable=False),
        sa.Column("common_uses", sa.Text(), nullable=True),
        sa.Column("common_uses_disclaimer", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("drug_key"),
    )
    op.create_index("ix_drugs_generic_name", "drugs", ["generic_name"], unique=False)

    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_name", sa.Text(), nullable=False),
        sa.Column("manufacturer", sa.Text(), nullable=True),
        sa.Column("medicine_type", sa.Text(), nullable=True),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["drug_id"], ["drugs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_brands_drug_id", "brands", ["drug_id"], unique=False)
    op.create_index("ix_brands_brand_name", "brands", ["brand_name"], unique=False)

    op.create_table(
        "medicine_search_index",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("term", sa.Text(), nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("brand_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["drug_id"], ["drugs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brand_id"], ["brands.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_medicine_search_index_term", "medicine_search_index", ["term"], unique=False)
    op.create_index("ix_medicine_search_index_drug_id", "medicine_search_index", ["drug_id"], unique=False)
    op.create_index("ix_medicine_search_index_brand_id", "medicine_search_index", ["brand_id"], unique=False)

    # 7f9c1b2d3e4f attempted this same index long before this table existed in
    # Alembic's history and is now a guarded no-op; create it here instead,
    # now that the table and the pg_trgm extension both exist.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_term_trgm "
        "ON medicine_search_index USING gin (term gin_trgm_ops);"
    )


def _upgrade_indexes_only() -> None:
    """Bring an out-of-band medicine schema up to what this revision guarantees."""
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_drugs_generic_name ON drugs (generic_name)",
        "CREATE INDEX IF NOT EXISTS ix_brands_drug_id ON brands (drug_id)",
        "CREATE INDEX IF NOT EXISTS ix_brands_brand_name ON brands (brand_name)",
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_term ON medicine_search_index (term)",
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_drug_id ON medicine_search_index (drug_id)",
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_brand_id ON medicine_search_index (brand_id)",
        "CREATE INDEX IF NOT EXISTS ix_medicine_search_index_term_trgm "
        "ON medicine_search_index USING gin (term gin_trgm_ops)",
    ):
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_medicine_search_index_term_trgm")
    op.drop_index("ix_medicine_search_index_brand_id", table_name="medicine_search_index")
    op.drop_index("ix_medicine_search_index_drug_id", table_name="medicine_search_index")
    op.drop_index("ix_medicine_search_index_term", table_name="medicine_search_index")
    op.drop_table("medicine_search_index")

    op.drop_index("ix_brands_brand_name", table_name="brands")
    op.drop_index("ix_brands_drug_id", table_name="brands")
    op.drop_table("brands")

    op.drop_index("ix_drugs_generic_name", table_name="drugs")
    op.drop_table("drugs")
