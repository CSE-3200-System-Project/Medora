# Team Contributions & Work Distribution

## Overview

Medora was built by **two developers** working collaboratively over a **3-month period** (January 2026 - April 2026). The project represents **185+ git commits** with clear division of responsibilities while maintaining significant overlap in critical areas to ensure system cohesion.

---

## Contributor Profiles

### Sarwad Hasan Siddiqui (2107006)
**Role**: Backend Lead, DevOps, AI/ML Infrastructure  
**Git Handles**: `rockstatata`, `Sarwad Hasan Siddiqui`  
**Commit Count**: 100+ commits (54% of total)  
**Primary Focus Areas**:
- Backend architecture and API design
- Database schema and migrations
- AI/ML service integration
- DevOps and cloud deployment
- Performance optimization
- Security and authentication

### Adiba Tahsin (2107031)
**Role**: Frontend Lead, UI/UX, AI Feature Integration  
**Git Handle**: `Adiba Tahsin`  
**Commit Count**: 85+ commits (46% of total)  
**Primary Focus Areas**:
- Frontend architecture and component design
- User experience and responsive design
- AI assistant (Chorui) integration
- Internationalization (i18n)
- Testing and observability
- Documentation

---

## Detailed Contribution Breakdown

### Sarwad Hasan Siddiqui - Backend & Infrastructure Lead

#### Backend Architecture (30+ commits)
**Core Infrastructure:**
- FastAPI application setup with async SQLAlchemy
- Route registration and middleware composition (`backend/app/main.py`)
- Dependency injection system (`backend/app/core/dependencies.py`)
- Security layer: JWT verification, RBAC enforcement (`backend/app/core/security.py`)
- PII anonymization for AI inputs (`backend/app/core/ai_privacy.py`)
- Data sharing consent guard (`backend/app/core/data_sharing_guard.py`)

**Database & Models:**
- 41 SQLAlchemy model classes across 26 model files
- 47 Alembic migration files tracking schema evolution
- Database session management and Supabase integration
- Row Level Security (RLS) context implementation

**API Endpoints (26 route modules, 194 handlers):**
- `/auth` - Authentication system (signup, login, session, password reset)
- `/profile` - Onboarding and profile state management
- `/doctor` - Doctor profile and operations
- `/appointment` - Appointment lifecycle (booking, slots, transitions)
- `/ai` - AI doctor search, Chorui assistant, voice normalization
- `/consultation` - Consultation workspace
- `/upload` - File upload and OCR handoff
- `/admin` - Admin verification and moderation
- `/reminders` - Reminder CRUD and scheduling
- `/notifications` - In-app and push notification APIs
- `/medicine` - Medicine search
- `/medical-test` - Test tracking
- `/health-metrics` - Vital signs tracking
- `/health-data` - Health data consent
- `/patient-access` - Access sharing and logs
- `/patient-data-sharing` - Fine-grained sharing preferences
- `/medical-reports` - Medical report endpoints
- `/availability` - Doctor availability
- `/reschedule` - Reschedule workflow
- `/oauth` - Google Calendar OAuth
- `/doctor/actions` - Doctor action items
- `/patient` - Patient dashboard aggregation
- `/specialities` - Specialty catalog
- `/health` - Health check

**Service Layer (19 service modules):**
- `ai_orchestrator.py` - Model provider abstraction (Groq/Gemini/Cerebras)
- `appointment_service.py` - Appointment lifecycle logic
- `asr.py` - Faster-whisper ASR service
- `availability_service.py` - Availability management
- `chorui_intent_normalizer.py` - AI intent normalization
- `chorui_navigation_engine.py` - Navigation engine for AI assistant
- `chorui_navigation_registry.py` - Navigation route registry
- `doctor_action_service.py` - Doctor action management
- `email_service.py` - SMTP email dispatch
- `geocoding.py` - Location geocoding
- `google_calendar_service.py` - Calendar sync
- `medical_knowledge.py` - Medical knowledge base
- `notification_service.py` - Notification dispatch
- `push_service.py` - VAPID web push delivery
- `reminder_dispatcher.py` - Background reminder loop
- `slot_service.py` - Slot management
- `specialty_matching.py` - Specialty matching logic

