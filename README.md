# Medora

## 1. Project Title & Tagline
Medora is a production-grade, AI-native healthcare platform for Bangladesh that unifies patient records, verified doctor operations, and safety-first clinical assistance into one end-to-end digital care system.

## 2. Executive Summary
Medora is built for three primary stakeholders:
- Patients who need trustworthy care access, structured health history, and continuity.
- Doctors who need verified identity, clear patient context, and operational tooling.
- Administrators who need controlled verification, oversight, and platform governance.

Why this system matters:
- It removes workflow fragmentation across onboarding, appointments, consultations, reminders, and prescriptions.
- It enforces role and consent boundaries in healthcare-sensitive flows.
- It includes practical AI capabilities (doctor discovery, assistant chat, OCR parsing) with privacy and safety guardrails.
- It is engineered for production operations, not just demos.

Current repository scale indicators:
- 26 backend route modules (`backend/app/routes`).
- 194 route handlers (`@router.*` decorated endpoints).
- 41 SQLAlchemy model classes (`backend/app/db/models`).
- 47 Alembic migration files (`backend/alembic/versions`).
- 20 frontend server action modules (`frontend/lib/*-actions.ts`).
- 45 shared UI component files (`frontend/components/ui`).

## 3. Product Overview
### Real-World Problem
Healthcare journeys often break down across disconnected tools: appointment booking in one place, records in another, prescriptions in another, and no reliable continuity between patient and doctor.

### Limitations in Existing Solutions
- Stale appointment slots due to delayed updates.
- Poorly structured patient history capture.
- Weak consent and audit visibility for sensitive data access.
- OCR systems that fail on real prescriptions and mixed Bangla-English text.
- AI features that are either generic chat wrappers or operationally unsafe.

### How Medora Solves It
Medora provides one cohesive stack with:
- Role-based workflows for patient, doctor, and admin.
- Structured onboarding and persistent medical context.
- Realtime appointment state synchronization.
- Consent-aware access and auditable interaction records.
- AI as assistive intelligence with deterministic backend control.
- A dedicated OCR service for document intelligence workloads.

### High-Level Workflow
1. Authentication and role context are established via Supabase + backend token verification.
2. Middleware and backend guards enforce access boundaries and onboarding/verification gates.
3. Business workflows execute through FastAPI route modules and typed schemas.
4. AI operations are brokered via backend orchestrators and constrained payload shaping.
5. Realtime and notification layers keep operational state synchronized.

## 4. Key Features (Grouped)
### Core Features
- Multi-role access model (`patient`, `doctor`, `admin`) with route protection.
- Structured onboarding data capture and update/retrieval APIs.
- Doctor verification gate before protected clinical access.
- Appointment lifecycle support including pending, confirmed, reschedule, cancellation, and completion states.
- Consultation and prescription issuance flows with medication/test/surgery constructs.
- Patient medical history, consent, and record-sharing control surfaces.

### Advanced Features
- Realtime slot updates in booking/rescheduling via Supabase channel subscriptions.
- Background reminder dispatcher with timezone-aware due window evaluation.
- Notification subsystem supporting in-app and web push delivery.
- Google Calendar OAuth integration paths for doctor schedule synchronization.
- Offline-capable PWA behavior with route-specific caching and background sync queue.
- Performance instrumentation and CI performance budget hooks.

### Intelligent / AI Features
- AI-assisted doctor search endpoint (`/ai/search`) with specialty extraction and ranking inputs.
- Voice normalization endpoint (`/ai/normalize/voice`) using faster-whisper in backend ASR service.
- Chorui assistant APIs with conversation history, context-aware intent routing, and structured outputs.
- Provider-agnostic AI orchestration (Groq, Gemini, Cerebras) with schema-validated outputs.
- PII anonymization helpers for AI input protection.
- Prescription OCR and report OCR service endpoints with fallback OCR behavior and parsing pipelines.

