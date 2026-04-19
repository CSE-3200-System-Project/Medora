# Medora - Complete Project Overview

## Executive Summary

**Medora** is a production-grade, AI-native healthcare platform built for Bangladesh that unifies patient records, verified doctor operations, and safety-first clinical assistance into one end-to-end digital care system. Built as a CSE-3200 System Project at **KUET (Khulna University of Science and Technology)**, the platform serves three stakeholder roles: **patients**, **doctors**, and **administrators**.

### Why This System Matters

Healthcare journeys in Bangladesh often break down across disconnected tools: appointment booking in one place, records in another, prescriptions in yet another, with no reliable continuity between patient and doctor. Medora solves this by providing:

- **Role-based workflows** for patient, doctor, and admin with strict access boundaries
- **Structured onboarding** and persistent medical context capture
- **Realtime appointment state synchronization** eliminating stale slot conflicts
- **Consent-aware access** and auditable interaction records
- **AI as assistive intelligence** with deterministic backend control and safety guardrails
- **A dedicated OCR service** for document intelligence workloads (prescriptions, medical reports)

### Project Scale (as of April 2026)

| Metric | Count |
|--------|-------|
| Backend route modules | 26 |
| Route handlers (endpoints) | 194 |
| SQLAlchemy model classes | 41 |
| Alembic migration files | 47 |
| Frontend server action modules | 20 |
| Shared UI components (shadcn/ui) | 45 |
| Total git commits | 185+ |
| Test files (unit + integration + e2e) | 15+ |
| Grafana dashboards | 4 |

---

## Technology Stack

### Frontend
| Category | Technology |
|----------|-----------|
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
| Voice AI | Vapi |
| Internationalization | next-intl (English + Bangla) |

### Backend
| Category | Technology |
|----------|-----------|
| Framework | FastAPI |
| Runtime | Python 3.11 + Uvicorn |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| Validation | Pydantic v2 + pydantic-settings |
| Auth Bridge | Supabase JWT verification |
| ASR | faster-whisper |
| Notifications | pywebpush |
| AI Providers | Groq, Gemini, Cerebras |

### Database & Cloud
| Category | Technology |
|----------|-----------|
| Primary Database | PostgreSQL (Supabase) |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase realtime streams |
| Cloud Runtime | Azure Container Apps |
| Container Registry | Azure Container Registry |
| CI/CD | GitHub Actions |

### AI / ML
| Category | Technology |
|----------|-----------|
| LLM Providers | Groq (Llama), Gemini, Cerebras |
| OCR Engine | Azure Document Intelligence |
| Fallback OCR | PaddleOCR |
| Region Detection | YOLO ONNX runtime |
| Fuzzy Matching | RapidFuzz |
| Image/PDF Handling | Pillow, pypdfium2 |

---

## System Architecture

Medora follows a **service-oriented architecture** with explicit workload boundaries:

