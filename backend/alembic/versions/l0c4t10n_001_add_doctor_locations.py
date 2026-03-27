"""add doctor locations table and location-aware links

Revision ID: l0c4t10n_001
Revises: r3p0rt_001
Create Date: 2026-03-27 11:30:00
"""

from datetime import datetime
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "l0c4t10n_001"
down_revision = "r3p0rt_001"
branch_labels = None
depends_on = None


def _compose_location_text(name: str | None, address: str | None, city: str | None, country: str | None) -> str:
    parts: list[str] = []
    for value in (name, address, city, country):
        if value and str(value).strip():
            parts.append(str(value).strip())
    return ", ".join(parts)


def _normalize_location_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def upgrade() -> None:
    op.create_table(
        "doctor_locations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("doctor_id", sa.String(), nullable=False),
        sa.Column("location_name", sa.String(length=255), nullable=False),
        sa.Column("location_type", sa.String(length=50), nullable=True),
        sa.Column("location_text", sa.Text(), nullable=False),
        sa.Column("normalized_location_text", sa.String(length=500), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("geocoded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("geocode_source", sa.String(length=30), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("available_days", sa.JSON(), nullable=True),
        sa.Column("day_time_slots", sa.JSON(), nullable=True),
        sa.Column("appointment_duration", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctor_profiles.profile_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doctor_locations_doctor_id", "doctor_locations", ["doctor_id"], unique=False)
    op.create_index(
        "ix_doctor_locations_normalized_location_text",
        "doctor_locations",
        ["normalized_location_text"],
        unique=False,
    )

    op.add_column("doctor_availability", sa.Column("doctor_location_id", sa.String(), nullable=True))
    op.add_column("doctor_exceptions", sa.Column("doctor_location_id", sa.String(), nullable=True))
    op.add_column("doctor_schedule_overrides", sa.Column("doctor_location_id", sa.String(), nullable=True))
    op.add_column("appointments", sa.Column("doctor_location_id", sa.String(), nullable=True))
    op.add_column("appointments", sa.Column("location_name", sa.String(length=255), nullable=True))

    op.create_foreign_key(
        "fk_doctor_availability_doctor_location_id",
        "doctor_availability",
        "doctor_locations",
        ["doctor_location_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_doctor_exceptions_doctor_location_id",
        "doctor_exceptions",
        "doctor_locations",
        ["doctor_location_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_doctor_schedule_overrides_doctor_location_id",
        "doctor_schedule_overrides",
        "doctor_locations",
        ["doctor_location_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_appointments_doctor_location_id",
        "appointments",
        "doctor_locations",
        ["doctor_location_id"],
        ["id"],
    )

    op.create_index("ix_doctor_availability_doctor_location_id", "doctor_availability", ["doctor_location_id"], unique=False)
    op.create_index("ix_doctor_exceptions_doctor_location_id", "doctor_exceptions", ["doctor_location_id"], unique=False)
    op.create_index(
        "ix_doctor_schedule_overrides_doctor_location_id",
        "doctor_schedule_overrides",
        ["doctor_location_id"],
        unique=False,
    )
    op.create_index("ix_appointments_doctor_location_id", "appointments", ["doctor_location_id"], unique=False)

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT
                profile_id,
                hospital_name,
                hospital_address,
                hospital_city,
                hospital_country,
                hospital_latitude,
                hospital_longitude,
                chamber_name,
                chamber_address,
                chamber_city,
                chamber_latitude,
                chamber_longitude,
                available_days,
                day_time_slots,
                appointment_duration
            FROM doctor_profiles
            """
        )
    ).mappings().all()

    location_table = sa.table(
        "doctor_locations",
        sa.column("id", sa.String()),
        sa.column("doctor_id", sa.String()),
        sa.column("location_name", sa.String()),
        sa.column("location_type", sa.String()),
        sa.column("location_text", sa.Text()),
        sa.column("normalized_location_text", sa.String()),
        sa.column("display_name", sa.Text()),
        sa.column("address", sa.Text()),
        sa.column("city", sa.String()),
        sa.column("country", sa.String()),
        sa.column("latitude", sa.Float()),
        sa.column("longitude", sa.Float()),
        sa.column("geocoded_at", sa.DateTime(timezone=True)),
        sa.column("geocode_source", sa.String()),
        sa.column("is_primary", sa.Boolean()),
        sa.column("available_days", sa.JSON()),
        sa.column("day_time_slots", sa.JSON()),
        sa.column("appointment_duration", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    inserts: list[dict] = []
    primary_location_by_doctor: dict[str, str] = {}
    primary_location_name_by_doctor: dict[str, str] = {}
    now = datetime.utcnow()

    for row in rows:
        doctor_id = row["profile_id"]
        available_days = row["available_days"]
        day_time_slots = row["day_time_slots"]
        appointment_duration = row["appointment_duration"]

        hospital_name = row["hospital_name"]
        hospital_address = row["hospital_address"]
        hospital_city = row["hospital_city"]
        hospital_country = row["hospital_country"] or "Bangladesh"
        has_hospital = any([hospital_name, hospital_address, hospital_city])

        if has_hospital:
            location_text = _compose_location_text(
                hospital_name,
                hospital_address,
                hospital_city,
                hospital_country,
            )
            location_id = str(uuid.uuid4())
            geocoded_at = now if row["hospital_latitude"] is not None and row["hospital_longitude"] is not None else None
            inserts.append(
                {
                    "id": location_id,
                    "doctor_id": doctor_id,
                    "location_name": hospital_name or "Primary Location",
                    "location_type": "HOSPITAL",
                    "location_text": location_text or "Primary Location, Bangladesh",
                    "normalized_location_text": _normalize_location_text(location_text),
                    "display_name": None,
                    "address": hospital_address,
                    "city": hospital_city,
                    "country": hospital_country,
                    "latitude": row["hospital_latitude"],
                    "longitude": row["hospital_longitude"],
                    "geocoded_at": geocoded_at,
                    "geocode_source": "legacy",
                    "is_primary": True,
                    "available_days": available_days,
                    "day_time_slots": day_time_slots,
                    "appointment_duration": appointment_duration,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            primary_location_by_doctor[doctor_id] = location_id
            primary_location_name_by_doctor[doctor_id] = hospital_name or "Primary Location"

        chamber_name = row["chamber_name"]
        chamber_address = row["chamber_address"]
        chamber_city = row["chamber_city"]
        has_chamber = any([chamber_name, chamber_address, chamber_city])

        if has_chamber:
            location_text = _compose_location_text(
                chamber_name,
                chamber_address,
                chamber_city,
                "Bangladesh",
            )
            if has_hospital and _normalize_location_text(location_text) == _normalize_location_text(
                _compose_location_text(hospital_name, hospital_address, hospital_city, hospital_country)
            ):
                continue

            location_id = str(uuid.uuid4())
            geocoded_at = now if row["chamber_latitude"] is not None and row["chamber_longitude"] is not None else None
            is_primary = not has_hospital
            inserts.append(
                {
                    "id": location_id,
                    "doctor_id": doctor_id,
                    "location_name": chamber_name or "Chamber",
                    "location_type": "CHAMBER",
                    "location_text": location_text or "Chamber, Bangladesh",
                    "normalized_location_text": _normalize_location_text(location_text),
                    "display_name": None,
                    "address": chamber_address,
                    "city": chamber_city,
                    "country": "Bangladesh",
                    "latitude": row["chamber_latitude"],
                    "longitude": row["chamber_longitude"],
                    "geocoded_at": geocoded_at,
                    "geocode_source": "legacy",
                    "is_primary": is_primary,
                    "available_days": available_days,
                    "day_time_slots": day_time_slots,
                    "appointment_duration": appointment_duration,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            if is_primary:
                primary_location_by_doctor[doctor_id] = location_id
                primary_location_name_by_doctor[doctor_id] = chamber_name or "Chamber"

    if inserts:
        op.bulk_insert(location_table, inserts)

    for doctor_id, location_id in primary_location_by_doctor.items():
        location_name = primary_location_name_by_doctor.get(doctor_id)
        conn.execute(
            sa.text(
                """
                UPDATE doctor_availability
                SET doctor_location_id = :location_id
                WHERE doctor_id = :doctor_id AND doctor_location_id IS NULL
                """
            ),
            {"doctor_id": doctor_id, "location_id": location_id},
        )
        conn.execute(
            sa.text(
                """
                UPDATE doctor_exceptions
                SET doctor_location_id = :location_id
                WHERE doctor_id = :doctor_id AND doctor_location_id IS NULL
                """
            ),
            {"doctor_id": doctor_id, "location_id": location_id},
        )
        conn.execute(
            sa.text(
                """
                UPDATE doctor_schedule_overrides
                SET doctor_location_id = :location_id
                WHERE doctor_id = :doctor_id AND doctor_location_id IS NULL
                """
            ),
            {"doctor_id": doctor_id, "location_id": location_id},
        )
        conn.execute(
            sa.text(
                """
                UPDATE appointments
                SET doctor_location_id = :location_id,
                    location_name = COALESCE(location_name, :location_name)
                WHERE doctor_id = :doctor_id AND doctor_location_id IS NULL
                """
            ),
            {
                "doctor_id": doctor_id,
                "location_id": location_id,
                "location_name": location_name,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_appointments_doctor_location_id", table_name="appointments")
    op.drop_index("ix_doctor_schedule_overrides_doctor_location_id", table_name="doctor_schedule_overrides")
    op.drop_index("ix_doctor_exceptions_doctor_location_id", table_name="doctor_exceptions")
    op.drop_index("ix_doctor_availability_doctor_location_id", table_name="doctor_availability")

    op.drop_constraint("fk_appointments_doctor_location_id", "appointments", type_="foreignkey")
    op.drop_constraint(
        "fk_doctor_schedule_overrides_doctor_location_id",
        "doctor_schedule_overrides",
        type_="foreignkey",
    )
    op.drop_constraint("fk_doctor_exceptions_doctor_location_id", "doctor_exceptions", type_="foreignkey")
    op.drop_constraint("fk_doctor_availability_doctor_location_id", "doctor_availability", type_="foreignkey")

    op.drop_column("appointments", "location_name")
    op.drop_column("appointments", "doctor_location_id")
    op.drop_column("doctor_schedule_overrides", "doctor_location_id")
    op.drop_column("doctor_exceptions", "doctor_location_id")
    op.drop_column("doctor_availability", "doctor_location_id")

    op.drop_index("ix_doctor_locations_normalized_location_text", table_name="doctor_locations")
    op.drop_index("ix_doctor_locations_doctor_id", table_name="doctor_locations")
    op.drop_table("doctor_locations")