### System / Engineering Features
- Async FastAPI + SQLAlchemy 2.x architecture with migration-managed schema evolution.
- Split service boundary between core API and OCR-intensive AI service.
- Lifecycle-managed background loops (reminder dispatcher and appointment hold sweeps).
- Environment-driven behavior for provider selection, OCR tuning, and performance controls.
- Mobile-first PWA runtime caching strategies with explicit TTL policies.

## 5. System Architecture
Medora follows a service-oriented architecture with explicit workload boundaries.

```text
+----------------------+      HTTPS / Bearer Auth      +----------------------+
| Frontend (Next.js)   | -----------------------------> | Backend (FastAPI)    |
| PWA + Server Actions |                                | Core Business APIs    |
+----------+-----------+                                +----------+-----------+
           |                                                       |
           | Supabase Client + Realtime                            | Async SQLAlchemy
           v                                                       v
+----------------------+                                +----------------------+
| Supabase             | <----------------------------> | PostgreSQL (Supabase)|
| Auth/Storage/Realtime|                                | RLS + Transactions   |
+----------------------+                                +----------------------+
                                                           |
                                                           | OCR delegation
                                                           v
                                                     +----------------------+
                                                     | AI OCR Service       |
                                                     | YOLO + Azure OCR     |
                                                     +----------------------+
```

### Major Components and Responsibilities
- Frontend (`frontend/`): application UI, role-aware navigation, server actions, PWA/service worker behavior, and realtime slot subscription logic.
- Backend (`backend/app/`): auth verification, RBAC, onboarding, appointment orchestration, consultations, reminders, notifications, consent enforcement, AI endpoint routing.
- AI OCR Service (`ai_service/app/`): image normalization, region detection, OCR extraction, parsing, and structured output generation.
- Supabase layer: identity, storage, PostgreSQL persistence, and realtime stream events.

### Data Flow and Control Boundaries
1. User action originates from Next.js pages/components or server actions.
2. Backend validates bearer token and role context.
3. Backend executes business logic using typed schemas and async data access.
4. OCR requests are delegated to AI service endpoints and returned as structured payloads.
5. State changes propagate to UI via API responses, realtime channels, and notifications.

### Scalability Decisions Present in Codebase
- AI OCR is isolated from core request paths to avoid OCR CPU spikes impacting core API latency.
- Async database sessions and pooled connections enable high-concurrency I/O patterns.
- Background dispatcher loops move time-based work out of user request critical paths.
- Realtime channel subscriptions reduce stale slot conflicts compared to heavy polling.

![System Architecture](./docs/architecture.png)

## 6. Technology Stack
### Frontend
| Category | Technology |
|---|---|
| Framework | Next.js 16.1.6 |
| Runtime | React 19.2.3 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Component Primitives | Radix UI + shadcn/ui |
| Data Layer | TanStack React Query |
| Animation | Framer Motion 12 |
| PWA | Serwist 9.5.6 |
| Charts | ECharts 6, Recharts 3 |
| Maps | MapLibre GL 5.16 |

### Backend
| Category | Technology |
|---|---|
| Framework | FastAPI |
| Runtime | Python 3.11 + Uvicorn |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| Validation | Pydantic v2 + pydantic-settings |
| Auth Bridge | Supabase JWT verification |
| ASR | faster-whisper |
| Notifications | pywebpush |

### Database
| Category | Technology |
|---|---|
| Primary | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase realtime streams |

### DevOps / Deployment
| Category | Technology |
|---|---|
| Containerization | Docker |
| Cloud Runtime | Azure Container Apps |
| CI/CD | GitHub Actions |
| Performance Gates | Lighthouse CI + bundle checks |

### AI / ML
| Category | Technology |
|---|---|
| LLM Providers | Groq, Gemini, Cerebras |
| OCR Engine | Azure Document Intelligence |
| Detection | YOLO ONNX runtime |
| Fuzzy Matching | RapidFuzz |
| Image/PDF Handling | Pillow, pypdfium2 |