```
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

### Three-Service Boundary

1. **Frontend Service (Next.js, Port 3000)**
   - PWA with Serwist service worker
   - Role-based routing via `proxy.ts` middleware
   - i18n (English + Bangla)
   - Supabase auth integration
   - Realtime slot subscriptions
   - Server actions for all backend API calls

2. **Backend Service (FastAPI, Port 8000)**
   - Core business APIs (26 route modules)
   - RBAC and JWT verification
   - Async SQLAlchemy with connection pooling
   - Background reminder dispatcher
   - Appointment hold expiry sweep
   - AI orchestration (Groq/Gemini/Cerebras)
   - ASR (faster-whisper)
   - Push notifications (VAPID)
   - Google Calendar OAuth

3. **AI OCR Service (FastAPI, Port 8001)**
   - Prescription and medical report OCR
   - YOLO region detection
   - Azure Document Intelligence (primary)
   - PaddleOCR (fallback)
   - Medicine matching via RapidFuzz

### Scalability Decisions

- **AI OCR isolation**: Prevents OCR CPU spikes from impacting core API latency
- **Async database sessions**: Enables high-concurrency I/O patterns
- **Background dispatcher loops**: Moves time-based work out of user request critical paths
- **Realtime channel subscriptions**: Reduces stale slot conflicts compared to heavy polling

---

## Core Features

### Authentication & Authorization
- Multi-role access model (`patient`, `doctor`, `admin`)
- Supabase JWT verification + backend RBAC
- Route protection via `proxy.ts` middleware
- Onboarding completion gates
- Doctor verification workflow
- Account moderation (banned status)

### Patient Features
- **Onboarding**: Progressive profile capture with medical context
- **Medical History**: Comprehensive tabbed interface (Medications, Surgeries, Hospitalizations, Vaccinations, Timeline)
- **Doctor Search**: AI-powered natural language symptom matching
- **Appointment Booking**: Realtime slot updates, reschedule, cancellation
- **Consultations**: View prescription history with accept/reject workflow
- **Health Metrics**: Track vitals and health data over time
- **Reminders**: Medication and appointment reminders with push notifications
- **Data Sharing**: Fine-grained consent management for health data
- **Analytics**: Health score, appointment trends, medication charts
- **PWA Support**: Offline caching, background sync, push notifications

### Doctor Features
- **Profile Management**: Verified identity with speciality and location data
- **Schedule Management**: Per-day time slots with Google Calendar integration
- **Patient Records**: Access to patient medical history (with consent)
- **Consultation Workspace**: Tabbed form for medications, tests, and procedures
- **Prescription Issuance**: Dynamic dosage scheduling with HTML rendering and PDF export
- **Appointment Management**: Confirm, reschedule, complete appointments
- **Analytics Dashboard**: Practice metrics and charts
- **AI Assistant (Chorui)**: Voice and text-based patient summary and navigation

### Admin Features
- **Doctor Verification**: Review and approve doctor registrations
- **Patient Management**: View, search, and manage patient accounts
- **System Monitoring**: Dashboard with platform metrics
- **Content Moderation**: Ban abusive accounts

### AI Features
- **Chorui Assistant**: Context-aware AI chat for patients and doctors
  - Role-scoped data access
  - Conversation persistence for continuity
  - Safety guardrails (no autonomous diagnosis/prescribing)
  - Navigation execution (confidence-based policy)
- **AI Doctor Search**: Natural language symptom matching with specialty extraction
- **Voice Control**: Vapi integration for hands-free operation
- **ASR**: Voice-to-text using faster-whisper
- **PII Anonymization**: Privacy-first AI input protection

### OCR Features
- **Prescription OCR**: YOLO region detection + Azure OCR + medicine matching
- **Medical Report OCR**: Structured extraction from lab reports and documents
- **Fallback Pipeline**: PaddleOCR when Azure is unavailable

### Notification System
- **In-app Notifications**: Realtime notification center
- **Push Notifications**: VAPID-based PWA background notifications
- **Email Notifications**: SMTP-based email delivery
- **Reschedule Notifications**: Bidirectional accept/reject workflow
- **Reminder Notifications**: Timezone-aware due window evaluation

### Internationalization
- **English and Bangla** support across all pages
- **10 translation categories**: auth, dashboard, medicine, consultation, common, Chorui, etc.
- **Locale-aware routing** via next-intl

---

## Database Schema

### Core Models (41 total)

| Model | Purpose |
|-------|---------|
| `Profile` | Base user profile with role enum |
| `Patient` | Patient-specific data (conditions, allergies, etc.) |
| `Doctor` | Doctor-specific data (speciality, qualifications, etc.) |
| `Appointment` | Appointment lifecycle with status tracking |
| `AppointmentRequest` | Reschedule request tracking |
| `DoctorAvailability` | Doctor schedule and time slots |
| `DoctorLocation` | Hospital and chamber locations with coordinates |
| `Consultation` | Doctor-patient consultation sessions |
| `Prescription` | Prescription with rendered HTML and snapshot |
| `MedicationPrescription` | Medication details with dosage schedule |
| `TestPrescription` | Recommended medical tests |
| `SurgeryRecommendation` | Recommended procedures |
| `MedicalReport` | Uploaded medical reports with OCR results |
| `HealthMetric` | Patient vital signs and health data |
| `HealthDataConsent` | Patient consent for data sharing |
| `PatientDataSharing` | Fine-grained sharing preferences |
| `PatientAccess` | Access logs and sharing records |
| `Reminder` | Medication and appointment reminders |
| `Notification` | In-app notification queue |
| `MediaFile` | Uploaded files and documents |
| `Medicine` | Medicine catalog with brand/generic names |
| `Speciality` | Medical specialty catalog (111 specialties) |
| `AIInteraction` | AI conversation tracking and metrics |
| `ChoruiChat` | Chorui assistant conversation messages |
| `DoctorAction` | Doctor task and action items |
| `AppointmentAudit` | Appointment change audit log |
| `OAuthToken` | Google Calendar OAuth tokens |

### Migration History
- **47 Alembic migrations** tracking schema evolution from initial setup to advanced features
- Covers: auth, appointments, consultations, prescriptions, AI tables, health metrics, data sharing, notifications

---

## API Endpoints

### Backend Service (Port 8000) - 194 Endpoints

| Prefix | Endpoints | Purpose |
|--------|-----------|---------|
| `/health` | 1 | Service health + DB check |
| `/auth` | 6 | Signup, login, session, password reset |
| `/profile` | 4 | Onboarding and profile state |
| `/upload` | 2 | File upload and OCR handoff |
| `/admin` | 8 | Verification, moderation, patient management |
| `/doctor` | 10 | Doctor profile, schedule, operations |
| `/specialities` | 2 | Specialty catalog APIs |
| `/appointment` | 12 | Booking, slots, lifecycle transitions |
| `/ai` | 8 | Doctor search, Chorui, voice normalization |
| `/consultation` | 6 | Consultation workspace and outputs |
| `/medicine` | 3 | Medicine search and lookups |
| `/medical-test` | 4 | Test tracking operations |
| `/notifications` | 5 | In-app/push notification APIs |
| `/patient-access` | 4 | Access sharing and logs |
| `/reminders` | 4 | Reminder CRUD and schedules |
| `/availability` | 3 | Doctor availability views |
| `/reschedule` | 4 | Reschedule request/decision workflow |
| `/oauth` | 3 | Google Calendar OAuth flow |
| `/health-metrics` | 4 | Vital/health metric operations |
| `/doctor/actions` | 3 | Doctor action item management |
| `/patient` | 3 | Patient dashboard aggregation |
| `/health-data` | 3 | Health-data consent APIs |
| `/medical-reports` | 4 | Report-oriented endpoints |
| `/patient-data-sharing` | 3 | Fine-grained sharing preferences |

### AI OCR Service (Port 8001)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | OCR service readiness and mode |
| `POST /ocr/prescription` | Structured prescription extraction |
| `POST /ocr/medical-report` | Structured medical report extraction |

---

## Frontend Architecture

### Route Structure

```
frontend/app/
├── (admin)/                    # Admin routes (verification gate)
│   ├── admin/                  # Admin panel
│   ├── verify-pending/         # Doctor verification queue
│   └── schedule-review/        # Schedule approval
├── (auth)/                     # Unauthenticated routes
│   ├── login/                  # Login page
│   ├── patient/register/       # Patient signup
│   ├── doctor/register/        # Doctor signup
│   └── forgot-password/        # Password recovery
├── (onboarding)/               # Onboarding routes
│   ├── patient/                # Patient onboarding wizard
│   └── doctor/                 # Doctor onboarding wizard
├── (home)/                     # Authenticated home routes
│   ├── patient/                # Patient dashboard & features
│   │   ├── home/               # Patient home dashboard
│   │   ├── find-doctor/        # AI-powered doctor search
│   │   ├── appointments/       # Appointment management
│   │   ├── medical-history/    # Comprehensive medical history
│   │   ├── prescriptions/      # Prescription history
│   │   ├── analytics/          # Health analytics
│   │   ├── chorui-ai/          # AI assistant
│   │   └── reminders/          # Medication reminders
│   ├── doctor/                 # Doctor dashboard & features
│   │   ├── home/               # Doctor home dashboard
│   │   ├── appointments/       # Appointment management
│   │   ├── schedule/           # Schedule management
│   │   ├── patients/           # Patient records
│   │   ├── chorui-ai/          # AI assistant for doctors
│   │   ├── analytics/          # Practice analytics
│   │   └── profile/            # Doctor profile
│   └── notifications/          # Notification center
└── [locale]/                   # i18n locale routes
```

### Server Actions (20 modules)

| Module | Purpose |
|--------|---------|
| `auth-actions.ts` | Authentication operations |
| `appointment-actions.ts` | Appointment booking and management |
| `doctor-actions.ts` | Doctor profile and search |
| `ai-consultation-actions.ts` | AI chat and consultation |
| `prescription-actions.ts` | Prescription management |
| `patient-dashboard-actions.ts` | Patient dashboard aggregation |
| `medical-report-actions.ts` | Medical report operations |
| `health-metrics-actions.ts` | Health metrics CRUD |
| `notification-actions.ts` | Notification management |
| `reminder-actions.ts` | Reminder scheduling |
| `medicine-actions.ts` | Medicine search |
| `availability-actions.ts` | Doctor availability |
| `patient-access-actions.ts` | Access sharing |
| `patient-data-sharing-actions.ts` | Data sharing preferences |
| `health-data-consent-actions.ts` | Consent management |
| `admin-actions.ts` | Admin operations |
| `file-storage-actions.ts` | File upload/download |
| `google-calendar-actions.ts` | Calendar integration |
| `clinical-prescription-document.ts` | Prescription PDF generation |
| `prescription-document-export.ts` | Document export |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useChoruiChat.ts` | Chorui AI chat state management |
| `use-realtime-slots.ts` | Realtime appointment slot subscriptions |
| `use-push-notifications.ts` | PWA push notification handling |
| `use-offline.ts` | Offline detection and queueing |
| `use-device-access.ts` | Camera, location, file picker access |
| `use-voice-recorder.ts` | Voice recording for ASR |
| `use-gsap.ts` | GSAP animation integration |