#### AI/ML Services (20+ commits)
**AI OCR Service (`ai_service/`):**
- FastAPI OCR service architecture (port 8001)
- YOLO ONNX region detection pipeline
- Azure Document Intelligence integration
- PaddleOCR fallback implementation
- Medicine matching via RapidFuzz
- Prescription and medical report parsing
- Image normalization and input handling

**AI Orchestration:**
- Provider-agnostic AI orchestration layer
- Schema-validated output generation
- Prompt versioning and management
- Safety guardrails implementation
- Conversation persistence for Chorui

**Voice AI:**
- Vapi voice integration for Chorui assistant
- Voice tool webhook handling
- Prescription voice summary
- AI doctor search voice control

#### DevOps & Deployment (15+ commits)
**Containerization:**
- Backend Dockerfile (`python:3.11-slim`, non-root `appuser`)
- AI OCR Dockerfile (with `libgomp1` for ONNX)
- Docker Compose configuration
- Entrypoint script (DB wait → migrations → uvicorn)

**Cloud Deployment (Azure):**
- Azure Container Apps configuration
- Azure Container Registry integration
- GitHub Actions CI/CD workflows:
  - `deploy-backend.yml`
  - `deploy-ai-ocr.yml`
  - `performance-budget.yml`
  - `testing-benchmarking.yml`

**Performance & Monitoring:**
- Prometheus configuration (`observability/prometheus.yml`)
- 4 Grafana dashboards:
  - AI Performance Dashboard
  - Appointment Load Dashboard
  - Error Heatmap Dashboard
  - System Health Overview
- Lighthouse CI configuration (mobile + desktop)
- Bundle budget checks

#### Performance Optimization (10+ commits)
- Realtime slot subscriptions via Supabase channels
- HTTP caching layer
- Connection pooling optimization
- Background worker loops (reminder dispatcher, appointment hold sweep)
- Async I/O patterns throughout
- Whisper ASR preload configuration

#### Security & Privacy (8+ commits)
- JWT verification and token validation
- Role-based access control (RBAC)
- Data sharing consent enforcement
- PII anonymization for AI inputs
- CORS configuration
- Environment-driven behavior
- Account moderation and banning

---

### Adiba Tahsin - Frontend & UX Lead

#### Frontend Architecture (25+ commits)
**Next.js 16 Application:**
- App Router structure with route groups
- Server actions pattern (20 action modules)
- Client/server component separation
- Proxy middleware for route protection (`proxy.ts`)
- Error boundaries and global error handling
- Service worker integration (Serwist PWA)

**Component Library:**
- 45 shadcn/ui components with responsive variants
- Radix UI primitives integration
- CVA (class-variance-authority) variant system
- Touch-friendly components (44px minimum targets)
- Mobile-first responsive design (320px baseline)

**UI Components by Domain:**
- **Admin**: Admin panel pages, patient management, verification queue
- **AI**: AIAssistantPanel, ChoruiChat, ChoruiSummaryPanel, voice control
- **Appointments**: Booking calendar, reschedule dialogs, cancel dialogs
- **Consultation**: ConsultationWorkspace, ConsultationActions
- **Doctor**: Profile, schedule setter, availability manager, analytics
- **Medical History**: Timeline, surgery manager, vaccination manager, medication wizard
- **Patient**: Home dashboard, analytics, appointment calendar
- **Prescription**: MedicationForm, PrescriptionReview, SurgeryForm, TestForm
- **Onboarding**: Doctor and patient wizards, step indicator

#### Internationalization (i18n) (15+ commits)
**next-intl Integration:**
- English and Bangla translation support
- 10 translation categories:
  - `auth.json` (English + Bangla)
  - `dashboard.json` (English + Bangla)
  - `medicine.json` (English + Bangla)
  - `consultation.json` (English + Bangla)
  - `common.json` (English + Bangla)
  - `chorui.json` (English + Bangla)
  - And more...
- Locale-aware routing via `[locale]` route group
- Message loader and error map
- Client and server-side translation

#### Chorui AI Assistant Integration (20+ commits)
**Full Frontend Pipeline:**
- ChoruiChat component with role context (patient/doctor)
- Chat message display and input handling
- Voice control via Vapi integration
- Navigation execution from AI commands
- Summary panels and patient summary cards

