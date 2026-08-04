# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RESPONSE DEFAULTS (apply to every reply unless I override):
- Answer directly. No preamble, filler, affirmations, or trailing summary clauses.
- Use plain prose or tight lists. No decorative headers for short answers.
- Do not use Extended Thinking or web search unless my prompt is explicitly complex or time-sensitive.
- If a task is simple (formatting, grammar, short translation), note once that Haiku may suffice.
- At 15+ messages, offer once to summarize key context for a fresh chat.
- If I request a correction, note once that editing my last message saves tokens.”
- You need to decide yourself for the complexity and the scale of the work you are enforced with, which model at which effort should be the best one then send a reminder note to me check before proceeding to work. So always note which model at which effort should be sufficient to carry out a task in your response/ plan.

## Non-Negotiable Working Rules

From `.github/copilot-instructions.md` — these apply to every task:

1. **Never create or recreate Python virtual environments.** `backend/venv` and `ai_service/venv` already exist and are user-managed. Activate them; never rebuild them.
2. **Plan before coding.** Write the plan as a todo list in `tasks/todo.md`, get it verified, then work through it marking items done. Add a review section summarizing changes when finished.
3. **Minimal blast radius.** Every change should touch as little code as possible. No sweeping refactors bundled into a fix.
4. **Root-cause fixes only.** No temporary patches or workarounds.
5. **Medical safety constraint.** Never write code that diagnoses, prescribes, or makes autonomous medical decisions. AI features are assistive only — they summarize, structure, and suggest for a human clinician to approve.
6. **No emojis in UI.** Vector icons (lucide-react) only.

## Commands

### Backend (FastAPI, Python)
```powershell
cd backend; .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload            # dev server on :8000

alembic revision --autogenerate -m "msg" # create migration
alembic upgrade head                     # apply migrations
alembic downgrade -1                     # roll back one
```

### Frontend (Next.js 16, React 19)
```powershell
cd frontend
npm run dev                  # turbopack dev server on :3000
npm run build                # production build (webpack, not turbopack)
npm run lint                 # eslint
npm run perf:bundle-budget   # enforce bundle size budget
npm run perf:lhci:mobile     # Lighthouse CI mobile run
```

### AI OCR Service
```powershell
cd ai_service; .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8001
```

### Tests
The main suites live at the repo root in `tests/`, **not** inside `backend/`, and are driven by two pytest configs that are not auto-discovered — the `-c` flag is required.

```bash
./run_tests.sh                          # full suite (bash; git-bash works on Windows)
MEDORA_SKIP_DOCKER=1 ./run_tests.sh     # skip docker-backed integration + security
E2E_ENABLED=1 ./run_tests.sh            # additionally run Playwright E2E

# Individual suites
MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini tests/unit/backend
MEDORA_TEST_TARGET=ai_service pytest -c tests/pytest.ai.ini tests/unit/ai_service

# Single file / single test
MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini tests/unit/backend/test_foo.py
MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini tests/unit/backend/test_foo.py::test_case

# Older tests also exist under backend/tests/ with backend/pytest.ini (Chorui engine, smoke)
cd backend; pytest tests/
```

`asyncio_mode = auto` is set — async test functions need no decorator. Markers: `backend`, `integration`, `security`, `contract`.

```bash
./run_benchmarks.sh          # writes to tests/benchmarks/reports/current
```

## Architecture

Three deployable services plus Supabase-hosted Postgres:

```
frontend/       Next.js 16 App Router (PWA via Serwist, EN+BN via next-intl)
backend/        FastAPI + async SQLAlchemy 2.x + asyncpg + Alembic
ai_service/     OCR microservice (Azure Document Intelligence → PaddleOCR fallback, YOLO)
observability/  Prometheus + Grafana config
```

### The rule that shapes the entire frontend

**The browser never talks to FastAPI.** Every read and write goes: client component → Server Action in `frontend/lib/*-actions.ts` → Next.js server process → HTTP + Bearer JWT → FastAPI. There is no `middleware.ts`; auth and role guards live inside route-group layouts (`(home)/layout.tsx`, `(admin)/admin/layout.tsx`) and inside the Server Actions themselves.

Server Actions read the Supabase session JWT and forward it; after a mutation they call `revalidatePath()`/`revalidateTag()`. Real-time slot availability is the sole exception — `use-realtime-slots.ts` subscribes to a Supabase Realtime channel directly from the browser.

`BACKEND_URL` vs `NEXT_PUBLIC_BACKEND_URL` is used inconsistently across action files. Prefer `BACKEND_URL` (server-only) for new code.

### Backend request lifecycle

```
Request → CORSMiddleware → performance-header middleware (X-Response-Time, Server-Timing)
  → Depends(get_db)                  opens AsyncSession from AsyncSessionLocal
  → Depends(get_current_user_token)  verify_jwt() then SELECT profiles WHERE id=sub,
                                     attaches .profile to the user object + ban check
  → route handler → service layer → SQLAlchemy
```

