# Repository Guidelines

## Project Structure & Module Organization

Medora has three applications:

- `frontend/`: Next.js 16/React 19 UI. Routes live in `app/`, reusable UI in `components/`, server actions and utilities in `lib/`, translations in `i18n/`, and static files in `public/`.
- `backend/`: FastAPI API. Keep endpoints in `app/routes/`, domain logic in `app/services/`, validation models in `app/schemas/`, database models in `app/db/models/`, and migrations in `alembic/versions/`.
- `ai_service/`: FastAPI OCR pipeline, parsers, matching logic, and model assets.

Cross-service tests are under `tests/{unit,integration,security,e2e,performance,benchmarks}`; backend smoke tests also exist in `backend/tests/`. Architecture and workflow notes belong in `docs/`.

## Build, Test, and Development Commands

- `cd frontend && npm ci && npm run dev`: install locked dependencies and start the UI on port 3000.
- `cd frontend && npm run lint && npm run build`: run Next.js ESLint checks and a production build.
- `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`: run the core API.
- `cd ai_service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8001`: run OCR locally.
- `bash run_tests.sh`: run unit suites plus Docker-backed integration/security tests. Set `MEDORA_SKIP_DOCKER=1` for a fast local pass or `E2E_ENABLED=1` to include Playwright.

Apply database changes from `backend/` with `alembic upgrade head`.

## Coding Style & Naming Conventions

Use four spaces in Python and two in TypeScript/TSX. Follow `snake_case` for Python modules/functions, `PascalCase` for classes and React components, `camelCase` for TypeScript values, and `useXxx` for hooks. TypeScript is strict; prefer the `@/` import alias and typed props over `any`. Run `npm run lint` before submitting frontend changes. No repository-wide Python formatter is configured, so preserve nearby patterns.

## Testing Guidelines

Pytest discovers `test_*.py`; Playwright uses `tests/e2e/specs/*.spec.ts`. Add tests at the narrowest appropriate level and mark Docker-dependent cases with the registered `integration`, `security`, or `contract` markers. Run targeted suites with `MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini` or `MEDORA_TEST_TARGET=ai_service pytest -c tests/pytest.ai.ini`. There is no fixed coverage threshold; new behavior and regressions should receive focused tests.

## Commit & Pull Request Guidelines

History follows Conventional Commit-style subjects such as `feat: Add pagination` and `fix: update hero carousel`. Use an imperative, scoped summary and keep unrelated changes separate. Pull requests should explain behavior and architecture impact, link the issue/task, list verification commands, call out migrations or environment changes, and include screenshots for UI work. Never commit credentials from `.env` files; update example environment files with placeholder values instead.
