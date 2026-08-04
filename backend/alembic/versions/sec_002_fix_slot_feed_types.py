"""Match the slot feed's doctor_id to appointments, and make the trigger unable to
abort a booking.

Revision ID: sec_002
Revises: sec_001
Create Date: 2026-08-04

Two defects in ``sec_001``, both found by exercising the trigger rather than reading it:

1. ``slot_change_events.doctor_id`` was declared ``uuid`` while
   ``appointments.doctor_id`` is ``character varying``. PL/pgSQL would coerce the value
   on every write, which succeeds only while every identifier happens to parse as a
   UUID. ``public.profiles`` already contains a row with ``id = 'admin'``, so a
   non-parsing identifier is not hypothetical, and the failure would have surfaced as a
   booking insert aborting in production.

2. The trigger could abort the transaction that fired it. The change feed is a
   progressive enhancement — the booking flow is correct without it and the client falls
   back to poll-on-focus — so it must never be able to fail a booking. It now swallows
   its own errors and raises a warning instead.
"""

from alembic import op

revision = "sec_002"
down_revision = "sec_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE public.slot_change_events "
        "ALTER COLUMN doctor_id TYPE character varying USING doctor_id::text;"
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.emit_slot_change_event()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            target_doctor character varying;
            target_date   date;
        BEGIN
            IF (TG_OP = 'DELETE') THEN
                target_doctor := OLD.doctor_id;
                target_date   := OLD.appointment_date::date;
            ELSE
                target_doctor := NEW.doctor_id;
                target_date   := NEW.appointment_date::date;
            END IF;

            IF target_doctor IS NOT NULL AND target_date IS NOT NULL THEN
                INSERT INTO public.slot_change_events (doctor_id, appointment_date, changed_at)
                VALUES (target_doctor, target_date, now())
                ON CONFLICT (doctor_id, appointment_date)
                DO UPDATE SET changed_at = EXCLUDED.changed_at;
            END IF;

            RETURN NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Never let the availability hint take down the booking that produced it.
            RAISE WARNING 'slot_change_events update skipped: %', SQLERRM;
            RETURN NULL;
        END;
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE public.slot_change_events "
        "ALTER COLUMN doctor_id TYPE uuid USING doctor_id::uuid;"
    )
