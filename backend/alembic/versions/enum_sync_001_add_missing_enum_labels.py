"""Add the enum labels the models use but the database never had.

Eleven members of five Python enums had no corresponding label in their Postgres type.
Writing any of them raises InvalidTextRepresentationError at insert time, which surfaces
as a 500. The worst case is surgery prescriptions: `surgeryurgency` held only
`immediate` and `scheduled`, and `SurgeryUrgency` in code has neither `immediate` nor
`scheduled` as a usable pair with the rest, so every value the API can send except
`scheduled` was rejected.

Found by comparing app/db/models/enums.py against pg_enum rather than by a failing
request, so none of this had a reproduction yet. tests/unit/backend covers the models,
not the enum type contents, which is why it stayed green.

Note that this schema stores these particular enums by **value** (lower case), while
`userrole`, `accountstatus`, `verificationstatus`, and `reviewmoderationstatus` store by
**name** (upper case). The labels added here follow each type's existing convention.

Revision ID: enum_sync_001
Revises: perf_fk_001
"""

from alembic import op

revision = "enum_sync_001"
down_revision = "perf_fk_001"
branch_labels = None
depends_on = None


MISSING_LABELS = {
    "consultationstatus": ("cancelled",),
    "durationunit": ("years", "ongoing", "as_needed"),
    "medicinetype": ("patch",),
    "surgeryurgency": ("routine", "urgent", "emergency", "elective"),
    "testurgency": ("routine", "emergency"),
}


def upgrade() -> None:
    # ADD VALUE IF NOT EXISTS is allowed inside a transaction on PostgreSQL 12 and later.
    # The new labels are not read back in this migration, which is the restriction that
    # would otherwise apply.
    for type_name, labels in MISSING_LABELS.items():
        for label in labels:
            op.execute(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{label}'")


def downgrade() -> None:
    # PostgreSQL cannot drop an enum label. Reversing this means recreating each type
    # and rewriting every column that uses it, which would risk data that the new labels
    # may already be in use for. Leaving the labels in place is the safe no-op.
    pass