**RLS is bypassed — every route owns its own authorization.** `docs/architecture/backend.md` and `docs/system/data-flow.md` claim `get_db` injects `request.jwt` via `set_config()` to enable row-level security. It does not; see the docstring in `app/core/dependencies.py`. The backend connects with a direct password-authenticated asyncpg connection, so Postgres RLS never applies. Never assume the database will scope rows to the caller.

Two auth dependency families exist and are not interchangeable:
- `get_current_user` / `require_doctor` (`app/core/dependencies.py`) — returns a `Profile` ORM object.
- `get_current_user_token` (`app/routes/auth.py`) — returns a `SimpleNamespace` with `.id`, `.email`, `.profile`. This is the more widely used one and it pre-loads the profile. Use `resolve_profile(db, user)` / `require_role(...)` from `dependencies.py` instead of re-querying `Profile`.

Admin routes define their own `require_admin` inside `admin.py`.

### Startup lifecycle (`backend/app/main.py`)

The lifespan context manager does considerably more than wire up routes:
1. Preloads the Faster-Whisper ASR model. Set `PRELOAD_WHISPER_ON_STARTUP=false` for fast local iteration.
2. Runs **idempotent schema self-heal** — raw `ALTER TABLE IF EXISTS` / `CREATE INDEX IF NOT EXISTS` statements patching known drift between Alembic and long-lived dev databases (`appointments.hold_expires_at`/`completed_at`/`revenue_amount`, `doctor_profiles.total_revenue`, `appointment_reschedule_requests` response columns, `health_data_consents.share_medical_tests`). If a column keeps going missing in dev databases this is where the band-aid goes — but the Alembic migration is still required.
3. Backfills missing avatar URLs.
4. Launches three background asyncio loops: `reminder_dispatcher`, `_run_hold_expiry_loop` (expires soft-held appointments every 60s), `_run_auto_complete_loop` (auto-completes overdue appointments every 120s).

### Layers

- `app/routes/` — 27 modules, ~220 endpoints. Several are very large: `ai_consultation.py` (5.3k lines), `admin.py` (2.4k), `consultation.py` (2.2k), `appointment.py` (2.1k).
- `app/services/` — business logic. `appointment_service.py` (1.7k lines) owns the appointment state machine and soft-hold expiry; `slot_service.py` owns slot math; `ai_orchestrator.py` is the single provider-agnostic LLM interface.
- `app/core/` — `config.py` (all settings via Pydantic BaseSettings), `security.py` (JWT via JWKS with a 5-min cache plus Supabase fallback), `dependencies.py`, `pagination.py`, and the privacy stack.
- `app/schemas/` — Pydantic v2 request/response contracts.
- `app/db/models/` — SQLAlchemy 2.0 `Mapped[...]` / `mapped_column` style. JSON columns carry nested medical data (medications, allergies, education, visiting_hours).

### The AI privacy stack (do not bypass)

Every LLM call passes through layered guards. Reuse them for any new AI feature:

| Module | Role |
|---|---|
| `core/data_sharing_guard.py` | Reads `health_data_consents` + `patient_data_sharing`, returns allowed categories, filters the payload |
| `core/ai_privacy.py` | Redacts emails/phones, hashes identifiers, strips name patterns |
| `core/patient_reference.py` | Stable pseudonymous patient ID — raw UUIDs never reach an LLM or the AI logs |
| `services/ai_orchestrator.py` | Sanitizes input, calls the provider, validates output against a Pydantic model, logs latency to `ai_interactions` |

Doctor→patient data reads are logged to `patient_access`. OCR calls to `ai_service` carry an `X-Medora-Subject-Token` pseudonym, never a real ID. `AI_PROVIDER` selects between `groq` / `gemini` / `cerebras`; the orchestrator is the only place that knows the difference.

### Chorui (the in-app assistant)

Intent → route resolution is a three-file pipeline: `chorui_intent_normalizer.py` (utterance → canonical intent) → `chorui_navigation_registry.py` (immutable tuple of intent→route→required-params entries; admin routes deliberately excluded) → `chorui_navigation_engine.py` (role-aware resolution, missing-param handling, fallbacks). Adding a navigable destination means adding a registry entry, not branching in the engine.

### Pagination contract

`app/core/pagination.py` defines the canonical contract shared by backend, AI service, and frontend:
- Query params: `limit` (default 20, max 100) + `offset`. Aliases `page` (1-indexed) + `size` resolve to the same thing; canonical form wins if both are sent.
- Response envelope: `{ items, total, limit, offset, has_more, page, page_size, total_pages }`.
- Inject with `params: PaginationParams = Depends(pagination_params(default_limit=20, max_limit=100))`; build responses with `Page[T]` or `make_page(...)`.
- Frontend counterparts: `frontend/lib/pagination.ts`, `frontend/lib/use-server-pagination.ts`.

New list endpoints must use this — do not hand-roll `skip`/`take`.

## Database & Performance

Current config is the dominant source of slow page loads. Know these before touching query code:

