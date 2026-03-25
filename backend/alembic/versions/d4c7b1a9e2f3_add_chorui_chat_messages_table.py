"""add chorui chat message persistence

Revision ID: d4c7b1a9e2f3
Revises: a11f9c2d4e6b
Create Date: 2026-03-25 10:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4c7b1a9e2f3"
down_revision: Union[str, Sequence[str], None] = "a11f9c2d4e6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chorui_chat_messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("patient_id", sa.String(), nullable=True),
        sa.Column("role_context", sa.String(length=32), nullable=False),
        sa.Column("sender", sa.String(length=16), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=64), nullable=True),
        sa.Column("structured_data", sa.JSON(), nullable=True),
        sa.Column("context_mode", sa.String(length=32), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_chorui_chat_messages_conversation_id"), "chorui_chat_messages", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_chorui_chat_messages_user_id"), "chorui_chat_messages", ["user_id"], unique=False)
    op.create_index(op.f("ix_chorui_chat_messages_patient_id"), "chorui_chat_messages", ["patient_id"], unique=False)
    op.create_index(op.f("ix_chorui_chat_messages_sender"), "chorui_chat_messages", ["sender"], unique=False)
    op.create_index(op.f("ix_chorui_chat_messages_intent"), "chorui_chat_messages", ["intent"], unique=False)
    op.create_index(op.f("ix_chorui_chat_messages_created_at"), "chorui_chat_messages", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chorui_chat_messages_created_at"), table_name="chorui_chat_messages")
    op.drop_index(op.f("ix_chorui_chat_messages_intent"), table_name="chorui_chat_messages")
    op.drop_index(op.f("ix_chorui_chat_messages_sender"), table_name="chorui_chat_messages")
    op.drop_index(op.f("ix_chorui_chat_messages_patient_id"), table_name="chorui_chat_messages")
    op.drop_index(op.f("ix_chorui_chat_messages_user_id"), table_name="chorui_chat_messages")
    op.drop_index(op.f("ix_chorui_chat_messages_conversation_id"), table_name="chorui_chat_messages")
    op.drop_table("chorui_chat_messages")
