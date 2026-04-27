# Medora Defense Guide — 01. Overview & Methodology

> One-stop notes to walk a reviewer through Chapters 1–3 of the report and Slides 1–9 of `Medora_Presentation`. Everything here is grounded in `docs/reports/2107006_2107031.pdf`.

---

## 1. Elevator pitch (Abstract, p. iii)

Medora is an **AI-native, consent-aware, bilingual healthcare platform for Bangladesh** that fuses authenticated appointment booking, prescription OCR, telemedicine context, and safety-bounded AI assistance into one Next.js + FastAPI + dedicated AI/OCR microservice stack on Supabase.

If asked "in one breath, what is Medora?":
> "A production-grade, role-based PWA where patients, doctors, and admins share a single Bangla/English application surface. It does real-time appointment booking, YOLO + Azure-DI OCR of paper prescriptions, schema-validated multi-provider LLM orchestration, and consent-gated patient records — all behind explicit safety guardrails, with observability and CI performance budgets enforced."

Three numbers to memorise: **194 backend endpoints**, **47 Alembic migrations**, **~10.5 s** (abstract) / **~3.5 s** (Chapter 4 measured) OCR end-to-end. If asked about the discrepancy: the abstract reports the conservative end-to-end including upload + queueing, Chapter 4 Table 4.2 reports the per-document model time inside the OCR microservice.

---

## 2. Problem statement (§1.1–1.2)

Bangladeshi patients juggle ≥4 disconnected systems: Google/referral search → appointment portals (DocTime, Doctorola, GoodDoktor) → in-person/telemed visit → paper prescription. This causes:

- Missed visits (no notification continuity).
- Duplicate tests (no longitudinal records).
- Medication errors (illegible Rx, no structured dose data).
- Disputes (no auditable proof trail).
- Consent violations (data shared with no patient control).

Existing players each cover *one* slice; **none** combine structured records + real-time scheduling + OCR + safe AI + bilingual UI under one consent model. Table 2.1 (p. 15) is the canonical gap chart — Medora is the only row with `Yes` across all 7 columns.

If a reviewer says *"isn't this just another telemedicine app?"* — answer with Table 2.1 and §1.5.

---

## 3. Objectives (§1.3) — Memorise verbatim

**Primary (5):**

1. **Single-platform role-based workflows** for patient, doctor, admin with access enforced at every architectural layer.
2. **AI-powered capabilities** (specialty-matched doctor search, conversational assistant Chorui) with **guardrails forbidding autonomous diagnosis/treatment**.
3. **Prescription OCR pipeline** for handwritten Bangla + English prescriptions and reports.
4. **Real-time appointment synchronisation** to prevent double-booking and stale slot views.
5. **Production deployment** via public cloud + CI/CD with observability and performance-budget governance.

**Secondary (5):** bilingual (En/Bn), PWA + offline, mobile-first from 320 px, comprehensive testing (unit/integration/E2E), and reproducible documentation.

---

## 4. Novelty (§1.5) — three exact talking points

The novelty is **not** a new algorithm; it is the **composition** of well-known parts in a way the literature/market does not show:

1. **Integrated platform**: structured patient history + real-time booking + Rx-document intelligence inside *one* consent-aware bilingual surface for Bangladesh.
2. **Safety-bounded AI orchestration pathway**: every external model call is anonymised, schema-validated, confidence-routed, and the deterministic backend retains final authority over patient-facing decisions.
3. **Production-grade deployment in an academic timeframe**: container orchestration (Azure Container Apps), observability dashboards (Grafana/Prometheus), and CI-enforced performance budgets — not a toy prototype.

If asked *"what is genuinely new here?"* → quote those three. Don't claim a new model.

---

## 5. Scope & technology decisions (§1.4)

| Layer | Concrete choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui on Radix | Server Components keep auth-gated reads near the contract; shadcn keeps a coherent design system; Tailwind 4 ships smaller. |
| PWA | Serwist service worker, mobile-first ≥ 320 px | Weak-network + app-store-bypass delivery in BD. |
| i18n | `next-intl` with English + Bangla catalogs across 10 functional categories | Bilingual is a primary design principle, not a wrapper. |
| Backend | FastAPI on Python 3.11 + Uvicorn, **194 endpoints across 26 route modules**, **19 service modules** | Async I/O for booking, structured DI for security/RBAC. |
| Persistence | async SQLAlchemy 2 on **Supabase PostgreSQL**, **47 Alembic migrations**, RLS context | Single ORM, auditable schema evolution, row-level security primitives from Supabase. |
| Realtime | Supabase Realtime channels for slot updates | Sub-second client-to-client slot propagation (~500 ms measured). |
| AI orchestration | Provider-agnostic adapter for **Groq, Gemini, Cerebras**; Pydantic schema validation; PII anonymisation | Decouples vendor from contract; lets us fall back without changing UI. |
| OCR microservice | **YOLO ONNX** region detector + **Azure Document Intelligence** (primary) + **PaddleOCR** (fallback) + **RapidFuzz** medicine matcher | Detector-plus-recognizer; not a single end-to-end model. |
| Voice | `faster-whisper` STT + Vapi voice agent with backend webhook | Speech in BD context; tool-calls routed through Chorui. |
| Notifications | VAPID web push via `pywebpush` | Browser-native push, no native-app store gate. |
| Deploy | **Azure Container Apps**, **GitHub Actions** CI, **Grafana + Prometheus** observability | Production posture inside academic budget. |
| Testing | Pytest + Locust + k6 + Playwright + Lighthouse CI + bundle-size budgets | Each layer measured the way it is actually used. |

