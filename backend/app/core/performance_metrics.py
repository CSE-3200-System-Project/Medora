"""Request-local SQL timing used by the Server-Timing response header."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass
from time import perf_counter
from typing import Any

from sqlalchemy import event

from app.db.session import engine


@dataclass
class RequestPerformance:
    query_count: int = 0
    database_ms: float = 0.0
    profile_cache: str = "unused"


_current: ContextVar[RequestPerformance | None] = ContextVar(
    "request_performance",
    default=None,
)


def begin_request_metrics() -> tuple[RequestPerformance, Token]:
    metrics = RequestPerformance()
    return metrics, _current.set(metrics)


def end_request_metrics(token: Token) -> None:
    _current.reset(token)


def mark_profile_cache(hit: bool) -> None:
    metrics = _current.get()
    if metrics is not None:
        metrics.profile_cache = "hit" if hit else "miss"


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(
    conn: Any,
    _cursor: Any,
    _statement: Any,
    _parameters: Any,
    _context: Any,
    _executemany: Any,
) -> None:
    conn.info.setdefault("_medora_query_started", []).append(perf_counter())


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(
    conn: Any,
    _cursor: Any,
    _statement: Any,
    _parameters: Any,
    _context: Any,
    _executemany: Any,
) -> None:
    starts = conn.info.get("_medora_query_started")
    started = starts.pop() if starts else perf_counter()
    metrics = _current.get()
    if metrics is not None:
        metrics.query_count += 1
        metrics.database_ms += (perf_counter() - started) * 1000