---

## Deployment & CI/CD

### Production Deployment
- **Frontend**: [PLACEHOLDER_FRONTEND_URL]
- **Backend**: [PLACEHOLDER_BACKEND_URL]
- **AI OCR Service**: [PLACEHOLDER_AI_SERVICE_URL]

### CI/CD Pipelines (GitHub Actions)

| Workflow | File | Purpose |
|----------|------|---------|
| Deploy Backend | `deploy-backend.yml` | Build + deploy backend to Azure Container Apps |
| Deploy AI OCR | `deploy-ai-ocr.yml` | Build + deploy AI OCR to Azure Container Apps |
| Performance Budget | `performance-budget.yml` | Bundle budget + Lighthouse CI gates |
| Testing & Benchmarking | `testing-benchmarking.yml` | Run test suite and benchmarks |

### Docker Configuration
- **Backend**: `python:3.11-slim`, non-root `appuser`, health checks on `/health`
- **AI OCR**: `python:3.11-slim`, `libgomp1` for ONNX, non-root execution
- **Entrypoint**: DB wait → migrations → uvicorn startup

---

## Testing & Quality Assurance

### Test Suite Structure

| Test Type | Location | Coverage |
|-----------|----------|----------|
| Unit Tests | `tests/unit/backend/` | AI orchestrator, privacy, service logic |
| Unit Tests | `tests/unit/ai_service/` | Matcher, parser, pipeline, YOLO |
| Integration Tests | `tests/integration/backend/` | API contracts, clinical lifecycle |
| E2E Tests | `tests/e2e/specs/` | Playwright: booking, verification, OCR |
| Security Tests | `tests/security/` | RBAC and JWT validation |
| Performance Tests | `tests/performance/` | API latency, concurrency, OCR, chaos |