### Tools & Libraries
- `@supabase/supabase-js`, `@supabase/ssr`
- `class-variance-authority`, `tailwind-merge`
- `lucide-react`
- ESLint 9 + strict TypeScript configuration

## 7. Project Structure (Real)
```text
/root
├── ai_service/
│   ├── app/
│   │   ├── main.py
│   │   ├── pipeline.py
│   │   ├── yolo.py
│   │   ├── azure_ocr.py
│   │   ├── parser.py
│   │   ├── matcher.py
│   │   ├── normalize.py
│   │   ├── report_parser.py
│   │   ├── report_schemas.py
│   │   └── config.py
│   ├── deploy/
│   ├── models/
│   └── requirements.txt
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── db/
│   │   │   └── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── services/
│   ├── alembic/
│   │   └── versions/
│   ├── context/
│   ├── tests/
│   ├── docker-compose.yaml
│   ├── Dockerfile
│   └── requirements.txt
├── docs/
│   ├── backend-implementation-prd.md
│   ├── frontend-implementation-prd.md
│   ├── chorui-ai-pipeline.md
│   ├── pwa-doc.md
│   └── diagrams/
├── frontend/
│   ├── app/
│   ├── components/
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   ├── perf/
│   ├── public/
│   ├── proxy.ts
│   ├── package.json
│   └── next.config.ts
├── tasks/
├── CLAUDE.md
├── LICENSE
└── README.md
```

### Purpose of Major Directories
- `frontend/`: interactive product experience, server actions, role UX, and PWA behavior.
- `backend/`: domain APIs, security, orchestration, persistence, and background processing.
- `ai_service/`: document intelligence and OCR extraction service.
- `docs/`: implementation PRDs and architecture narratives.
- `tasks/`: planning logs and change summaries.

### Key Files and Responsibilities
- `backend/app/main.py`: application composition, lifespan startup/shutdown tasks, route registration.
- `backend/app/services/ai_orchestrator.py`: model-provider abstraction and output validation.
- `backend/app/routes/ai_consultation.py`: Chorui assistant endpoints and context processing.
- `backend/app/services/reminder_dispatcher.py`: due reminder scanning and dispatch orchestration.
- `backend/app/services/push_service.py`: VAPID-based push delivery and failure management.
- `frontend/app/sw.ts`: service worker caching policies, background sync queueing, push handlers.
- `frontend/lib/use-realtime-slots.ts`: realtime appointment-slot subscription hook.
- `ai_service/app/pipeline.py`: OCR pipeline controller across detection, OCR, and parsing.

## 8. Core Workflows
### A. User Onboarding Workflow
1. User signs up via role-specific auth route.
2. Backend creates profile + role-specific entity rows.
3. Frontend middleware (`proxy.ts`) enforces onboarding completion rules.
4. Patient onboarding data is progressively captured and patched to backend.
5. Backend returns normalized onboarding payload for subsequent sessions.

### B. Appointment Lifecycle Workflow
1. Patient requests doctor slot from booking UI.
2. Frontend realtime hook tracks slot changes for doctor/date context.
3. Backend validates status and schedule constraints before commit.
4. Appointment status transitions persist through controlled state tables.
5. Reschedule, cancellation, and completion update downstream notifications and analytics.

### C. Backend Processing Workflow (Reminders + Events)
1. Reminder dispatcher loops at configured interval.
2. Active reminders are converted into timezone-aware due windows.
3. Due reminders create in-app notifications and delivery-log rows.
4. Push dispatch attempts are made across active subscriptions.
5. Failures increment counters; stale endpoints are deactivated.

### D. AI Doctor Discovery Workflow
1. User submits natural language symptom input.
2. Backend sanitizes payload and invokes LLM extraction logic.
3. Extracted specialties and severity cues are mapped to doctor candidates.
4. Backend applies filters and ranking inputs from real data.
5. Response returns doctor cards + explainability factors.

