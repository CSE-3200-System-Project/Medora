"""Index the foreign keys that had no supporting index.

A foreign key without an index on the referencing column costs twice. Joins across it
fall back to a scan, and every DELETE or key UPDATE on the parent row has to scan the
whole child table to prove no row still references it. That second cost is the one that
bites without warning: it turns a single-row delete into a full table scan, and it is
what made clearing test appointments slow enough to notice.

Fifteen such keys were found on the live database. The two on medicine_search_index are
handled by med_001 instead, which is where they were always meant to be created.

Revision ID: perf_fk_001
Revises: med_001
"""

from alembic import op

revision = "perf_fk_001"
down_revision = "med_001"
branch_labels = None
depends_on = None


# (index name, table, column). Names follow the ix_<table>_<column> convention already
# used across this migration history.
FOREIGN_KEY_INDEXES = (
    ("ix_appointment_audit_logs_performed_by_id", "appointment_audit_logs", "performed_by_id"),
    ("ix_appointment_cancellation_requests_requested_by_id", "appointment_cancellation_requests", "requested_by_id"),
    ("ix_appointment_idempotency_records_appointment_id", "appointment_idempotency_records", "appointment_id"),
    ("ix_appointment_outbox_events_aggregate_id", "appointment_outbox_events", "aggregate_id"),
    ("ix_appointment_reschedule_requests_requested_by_id", "appointment_reschedule_requests", "requested_by_id"),
    ("ix_consultations_appointment_id", "consultations", "appointment_id"),
    ("ix_doctor_profiles_speciality_id", "doctor_profiles", "speciality_id"),
    ("ix_doctor_reviews_appointment_id", "doctor_reviews", "appointment_id"),
    ("ix_medical_report_results_test_id", "medical_report_results", "test_id"),
    ("ix_medical_reports_reviewed_by_id", "medical_reports", "reviewed_by_id"),
    ("ix_medical_reports_uploaded_by", "medical_reports", "uploaded_by"),
    ("ix_prescriptions_consultation_id", "prescriptions", "consultation_id"),
    ("ix_processing_consent_grants_granted_by_id", "processing_consent_grants", "granted_by_id"),
    ("ix_processing_consent_grants_revoked_by_id", "processing_consent_grants", "revoked_by_id"),
    ("ix_reminder_delivery_logs_notification_id", "reminder_delivery_logs", "notification_id"),
)


def upgrade() -> None:
    # IF NOT EXISTS rather than create_index: several of these tables have been patched
    # by the startup self-heal in app/main.py on long-lived development databases, so an
    # index may already be present on one machine and absent on another.
    for name, table, column in FOREIGN_KEY_INDEXES:
        op.execute(f'CREATE INDEX IF NOT EXISTS {name} ON "{table}" ("{column}")')


def downgrade() -> None:
    for name, _table, _column in FOREIGN_KEY_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
