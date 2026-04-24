"""
Async SQLAlchemy engine & session factory.

Supabase can be reached three ways, and the right engine config differs for each:

  1. Direct connection (port 5432)          → real pooling + prepared statements OK
  2. Session-mode pooler (port 5432 pooler) → real pooling + prepared statements OK
  3. Transaction-mode pgBouncer (port 6543) → MUST disable prepared-statement caches

We auto-detect (1)/(2) vs (3) from the URL but allow explicit override via env.
Overrides (all optional):

  DB_POOL_MODE              = "auto" | "direct" | "pgbouncer"   (default "auto")
  DB_POOL_SIZE              = int  (default 10; ignored in pgbouncer mode)
  DB_MAX_OVERFLOW           = int  (default 10; ignored in pgbouncer mode)
  DB_POOL_TIMEOUT           = int seconds (default 30)
  DB_POOL_RECYCLE           = int seconds (default 1800)
  DB_POOL_PRE_PING          = "true"|"false" (default "true")
  DB_ECHO                   = "true"|"false" (default "false")
"""

from __future__ import annotations

import os
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _detect_pgbouncer(url: str) -> bool:
    """True if the URL looks like a Supabase pgBouncer transaction-mode endpoint."""
    try:
        parsed = urlparse(url.replace("postgresql+asyncpg://", "postgresql://"))
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    port = parsed.port
    if port == 6543:
        return True
    if "pooler.supabase" in host:
        return True
    return False


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


DB_URL = settings.SUPABASE_DATABASE_URL
DB_POOL_MODE = os.getenv("DB_POOL_MODE", "auto").lower()
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_PRE_PING = _as_bool(os.getenv("DB_POOL_PRE_PING"), True)
DB_ECHO = _as_bool(os.getenv("DB_ECHO"), False)

if DB_POOL_MODE == "auto":
    _is_pgbouncer = _detect_pgbouncer(DB_URL)
elif DB_POOL_MODE == "pgbouncer":
    _is_pgbouncer = True
elif DB_POOL_MODE == "direct":
    _is_pgbouncer = False
else:
    _is_pgbouncer = _detect_pgbouncer(DB_URL)


if _is_pgbouncer:
    # Transaction-mode pgBouncer: no server-side prepared statements survive
    # between checkouts, so asyncpg's caches must be disabled and we can't reuse
    # connections ourselves (pgBouncer is the pool).
    engine = create_async_engine(
        DB_URL,
        echo=DB_ECHO,
        poolclass=NullPool,
        pool_recycle=DB_POOL_RECYCLE,
        execution_options={"compiled_cache": None},
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "server_settings": {"jit": "off"},
        },
    )
else:
    # Direct Postgres (or session-mode pooler): real pooling + asyncpg caches.
    pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    engine = create_async_engine(
        DB_URL,
        echo=DB_ECHO,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=DB_POOL_TIMEOUT,
        pool_recycle=DB_POOL_RECYCLE,
        pool_pre_ping=DB_POOL_PRE_PING,
    )


AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
