from __future__ import annotations

import asyncio

import app.core.db_concurrency as concurrency


def test_gather_reads_enforces_process_wide_limit(monkeypatch) -> None:
    active = 0
    peak = 0

    class SessionContext:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, exc_type, exc, traceback):
            return False

    monkeypatch.setattr(concurrency, "AsyncSessionLocal", SessionContext)
    monkeypatch.setattr(concurrency, "_process_read_semaphore", asyncio.Semaphore(2))

    async def query(_session):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        return peak

    async def run():
        return await concurrency.gather_reads(
            query,
            query,
            query,
            query,
            query,
            max_concurrency=5,
        )

    results = asyncio.run(run())
    assert len(results) == 5
    assert peak == 2


def test_gather_reads_rejects_invalid_request_limit() -> None:
    async def run():
        try:
            await concurrency.gather_reads(lambda _session: None, max_concurrency=0)
        except ValueError as exc:
            return str(exc)
        raise AssertionError("Expected ValueError")

    assert "at least 1" in asyncio.run(run())