**Key Features Implemented:**
- Persistent chat UI with conversation history
- Role-scoped data access in UI
- Confidence-based navigation policy
  - Auto-navigate ≥ 0.85
  - Confirm 0.60-0.84
  - Clarify < 0.60
- Undo/recovery system for navigation
- Soft suggestion system

**Voice Integration:**
- `chorui-vapi-voice-control.tsx` component
- Prescription voice summary
- AI doctor search voice control
- Audio recording and ASR integration

#### Prescription System (15+ commits)
**Frontend Implementation:**
- Consultation workspace with tabbed forms
- Medication, test, and surgery forms
- Dynamic dosage schedule UI
- HTML rendering for prescriptions
- PDF export functionality
- Prescription review component with dosage display
- Prescription history pages
- Accept/reject workflow for patients

**Backend Support:**
- Consultation draft feature
- Rendered prescription HTML and snapshot fields
- Prescription model enhancements

#### Patient & Doctor Dashboards (12+ commits)
**Patient Dashboard:**
- Home dashboard with health score chart
- Appointment status cards
- Medication trend charts
- Analytics page with comprehensive charts
- Medical history with tabbed interface
- Prescription history with filtering

**Doctor Dashboard:**
- Home dashboard with upcoming appointments
- Patient records access
- Analytics dashboard with practice metrics
- Schedule management with per-day time slots
- Google Calendar integration UI
- Patient consultation workspace

#### Testing & Observability (10+ commits)
**E2E Testing:**
- Playwright configuration
- Test specs for:
  - Appointment booking and reschedule
  - Doctor verification
  - Patient onboarding
  - Prescription upload and OCR

**Performance Testing:**
- API latency benchmark scripts
- DB concurrency benchmark
- OCR pipeline benchmark
- Chaos recovery test
- Frontend performance guard
- Realtime slot consistency benchmark

**Load Testing:**
- Locust file (`tests/locust/locustfile.py`)
- k6 healthcare workload script
- Benchmark baseline tracking
- Regression guard script

**Observability:**
- Web vitals collection via Serwist
- OpenTelemetry instrumentation (`instrumentation-client.ts`)
- Performance API endpoint (`/api/perf/vitals`)
- Grafana dashboard configurations

#### Appointment & Reschedule System (12+ commits)
**Appointment Features:**
- Booking calendar with realtime slot updates
- Appointment status management
- Reschedule functionality (backend + frontend)
- Cancellation with reason and metadata
- Soft hold and reschedule consistency
- Admin patient management for appointments

**Reschedule Notification System:**
- Bidirectional reschedule workflow
- Doctor proposes → patient receives notification → accept/reject → doctor gets response
- Three new notification types:
  - `appointment_reschedule_request`
  - `appointment_reschedule_accepted`
  - `appointment_reschedule_rejected`
- RescheduleNotificationCard component
- Calendar view integration

#### Documentation (8+ commits)
**Technical Documentation:**
- Backend Implementation PRD (`docs/backend-implementation-prd.md`)
- Frontend Implementation PRD (`docs/frontend-implementation-prd.md`)
- Chorui AI Pipeline documentation (`docs/chorui-ai-pipeline.md`)
- PWA documentation (`docs/pwa-doc.md`)
- Testing & benchmarking guide (`docs/testing-benchmarking.md`)
- Vapi AI audit guide (`docs/vapi-ai-audit-guide.md`)
- Vapi voice integration (`docs/vapi-voice-integration.md`)
- AI Navigation implementation plan
- AI navigation audit document

---

## Collaborative Work

### Areas of Overlap (Both Contributors)
The following critical areas show **intentional collaboration** with both developers contributing:

1. **Prescription System**: Both backend models and frontend UI developed in parallel with multiple merge commits
2. **AI Consultation**: Chorui assistant required tight backend-frontend coordination
3. **Medical History**: Joint effort on data model, UI, and AI search integration
4. **Appointment System**: Lifecycle from booking to reschedule involved both developers
5. **Authentication & Onboarding**: Initial system setup with joint testing
6. **Responsive Design**: Mobile optimization across all screens
7. **Merge Commits**: 15+ merge commits showing active collaboration and code integration

