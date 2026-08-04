"""Close the anon/authenticated data-plane hole; move realtime slots off PHI.

Revision ID: sec_001
Revises: softwarex_003
Create Date: 2026-08-04

Background
----------
Every table in ``public`` had ``SELECT, INSERT, UPDATE, DELETE, TRUNCATE`` granted to
the ``anon`` and ``authenticated`` roles with row-level security disabled. The anon key
is published to the browser by ``frontend/lib/use-realtime-slots.ts`` (it is a
``NEXT_PUBLIC_`` value by design), so anyone loading the site could read or modify every
prescription, medical report, and consent record through the PostgREST Data API.

The backend is unaffected by this migration. It connects as ``postgres``, which holds
``rolbypassrls`` and owns every table, so enabling RLS does not change its access. The
documented architecture — browser to Server Action to FastAPI — never used these grants.

Realtime
--------
``use-realtime-slots.ts`` subscribed to ``postgres_changes`` on ``public.appointments``,
which would have streamed whole appointment rows to any anonymous subscriber. It never
did: the ``supabase_realtime`` publication contained no tables, so the feature has been
silently inert. Rather than restore it as-is, this migration introduces
``slot_change_events``, which carries only ``(doctor_id, appointment_date, changed_at)``.
That is all the hook needs — it ignores the payload and refetches through the backend —
and it contains no patient data, so it can be published safely.

Defense in depth: grants are revoked *and* RLS is enabled. Either one alone would close
the hole; both mean a future ``GRANT`` cannot silently reopen it.
"""

from alembic import op

revision = "sec_001"
down_revision = "softwarex_003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. A non-sensitive change feed for slot availability.
    # ------------------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.slot_change_events (
            doctor_id        uuid        NOT NULL,
            appointment_date date        NOT NULL,
            changed_at       timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (doctor_id, appointment_date)
        );
        """
    )

    # Upsert keeps the table bounded at one row per doctor+date instead of growing
    # with every booking.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.emit_slot_change_event()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            target_doctor uuid;
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
        END;
        $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_appointments_slot_change ON public.appointments;")
    op.execute(
        """
        CREATE TRIGGER trg_appointments_slot_change
        AFTER INSERT OR UPDATE OR DELETE ON public.appointments
        FOR EACH ROW EXECUTE FUNCTION public.emit_slot_change_event();
        """
    )

    # ------------------------------------------------------------------
    # 2. Revoke the data plane from the browser-facing roles.
    # ------------------------------------------------------------------
    # anon/authenticated are Supabase-platform roles, auto-provisioned on every
    # Supabase project but absent on a plain Postgres instance (local dev,
    # CI, or this repo's own reproducibility testing). Guard every reference
    # to them so this migration is a no-op -- correctly, since there is
    # nothing to restrict -- on a database that never had these roles.
    #
    # Schema USAGE is retained so PostgREST can still introspect; without table
    # privileges that yields an empty API surface rather than a broken one.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
                REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
            END IF;
        END $$;
        """
    )

    # Stop newly created tables from inheriting the same grants. Supabase installs these
    # defaults under more than one owning role, and a managed project's `postgres` role
    # is not a member of `supabase_admin`, so clearing that one raises
    # `insufficient_privilege`. Each role is attempted and a refusal is skipped rather
    # than failing the migration: clearing `postgres` is what matters, because Alembic
    # creates every application table as `postgres`.
    #
    # Residual risk, covered by tests/unit/backend/test_database_grants.py: a table
    # created by another owning role could still inherit grants. That test asserts the
    # invariant directly rather than trusting this to have been exhaustive.
    op.execute(
        """
        DO $$
        DECLARE owner_role text;
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                FOREACH owner_role IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
                    BEGIN
                        EXECUTE format(
                            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
                            'REVOKE ALL ON TABLES FROM anon, authenticated', owner_role);
                        EXECUTE format(
                            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
                            'REVOKE ALL ON SEQUENCES FROM anon, authenticated', owner_role);
                    EXCEPTION WHEN insufficient_privilege THEN
                        RAISE NOTICE
                            'skipping default privileges for role % (not permitted here)',
                            owner_role;
                    END;
                END LOOP;
            END IF;
        END $$;
        """
    )

    # ------------------------------------------------------------------
    # 3. Enable RLS everywhere as a second, independent barrier.
    # ------------------------------------------------------------------
    # No policies are created, so these tables deny all access to any non-bypassing
    # role. The backend is unaffected (postgres has rolbypassrls and owns the tables).
    op.execute(
        """
        DO $$
        DECLARE rec record;
        BEGIN
            FOR rec IN
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> 'slot_change_events'
            LOOP
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', rec.tablename);
            END LOOP;
        END $$;
        """
    )

    # ------------------------------------------------------------------
    # 4. Re-open exactly one read-only, PHI-free surface.
    # ------------------------------------------------------------------
    op.execute("ALTER TABLE public.slot_change_events ENABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS slot_change_events_read ON public.slot_change_events;")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                CREATE POLICY slot_change_events_read ON public.slot_change_events
                FOR SELECT TO anon, authenticated USING (true);
                GRANT SELECT ON public.slot_change_events TO anon, authenticated;
            END IF;
        END $$;
        """
    )

    # Publish it so realtime actually delivers, which it never did for appointments.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime'
                      AND schemaname = 'public'
                      AND tablename = 'slot_change_events'
                ) THEN
                    ALTER PUBLICATION supabase_realtime ADD TABLE public.slot_change_events;
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Deliberately does not restore the blanket anon/authenticated grants. Recreating a
    # known data-exposure automatically would be the wrong default; re-grant by hand if
    # a rollback genuinely requires it.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
               AND EXISTS (
                    SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime'
                      AND schemaname = 'public' AND tablename = 'slot_change_events'
               ) THEN
                ALTER PUBLICATION supabase_realtime DROP TABLE public.slot_change_events;
            END IF;
        END $$;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_appointments_slot_change ON public.appointments;")
    op.execute("DROP FUNCTION IF EXISTS public.emit_slot_change_event();")
    op.execute("DROP TABLE IF EXISTS public.slot_change_events;")
