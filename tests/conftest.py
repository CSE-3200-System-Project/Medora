from __future__ import annotations

import importlib
import os
import pkgutil
import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET = (os.getenv("MEDORA_TEST_TARGET") or "backend").strip().lower()


def _ensure_path(path: Path) -> None:
    candidate = str(path)
    if candidate not in sys.path:
        sys.path.insert(0, candidate)


def _configure_backend_env_defaults() -> None:
    os.environ.setdefault(
        "SUPABASE_DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    )
    os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
    os.environ.setdefault("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature")
    os.environ.setdefault(
        "SUPABASE_SERVICE_ROLE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.service",
    )
    os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "medora-test")
    os.environ.setdefault("AI_PROVIDER", "groq")
    os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
    os.environ.setdefault("GROQ_MODEL", "llama-3.1-8b-instant")
    os.environ.setdefault("AI_OCR_SERVICE_URL", "http://localhost:8001")
    os.environ.setdefault("CHORUI_PRIVACY_MODE", "strict_local")
    os.environ.setdefault("PRELOAD_WHISPER_ON_STARTUP", "false")
    os.environ.setdefault("REMINDER_DISPATCH_ENABLED", "false")
    os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")


def _configure_ai_service_env_defaults() -> None:
    os.environ.setdefault("MODEL_TYPE", "read")
    os.environ.setdefault("AZURE_OCR_ENDPOINT", "https://example.cognitiveservices.azure.com")
    os.environ.setdefault("AZURE_OCR_KEY", "fake-azure-key")
    os.environ.setdefault("SUPABASE_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    os.environ.setdefault("OCR_USE_FULL_IMAGE_FALLBACK", "false")
    os.environ.setdefault("DISABLE_MEDICINE_MATCHING", "true")


if TARGET == "ai_service":
    _ensure_path(REPO_ROOT / "ai_service")
    _configure_ai_service_env_defaults()
else:
    _ensure_path(REPO_ROOT / "backend")
    _configure_backend_env_defaults()


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "backend: backend-only tests")
    config.addinivalue_line("markers", "ai_service: ai_service-only tests")
    config.addinivalue_line("markers", "integration: integration tests requiring docker/postgres")
    config.addinivalue_line("markers", "security: security and RBAC validation tests")
    config.addinivalue_line("markers", "contract: API and schema contract tests")
    config.addinivalue_line("markers", "e2e: Playwright end-to-end browser tests")
    config.addinivalue_line("markers", "performance: performance and load benchmarks")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    skip_backend = pytest.mark.skip(reason="Set MEDORA_TEST_TARGET=backend to run backend suites.")
    skip_ai = pytest.mark.skip(reason="Set MEDORA_TEST_TARGET=ai_service to run ai_service suites.")

    for item in items:
        path_text = str(item.fspath).replace("\\", "/")
        if "/tests/unit/ai_service/" in path_text and TARGET != "ai_service":
            item.add_marker(skip_ai)
        if (
            "/tests/unit/backend/" in path_text
            or "/tests/integration/backend/" in path_text
            or "/tests/security/" in path_text
        ) and TARGET != "backend":
            item.add_marker(skip_backend)


@pytest.fixture(scope="session")
def backend_models_loaded() -> None:
    if TARGET != "backend":
        return

    models_dir = REPO_ROOT / "backend" / "app" / "db" / "models"
    for module_info in pkgutil.iter_modules([str(models_dir)]):
        if module_info.name.startswith("__"):
            continue
        importlib.import_module(f"app.db.models.{module_info.name}")


@pytest.fixture(scope="session")
def postgres_container():
    if TARGET != "backend":
        pytest.skip("Postgres test container is backend-only.")
    if os.getenv("MEDORA_SKIP_DOCKER") == "1":
        pytest.skip("Skipping docker-backed tests (MEDORA_SKIP_DOCKER=1).")

    testcontainers = pytest.importorskip("testcontainers.postgres")
    PostgresContainer = testcontainers.PostgresContainer

    try:
        container = PostgresContainer("postgres:16-alpine")
        container.start()
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"Docker/Postgres is unavailable: {exc}")

    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def postgres_async_url(postgres_container) -> str:
    sync_url = postgres_container.get_connection_url()
    if sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return sync_url


@pytest.fixture(scope="session")
async def backend_engine(postgres_async_url: str, backend_models_loaded):
    if TARGET != "backend":
        pytest.skip("Backend engine fixture is backend-only.")

    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(postgres_async_url, future=True, pool_pre_ping=True)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def db_session(backend_engine):
    if TARGET != "backend":
        pytest.skip("DB session fixture is backend-only.")

    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.db.base import Base

    async with backend_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(backend_engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def backend_client(db_session) -> AsyncGenerator:
    if TARGET != "backend":
        pytest.skip("Backend API client is backend-only.")

    from httpx import ASGITransport, AsyncClient

    from app.core.dependencies import get_db
    from app.main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def auth_token_map(monkeypatch):
    if TARGET != "backend":
        pytest.skip("Auth token fixture is backend-only.")

    from fastapi import HTTPException, status

    token_map: dict[str, dict[str, str]] = {}

    async def _fake_verify(token: str):
        payload = token_map.get(token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return payload

    import app.core.security as security_module
    import app.routes.auth as auth_module

    monkeypatch.setattr(security_module, "verify_jwt", _fake_verify)
    monkeypatch.setattr(auth_module, "verify_jwt", _fake_verify)
    return token_map


@pytest.fixture
async def ai_client():
    if TARGET != "ai_service":
        pytest.skip("AI OCR client is ai_service-only.")

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