### Integration Points
- **API Contracts**: Backend schemas matched to frontend server action types
- **Database Migrations**: Coordinated frontend feature releases with backend schema changes
- **Realtime Features**: Supabase channel subscriptions requiring both backend events and frontend hooks
- **AI Features**: Prompt engineering with frontend UX considerations
- **Notification System**: Backend dispatch with frontend display and interaction

---

## Commit Timeline

### January 2026 - Foundation Phase
**Week 1-2 (Jan 7-23):**
- Authentication system setup
- Doctor and patient onboarding flows
- Initial appointment booking system
- Doctor search with AI (Groq/Llama integration)
- Medical history foundation
- Admin verification panel
- Medicine search feature

**Week 3-4 (Jan 27-30):**
- Reminders feature implementation
- Consultation and prescription system foundation
- Medical test tracking
- Patient access management
- Voice-to-text ASR integration

### February 2026 - Core Features Phase
**Week 1-2 (Feb 12-19):**
- Multi-type prescription support
- Notification workflow
- Docker containerization
- Medical history enhancements
- Microservices architecture documentation

### March 2026 - AI & Polish Phase
**Week 1-2 (Mar 11-18):**
- PWA support with offline capabilities
- CI/CD workflows for Azure deployment
- Password reset flow
- Google Calendar integration
- Doctor scheduling system
- File upload support
- Light/dark mode audit

**Week 3-4 (Mar 19-27):**
- AI Prescription OCR Service
- Chorui AI assistant (backend + frontend)
- AI orchestrator service
- Patient summary card
- Health data consent and metrics
- Doctor actions feature
- Admin section overhaul
- AI consultation features
- Medical report management
- Patient data sharing
- Location management

### April 2026 - Advanced Features Phase
**Week 1 (Apr 1-8):**
- Reschedule notifications
- Doctor analytics dashboard
- Admin patient management
- Appointment cancellation metadata
- Soft hold and reschedule consistency
- Performance testing and benchmarking
- Grafana dashboards

**Week 2 (Apr 8-12):**
- Chorui navigation engine and registry
- AI navigation with route validation
- Internationalization across all components
- Bengali translations
- VAPI voice control integration
- Prescription history
- Consultation route updates
- Voice transcription review

---

## Code Quality & Engineering Practices

### Shared Engineering Standards
Both developers maintained consistent quality standards:

1. **Type Safety**: TypeScript strict mode, Pydantic v2 validation
2. **Code Organization**: Feature-based module structure, separation of concerns
3. **Documentation**: Inline comments, PRDs, task tracking
4. **Testing**: Unit, integration, E2E coverage
5. **Performance**: Async patterns, caching, bundle budgets
6. **Security**: RBAC, consent enforcement, PII protection

### Git Workflow
- Feature branches with descriptive naming
- Regular merges to maintain synchronization
- Descriptive commit messages with scope prefixes
- Merge commits for major integrations
- No force pushes to main (preserves history)

---

## Summary Statistics

| Metric | Sarwad | Adiba | Shared |
|--------|--------|-------|--------|
| Total Commits | 100+ | 85+ | 15+ merges |
| Backend Files | 60+ | 10 | - |
| Frontend Files | 15 | 80+ | - |
| AI/ML Files | 25+ | 5 | - |
| Documentation | 8 | 12 | - |
| Tests | 10 | 12 | - |
| DevOps/CI | 15+ | 3 | - |
| Lines of Code (est.) | 15,000+ | 18,000+ | - |

### Technical Breadth
- **Languages**: Python, TypeScript, SQL, Dockerfile, YAML
- **Frameworks**: FastAPI, Next.js, React, SQLAlchemy
- **Databases**: PostgreSQL, Supabase
- **Cloud**: Azure Container Apps, Azure Container Registry
- **AI/ML**: Groq, Gemini, Cerebras, Azure OCR, YOLO, Vapi
- **Testing**: Pytest, Playwright, Locust, k6, Lighthouse

---

## Verification

All contributions are verifiable via git history:
```bash
# View commits by Sarwad
git log --author="rockstatata\|Sarwad" --oneline

# View commits by Adiba
git log --author="Adiba" --oneline

# View commit statistics
git shortlog -sn --all

# View file changes by author
git log --author="rockstatata" --stat
git log --author="Adiba" --stat
```

The git commit history serves as immutable proof of work distribution, with each commit traceable to its author, timestamp, and modified files.
