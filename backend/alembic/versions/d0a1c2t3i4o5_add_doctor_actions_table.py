"""add doctor actions table

Revision ID: d0a1c2t3i4o5
Revises: h1a2b3c4d5e6
Create Date: 2026-03-26 11:50:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "d0a1c2t3i4o5"
down_revision = "h1a2b3c4d5e6"
branch_labels = None
depends_on = None


doctor_action_type = postgresql.ENUM(
    "appointment_completed",
    "prescription_issued",
    "consultation_completed",
    "lab_review",
    "patient_message",
    "manual_task",
    name="doctoractiontype",
    create_type=False,
)

doctor_action_priority = postgresql.ENUM(
    "low",
    "medium",
    "high",
    "urgent",
    name="doctoractionpriority",
    create_type=False,
)

doctor_action_status = postgresql.ENUM(
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    name="doctoractionstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    doctor_action_type.create(bind, checkfirst=True)
    doctor_action_priority.create(bind, checkfirst=True)
    doctor_action_status.create(bind, checkfirst=True)

    op.create_table(
        "doctor_actions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("doctor_id", sa.String(), nullable=False),
        sa.Column("action_type", doctor_action_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", doctor_action_priority, nullable=False),
        sa.Column("status", doctor_action_status, nullable=False),
        sa.Column("related_patient_id", sa.String(), nullable=True),
        sa.Column("related_appointment_id", sa.String(), nullable=True),
        sa.Column("revenue_amount", sa.Float(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.profile_id"]),
        sa.ForeignKeyConstraint(["related_appointment_id"], ["appointments.id"]),
        sa.ForeignKeyConstraint(["related_patient_id"], ["patient_profiles.profile_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_doctor_actions_doctor_id", "doctor_actions", ["doctor_id"], unique=False)
    op.create_index("ix_doctor_actions_related_appointment_id", "doctor_actions", ["related_appointment_id"], unique=False)
    op.create_index("ix_doctor_actions_related_patient_id", "doctor_actions", ["related_patient_id"], unique=False)
    op.create_index("ix_doctor_actions_doctor_status", "doctor_actions", ["doctor_id", "status"], unique=False)
    op.create_index("ix_doctor_actions_doctor_created", "doctor_actions", ["doctor_id", "created_at"], unique=False)
    op.create_index("ix_doctor_actions_doctor_type", "doctor_actions", ["doctor_id", "action_type"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_doctor_actions_doctor_type", table_name="doctor_actions")
    op.drop_index("ix_doctor_actions_doctor_created", table_name="doctor_actions")
    op.drop_index("ix_doctor_actions_doctor_status", table_name="doctor_actions")
    op.drop_index("ix_doctor_actions_related_patient_id", table_name="doctor_actions")
    op.drop_index("ix_doctor_actions_related_appointment_id", table_name="doctor_actions")
    op.drop_index("ix_doctor_actions_doctor_id", table_name="doctor_actions")
    op.drop_table("doctor_actions")

    doctor_action_status.drop(bind, checkfirst=True)
    doctor_action_priority.drop(bind, checkfirst=True)
    doctor_action_type.drop(bind, checkfirst=True)