### E. Chorui Assistant Workflow
1. Assistant-chat request arrives with role context.
2. Backend enforces consent/privacy and access constraints.
3. Structured context is assembled and sanitized.
4. AI orchestrator generates validated output or fallback response.
5. Conversation turn is persisted for continuity and auditability.

### F. OCR Pipeline Workflow
1. Input accepted via file/image URL/base64.
2. Input normalization handles orientation/type constraints.
3. YOLO detects candidate prescription/report regions.
4. OCR extraction runs (Azure primary, optional fallback paths).
5. Parser normalizes dosage/frequency/quantity and returns structured output.

## 9. Diagrams Section
### Class Diagram
![Class Diagram](./docs/class-diagram.png)

### DFD
![DFD](./docs/dfd.png)

### Use Case Diagram
![Use Case Diagram](./docs/use-case-diagram.png)

### Activity Diagram
![Activity Diagram](./docs/activity-diagram.png)

### Architecture Diagram
![Architecture Diagram](./docs/architecture.png)

## 10. Screenshots
### Landing Page
![Screenshot](./docs/screens/screen1.png)

### Dashboard
![Screenshot](./docs/screens/screen2.png)

### Key Features UI
![Screenshot](./docs/screens/screen3.png)

## 11. Demo / Walkthrough
### Demo Link
- Product walkthrough: `https://example.com/medora-demo`

### Suggested Demo Sequence
1. Auth + role resolution + route gating.
2. Patient onboarding and profile persistence.
3. AI doctor search from symptom narrative.
4. Realtime slot update while booking.
5. Consultation and reminder event flow.
6. OCR prescription upload and structured extraction.

## 12. Setup & Installation
### Prerequisites
- Node.js 18+
- npm 9+
- Python 3.11+
- Supabase project with PostgreSQL/Auth/Storage configured
- Azure AI Document Intelligence credentials
- AI provider credentials (at least one of Groq/Gemini/Cerebras)

### Installation Steps
#### 1. Clone Repository
```bash
git clone <repository-url>
cd Medora
```

#### 2. Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

#### 3. Backend Environment
```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/macOS
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

#### 4. AI OCR Service Environment
```bash
cd ai_service
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/macOS
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

#### 5. Configure Environment Files
Create and configure:
- `frontend/.env.local`
- `backend/.env`
- `ai_service/.env`

#### 6. Apply Database Migrations
```bash
cd backend
# Activate backend virtual environment first
alembic upgrade head
cd ..
```

#### 7. Run Services
Backend:
```bash
cd backend
# Activate backend virtual environment first
uvicorn app.main:app --reload --port 8000
```

AI OCR Service:
```bash
cd ai_service
# Activate ai_service virtual environment first
uvicorn app.main:app --reload --port 8001
```

Frontend:
```bash
cd frontend
npm run dev
```

### Optional Docker Run
Backend compose:
```bash
cd backend
docker-compose up --build
```

### Health Checks
```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
```

## 13. Environment Variables
### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_PERF_API_CACHE_TTL` | Service worker API cache TTL |
| `NEXT_PUBLIC_RUM_SAMPLE_RATE` | Web vitals sampling rate |

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `SUPABASE_DATABASE_URL` | Async SQLAlchemy connection string |
| `SUPABASE_URL` | Supabase URL |
| `SUPABASE_KEY` | Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for privileged writes |
| `SUPABASE_STORAGE_BUCKET` | Bucket for uploads/documents |
| `AI_PROVIDER` | `groq`, `gemini`, or `cerebras` |
| `GROQ_API_KEY` | Groq API key |
| `GEMINI_API_KEY` | Gemini API key |
| `CEREBRAS_CLOUD_API_KEY` | Cerebras API key |
| `GROQ_MODEL` | Groq model id |
| `GEMINI_MODEL` | Gemini model id |
| `CEREBRAS_CLOUD_MODEL` | Cerebras model id |
| `AI_OCR_SERVICE_URL` | OCR service base URL |
| `AI_ID_HASH_SECRET` | Stable tokenization secret for AI privacy |
| `CHORUI_PRIVACY_MODE` | Assistant privacy mode policy |
| `DEFAULT_REMINDER_TIMEZONE` | Default reminder timezone (e.g., Asia/Dhaka) |
| `REMINDER_DISPATCH_ENABLED` | Enable/disable reminder background worker |
| `REMINDER_DISPATCH_INTERVAL_SECONDS` | Reminder scan interval |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Push public key |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Push private key |
| `WEB_PUSH_VAPID_SUBJECT` | Push subject claim |
| `PRELOAD_WHISPER_ON_STARTUP` | ASR preload toggle |
| `ALLOWED_ORIGINS` | CORS allowlist |

