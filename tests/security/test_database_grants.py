"""The database must not be reachable around the API.

Every authorization predicate in this system lives in FastAPI route code. That is only
sound while the API is the sole path to the data. It was not: before migration
`sec_001`, all 50 tables in `public` granted full DML to the `anon` and `authenticated`
roles with row-level security disabled, and the anon key is published to the browser by
`frontend/lib/use-realtime-slots.ts`. Anyone loading the site could read or write every
prescription through the PostgREST Data API without touching a single route check.

Why this file builds its own fixture
------------------------------------
`tests/conftest.py` creates the test schema with `Base.metadata.create_all` against a
stock `postgres:16-alpine` container. Alembic never runs there and the platform roles
`anon` and `authenticated` do not exist, so asserting "no grants to anon" against that
database passes for the wrong reason — there is no `anon` to hold a grant. A security
test that cannot fail is worse than no test, so this module reconstructs the vulnerable
state explicitly (create the roles, grant them everything, leave RLS off), applies the
lockdown, and only then asserts. Each test would fail if the lockdown were removed.

`assert_vulnerable_state_reproduced` is the guard against this file quietly decaying
back into a vacuous pass.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text

pytestmark = [pytest.mark.backend, pytest.mark.integration, pytest.mark.security]

# The single deliberate exception: a trigger-maintained change feed of
# (doctor_id, appointment_date, changed_at) that the booking UI subscribes to. It
# carries no patient data, so the browser may read it.
PUBLIC_READABLE = {"slot_change_events"}

BROWSER_ROLES = ("anon", "authenticated")

# The contract migration sec_001 must satisfy. Kept here in the test rather than
# imported from the migration so that a change to the migration has to be justified
# against an independently stated expectation.
LOCKDOWN_SQL = [
    "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated",
    "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated",
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
    """,
    "ALTER TABLE public.slot_change_events ENABLE ROW LEVEL SECURITY",
    "DROP POLICY IF EXISTS slot_change_events_read ON public.slot_change_events",
    """
    CREATE POLICY slot_change_events_read ON public.slot_change_events
    FOR SELECT TO anon, authenticated USING (true)
    """,
    "GRANT SELECT ON public.slot_change_events TO anon, authenticated",
]


async def _scalar(session, sql: str):
    return (await session.execute(text(sql))).scalar()


@pytest.fixture
async def locked_down_db(db_session):
    """Reproduce the pre-`sec_001` exposure, then apply the lockdown."""
    for role in BROWSER_ROLES:
        await db_session.execute(
            text(
                f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{role}') "
                f"THEN CREATE ROLE {role} NOLOGIN; END IF; END $$;"
            )
        )
    await db_session.execute(text("GRANT USAGE ON SCHEMA public TO anon, authenticated"))
    await db_session.execute(
        text("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated")
    )
    await db_session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.slot_change_events (
                doctor_id        character varying NOT NULL,
                appointment_date date              NOT NULL,
                changed_at       timestamptz       NOT NULL DEFAULT now(),
                PRIMARY KEY (doctor_id, appointment_date)
            )
            """
        )
    )
    await db_session.execute(
        text("GRANT ALL ON public.slot_change_events TO anon, authenticated")
    )

    # The test is only meaningful if the hole it closes was actually open.
    exposed = await _scalar(
        db_session,
        "SELECT count(*) FROM information_schema.role_table_grants "
        "WHERE table_schema='public' AND grantee IN ('anon','authenticated') "
        "AND privilege_type IN ('INSERT','UPDATE','DELETE')",
    )
    assert exposed > 0, (
        "Could not reproduce the vulnerable state, so the assertions below would pass "
        "for the wrong reason. Check that the platform roles were created and granted."
    )

    for statement in LOCKDOWN_SQL:
        await db_session.execute(text(statement))
    await db_session.flush()
    return db_session


@pytest.mark.asyncio
async def test_browser_roles_hold_no_write_access_to_any_table(locked_down_db) -> None:
    result = await locked_down_db.execute(
        text(
            """
            SELECT table_name, grantee, privilege_type
            FROM information_schema.role_table_grants
            WHERE table_schema = 'public'
              AND grantee IN ('anon', 'authenticated')
              AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
            ORDER BY table_name, grantee, privilege_type
            """
        )
    )
    offenders = [f"{r.grantee} has {r.privilege_type} on {r.table_name}" for r in result]
    assert not offenders, (
        "The browser-facing roles can modify application data directly, bypassing every "
        "route-level authorization check:\n  " + "\n  ".join(offenders)
    )


@pytest.mark.asyncio
async def test_browser_roles_can_only_read_the_phi_free_change_feed(locked_down_db) -> None:
    result = await locked_down_db.execute(
        text(
            """
            SELECT DISTINCT table_name
            FROM information_schema.role_table_grants
            WHERE table_schema = 'public'
              AND grantee IN ('anon', 'authenticated')
              AND privilege_type = 'SELECT'
            """
        )
    )
    readable = {row.table_name for row in result}
    assert readable <= PUBLIC_READABLE, (
        "Tables readable with the browser-published anon key: "
        f"{sorted(readable - PUBLIC_READABLE)}"
    )


@pytest.mark.asyncio
async def test_row_level_security_is_enabled_on_every_table(locked_down_db) -> None:
    """Second, independent barrier, so a stray GRANT cannot silently reopen the hole."""
    result = await locked_down_db.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity")
    )
    unprotected = sorted(row.tablename for row in result)
    assert not unprotected, f"Row-level security is disabled on: {unprotected}"


@pytest.mark.asyncio
async def test_change_feed_carries_no_patient_data(locked_down_db) -> None:
    """The one published table must stay free of anything identifying a patient."""
    result = await locked_down_db.execute(
        text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name='slot_change_events'
            """
        )
    )
    columns = {row.column_name for row in result}
    assert columns == {"doctor_id", "appointment_date", "changed_at"}, (
        f"slot_change_events gained unexpected columns: {sorted(columns)}. "
        "Anything added here is broadcast to anonymous browser subscribers."
    )


@pytest.mark.asyncio
async def test_change_feed_doctor_id_type_matches_appointments(locked_down_db) -> None:
    """Regression for sec_002.

    The feed's ``doctor_id`` was declared ``uuid`` against a ``character varying``
    ``appointments.doctor_id``. PL/pgSQL coerced it on every write, which holds only
    while every identifier parses as a UUID — and ``public.profiles`` already contains a
    row with ``id = 'admin'``. In production this aborts the booking insert.
    """
    result = await locked_down_db.execute(
        text(
            """
            SELECT table_name, data_type FROM information_schema.columns
            WHERE table_schema='public' AND column_name='doctor_id'
              AND table_name IN ('appointments', 'slot_change_events')
            """
        )
    )
    types = {row.table_name: row.data_type for row in result}
    if len(types) < 2:
        pytest.fail(f"expected both tables to expose doctor_id, saw {types}")
    assert types["appointments"] == types["slot_change_events"], (
        f"doctor_id type mismatch would abort booking writes: {types}"
    )
