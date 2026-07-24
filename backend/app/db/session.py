"""
Async SQLAlchemy engine & session factory.

Supabase can be reached three ways, and the right engine config differs for each:

  1. Direct connection (port 5432)          → real pooling + prepared statements OK
  2. Session-mode pooler (port 5432 pooler) → real pooling + prepared statements OK
  3. Transaction-mode pgBouncer (port 6543) → MUST disable prepared-statement caches

All three use a real client-side pool. pgBouncer multiplexes *server* connections
per transaction, but the client↔pgBouncer TCP+TLS session is ours to hold open —
so transaction mode only rules out server-side prepared statements, not pooling.
(This module previously used NullPool in mode 3, which made every request pay a
full handshake before its first query.)

We auto-detect (1)/(2) vs (3) from the URL but allow explicit override via env.
Overrides (all optional):

  DB_POOL_MODE              = "auto" | "direct" | "pgbouncer"   (default "auto")
  DB_POOL_SIZE              = int  (default 5)
  DB_MAX_OVERFLOW           = int  (default 0)
  DB_POOL_TIMEOUT           = int seconds (default 10)
  DB_POOL_RECYCLE           = int seconds (default 300)
  DB_POOL_PRE_PING          = "true"|"false" (default "false")
  DB_ECHO                   = "true"|"false" (default "false")
"""

from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

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


DB_URL = settings.SUPABASE_DATABASE_URL
DB_POOL_MODE = settings.DB_POOL_MODE.lower()
DB_POOL_RECYCLE = settings.DB_POOL_RECYCLE
DB_POOL_TIMEOUT = settings.DB_POOL_TIMEOUT
DB_POOL_PRE_PING = settings.DB_POOL_PRE_PING
DB_ECHO = settings.DB_ECHO

if DB_POOL_MODE == "auto":
    _is_pgbouncer = _detect_pgbouncer(DB_URL)
elif DB_POOL_MODE == "pgbouncer":
    _is_pgbouncer = True
elif DB_POOL_MODE == "direct":
    _is_pgbouncer = False
else:
    _is_pgbouncer = _detect_pgbouncer(DB_URL)


# Keep pool_size * replica_count under the Supabase pooler's client connection
# limit — Azure Container Apps can scale this process horizontally.
pool_size = settings.DB_POOL_SIZE
max_overflow = settings.DB_MAX_OVERFLOW

_engine_kwargs: dict = {
    "echo": DB_ECHO,
    "pool_size": pool_size,
    "max_overflow": max_overflow,
    "pool_timeout": DB_POOL_TIMEOUT,
    "pool_recycle": DB_POOL_RECYCLE,
    # Costs one extra cross-region round trip per checkout. Optimistic
    # invalidation plus a short recycle window avoids paying that cost on every
    # request. Set true only when the pooler is observed dropping live clients.
    "pool_pre_ping": DB_POOL_PRE_PING,
}

if _is_pgbouncer:
    # Transaction-mode pgBouncer: no server-side prepared statement survives
    # between transactions, so both statement caches must be off. SQLAlchemy's
    # compiled_cache is a client-side SQL-string cache and is unaffected by
    # pgBouncer — leaving it enabled avoids re-compiling every ORM statement.
    _engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "server_settings": {"jit": "off"},
    }

engine = create_async_engine(DB_URL, **_engine_kwargs)


AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
