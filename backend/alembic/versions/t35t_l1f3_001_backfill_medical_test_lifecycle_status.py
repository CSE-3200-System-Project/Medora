"""backfill lifecycle status in patient medical_tests json

Revision ID: t35t_l1f3_001
Revises: e6890bb2c807
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "t35t_l1f3_001"
down_revision: Union[str, Sequence[str], None] = "e6890bb2c807"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        UPDATE patient_profiles
        SET medical_tests = (
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN jsonb_typeof(item) = 'object' THEN
                  jsonb_set(
                    item,
                    '{status}',
                    to_jsonb(
                      CASE
                        WHEN lower(COALESCE(item->>'status', '')) IN ('pending', 'completed', 'skipped')
                          THEN lower(item->>'status')
                        WHEN btrim(COALESCE(item->>'result', '')) <> ''
                          THEN 'completed'
                        ELSE 'pending'
                      END
                    ),
                    true
                  )
                ELSE item
              END
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(medical_tests::jsonb) = 'array' THEN medical_tests::jsonb
              ELSE '[]'::jsonb
            END
          ) AS item
        )
        WHERE medical_tests IS NOT NULL;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        UPDATE patient_profiles
        SET medical_tests = (
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN jsonb_typeof(item) = 'object' THEN item - 'status'
                ELSE item
              END
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(medical_tests::jsonb) = 'array' THEN medical_tests::jsonb
              ELSE '[]'::jsonb
            END
          ) AS item
        )
        WHERE medical_tests IS NOT NULL;
        """
    )