### Benchmarking Tools
- **Locust**: Load testing with realistic healthcare workloads
- **k6**: API performance and stress testing
- **Lighthouse CI**: Frontend performance budget gates
- **Chaos Recovery**: Fault tolerance testing

### Observability
- **Prometheus**: Metrics collection for all services
- **Grafana**: 4 dashboards (AI Performance, Appointment Load, Error Heatmap, System Health)
- **Web Vitals**: Real user monitoring via Serwist

---

## Development Workflow

### Branching Strategy
- `main`: Stable production branch
- `feature/<scope>-<topic>`: Feature branches
- `fix/<scope>-<topic>`: Bug fix branches
- `chore/<scope>-<topic>`: Maintenance and docs

### Quality Gates
- ESLint 9 + strict TypeScript configuration
- Pydantic v2 schema validation
- Alembic migration checks
- Lighthouse performance budget
- Bundle size checks

---

## Key Engineering Decisions

### Why This Architecture Was Chosen
1. **Service boundary between core API and OCR compute** keeps core workflows stable under image-heavy load
2. **Async backend architecture** supports concurrent appointment/notification workflows
3. **Realtime and background-worker primitives** reduce user-facing state drift
4. **AI orchestration centralization** enforces consistent prompting, validation, and privacy handling

### Key Trade-Offs
1. Multi-service coordination increases deployment and observability complexity
2. OCR quality depends on both detection and OCR provider quality; fallback logic is essential
3. Realtime subscriptions improve freshness but add state-sync complexity in UI clients