### AI OCR Service (`ai_service/.env`)
| Variable | Description |
|---|---|
| `MODEL_TYPE` | OCR mode (`read`, `custom`, `llm`) |
| `AZURE_OCR_ENDPOINT` | Azure endpoint |
| `AZURE_OCR_KEY` | Azure OCR key |
| `AZURE_OCR_MODEL_ID` | Model identifier |
| `AZURE_OCR_TIMEOUT_SECONDS` | OCR timeout |
| `YOLO_MODEL_PATH` | ONNX model path |
| `YOLO_INPUT_SIZE` | Detection input size |
| `YOLO_CONFIDENCE_THRESHOLD` | Detection confidence threshold |
| `YOLO_IOU_THRESHOLD` | Detection IoU threshold |
| `YOLO_RETRY_INPUT_SIZES` | Retry sizes for low-confidence detections |
| `DISABLE_MEDICINE_MATCHING` | Toggle DB-assisted medicine matching |
| `SUPABASE_DATABASE_URL` | DB URL for medicine indexing/matching |
| `MEDICINE_DB_TABLE` | Medicine source table |
| `MEDICINE_MATCH_MIN_CONFIDENCE` | Match acceptance floor |
| `OCR_MAX_UPLOAD_BYTES` | Max accepted upload size |
| `OCR_MAX_IMAGE_BYTES` | OCR-processing image byte cap |

## 14. API Overview
### Backend Service (Port 8000)
| Prefix | Purpose |
|---|---|
| `/health` | Service health + DB check |
| `/auth` | Signup/login/session profile endpoints |
| `/profile` | Onboarding and profile state |
| `/upload` | File upload and OCR handoff integration |
| `/admin` | Verification/moderation/admin ops |
| `/doctor` | Doctor profile and operations |
| `/specialities` | Specialty catalog APIs |
| `/appointment` | Booking, slots, lifecycle transitions |
| `/ai` | Doctor search + Chorui + AI utilities |
| `/consultation` | Consultation workspace and outputs |
| `/medicine` | Medicine search and lookups |
| `/medical-test` | Test tracking/operations |
| `/notifications` | In-app/push notification APIs |
| `/patient-access` | Access sharing and logs |
| `/reminders` | Reminder CRUD and schedules |
| `/availability` | Doctor availability views |
| `/reschedule` | Reschedule request/decision workflow |
| `/oauth` | Calendar OAuth flow |
| `/health-metrics` | Vital/health metric operations |
| `/doctor/actions` | Doctor action item management |
| `/patient` | Patient dashboard aggregation |
| `/health-data` | Health-data consent APIs |
| `/medical-reports` | Report-oriented endpoints |
| `/patient-data-sharing` | Fine-grained patient sharing preferences |

### AI OCR Service (Port 8001)
| Endpoint | Purpose |
|---|---|
| `GET /health` | OCR service readiness and mode |
| `POST /ocr/prescription` | Structured prescription extraction |
| `POST /ocr/medical-report` | Structured medical report extraction |

