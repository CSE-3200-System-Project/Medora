"""add health metrics table

Revision ID: h1a2b3c4d5e6
Revises: d4c7b1a9e2f3
Create Date: 2026-03-26 11:40:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "h1a2b3c4d5e6"
down_revision = "d4c7b1a9e2f3"
branch_labels = None
depends_on = None


health_metric_type = postgresql.ENUM(
    "steps",
    "sleep_hours",
    "sleep_minutes",
    "heart_rate",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "weight",
    "blood_sugar",
    name="healthmetrictype",
    create_type=False,
)

health_metric_source = postgresql.ENUM(
    "manual",
    "device",
    name="healthmetricsource",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    health_metric_type.create(bind, checkfirst=True)
    health_metric_source.create(bind, checkfirst=True)

    op.create_table(
        "health_metrics",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("metric_type", health_metric_type, nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", health_metric_source, nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_health_metrics_recorded_at", "health_metrics", ["recorded_at"], unique=False)
    op.create_index("ix_health_metrics_user_id", "health_metrics", ["user_id"], unique=False)
    op.create_index(
        "ix_health_metrics_user_metric_recorded",
        "health_metrics",
        ["user_id", "metric_type", "recorded_at"],
        unique=False,
    )
    op.create_index(
        "ix_health_metrics_user_recorded",
        "health_metrics",
        ["user_id", "recorded_at"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_health_metrics_user_recorded", table_name="health_metrics")
    op.drop_index("ix_health_metrics_user_metric_recorded", table_name="health_metrics")
    op.drop_index("ix_health_metrics_user_id", table_name="health_metrics")
    op.drop_index("ix_health_metrics_recorded_at", table_name="health_metrics")
    op.drop_table("health_metrics")

    health_metric_source.drop(bind, checkfirst=True)
    health_metric_type.drop(bind, checkfirst=True)
