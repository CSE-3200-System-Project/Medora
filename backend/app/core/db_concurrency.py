"""Run independent read-only queries concurrently.

A single ``AsyncSession`` cannot execute overlapping queries — the underlying
asyncpg connection is not concurrency-safe and SQLAlchemy raises on concurrent
use. So ``asyncio.gather`` over ``db.execute`` on one shared session does not
work. Each branch here gets its own short-lived session, and therefore its own
pooled connection.

This exists because the database is remote: an endpoint issuing eight dependent-
looking-but-actually-independent queries pays eight serial round trips. Running
them in one wave collapses that to roughly one.

Constraints for anything passed in:
  * Reads only. Nothing here commits, and a failure mid-wave leaves no
    transaction to roll back.
  * Return plain scalars, rows, or fully-loaded ORM objects. ``AsyncSessionLocal``
    sets ``expire_on_commit=False`` so already-loaded attributes stay readable
    after the session closes, but touching an unloaded lazy relationship on a
    returned object will fail — its session is gone.
  * Concurrency multiplies pool usage. A process-wide limiter caps aggregate
    fan-out across all requests; ``max_concurrency`` additionally caps one wave.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal

ReadQuery = Callable[[AsyncSession], Awaitable[Any]]

# One limiter per Uvicorn worker. With the production default of one worker and
# no pool overflow, fan-out can use at most four of the five pooled clients,
# leaving capacity for ordinary request sessions and background work.
_process_read_semaphore = asyncio.Semaphore(max(1, settings.DB_READ_CONCURRENCY))


async def _run_isolated(query: ReadQuery, request_semaphore: asyncio.Semaphore) -> Any:
    async with request_semaphore:
        async with _process_read_semaphore:
            async with AsyncSessionLocal() as session:
                return await query(session)


async def gather_reads(*queries: ReadQuery, max_concurrency: int = 4) -> list[Any]:
    """Execute read-only queries concurrently, returning results in input order.

    Each callable receives its own ``AsyncSession``. If one raises, the exception
    propagates; the remaining queries run to completion and close their own
    sessions, so nothing leaks.
    """
    if not queries:
        return []

    if max_concurrency < 1:
        raise ValueError("max_concurrency must be at least 1")

    request_semaphore = asyncio.Semaphore(max_concurrency)
    return await asyncio.gather(
        *(_run_isolated(query, request_semaphore) for query in queries)
    )
