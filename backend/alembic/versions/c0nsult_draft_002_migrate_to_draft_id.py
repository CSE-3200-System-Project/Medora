"""Migrate consultation draft_payload to normalized draft_id architecture.

Revision ID: c0nsult_draft_002
Revises: c0nsult_draft_001
Create Date: 2026-04-08 22:00:00.000000

"""
from typing import Any, Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "c0nsult_draft_002"
down_revision: Union[str, Sequence[str], None] = "c0nsult_draft_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_optional_date_like(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _normalize_legacy_draft_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    normalized = dict(payload)

    for text_key in ("chief_complaint", "diagnosis", "notes", "prescription_notes"):
        normalized[text_key] = _normalize_optional_text(normalized.get(text_key))

    prescription_type = normalized.get("prescription_type")
    if prescription_type not in {"medication", "test", "surgery"}:
        normalized["prescription_type"] = None

    normalized_medications: list[dict[str, Any]] = []
    medications = normalized.get("medications")
    if isinstance(medications, list):
        for medication in medications:
            if not isinstance(medication, dict):
                continue

            medication_item = dict(medication)
            medicine_name = _normalize_optional_text(
                medication_item.get("medicine_name")
                or medication_item.get("name")
                or medication_item.get("medication_name")
            )
            if not medicine_name:
                continue

            medication_item["medicine_name"] = medicine_name
            medication_item["generic_name"] = _normalize_optional_text(medication_item.get("generic_name"))
            medication_item["strength"] = _normalize_optional_text(medication_item.get("strength"))
            medication_item["dosage_pattern"] = _normalize_optional_text(medication_item.get("dosage_pattern"))
            medication_item["frequency_text"] = _normalize_optional_text(medication_item.get("frequency_text"))
            medication_item["special_instructions"] = _normalize_optional_text(medication_item.get("special_instructions"))
            medication_item["start_date"] = _normalize_optional_date_like(medication_item.get("start_date"))
            medication_item["end_date"] = _normalize_optional_date_like(medication_item.get("end_date"))
            normalized_medications.append(medication_item)
    normalized["medications"] = normalized_medications

    normalized_tests: list[dict[str, Any]] = []
    tests = normalized.get("tests")
    if isinstance(tests, list):
        for test in tests:
            if not isinstance(test, dict):
                continue

            test_item = dict(test)
            test_name = _normalize_optional_text(test_item.get("test_name") or test_item.get("name"))
            if not test_name:
                continue

            test_item["test_name"] = test_name
            test_item["test_type"] = _normalize_optional_text(test_item.get("test_type"))
            test_item["instructions"] = _normalize_optional_text(test_item.get("instructions"))
            test_item["preferred_lab"] = _normalize_optional_text(test_item.get("preferred_lab"))
            test_item["expected_date"] = _normalize_optional_date_like(test_item.get("expected_date"))
            normalized_tests.append(test_item)
    normalized["tests"] = normalized_tests

    normalized_surgeries: list[dict[str, Any]] = []
    surgeries = normalized.get("surgeries")
    if isinstance(surgeries, list):
        for surgery in surgeries:
            if not isinstance(surgery, dict):
                continue

            surgery_item = dict(surgery)
            procedure_name = _normalize_optional_text(
                surgery_item.get("procedure_name")
                or surgery_item.get("name")
            )
            if not procedure_name:
                continue

            surgery_item["procedure_name"] = procedure_name
            surgery_item["procedure_type"] = _normalize_optional_text(surgery_item.get("procedure_type"))
            surgery_item["reason"] = _normalize_optional_text(surgery_item.get("reason"))
            surgery_item["pre_op_instructions"] = _normalize_optional_text(surgery_item.get("pre_op_instructions"))
            surgery_item["notes"] = _normalize_optional_text(surgery_item.get("notes"))
            surgery_item["preferred_facility"] = _normalize_optional_text(surgery_item.get("preferred_facility"))
            surgery_item["recommended_date"] = _normalize_optional_date_like(surgery_item.get("recommended_date"))
            normalized_surgeries.append(surgery_item)
    normalized["surgeries"] = normalized_surgeries

    normalized["patient_info"] = normalized.get("patient_info") if isinstance(normalized.get("patient_info"), dict) else None
    normalized["doctor_info"] = normalized.get("doctor_info") if isinstance(normalized.get("doctor_info"), dict) else None

    return normalized


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if not _table_exists(inspector, "consultation_drafts"):
        op.create_table(
            "consultation_drafts",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = sa.inspect(connection)
    if not _column_exists(inspector, "consultations", "draft_id"):
        op.add_column("consultations", sa.Column("draft_id", sa.String(), nullable=True))

    inspector = sa.inspect(connection)
    unique_constraints = {constraint.get("name") for constraint in inspector.get_unique_constraints("consultations")}
    if "uq_consultations_draft_id" not in unique_constraints:
        op.create_unique_constraint("uq_consultations_draft_id", "consultations", ["draft_id"])

    inspector = sa.inspect(connection)
    foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("consultations")}
    if "fk_consultations_draft_id_consultation_drafts" not in foreign_keys:
        op.create_foreign_key(
            "fk_consultations_draft_id_consultation_drafts",
            "consultations",
            "consultation_drafts",
            ["draft_id"],
            ["id"],
            ondelete="SET NULL",
        )

    inspector = sa.inspect(connection)
    if _column_exists(inspector, "consultations", "draft_payload"):
        rows = connection.execute(
            sa.text(
                """
                SELECT id, draft_payload, draft_id
                FROM consultations
                WHERE draft_payload IS NOT NULL
                """
            )
        ).fetchall()

        draft_lookup_stmt = sa.text("SELECT id FROM consultation_drafts WHERE id = :draft_id")
        insert_draft_stmt = sa.text(
            "INSERT INTO consultation_drafts (id, payload) VALUES (:draft_id, :payload)"
        ).bindparams(sa.bindparam("payload", type_=sa.JSON()))
        update_draft_stmt = sa.text(
            "UPDATE consultation_drafts SET payload = :payload, updated_at = NOW() WHERE id = :draft_id"
        ).bindparams(sa.bindparam("payload", type_=sa.JSON()))
        update_consultation_stmt = sa.text(
            "UPDATE consultations SET draft_id = :draft_id WHERE id = :consultation_id"
        )

        for row in rows:
            consultation_id = row._mapping["id"]
            payload = _normalize_legacy_draft_payload(row._mapping["draft_payload"])
            existing_draft_id = row._mapping.get("draft_id")
            target_draft_id = existing_draft_id or str(uuid.uuid4())

            draft_exists = connection.execute(
                draft_lookup_stmt,
                {"draft_id": target_draft_id},
            ).scalar_one_or_none()

            if draft_exists:
                connection.execute(
                    update_draft_stmt,
                    {"draft_id": target_draft_id, "payload": payload},
                )
            else:
                connection.execute(
                    insert_draft_stmt,
                    {"draft_id": target_draft_id, "payload": payload},
                )

            connection.execute(
                update_consultation_stmt,
                {"draft_id": target_draft_id, "consultation_id": consultation_id},
            )

        op.drop_column("consultations", "draft_payload")


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if not _column_exists(inspector, "consultations", "draft_payload"):
        op.add_column("consultations", sa.Column("draft_payload", sa.JSON(), nullable=True))

    inspector = sa.inspect(connection)
    if _table_exists(inspector, "consultation_drafts") and _column_exists(inspector, "consultations", "draft_id"):
        rows = connection.execute(
            sa.text(
                """
                SELECT consultations.id AS consultation_id, consultation_drafts.payload AS payload
                FROM consultations
                JOIN consultation_drafts ON consultations.draft_id = consultation_drafts.id
                """
            )
        ).fetchall()

        update_payload_stmt = sa.text(
            "UPDATE consultations SET draft_payload = :payload WHERE id = :consultation_id"
        ).bindparams(sa.bindparam("payload", type_=sa.JSON()))

        for row in rows:
            consultation_id = row._mapping["consultation_id"]
            payload = row._mapping["payload"]
            connection.execute(
                update_payload_stmt,
                {"payload": payload, "consultation_id": consultation_id},
            )

    inspector = sa.inspect(connection)
    if _column_exists(inspector, "consultations", "draft_id"):
        foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("consultations")}
        if "fk_consultations_draft_id_consultation_drafts" in foreign_keys:
            op.drop_constraint("fk_consultations_draft_id_consultation_drafts", "consultations", type_="foreignkey")

        unique_constraints = {constraint.get("name") for constraint in inspector.get_unique_constraints("consultations")}
        if "uq_consultations_draft_id" in unique_constraints:
            op.drop_constraint("uq_consultations_draft_id", "consultations", type_="unique")

        op.drop_column("consultations", "draft_id")

    inspector = sa.inspect(connection)
    if _table_exists(inspector, "consultation_drafts"):
        op.drop_table("consultation_drafts")