If asked "why not Django/Express/T3/etc." → because async FastAPI + Pydantic gives the schema-first contract the AI/OCR boundary needs, and async SQLAlchemy plays cleanly with Supabase's pgbouncer.

---

## 6. System architecture (§3.2.1, Figs. 3.1–3.4) — the 4-layer story

```
Patients/Doctors/Admins
        │  HTTPS, locale-aware UI
        ▼
Next.js 16 PWA (App Router, Server Actions, i18n, Serwist)
        │  Bearer-token JSON APIs                         ▲ Realtime slots / auth
        ▼                                                 │
FastAPI Core Backend (26 route modules · 194 handlers · 19 service modules)
   ├── async SQLAlchemy 2 ──► Supabase Postgres / Auth / Storage / Realtime
   ├── schema-validated prompts ──► LLM Providers (Groq, Gemini, Cerebras)
   └── internal HTTP ──► AI OCR Microservice (YOLO + Azure DI + PaddleOCR fallback)
```

### Why three services and not a monolith

§3.2.1 gives three reasons — keep these in your head:

1. **OCR is computationally lumpy** and would cause latency spikes on the booking path if it shared a runtime.
2. **OCR has heavier model artifacts** and image-processing dependencies; bundling them into the core API would inflate cold starts.
3. **Fault isolation**: if OCR degrades, booking, onboarding, and notifications still work.

### Frontend layer (Fig. 3.2)

Route groups (Auth / Onboarding / Dashboard / Admin); Server Actions are typed RPCs with permission checks placed adjacent to the backend contract; UI = 45 shadcn primitives; PWA = Serwist with background sync + push.

### Backend layer (Fig. 3.3)

`app/main.py` assembly → Route Layer (26 modules / 194 handlers) → Service Layer (appointments, reminders, AI orchestration, slots) → Core Dependencies (JWT verify, RBAC, request context). Background workers run hold-expiry loops and reminder dispatch. External integrations: Supabase, Google Calendar, LLM APIs, VAPID push.

### AI service layer (Fig. 3.4)

The **AI Boundary** is the conceptually most important box. Every external model call passes through:
- **Consent + PII Guard** — tokenisation + policy checks (eqs. in §4.5.1).
- **Orchestrator** — adapter registry (per-provider) + schema validation (Pydantic).
- **Conversation Context** — Chorui history table for audit retention.

Persisted into `ai_interactions` and `chorui_chat_messages` tables.

### OCR microservice (Fig. 3.5)

`Input (multipart/base64/URL) → Normalize → YOLO ONNX region detection (multi-scale retry) → Azure DI primary / PaddleOCR fallback → Parser (dosage/frequency/quantity grammar) → RapidFuzz match against catalog with confidence floor`. Thresholds, timeouts, IoU and matcher confidence are environment-configured.

---

## 7. Project planning (§1.6, Figs. 1.2–1.5, Table 1.1)

- **Lifecycle**: agile, four monthly phases Dec 2025 → Apr 2026 (Foundation → Features → AI/Polish → Advanced).
- **Branch model**: feature branching with **15 explicit merge commits** at integration points.
- **Coordination**: daily standups, ad-hoc RACI on parallel modules, 4 phases / 4 months.
- **Work split (Table 1.1)** — know your own row:
  - **Sarwad (2107006)**: Backend architecture lead (FastAPI, 194 endpoints, 41 models, 47 migrations); AI orchestration lead; OCR microservice lead; DevOps + deployment lead; testing (unit/integration/security/load); backend i18n catalog scaffold; backend PRD + deployment guide.
  - **Adiba (2107031)**: Frontend architecture lead (Next.js 16, App Router, 45 components); Chorui chat UI + voice control + navigation policy; OCR upload UX; Lighthouse CI / dashboard authoring; i18n lead (next-intl, En + Bn, 10 categories); Playwright E2E + frontend perf tests; Frontend PRD + Chorui pipeline + PWA docs.
- **Timeline (Fig. 1.5)**: Foundation Dec'25, Core systems Jan, Features Feb, AI integration Mar, Optimization + scaling Apr.

If asked about overlap/RACI: the **prescription module** is the canonical parallel area — backend (Sarwad) and frontend (Adiba) used a written RACI doc to resolve ownership of contract fields.

---

## 8. Reproducibility (§1.9) — quick fact sheet

