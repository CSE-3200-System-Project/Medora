# Medora

**A production-grade, AI-native healthcare platform built for Bangladesh.**

Medora is a full-stack digital healthcare system that connects patients, doctors, and administrators through intelligent workflows. It combines structured medical record management, real-time appointment scheduling, AI-assisted clinical decision support, computer vision prescription parsing, and voice transcription into a single, cohesive platform. Every layer of the system, from the progressive web app frontend to the microservice backend to the machine learning pipelines, is designed around one principle: safety-first healthcare delivery at scale.

This is not a prototype. Medora ships with 22 database models, 36 schema migrations, 24 API route modules, a multi-provider AI orchestration layer with PII anonymization, a custom-trained YOLO object detection model for prescription region extraction, real-time slot synchronization via PostgreSQL change streams, a background reminder dispatcher with timezone-aware scheduling, and a service worker with offline-first caching, background sync, and push notifications. It is built to run in production on Azure Container Apps with scale-to-zero economics.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
  - [Patient Workflows](#patient-workflows)
  - [Doctor Workflows](#doctor-workflows)
  - [Admin Workflows](#admin-workflows)
  - [Chorui AI Healthcare Assistant](#chorui-ai-healthcare-assistant)
  - [Prescription OCR Pipeline](#prescription-ocr-pipeline)
  - [AI-Assisted Doctor Discovery](#ai-assisted-doctor-discovery)
- [Authentication and Authorization](#authentication-and-authorization)
- [Database Architecture](#database-architecture)
- [AI and Machine Learning](#ai-and-machine-learning)
- [Progressive Web App](#progressive-web-app)
- [Real-Time Features](#real-time-features)
- [Design System](#design-system)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Architecture Overview

Medora follows a microservices architecture with clean separation between compute and data layers.

```
                          +-------------------+
                          |    Frontend (PWA)  |
                          |  Next.js 16 + React 19  |
                          +--------+----------+
                                   |
                     HTTPS (Bearer Token Auth)
                                   |
                  +----------------+----------------+
                  |                                 |
         +--------v--------+             +---------v---------+
         |  Backend Service |             |  AI OCR Service   |
         |  FastAPI (Core)  |             |  FastAPI + YOLO   |
         |  Port 8000       |             |  Port 8001        |
         +--------+---------+             +---------+---------+
                  |                                 |
                  |          +-----------+          |
                  +--------->| Supabase  |<---------+
                             |           |
                             | PostgreSQL|
                             | Storage   |
                             | Auth      |
                             | Realtime  |
                             +-----------+
```

**Three-service pattern:**

| Service | Role | Scaling Profile |
|---------|------|-----------------|
| **Backend** | Authentication, RBAC, business logic, orchestration. Never loads ML models. | 0.5 vCPU, 1 GB RAM |
| **AI Service** | Prescription OCR, YOLO detection, medicine matching, text parsing. | 1 vCPU, 2 GB RAM, 0-3 replicas |
| **STT Service** | Speech-to-text via faster-whisper with int8 quantization. | 1-2 vCPU, 2-4 GB RAM |

Services communicate through the backend as orchestrator. The AI and STT services never talk to each other directly. All three scale to zero when idle, keeping costs under control for development and low-traffic production environments.

**Data layer:** Supabase provides PostgreSQL (with Row-Level Security), object storage for medical documents and images, JWT-based authentication, and real-time change streams for live slot updates.

---

## Technology Stack

### Frontend

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16.1.6 (App Router, Server Components) |
| Language | TypeScript 5 (strict mode) |
| UI Runtime | React 19.2.3 |
| Styling | Tailwind CSS 4 with CSS custom properties |
| Components | shadcn/ui (44 components) on Radix UI primitives |
| Animation | Framer Motion 12, tw-animate-css |
| Charts | ECharts 6, Recharts 3 |
| Maps | MapLibre GL 5.16 |
| PWA | Serwist 9.5 (Service Worker, precaching, background sync) |
| Smooth Scroll | Lenis 1.3 |
| Icons | Lucide React |
| Performance | Web Vitals RUM telemetry, Lighthouse CI |

### Backend

| Category | Technology |
|----------|-----------|
| Framework | FastAPI 0.95+ (async) |
| Runtime | Python 3.11, Uvicorn |
| ORM | SQLAlchemy 2.0+ (async sessions via asyncpg) |
| Migrations | Alembic (36 versioned migrations) |
| Validation | Pydantic v2, pydantic-settings |
| Auth | Supabase JWT with JWKS verification and 5-minute cache |
| AI Providers | Groq, Google Gemini, Cerebras (provider-agnostic orchestrator) |
| Voice | faster-whisper (small model, int8) |
| Push | pywebpush (VAPID) |
| Calendar | Google Calendar API (OAuth) |
| Database | PostgreSQL via Supabase (asyncpg driver, pool size 10, overflow 20) |

### AI OCR Service

| Category | Technology |
|----------|-----------|
| Detection | YOLO v8 (custom Yolo26s model, ONNX runtime) |
| OCR | Azure AI Document Intelligence (prebuilt-read) |
| Matching | PostgreSQL trigram similarity (pg_trgm) + RapidFuzz |
| PDF Support | pypdfium2 |
| Image Processing | Pillow with auto-contrast and adaptive JPEG compression |

### Infrastructure

| Category | Technology |
|----------|-----------|
| Compute | Azure Container Apps (Consumption Plan, scale-to-zero) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Object Storage (S3-compatible) |
| CI/CD | GitHub Actions (backend deploy, AI deploy, frontend perf budget) |
| Containers | Docker (multi-stage, non-root, health checks) |
| Registry | Azure Container Registry |

---

## Project Structure

```
medora/
|
+-- frontend/                    # Next.js 16 Progressive Web App
|   +-- app/                     # App Router pages and layouts
|   |   +-- (auth)/              # Login, registration, password reset
|   |   +-- (onboarding)/        # Patient and doctor onboarding wizards
|   |   +-- (home)/              # Authenticated routes (patient, doctor)
|   |   +-- (admin)/             # Admin dashboard and management
|   |   +-- api/                 # Lightweight API routes (auth, perf)
|   |   +-- sw.ts                # Service worker source (Serwist)
|   +-- components/              # Feature-organized component library
|   |   +-- ui/                  # 44 shared UI components (shadcn/ui)
|   |   +-- admin/               # Admin panels and verification
|   |   +-- auth/                # Auth forms and flows
|   |   +-- doctor/              # Doctor-specific interfaces
|   |   +-- patient/             # Patient dashboard and records
|   |   +-- ai/                  # Chorui AI chat interface
|   |   +-- appointment/         # Booking and calendar components
|   |   +-- prescription/        # Prescription display and management
|   |   +-- medicine/            # Medicine search interface
|   |   +-- onboarding/          # Multi-step onboarding wizards
|   |   +-- landing/             # Public landing page
|   +-- lib/                     # Server actions, utilities, services
|   |   +-- *-actions.ts         # 17 server action modules (~4,000 lines)
|   +-- hooks/                   # Client-side React hooks
|   +-- types/                   # TypeScript type definitions
|   +-- public/                  # Static assets, PWA manifest, icons
|
+-- backend/                     # FastAPI Core Service
|   +-- app/
|   |   +-- core/                # Config, security, dependencies
|   |   +-- db/                  # Database session, base, Supabase client
|   |   |   +-- models/          # 22 SQLAlchemy models + enums
|   |   +-- routes/              # 24 route modules (14,000+ lines)
|   |   +-- schemas/             # 18 Pydantic schema modules
|   |   +-- services/            # 14 business logic services
|   |   +-- main.py              # Application entry with lifespan
|   +-- alembic/                 # Database migrations
|   |   +-- versions/            # 36 migration scripts
|   +-- context/                 # Architecture docs and PRDs
|   +-- Dockerfile               # Multi-stage production image
|   +-- docker-compose.yaml      # Local development setup
|   +-- requirements.txt         # Python dependencies
|
+-- ai_service/                  # Prescription OCR Microservice
|   +-- app/
|   |   +-- main.py              # FastAPI entry point
|   |   +-- pipeline.py          # OCR pipeline orchestration
|   |   +-- yolo.py              # YOLO region detection
|   |   +-- azure_ocr.py         # Azure Document Intelligence client
|   |   +-- parser.py            # Prescription text parsing
|   |   +-- matcher.py           # Medicine database matching
|   |   +-- normalize.py         # Text normalization (Bangla + English)
|   |   +-- db.py                # Medicine search repository
|   |   +-- config.py            # 50+ configurable settings
|   |   +-- schemas.py           # Request/response models
|   +-- models/                  # YOLO ONNX model weights
|   +-- deploy/                  # Azure Container Apps scripts
|   +-- requirements.txt         # Python dependencies
|
+-- docs/                        # Architecture and feature documentation
|   +-- chorui-ai-pipeline.md    # Chorui AI architecture spec
|   +-- pwa-doc.md               # PWA implementation details
|   +-- frontend-implementation-prd.md
|   +-- backend-implementation-prd.md
|
+-- tasks/                       # Project tracking
+-- .github/
|   +-- workflows/               # CI/CD pipelines
|   +-- copilot-instructions.md  # Development guidelines (763 lines)
+-- CLAUDE.md                    # Design principles and brand guidelines
```

---

## Core Features

### Patient Workflows

**Eight-Step Onboarding Wizard.** New patients complete a structured intake covering personal identity, physical metrics, chronic conditions, current medications, allergies, medical history (surgeries, hospitalizations, vaccinations), family history, lifestyle and mental health indicators, and preferences including language, notification channels, emergency contacts, and granular consent controls (storage, AI, doctor access, research participation).

**Doctor Discovery.** Patients can search for doctors through a traditional filter interface (specialty, location, availability, gender, language) or through an AI-assisted flow where they describe their health concern in free-form Bangla, English, or mixed text. The system extracts symptoms, infers urgency, maps to medical specialties, and returns a ranked list of appropriate doctors with explanations.

**Real-Time Appointment Booking.** Available time slots update in real time via Supabase PostgreSQL change streams. When another patient books a slot, the interface reflects the change immediately without polling. The booking flow includes conflict prevention, doctor confirmation gates, and automatic notification dispatch.

**Prescription Management.** Patients view active and past prescriptions, accept or reject individual medication items, and track prescription history over time. Prescriptions issued by doctors include structured medication details, test orders, and surgical recommendations.

**Health Metrics Tracking.** Blood pressure, weight, blood sugar, heart rate, sleep, and step count can be recorded manually or imported from devices. Tracking requires explicit health data consent, and patients control which doctors can access their metric history.

**Medical History Timeline.** A longitudinal view of all visits, tests, conditions, medications, surgeries, and hospitalizations, providing patients and their authorized doctors with a complete clinical picture.

**Reminders.** Configurable medication, appointment, and follow-up reminders delivered through push notifications, in-app alerts, and the background reminder dispatcher. Supports multiple daily times and timezone-aware scheduling (default: Asia/Dhaka).

**Privacy and Access Controls.** Patients grant and revoke doctor access to their health records. Every access event is logged in an audit trail visible to the patient, including AI-assisted queries made by doctors.

### Doctor Workflows

**Credential Verification.** Doctors must be verified by an administrator (BMDC credential review) before accessing patient data or conducting consultations. The verification gate blocks all protected routes until approval.

**Schedule Management.** Doctors configure weekly availability slots, set per-day appointment limits, and optionally sync their schedule with Google Calendar through OAuth integration.

**Patient Management.** A searchable patient roster with access to authorized medical records. Doctors view a patient's full profile, conditions, medications, allergies, risk flags, and appointment history before or during consultation.

**Consultation Interface.** A dedicated workspace for active consultations with integrated access to the patient's medical record, AI-assisted intake review, voice-to-text for symptom input, and structured prescription issuance (medications, lab tests, surgical recommendations).

**Action Items.** A task management system for pending follow-ups, lab reviews, patient messages, and manual tasks. Each action carries a priority level (low, medium, high, urgent) and status tracking.

**Analytics Dashboard.** Visual analytics including monthly revenue, weekly workload stress index (WSI), patient demographics, appointment completion rates, and practice trends. Built with ECharts and Recharts.

### Admin Workflows

**Doctor Verification Panel.** Review pending doctor registrations with BMDC credential details. Approve, reject, or request additional documentation.

**Platform Oversight.** Dashboard with key metrics across appointments, users, and revenue. Manage doctor and patient accounts, view all system appointments, and access the audit log for compliance.

**User Management.** Ban and unban users, review account status, and handle escalated safety concerns.

---

### Chorui AI Healthcare Assistant

Chorui is Medora's built-in AI healthcare assistant. It operates in two role-scoped modes with fundamentally different data access patterns.

**Patient Mode.** Patients interact with Chorui to understand their own medical records. The assistant can summarize medications, explain conditions, surface allergy information, highlight risk flags, review surgical and hospitalization history, and provide upcoming appointment details. All responses are drawn from the patient's own authorized records stored in the database.

**Doctor Mode.** Doctors use Chorui for general schedule queries (upcoming 7-day appointments, active patient list) and for patient-specific consultation support. When a doctor provides a patient ID, Chorui retrieves authorized patient data (medications, conditions, allergies, risk factors, history) to support clinical reasoning. Every doctor AI query is logged as a `view_ai_query` access event, and patients can review their AI access history for full transparency.

**Safety Architecture:**

- Chorui is assistive intelligence only. It never performs autonomous diagnosis, prescribing, or treatment recommendations.
- Explicit safety guards block requests for diagnosis confirmation, dosage recommendations, and emergency treatment instructions. All such queries are redirected to licensed clinicians.
- The system supports a strict-local retrieval mode (`CHORUI_PRIVACY_MODE=strict_local`) that operates entirely from database reads without making external API calls.
- Conversation ownership is validated per user. If a conversation ID belongs to another user, access is denied. If the role context or patient scope changes mid-conversation, the server rotates to a new conversation thread.
- PII is anonymized using stable hash tokens before any data reaches external AI providers.

**Conversation Persistence.** Chat turns are stored in `chorui_chat_messages` with full metadata: conversation ID, user ID, patient ID, role context, sender, message text, classified intent, structured data extraction, context mode, IP address, and user agent. This enables multi-turn continuity, follow-up intent inference from prior conversation history, and complete audit trails.

**Structured Data Extraction.** Beyond natural language responses, Chorui returns structured payloads including extracted symptoms, conditions, duration, and severity, which can feed into downstream clinical workflows.

---

### Prescription OCR Pipeline

The AI OCR service transforms prescription images into structured medication data through a multi-stage computer vision and NLP pipeline.

```
Input Image --> Input Normalization --> YOLO Region Detection --> Region Cropping
    --> Azure OCR Text Extraction --> Prescription Parsing --> Medicine Matching
    --> Structured Output with Confidence Scores
```

**Stage 1: Input Normalization.** Accepts images via file upload, URL, or base64 encoding. Detects and converts PDFs to PNG. Handles EXIF orientation correction and RGB normalization.

**Stage 2: YOLO Region Detection.** A custom-trained Yolo26s model (ONNX format, 640x640 input) detects prescription regions with class labels: Medication, Lines, Frequency, Quantity, Dosage. Non-max suppression with 0.45 IOU threshold filters overlapping detections. If the primary input size yields insufficient confidence, the pipeline automatically retries at 832 and 960 pixel input sizes.

**Stage 3: Region Cropping and Preprocessing.** Detected regions are cropped with configurable padding (12px default), then preprocessed for OCR: downscaled to max 2600px, converted to grayscale with auto-contrast, contrast-enhanced at 1.25x, and adaptively JPEG-compressed (quality 88 down to 40) to meet the 4MB Azure limit.

**Stage 4: Azure OCR.** Azure AI Document Intelligence (prebuilt-read model) extracts text lines with confidence scores and polygon coordinates. The system maps polygons to bounding boxes and builds line-level results with page attribution.

**Stage 5: Prescription Parsing.** OCR lines are grouped by vertical proximity (26px merge threshold) and parsed for medication attributes:

- **Name:** Fuzzy matching against known medicine names, with fallback to candidate extraction (first 3 tokens after stripping noise prefixes like "Tab", "Cap", "Inj").
- **Dosage:** Regex extraction for patterns like `5 mg`, `500ml`, `10 mcg`.
- **Frequency:** Recognizes medical codes (OD, BD, TDS, QID, HS) and numeric patterns (1+0+1, 2-1-0).
- **Quantity:** Duration parsing (10 days, 2 weeks, 3 months) including Bangla text support.

**Stage 6: Medicine Matching.** Three-tier database matching against a medicine search index:

1. Exact match (case-insensitive).
2. PostgreSQL trigram similarity search (pg_trgm `%` operator).
3. Fallback pattern match with fuzzy reranking via RapidFuzz.

Confidence is computed as: `0.82 * base_score + 0.13 * length_similarity + 0.05 * dosage_overlap`.

**Bangla Support.** The normalizer converts Bangla digits to ASCII, handles Bangla frequency and quantity terms, and processes mixed-script prescription text.

---

### AI-Assisted Doctor Discovery

Patients describe their health concern in free-form text (Bangla, English, Banglish, or mixed) and receive a ranked list of appropriate doctors.

**Pipeline:**

1. Patient input is sanitized and PII is stripped.
2. An LLM (Groq, configurable provider) extracts structured medical intent: symptoms, duration, urgency level, and relevant specialties.
3. LLM output is validated against a Pydantic schema with confidence gating.
4. The backend performs all database queries: filtering doctors by extracted specialties, availability, location, and other criteria.
5. Doctors are ranked using deterministic logic and returned with explanations.

**Safety principles:** The LLM is a language interpreter, never a decision maker. It has no database access. All ranking and filtering is performed server-side. The patient always makes the final choice.

---

## Authentication and Authorization

**Identity Provider.** Supabase Auth with JWT tokens. JWKS-based local verification with 5-minute key cache and fallback to Supabase Auth API validation.

**Session Management.** Cookie-based sessions with configurable expiry: 12-hour default, 30-day with "remember me". Cookies include `session_token`, `user_role`, `onboarding_completed`, `verification_status`, and `admin_access`.

**Role-Based Access Control:**

| Role | Access Scope |
|------|-------------|
| Patient | Own records, authorized doctors, appointment management, AI assistant (self-context only) |
| Doctor | Authorized patient records (consent-gated), appointments, consultations, AI assistant (general + patient context) |
| Admin | Doctor verification, user management, audit logs, platform metrics. Password-gated via `X-Admin-Password` header |

**Middleware Enforcement.** Server-side route protection via Next.js middleware (`proxy.ts`) reads auth cookies and enforces:

- Unauthenticated users are redirected to login.
- Unverified doctors are redirected to the verification pending page.
- Patients who have not completed onboarding are redirected to the onboarding wizard.
- Admin routes require the `admin_access` flag.

**Patient Data Access.** Doctors must have explicit patient consent to access health records. Every access event (including AI queries) is logged in `patient_access_logs` and visible to the patient through the privacy dashboard.

---

## Database Architecture

PostgreSQL via Supabase with async SQLAlchemy 2.0 sessions and asyncpg driver. Connection pool: 10 base, 20 overflow, 30-second timeout with pre-ping.

### Models (22 total)

**Identity:** `Profile`, `DoctorProfile`, `PatientProfile`

**Scheduling:** `Appointment`, `AppointmentAudit`, `AppointmentRequest`, `DoctorAvailability`, `Reschedule`

**Clinical:** `Consultation`, `Prescription`, `MedicationPrescription`, `TestPrescription`, `SurgeryRecommendation`, `MedicalTest`

**Patient Health:** `HealthMetric`, `HealthDataConsent`, `Medicine`, `Reminder`, `ReminderDeliveryLog`

**Doctor Operations:** `DoctorAction`, `Speciality`

**Access and Notifications:** `PatientAccessLog`, `PatientDoctorAccess`, `Notification`, `OAuthToken`

**AI and Media:** `MediaFile`, `AIInteraction`, `ChoruiChat`

### Key Enums

The domain model is encoded through comprehensive enum types: `UserRole` (admin, doctor, patient), `VerificationStatus` (unverified, pending, verified, rejected), `AppointmentStatus` (10 states including reschedule and cancellation flows), `PrescriptionType` (medication, test, surgery), `MealInstruction` (before_meal, after_meal, with_meal, empty_stomach, any_time), `TestUrgency` and `SurgeryUrgency` (normal through emergency), `MedicineType` (12 forms from tablet to suppository), `HealthMetricType` (8 vital signs), `DoctorActionPriority` (low through urgent), and `NotificationType` (20+ event categories).

### Migrations

36 Alembic migration scripts covering the full schema evolution: initial identity and consultation tables, comprehensive onboarding fields, appointment scheduling with status tracking, performance indexes, AI orchestrator tables, health metrics and consent tracking, and doctor action management.

---

## AI and Machine Learning

### AI Orchestrator (Backend)

The backend includes a provider-agnostic AI orchestration layer (`ai_orchestrator.py`) that:

- Supports Groq, Google Gemini, and Cerebras as interchangeable LLM providers.
- Anonymizes PII using stable hash tokens before constructing prompts.
- Validates all LLM outputs against Pydantic schemas with structured output enforcement.
- Tracks execution metadata: latency, provider used, validation status, and feature-specific prompt versions.

### Prescription OCR (AI Service)

- Custom YOLO v8 model trained on prescription images, exported to ONNX for cross-platform inference.
- Azure AI Document Intelligence for high-accuracy text extraction.
- Multi-strategy medicine matching with trigram similarity and fuzzy reranking.
- Configurable confidence thresholds, retry strategies, and fallback pipelines.

### Voice Transcription (STT Service)

- faster-whisper (small model) with int8 quantization for efficient CPU inference.
- Greedy decoding with configurable max duration caps.
- Supports Bangla and English transcription.
- Integrated with the frontend via MediaRecorder API with echo cancellation and noise suppression.

---

## Progressive Web App

Medora ships as a fully installable PWA with offline-first capabilities.

**Service Worker (Serwist 9.5):**

| Strategy | Target | Cache Duration |
|----------|--------|----------------|
| CacheFirst | Static assets, fonts | 30 days |
| StaleWhileRevalidate | Images, icons | 14 days |
| StaleWhileRevalidate | API GET requests | 60-second TTL |
| NetworkFirst | Page navigations | 3-second timeout, 24-hour fallback |

**Background Sync.** Failed POST, PATCH, and PUT requests to `/api/*` are queued in a `medora-api-queue` with 24-hour retention and automatically retried when connectivity is restored.

**Push Notifications.** VAPID-based web push through the service worker. Subscription management, notification display with badge and icon, and click-to-navigate handling.

**Offline Support.** `useNetworkStatus` and `useOfflineCache` hooks provide network detection and localStorage-based caching with configurable expiration for offline-first data access.

**Installation.** Full `manifest.json` with 9 icon sizes (72x72 to 512x512), standalone display mode, and `maskable any` icon purpose. Categories: health, medical.

**Performance Monitoring.** Real User Monitoring via Web Vitals (CLS, FCP, INP, LCP, TTFB) sampled at 10% and beaconed to `/api/perf/vitals`. Lighthouse CI runs on every frontend PR for both mobile and desktop.

---

## Real-Time Features

**Appointment Slot Synchronization.** The `useRealtimeSlots` hook subscribes to Supabase PostgreSQL change streams on the `appointments` table, scoped to a specific doctor and date. INSERT, UPDATE, and DELETE events trigger immediate UI updates so patients always see current availability without page refresh.

**Push Notifications.** Server-side events (appointment booked, prescription issued, reminder triggered, verification status change) dispatch web push notifications through `pywebpush`. The service worker handles display and click routing.

**Background Reminder Dispatcher.** An async background loop in the backend checks for due reminders at configurable intervals (default: 300 seconds), resolves against the target timezone (default: Asia/Dhaka), and dispatches push notifications. Delivery is logged in `reminder_delivery_logs` for audit.

---

## Design System

Medora's visual identity is built on a medical-blue palette with strict light/dark theme parity.

**Color Foundation:**

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0360D9` | Core brand blue, primary actions |
| Primary Muted | `#1379B1` | Secondary interactive elements |
| Primary Light | `#A5CCFF` | Highlights, hover states |
| Surface | `#E6F5FC` | Card backgrounds, containers |
| Background | `#FFFFFF` / dark equivalent | Page backgrounds |
| Success | `#39E039` | Confirmation states |
| Destructive | `oklch(0.577 0.245 27.325)` | Error states, dangerous actions |
| Border | `#D9D9D9` | Dividers, input borders |

**Typography.** SF Pro Display as the primary typeface with system font fallback stack. Font-display: swap for fast rendering.

**Spacing Scale.** 8-point grid: xs (4px), sm (8px), md (16px), lg (20px), xl (24px), 2xl (32px), 3xl (40px).

**Motion.** Three-tier duration system: fast (0.25s), base (0.4s), slow (0.6s) with standard easing (cubic-bezier 0.4, 0, 0.2, 1). All animation is purposeful and performs well on low-end devices.

**Accessibility.** Minimum 44px touch targets on mobile. Dark mode via `next-themes` with system preference detection.

**Bilingual Support.** The platform is designed for both Bangla and English. Components, typography, and layouts accommodate both scripts without breaking hierarchy or spacing. Voice input supports mixed-language transcription.

---

## API Reference

### Backend Service (Port 8000)

| Prefix | Module | Description |
|--------|--------|-------------|
| `/health` | health | System health check with DB connectivity |
| `/auth` | auth | Signup (patient/doctor), login, JWT verification |
| `/profile` | profile | User profile CRUD, avatar generation |
| `/upload` | upload | File uploads to Supabase Storage, OCR trigger |
| `/admin` | admin | Doctor verification, platform metrics |
| `/doctor` | doctor | Doctor profile, specialties, availability |
| `/specialities` | specialities | Medical specialty database |
| `/appointment` | appointment | CRUD, scheduling, slot management |
| `/ai` | ai_doctor_search | LLM-powered doctor matching |
| `/ai` | ai_consultation | Clinical intake, note generation, Chorui chat |
| `/medicine` | medicine | Medicine database search and lookup |
| `/medical-test` | medical_test | Test records and ordering |
| `/notifications` | notifications | Notification delivery and inbox management |
| `/patient-access` | patient_access | Data access control and audit logs |
| `/reminders` | reminders | Reminder CRUD with timezone support |
| `/consultation` | consultation | Doctor-patient consultations, prescriptions |
| `/availability` | availability | Doctor schedule lookup |
| `/reschedule` | reschedule | Appointment reschedule requests |
| `/oauth` | oauth | Google Calendar OAuth flow |
| `/health-metrics` | health_metrics | Patient vital sign tracking |
| `/doctor/actions` | doctor_actions | Doctor task and follow-up management |
| `/patient` | patient_dashboard | Aggregated patient dashboard data |
| `/health-data` | health_data_consent | Health data consent management |

### AI OCR Service (Port 8001)

**`POST /ocr/prescription`**

Accepts a prescription image and returns structured medication data.

Input (any of):
- Multipart form-data with `file` field
- JSON with `image_url`
- JSON with base64-encoded `image_file`

Query parameters:
- `debug=true` for YOLO region and OCR line details

Response:
```json
{
  "medications": [
    {
      "name": "Carbizole",
      "matched_term": "Carbimazole",
      "drug_id": "DRG-001",
      "brand_id": "BRD-042",
      "dosage": "5 mg",
      "frequency": "1+0+1",
      "quantity": "10 days",
      "confidence": 0.92
    }
  ],
  "raw_text": "full OCR output text",
  "meta": {
    "model": "azure_prebuilt-read",
    "model_type": "read",
    "processing_time_ms": 320,
    "detected_regions": 3,
    "ocr_line_count": 18
  }
}
```

---

## Deployment

### Production (Azure Container Apps)

All three services deploy to Azure Container Apps on the Consumption Plan with scale-to-zero.

GitHub Actions workflows handle CI/CD:

- **`deploy-backend.yml`** triggers on pushes to `main` that modify `backend/`. Builds a Docker image, pushes to Azure Container Registry, and deploys to the `medora-backend` container app.
- **`deploy-ai-ocr.yml`** triggers on pushes to `main` that modify `ai_service/`. Builds, pushes, deploys with health check verification (5 attempts, 8-second intervals). Configured for `westindia` region with 0-3 replicas, 1 vCPU, 2 GB memory.
- **`performance-budget.yml`** runs Lighthouse CI (mobile and desktop) and bundle budget validation on frontend changes.

### Docker Images

**Backend** (`backend/Dockerfile`):
- Base: `python:3.11-slim`
- Non-root user: `appuser` (UID 1000)
- Health check: `curl http://localhost:8000/health` (30-second interval)
- Entrypoint: Database readiness check, Alembic migrations, Uvicorn startup

**AI Service** (`ai_service/Dockerfile`):
- Base: `python:3.11-slim`
- System dependency: `libgomp1` (OpenMP for ONNX runtime)
- Non-root user
- Port: 8001

---

## Local Development

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- A Supabase project (PostgreSQL, Auth, Storage)
- Azure AI Document Intelligence credentials (for OCR)
- A Groq API key (for AI features)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` with Turbopack for fast development builds.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Configure your environment variables
uvicorn app.main:app --reload --port 8000
```

Alembic migrations run automatically on startup when `RUN_MIGRATIONS=true`, or manually:

```bash
alembic upgrade head
```

### AI OCR Service

```bash
cd ai_service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Docker Compose (Full Stack)

```bash
cd backend
docker-compose up --build
```

This starts the backend service with environment variables from `.env`, volume mounts for hot reload, and JSON-file logging with rotation.

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anon key |
| `NEXT_PUBLIC_RUM_SAMPLE_RATE` | Web Vitals sampling rate (default: 0.1) |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_DATABASE_URL` | PostgreSQL async connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `GROQ_API_KEY` | Groq LLM API key |
| `GROQ_MODEL` | LLM model selection |
| `AI_PROVIDER` | AI provider: groq, gemini, or cerebras |
| `AI_OCR_SERVICE_URL` | OCR microservice endpoint |
| `AI_ID_HASH_SECRET` | PII anonymization secret |
| `ADMIN_PASSWORD` | Admin panel authentication password |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `FRONTEND_URL` | Frontend base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | VAPID public key for push |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | VAPID private key for push |
| `REMINDER_DISPATCH_ENABLED` | Enable background reminder service |
| `DEFAULT_REMINDER_TIMEZONE` | Timezone for reminders (default: Asia/Dhaka) |
| `DB_POOL_SIZE` | Connection pool size (default: 10) |
| `PRELOAD_WHISPER_ON_STARTUP` | Preload ASR model at boot |
| `CHORUI_PRIVACY_MODE` | AI privacy mode: strict_local or augmented |

### AI OCR Service (`ai_service/.env`)

| Variable | Description |
|----------|-------------|
| `MODEL_TYPE` | Pipeline mode: read, custom, or llm |
| `AZURE_OCR_ENDPOINT` | Azure AI endpoint URL |
| `AZURE_OCR_KEY` | Azure AI API key |
| `YOLO_MODEL_PATH` | Path to ONNX model weights |
| `DISABLE_MEDICINE_MATCHING` | Toggle database matching (default: true) |
| `SUPABASE_DATABASE_URL` | PostgreSQL connection for medicine DB |
| `MEDICINE_DB_TABLE` | Medicine search index table name |
| `MEDICINE_MATCH_MIN_CONFIDENCE` | Minimum match confidence threshold |

---

## License

MIT License. Copyright (c) 2025 CSE-3200-System-Project.

See [LICENSE](LICENSE) for the full text.