1. **The DB URL points at Supabase's transaction-mode pgBouncer** (`...pooler.supabase.com:6543`). `app/db/session.py` auto-detects this and switches to `NullPool`, so **every request opens a fresh TCP+TLS+auth connection**. `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` in `backend/.env` are silently ignored in this mode.
2. **`execution_options={"compiled_cache": None}` is set in the pgBouncer branch.** That disables SQLAlchemy's ORM→SQL *compilation* cache, which is client-side and unrelated to pgBouncer. Only asyncpg's `statement_cache_size=0` is actually required for transaction pooling; the compiled-cache kill costs real CPU on every query.
3. **The database is in ap-south-1 (Mumbai); the backend deploys to Azure `medora-rg-us`.** Cross-region round-trip latency multiplies against every sequential query.
4. **Queries are sequential.** `asyncio.gather` appears exactly once in the entire backend (`push_service.py`). Endpoints such as `/patient/dashboard` issue ~8 independent `await db.execute(...)` calls in series.
5. **Eager loading is barely used.** 59 `selectinload`/`joinedload` references across only 4 route modules; only 4 relationships declare `lazy="selectin"`. On an `AsyncSession` lazy loads raise rather than silently N+1, so the established pattern is an explicit JOIN followed by manual dict-building — see `patient_dashboard.py:216-231` for the intended shape.
6. **The frontend never caches.** 77 `fetch` calls in `frontend/lib/` use `cache: "no-store"`; only two use `next: { revalidate }`. Every RSC render is a fresh backend round trip.

Existing index work: migrations `7f9c1b2d3e4f_add_performance_indexes.py`, `p3rf_001_hot_path_composite_indexes.py`, `p3rf_002_add_query_path_indexes.py`, `pag_idx_001_add_pagination_indexes.py`.

Set `DB_ECHO=true` to log SQL. `X-Response-Time` and `Server-Timing` headers are on every response.

## Conventions

- **Naming across the boundary**: frontend is camelCase, backend is snake_case. Server Actions convert explicitly in the payload — there is no automatic mapper.
- **Adding an onboarding field**: model (`app/db/models/patient.py` or `doctor.py`) → schema (`app/schemas/onboarding.py`) → route PATCH *and* GET (`app/routes/profile.py`) → `alembic revision --autogenerate` (use `server_default` for NOT NULL columns on existing tables) → frontend form state + UI + payload conversion.
- **Styling**: Tailwind with CSS variables only (`bg-primary`, `text-foreground`, `border-border`), never hardcoded palette classes (`bg-blue-500`, `text-gray-600`). Mobile-first: base classes target mobile, then `sm:`/`md:`/`lg:`. Minimum 44×44px touch targets.
- **UI primitives**: `frontend/components/ui/` — Radix + `cva` variants + `data-slot` attributes + `cn()` merging. Button carries custom `medical` / `transaction` / `emergency` variants.
- **i18n**: all user-facing strings live in `frontend/i18n/messages/{en,bn}/*.json`. No hardcoded copy — Bangla must not break layout.
- **Enums**: `backend/app/db/models/enums.py` is the single source (12 appointment statuses, roles, verification states).
- **Admin bootstrap**: `UPDATE profiles SET role = 'ADMIN' WHERE email = '...'`.

## Docs

`docs/INDEX.md` is the entry point. `docs/architecture/*` and `docs/workflows/*` are the maintained developer reference; everything under "Legacy / Academic Docs" in that index, plus `docs/defense/` and `tasks/*.md`, is historical and may not match current code. Where docs and code disagree the code wins — the RLS claim above is a live example.

---

## Design Context

### Users
Medora is for patients and doctors equally across core healthcare workflows.
Users often interact in high-stakes moments where speed, clarity, and confidence are critical.
Core jobs to be done:
- Patients: find care, book appointments, manage history/prescriptions/reminders, and follow treatment plans.
- Doctors: manage schedules, assess patient context, conduct consultations, and issue structured prescriptions.
- Admin workflow can remain operationally clear, but design priority should stay balanced between patient and doctor experiences.

### Brand Personality
Brand personality: Trustworthy, Reliable, Modern, Calm.
The interface should feel like a professional-grade medical platform: confident, polished, and operationally mature.
No playful or gimmicky direction that weakens trust.

### Aesthetic Direction
Use a clean, premium medical aesthetic grounded in the existing token system and medical-blue identity.
Maintain strict visual parity across light and dark themes on all screens.
Motion should feel fluid and smooth (not stiff), while staying performant and controlled on all device sizes.
Design must support Bangla as well as English without breaking hierarchy, spacing, or readability.

### Design Principles
1. Safety-First Clarity
Every screen should reduce cognitive load in healthcare-critical tasks using clear hierarchy, plain labels, and explicit states.

2. Trust Through Professional Consistency
Use consistent spacing, typography, and component behavior so the product feels reliable across all flows and roles.

3. Medical-Blue Visual Discipline
Keep the blue-led palette as the anchor; use restrained accents and avoid saturated, mismatched, or novelty-heavy color combinations.

4. Smooth Motion, High Performance
Interactions should feel fluid and modern, but animation must remain purposeful, fast, and stable across low- and high-end devices.

5. Bilingual-Ready System Design
Components, typography, and layouts must gracefully support both Bangla and English content at all breakpoints.
