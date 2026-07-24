from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routes.health import health_check, readiness_check


@pytest.mark.asyncio
async def test_health_check_does_not_touch_database() -> None:
    assert await health_check() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readiness_check_queries_database() -> None:
    db = AsyncMock()

    assert await readiness_check(db) == {"status": "ok", "database": "connected"}
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_readiness_check_returns_503_without_leaking_error() -> None:
    db = AsyncMock()
    db.execute.side_effect = RuntimeError("secret database hostname")

    with pytest.raises(HTTPException) as exc_info:
        await readiness_check(db)

    assert exc_info.value.status_code == 503
    assert "secret database hostname" not in str(exc_info.value.detail)
