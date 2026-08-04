# Medora Documentation Index

**Medora** — AI-native healthcare platform for Bangladesh. Full-stack: Next.js 16 frontend, FastAPI backend, dedicated OCR microservice.

---

## Developer Reference (Start Here)

These docs are verified against actual code and reflect the current implementation:

### Architecture
| Document | What it covers |
|---|---|
| [architecture/frontend.md](./architecture/frontend.md) | App Router structure, Server Actions, components, PWA, i18n |
| [architecture/backend.md](./architecture/backend.md) | FastAPI routes, services, auth flow, startup lifecycle |
| [architecture/database.md](./architecture/database.md) | All models, relationships, enums, indexes |
| [architecture/ai-system.md](./architecture/ai-system.md) | AI orchestrator, Chorui assistant, OCR microservice pipeline |

### Workflows (End-to-End Flows)
| Document | What it covers |
|---|---|
| [workflows/onboarding.md](./workflows/onboarding.md) | Patient registration, doctor onboarding wizard, admin verification |
| [workflows/appointments.md](./workflows/appointments.md) | Booking, soft-holds, reschedule, cancellation, reminders, Google Calendar |
| [workflows/ai-flows.md](./workflows/ai-flows.md) | Chorui navigation, AI doctor search, SOAP notes, OCR, consent guard |

### API & System
| Document | What it covers |
|---|---|
| [api/routes.md](./api/routes.md) | All 28 route modules, every endpoint with method/path/auth |
| [system/data-flow.md](./system/data-flow.md) | Request lifecycle, auth path, AI data path, OCR path, background loops |
| [system/realtime.md](./system/realtime.md) | Supabase Realtime, push notifications, reminder dispatcher, hold expiry |

---

## Supplementary Docs

Narrower or point-in-time material. Where these disagree with the developer reference
above on current behavior, the developer reference and the code win.

| Document | Description |
|---|---|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | High-level system overview |
| [FEATURES_INVENTORY.md](./FEATURES_INVENTORY.md) | Feature list across roles |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, CI/CD, environment setup |
| [TESTING_REPORT.md](./TESTING_REPORT.md) | Test coverage and benchmarks |
| [DIAGRAMS_DOCUMENTATION.md](./DIAGRAMS_DOCUMENTATION.md) | Architecture diagrams |
| [chorui-ai-pipeline.md](./chorui-ai-pipeline.md) | Chorui AI pipeline (see ai-system.md for current version) |
| [pwa-doc.md](./pwa-doc.md) | PWA service worker details |
| [GOOGLE_CALENDAR_INTEGRATION.md](./GOOGLE_CALENDAR_INTEGRATION.md) | Google Calendar OAuth details |
| [vapi-voice-integration.md](./vapi-voice-integration.md) | Vapi voice call integration |
| [backend-implementation-prd.md](./backend-implementation-prd.md) | Original backend PRD |
| [frontend-implementation-prd.md](./frontend-implementation-prd.md) | Original frontend PRD |

## Archive

Superseded planning and reporting documents from earlier in development, kept for
history rather than reference: [docs/archive/](./archive/).

---

## Quick Reference

**Codebase layout:**
```
/frontend    — Next.js 15 app (React 19, TypeScript, Tailwind, Serwist)
/backend     — FastAPI app (Python, SQLAlchemy 2.x, asyncpg)
/ai_service  — OCR microservice (FastAPI, Azure Document Intelligence, YOLO, PaddleOCR)
/docs        — This documentation
/observability — Prometheus + Grafana config
/tests       — Integration / E2E tests
```

**Key numbers (verified from code):**
- 26 backend route modules, ~220 endpoints
- 25 SQLAlchemy model files, 40+ mapped classes
- 58 Alembic migrations
- 20 Server Action modules
- 2 OCR endpoints (prescription + medical report)
- 3 AI providers (Groq, Gemini, Cerebras) — switched via `AI_PROVIDER` env var
- 12 appointment statuses
- i18n: English + Bangla
