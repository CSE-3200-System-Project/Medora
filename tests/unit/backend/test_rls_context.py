from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

import app.core.dependencies as dependencies_module


@dataclass
class FakeSession:
    executed: list[str] = field(default_factory=list)

    async def execute(self, statement):
        self.executed.append(str(statement))


class FakeSessionContextManager:
    def __init__(self, session: FakeSession):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_get_db_yields_session_without_fake_rls_context(monkeypatch) -> None:
    fake_session = FakeSession()
    monkeypatch.setattr(
        dependencies_module,
        "AsyncSessionLocal",
        lambda: FakeSessionContextManager(fake_session),
    )

    async def _run() -> None:
        generator = dependencies_module.get_db(authorization="Bearer token-abc")
        yielded_session = await generator.__anext__()
        assert yielded_session is fake_session
        await generator.aclose()

    asyncio.run(_run())
    # Direct password-authenticated backend connections use a BYPASSRLS role.
    # Authorization is application-owned; no request.jwt setting is injected.
    assert fake_session.executed == []
