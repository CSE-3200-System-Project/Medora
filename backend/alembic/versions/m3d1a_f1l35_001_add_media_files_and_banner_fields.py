"""Add media_files table and profile banner URL fields

Revision ID: m3d1a_f1l35_001
Revises: sched_003
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "m3d1a_f1l35_001"
down_revision: Union[str, None] = "sched_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patient_profiles", sa.Column("profile_banner_url", sa.String(), nullable=True))
    op.add_column("doctor_profiles", sa.Column("profile_banner_url", sa.String(), nullable=True))

    op.create_table(
        "media_files",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_profile_id", sa.String(), nullable=False),
        sa.Column("bucket", sa.String(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("public_url", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("original_file_name", sa.String(), nullable=True),
        sa.Column("content_type", sa.String(), nullable=True),
        sa.Column("file_extension", sa.String(), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=False, server_default="general"),
        sa.Column("entity_type", sa.String(), nullable=True),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("visibility", sa.String(), nullable=False, server_default="public"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_profile_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_path"),
    )

    op.create_index("ix_media_files_owner_profile_id", "media_files", ["owner_profile_id"], unique=False)
    op.create_index("ix_media_files_category", "media_files", ["category"], unique=False)
    op.create_index("ix_media_files_entity", "media_files", ["entity_type", "entity_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_media_files_entity", table_name="media_files")
    op.drop_index("ix_media_files_category", table_name="media_files")
    op.drop_index("ix_media_files_owner_profile_id", table_name="media_files")
    op.drop_table("media_files")

    op.drop_column("doctor_profiles", "profile_banner_url")
    op.drop_column("patient_profiles", "profile_banner_url")