### Scalability Path
- Introduce queue-backed async jobs for OCR and heavy assistant computations
- Add dedicated telemetry pipelines for latency/error-rate per endpoint/workflow
- Expand read model/caching strategy for high-volume doctor search and dashboard paths
- Introduce canary rollout controls for AI provider switching and prompt-version migration

---

## Future Roadmap

### Planned Features
- Payment gateway integration for consultation fees
- Video consultation (WebRTC)
- Pharmacy integration and medicine delivery
- Lab test booking and results
- Emergency contact and ambulance services
- Multi-language support expansion (Hindi, Urdu)
- Advanced analytics and predictive insights
- Telemedicine regulations compliance module

### Technical Improvements
- Publish formal architecture, sequence, and ER diagrams
- Expand integration tests for consent, RBAC, and appointment race conditions
- Add contract tests for server actions against backend schema evolution
- Add performance baselines and SLO tracking dashboards
- Improve multilingual UX and healthcare-term normalization
- Introduce richer audit analytics for patient data access transparency
- Externalize ASR into a dedicated microservice

---

## Project Timeline

| Phase | Dates | Key Deliverables |
|-------|-------|------------------|
| Initial Development | Jan 7-23, 2026 | Auth, onboarding, appointments, doctor search, medical history |
| Core Features | Jan 27 - Feb 19, 2026 | Medicine search, reminders, notifications, prescriptions |
| AI Integration | Mar 11-27, 2026 | Chorui assistant, AI orchestrator, voice control, OCR |
| Polish & Deployment | Mar 18 - Apr 1, 2026 | PWA, responsiveness, reschedule, Google Calendar, Azure deployment |
| Advanced Features | Apr 8-12, 2026 | Analytics, data sharing, Vapi integration, prescription history |

---

## Contributors

| Name | Student ID | Role | Commit Count |
|------|-----------|------|--------------|
| Sarwad Hasan Siddiqui | 2107006 | Backend Lead, DevOps, AI/ML | 100+ |
| Adiba Tahsin | 2107031 | Frontend Lead, UI/UX, AI Integration | 85+ |

**Course**: CSE-3200 (System Project)  
**Instructor**: Kazi Saeed Alam  
**Institution**: KUET (Khulna University of Science & Technology), CSE Department  
**Level**: 3-2 (Spring 2026)
