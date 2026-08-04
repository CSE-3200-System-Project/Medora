"""Runs `alembic upgrade head` against a real, empty Postgres database.

Every other backend test builds its schema with `Base.metadata.create_all()`
(see `db_session` in tests/conftest.py), which is ORM-driven and bypasses
Alembic entirely. That gap is exactly how this project's migration chain
went years without anyone noticing it could not actually reproduce the
schema from scratch: several migrations assumed columns already existed
(added by hand outside Alembic on the long-lived dev/prod database), and a
Postgres transaction-scoping issue with enum values only surfaces when the
full history replays in one run. This test is the actual reproducibility
check for `alembic upgrade head` -- see README.md's Local development
section, which promises exactly this command works on a fresh database.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
import sqlalchemy as sa

pytestmark = [pytest.mark.backend, pytest.mark.integration]

BACKEND_DIR = Path(__file__).resolve().parents[3] / "backend"


@pytest.fixture
def empty_postgres_url(postgres_async_url: str) -> str:
    sync_url = sa.engine.make_url(postgres_async_url).set(drivername="postgresql+psycopg2")
    engine = sa.create_engine(sync_url.render_as_string(hide_password=False))
    with engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA public"))
    engine.dispose()
    return sync_url.render_as_string(hide_password=False)


def test_alembic_upgrade_head_succeeds_on_a_fresh_database(empty_postgres_url):
    async_url = sa.engine.make_url(empty_postgres_url).set(drivername="postgresql+asyncpg")

    env = {
        "SUPABASE_DATABASE_URL": async_url.render_as_string(hide_password=False),
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_KEY": "test-key",
        "SUPABASE_STORAGE_BUCKET": "test-bucket",
    }
    import os

    full_env = {**os.environ, **env}

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=full_env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert result.returncode == 0, (
        f"alembic upgrade head failed on a fresh database:\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )

    engine = sa.create_engine(empty_postgres_url)
    with engine.connect() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                sa.text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            )
        }
        assert {"drugs", "brands", "medicine_search_index", "doctor_profiles"}.issubset(tables)

        doctor_profile_columns = {
            row[0]
            for row in conn.execute(
                sa.text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'doctor_profiles'"
                )
            )
        }
        assert "day_time_slots" in doctor_profile_columns
    engine.dispose()
