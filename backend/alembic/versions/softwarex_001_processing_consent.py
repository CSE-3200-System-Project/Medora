"""add versioned processing consent grants

Revision ID: softwarex_001
Revises: perf_merge_001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "softwarex_001"
down_revision: str | None = "perf_merge_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "processing_consent_grants",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=True),
        sa.Column("recipient_id", sa.String(), nullable=True),
        sa.Column("policy_version", sa.String(length=40), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("granted_by_id", sa.String(), nullable=False),
        sa.Column("revoked_by_id", sa.String(), nullable=True),
        sa.Column("audit_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["granted_by_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["revoked_by_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_processing_consent_grants_subject_id", "processing_consent_grants", ["subject_id"])
    op.create_index(
        "ix_processing_consent_subject_purpose_version",
        "processing_consent_grants",
        ["subject_id", "purpose", "recipient_id", "version"],
        unique=True,
    )
    op.create_index(
        "ix_processing_consent_active_lookup",
        "processing_consent_grants",
        ["subject_id", "purpose", "revoked_at"],
    )
    op.execute(
        """
        INSERT INTO processing_consent_grants
            (id, subject_id, purpose, version, scopes, provider, policy_version,
             valid_from, granted_at, granted_by_id, audit_note)
        SELECT
            md5(random()::text || clock_timestamp()::text)::uuid::text,
            profile_id,
            'external_text_ai',
            1,
            '["clinical_context"]'::jsonb,
            'legacy_unspecified_provider',
            'legacy-ai-consent-v1',
            now(),
            now(),
            profile_id,
            'Migrated as non-routable legacy consent. The subject must select a named provider before external processing; no image or audio permission inferred.'
        FROM patient_profiles
        WHERE COALESCE(ai_personal_context_enabled, consent_ai, false) = true
        """
    )
    op.execute(
        """
        INSERT INTO processing_consent_grants
            (id, subject_id, purpose, version, scopes, provider, recipient_id,
             policy_version, valid_from, granted_at, granted_by_id, audit_note)
        SELECT
            md5(random()::text || clock_timestamp()::text)::uuid::text,
            patient_id,
            'clinical_sharing',
            1,
            to_jsonb(array_remove(ARRAY[
                CASE WHEN can_view_profile THEN 'profile' END,
                CASE WHEN can_view_conditions THEN 'conditions' END,
                CASE WHEN can_view_medications THEN 'medications' END,
                CASE WHEN can_view_allergies THEN 'allergies' END,
                CASE WHEN can_view_medical_history THEN 'medical_history' END,
                CASE WHEN can_view_family_history THEN 'family_history' END,
                CASE WHEN can_view_lifestyle THEN 'lifestyle' END,
                CASE WHEN can_view_vaccinations THEN 'vaccinations' END,
                CASE WHEN can_view_reports THEN 'reports' END,
                CASE WHEN can_view_health_metrics THEN 'health_metrics' END,
                CASE WHEN can_view_prescriptions THEN 'prescriptions' END
            ]::text[], NULL)),
            'medora',
            doctor_id,
            'legacy-sharing-v1',
            now(),
            now(),
            patient_id,
            'Migrated only explicitly enabled per-doctor sharing categories.'
        FROM patient_data_sharing_preferences
        WHERE can_view_profile OR can_view_conditions OR can_view_medications
           OR can_view_allergies OR can_view_medical_history OR can_view_family_history
           OR can_view_lifestyle OR can_view_vaccinations OR can_view_reports
           OR can_view_health_metrics OR can_view_prescriptions
        """
    )


def downgrade() -> None:
    op.drop_index("ix_processing_consent_active_lookup", table_name="processing_consent_grants")
    op.drop_index("ix_processing_consent_subject_purpose_version", table_name="processing_consent_grants")
    op.drop_index("ix_processing_consent_grants_subject_id", table_name="processing_consent_grants")
    op.drop_table("processing_consent_grants")
