"""add appointment completion and revenue fields

Revision ID: appt_rev_001
Revises: rvw_001
Create Date: 2026-04-24 22:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "appt_rev_001"
down_revision: Union[str, Sequence[str], None] = "rvw_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    appointment_columns = _column_names("appointments")
    if "completed_at" not in appointment_columns:
        op.add_column("appointments", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    if "revenue_amount" not in appointment_columns:
        op.add_column("appointments", sa.Column("revenue_amount", sa.Float(), nullable=True))

    doctor_columns = _column_names("doctor_profiles")
    if "total_revenue" not in doctor_columns:
        op.add_column(
            "doctor_profiles",
            sa.Column("total_revenue", sa.Float(), nullable=False, server_default=sa.text("0")),
        )

    appointment_indexes = _index_names("appointments")
    if "ix_appointments_doctor_completed_at" not in appointment_indexes:
        op.create_index(
            "ix_appointments_doctor_completed_at",
            "appointments",
            ["doctor_id", "completed_at"],
            unique=False,
        )

    op.execute(
        sa.text(
            """
            UPDATE appointments AS a
            SET
                completed_at = COALESCE(
                    a.completed_at,
                    a.updated_at,
                    a.appointment_date
                ),
                revenue_amount = COALESCE(
                    a.revenue_amount,
                    (
                        SELECT da.revenue_amount
                        FROM doctor_actions AS da
                        WHERE da.related_appointment_id = a.id
                          AND da.action_type = 'appointment_completed'
                          AND da.revenue_amount IS NOT NULL
                        ORDER BY da.created_at DESC NULLS LAST, da.id DESC
                        LIMIT 1
                    ),
                    dp.consultation_fee,
                    0
                )
            FROM doctor_profiles AS dp
            WHERE a.doctor_id = dp.profile_id
              AND a.status = 'COMPLETED'
              AND (a.completed_at IS NULL OR a.revenue_amount IS NULL)
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE appointments
            SET
                completed_at = COALESCE(completed_at, updated_at, appointment_date),
                revenue_amount = COALESCE(revenue_amount, 0)
            WHERE status = 'COMPLETED'
              AND (completed_at IS NULL OR revenue_amount IS NULL)
            """
        )
    )

    op.execute(sa.text("UPDATE doctor_profiles SET total_revenue = 0"))
    op.execute(
        sa.text(
            """
            UPDATE doctor_profiles AS dp
            SET total_revenue = revenue_summary.total_revenue
            FROM (
                SELECT
                    doctor_id,
                    COALESCE(SUM(COALESCE(revenue_amount, 0)), 0) AS total_revenue
                FROM appointments
                WHERE status = 'COMPLETED'
                GROUP BY doctor_id
            ) AS revenue_summary
            WHERE dp.profile_id = revenue_summary.doctor_id
            """
        )
    )


def downgrade() -> None:
    appointment_indexes = _index_names("appointments")
    if "ix_appointments_doctor_completed_at" in appointment_indexes:
        op.drop_index("ix_appointments_doctor_completed_at", table_name="appointments")

    doctor_columns = _column_names("doctor_profiles")
    if "total_revenue" in doctor_columns:
        op.drop_column("doctor_profiles", "total_revenue")

    appointment_columns = _column_names("appointments")
    if "revenue_amount" in appointment_columns:
        op.drop_column("appointments", "revenue_amount")
    if "completed_at" in appointment_columns:
        op.drop_column("appointments", "completed_at")