### Example Requests
Login:
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password"}'
```

Patient onboarding patch:
```bash
curl -X PATCH "http://localhost:8000/profile/patient/onboarding" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Rahim","last_name":"Khan"}'
```

AI doctor search:
```bash
curl -X POST "http://localhost:8000/ai/search" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_text":"persistent cough and chest discomfort"}'
```

Voice normalization:
```bash
curl -X POST "http://localhost:8000/ai/normalize/voice" \
  -H "Authorization: Bearer <token>" \
  -F "audio_file=@voice.webm" \
  -F "language_hint=auto"
```

Prescription OCR:
```bash
curl -X POST "http://localhost:8001/ocr/prescription?debug=true" \
  -F "file=@prescription.jpg"
```

## 15. Scalability & Design Decisions
### Why This Architecture Was Chosen
- Service boundary between core API and OCR compute keeps core workflows stable under image-heavy load.
- Async backend architecture supports concurrent appointment/notification workflows.
- Realtime and background-worker primitives reduce user-facing state drift.
- AI orchestration centralization enforces consistent prompting, validation, and privacy handling.

### Key Trade-Offs
- Multi-service coordination increases deployment and observability complexity.
- OCR quality depends on both detection and OCR provider quality; fallback logic is essential.
- Realtime subscriptions improve freshness but add state-sync complexity in UI clients.

### Scalability Path
- Introduce queue-backed async jobs for OCR and heavy assistant computations.
- Add dedicated telemetry pipelines for latency/error-rate per endpoint/workflow.
- Expand read model/caching strategy for high-volume doctor search and dashboard paths.
- Introduce canary rollout controls for AI provider switching and prompt-version migration.

### Current Deployment and CI/CD Model
- Production deployment target is Azure Container Apps for backend and OCR services.
- Repository CI/CD includes `.github/workflows/deploy-backend.yml`.
- Repository CI/CD includes `.github/workflows/deploy-ai-ocr.yml`.
- Repository CI/CD includes `.github/workflows/performance-budget.yml`.
- Backend container image (`backend/Dockerfile`) uses `python:3.11-slim`, non-root execution (`appuser`), and health checks against `/health`.
- AI OCR container image (`ai_service/Dockerfile`) uses `python:3.11-slim`, installs `libgomp1` for ONNX runtime support, and runs as non-root.

## 16. Future Improvements / Roadmap
- Publish formal architecture, sequence, and ER diagrams under `docs/diagrams`.
- Expand integration tests for consent, RBAC, and appointment race-condition scenarios.
- Add contract tests for server actions against backend schema evolution.
- Add performance baselines and SLO tracking dashboards for critical paths.
- Improve multilingual UX and healthcare-term normalization for Bangla/English hybrid usage.
- Introduce richer audit analytics for patient data access transparency.
- Externalize ASR into a dedicated microservice if throughput requirements grow.

## 17. Contribution Guidelines
### How to Contribute
1. Fork repository and create a feature/fix branch.
2. Keep scope small and aligned to a single workflow concern.
3. Implement with tests and update docs for behavior or API changes.
4. Run lint/build checks for touched services.
5. Open PR with context, technical rationale, and verification notes.

### Suggested Branching Strategy
- `main`: stable branch.
- `feature/<scope>-<topic>` for features.
- `fix/<scope>-<topic>` for bug fixes.
- `chore/<scope>-<topic>` for maintenance/docs/refactors.

### Quality and Safety Expectations
- Preserve privacy and consent semantics.
- Do not introduce autonomous diagnosis/prescription logic.
- Keep changes minimal, explicit, and testable.
- Document schema/endpoint changes in PRs.

### Local Validation Checklist Before PR
- Backend imports and starts successfully.
- Migrations apply cleanly.
- Frontend builds and role-gated routes behave correctly.
- Changed endpoints return typed schema-compatible responses.
- PWA/service-worker changes are tested in at least one mobile browser profile.

## 18. License
This project is licensed under the MIT License.
See `LICENSE` for full terms.
