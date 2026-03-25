"""add ai orchestrator interaction and feedback tables

Revision ID: a11f9c2d4e6b
Revises: a5f7c8d2e1b3
Create Date: 2026-03-24 21:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a11f9c2d4e6b"
down_revision: Union[str, Sequence[str], None] = "a5f7c8d2e1b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_interactions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("feature", sa.String(length=100), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("sanitized_input", sa.JSON(), nullable=False),
        sa.Column("raw_output", sa.JSON(), nullable=True),
        sa.Column("validated_output", sa.JSON(), nullable=True),
        sa.Column("validation_status", sa.String(length=32), nullable=False),
        sa.Column("doctor_action", sa.String(length=64), nullable=True),
        sa.Column("doctor_id", sa.String(), nullable=False),
        sa.Column("patient_id", sa.String(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.profile_id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patient_profiles.profile_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_interactions_doctor_id"), "ai_interactions", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_ai_interactions_patient_id"), "ai_interactions", ["patient_id"], unique=False)
    op.create_index(op.f("ix_ai_interactions_feature"), "ai_interactions", ["feature"], unique=False)
    op.create_index(op.f("ix_ai_interactions_created_at"), "ai_interactions", ["created_at"], unique=False)
    op.create_index(op.f("ix_ai_interactions_validation_status"), "ai_interactions", ["validation_status"], unique=False)

    op.create_table(
        "ai_feedback",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("ai_interaction_id", sa.String(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("correction_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_ai_feedback_rating"),
        sa.ForeignKeyConstraint(["ai_interaction_id"], ["ai_interactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_feedback_ai_interaction_id"), "ai_feedback", ["ai_interaction_id"], unique=False)
    op.create_index(op.f("ix_ai_feedback_created_at"), "ai_feedback", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_feedback_created_at"), table_name="ai_feedback")
    op.drop_index(op.f("ix_ai_feedback_ai_interaction_id"), table_name="ai_feedback")
    op.drop_table("ai_feedback")

    op.drop_index(op.f("ix_ai_interactions_validation_status"), table_name="ai_interactions")
    op.drop_index(op.f("ix_ai_interactions_created_at"), table_name="ai_interactions")
    op.drop_index(op.f("ix_ai_interactions_feature"), table_name="ai_interactions")
    op.drop_index(op.f("ix_ai_interactions_patient_id"), table_name="ai_interactions")
    op.drop_index(op.f("ix_ai_interactions_doctor_id"), table_name="ai_interactions")
    op.drop_table("ai_interactions")