- **Repo**: `https://github.com/CSE-3200-System-Project/Medora.git` v1.0 MIT.
- **Requirements**: Node 18+, npm 9+, Python 3.11+, Supabase project, Azure DI credentials, ≥1 LLM provider key, optional Docker.
- **Setup**: clone → `frontend: npm install && npm run dev` → `backend: venv + pip install + alembic upgrade head + uvicorn :8000` → `ai_service: venv + pip install + uvicorn :8001`. Health: `GET :8000/health` and `:8001/health`.
- **Datasets**: synthetic scheduling workload (multi-week, many patient/doctor actors) + OCR corpus of **~100 prescription images** with field-level annotations + **~20,000-entry medicine catalog**.
- **Reproducibility caveat**: AI responses + Realtime delays vary because external services do; the *approach* is reproducible, exact ms-numbers are not.
- **Limitations**: controlled environment, simulated traffic, small dataset, no national-scale production data, no third-party security audit.

---

## 9. Methodology design philosophy (Chapter 3)

Two quotes worth knowing literally:

> "The methodology makes Medora a production-based, modular healthcare platform and not a monolithic student prototype." (§3.3)

> "Medora is meant to be AI-native rather than merely AI-powered." (§1.1)

The difference between *AI-native* and *AI-powered*:
- **AI-bolted**: input lacks structure, application can't enforce safety, behavior is inconsistent.
- **AI-native (Medora)**: orchestration, schema validation, consent enforcement, observability are a *single architectural layer*. Every model call passes through the backend orchestrator, which fixes provider, anonymises PII, validates output via Pydantic, and stores the conversation turn for auditing.

If asked *"is this just OpenAI wrapped in a webapp?"* — quote the AI-native definition and walk through Fig. 3.4.

---

## 10. Workflow design principle (§3.2.3)

Principal user journeys are deterministic state machines, **not loose page transitions**. This is most visible in three flows:

- **Booking (Figs. 3.7–3.8)**: `search doctors → fetch live slots → soft hold → commit → notify` — every step is server-validated and Realtime-synchronised.
- **Chorui conversation (Fig. 3.10)**: `intent → context attach → structured prompt → confidence-gated route` — confidence decides whether to act, confirm, or clarify.
- **Voice (Vapi, Figs. 3.21–3.22)**: local Vapi action followed by **validated backend action** — health-related reasoning never lives on the client.

If a reviewer probes for race conditions or split-brain UX, the answer is: soft holds + Realtime + transactional commit means there is no window where two clients can see the same slot as free.

---

## 11. Use-case & role views (§3.2.4, Figs. 3.6, 3.11–3.14)

- **Patient (Figs. 3.11–3.12)**: signup + onboarding → doctor discovery → booking → Rx/report OCR → reminders/notifications → Chorui assistant.
- **Doctor (Fig. 3.14)**: schedule mgmt + calendar/reminders, consultation + prescription, patient reports + metrics.
- **Admin (Fig. 3.14)**: doctor verification, user moderation, audit + governance, platform metrics.

Three role-specific dashboards, three RBAC contexts, three audit trails. Cleanly separated route groups, dependencies and dashboards in code.

---

## 12. Defensive talking points for "what's the methodology really?"

If asked open-endedly, structure the answer as:

1. **Service decomposition** with explicit interface boundaries (frontend / backend / OCR / external AI).
2. **Contract-first API design** (FastAPI routers, Pydantic schemas, server actions on the FE).
3. **Asynchronous backend processing** (async SQLAlchemy, background workers for hold expiry + reminders).
4. **Consent-first data flow** with PII anonymisation before any external AI call.
5. **Empirical validation** at every layer (unit, integration, E2E, security, load, OCR accuracy, Lighthouse).
6. **Production-grade ops** (Azure Container Apps, GitHub Actions, Grafana/Prometheus, performance budgets in CI).

Six bullet points = the methodology. Anything else is a detail of one of those six.

---

## 13. The "where is X documented in the report?" cheat sheet

| Question topic | Section | Page (approx.) |
| --- | --- | --- |
| Problem & gap | §1.2, Table 2.1 | 2, 15 |
| Objectives | §1.3 | 3 |
| Novelty | §1.5 | 4 |
| Tech stack details | §1.4, §1.9.3 | 3–4, 9 |
| Work split | Table 1.1 | 6 |
| System architecture diagrams | Figs. 3.1–3.4 | 17–18 |
| OCR pipeline diagram | Fig. 3.5 | 19 |
| DFDs (context, booking) | Figs. 3.6–3.8 | 20–21 |
| Sequence diagrams | Figs. 3.8, 3.9, 3.10, 3.20, 3.22 | 21, 22, 23, 27, 28 |
| Math formulas | §3.2.1 + §4.5.1 + Appendix A | 17–18, 32–36, 62–68 |
| Performance results | Table 4.2, Fig. 4.14 | 44 |
| OCR validation results | Table 4.3, Fig. 4.15 | 45–46 |
| Ethics/safety | §5.2–5.3 | 47–48 |
| K/P/A attributes | Tables 6.1–6.3, Fig. 6.1 | 53–56 |
| Limitations | §7.2 | 57 |
| Future work | §7.3 | 58 |
