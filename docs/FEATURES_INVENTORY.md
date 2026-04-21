# Features Inventory

## Overview

This document provides a comprehensive inventory of all features in Medora, categorized by implementation status. Features marked as **✅ Implemented** are production-ready, while **🔲 Planned** features are documented for future development.

---

## 1. Authentication & Authorization

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Role Signup | Separate registration flows for patients, doctors, and admins | ✅ Production |
| Email/Password Auth | Supabase-based authentication with email verification | ✅ Production |
| JWT Verification | Backend JWT token validation with expiry checks | ✅ Production |
| Role-Based Access Control (RBAC) | Endpoint-level role enforcement (patient/doctor/admin) | ✅ Production |
| Route Protection | Next.js middleware (`proxy.ts`) enforces access gates | ✅ Production |
| Password Reset | Token-based password reset with email delivery | ✅ Production |
| Remember Me | Persistent session with configurable expiry | ✅ Production |
| Account Moderation | Admin can ban/suspend abusive accounts | ✅ Production |
| Doctor Verification | Admin review and approval workflow for doctor accounts | ✅ Production |
| Onboarding Gates | Mandatory onboarding completion before accessing core features | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Two-Factor Authentication (2FA) | TOTP or SMS-based second factor | Medium |
| Social Login (Google, Facebook) | OAuth-based social authentication | Low |
| Magic Link Login | Passwordless login via email link | Low |
| Session Management UI | View and revoke active sessions | Low |

---

## 2. Patient Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Progressive Onboarding | Multi-step profile capture with medical context | ✅ Production |
| Medical History | Comprehensive tabbed interface: | ✅ Production |
| ├─ Medications | Track current and past medications with CRUD | ✅ Production |
| ├─ Surgeries | Surgical history with dates and details | ✅ Production |
| ├─ Hospitalizations | Hospital stay records | ✅ Production |
| ├─ Vaccinations | Vaccination tracker with schedule | ✅ Production |
| └─ Timeline | Chronological view of all medical events | ✅ Production |
| AI Doctor Search | Natural language symptom matching with specialty extraction | ✅ Production |
| Doctor Search Filters | Filter by specialty, location (64 Bangladesh districts) | ✅ Production |
| Doctor Profiles | View doctor qualifications, specialties, locations, ratings | ✅ Production |
| Map Integration | MapLibre GL with OpenStreetMap geocoding and routing | ✅ Production |
| Appointment Booking | Real-time slot selection and booking | ✅ Production |
| Realtime Slot Updates | Supabase channel subscriptions for live slot availability | ✅ Production |
| Appointment Management | View, cancel, reschedule appointments | ✅ Production |
| Reschedule Workflow | Bidirectional accept/reject with notifications | ✅ Production |
| Consultation View | View doctor-prescribed medications, tests, procedures | ✅ Production |
| Prescription Accept/Reject | Patient consent workflow for prescriptions | ✅ Production |
| Prescription History | Browse and filter all prescriptions | ✅ Production |
| Prescription PDF Export | Download prescriptions as PDF documents | ✅ Production |
| Health Metrics Tracking | Record and track vital signs over time | ✅ Production |
| Health Analytics Dashboard | Health score, trends, medication adherence charts | ✅ Production |
| Medication Reminders | Timezone-aware reminder scheduling | ✅ Production |
| Push Notifications | PWA background notifications via VAPID | ✅ Production |
| In-App Notifications | Notification center with filtering | ✅ Production |
| Data Sharing Controls | Fine-grained consent for health data access | ✅ Production |
| Patient Access Logs | View who accessed your health data and when | ✅ Production |
| Profile Management | Update personal information, medical context | ✅ Production |
| Appointment Calendar | Calendar view of upcoming and past appointments | ✅ Production |
| PWA Installation | Installable on mobile with offline support | ✅ Production |
| Offline Caching | Route-specific caching with background sync | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Family Member Profiles | Manage health records for family members | High |
| Symptom Checker | AI-guided symptom assessment tool | Medium |
| Medicine Reminders with Snooze | Smart reminders with dosage tracking | Medium |
| Health Goals & Milestones | Track fitness and health improvement goals | Low |
| Emergency Contact | Quick access to emergency services | Medium |
| Insurance Integration | Store and manage insurance information | Low |

---

## 3. Doctor Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Doctor Onboarding | Professional profile setup with qualifications | ✅ Production |
| Profile Management | Edit specialties, locations, hospital affiliations | ✅ Production |
| Schedule Management | Per-day time slot configuration | ✅ Production |
| Google Calendar Integration | OAuth-based calendar synchronization | ✅ Production |
| Appointment Dashboard | View upcoming and past appointments | ✅ Production |
| Appointment Actions | Confirm, reschedule, complete appointments | ✅ Production |
| Patient Records | Access patient medical history (with consent) | ✅ Production |
| Consultation Workspace | Tabbed form for comprehensive consultations | ✅ Production |
| ├─ Medication Prescription | Dynamic dosage scheduling with frequency controls | ✅ Production |
| ├─ Test Recommendation | Recommend medical tests | ✅ Production |
| ├─ Procedure/Surgery Recommendation | Suggest procedures | ✅ Production |
| Prescription Review | Review and finalize prescriptions before issuing | ✅ Production |
| Prescription HTML Rendering | Professionally formatted prescription documents | ✅ Production |
| Patient Analytics | View patient health trends and history | ✅ Production |
| Practice Analytics | Appointment stats, patient volume metrics | ✅ Production |
| Chorui AI Assistant | AI-powered chat for patient summaries and navigation | ✅ Production |
| Voice Control | Vapi-based hands-free voice commands | ✅ Production |
| Patient Summary Card | AI-generated patient overview at a glance | ✅ Production |
| Doctor Actions | Task management and action items | ✅ Production |
| Location Management | Multiple hospital/chamber locations with coordinates | ✅ Production |
| Notification Center | Receive appointment requests, reschedule requests | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Video Consultation | WebRTC-based telemedicine | High |
| E-Prescription Signing | Digital signature for prescriptions | Medium |
| Patient Messaging | Secure messaging with patients | Medium |
| Referral System | Refer patients to other doctors | Low |
| Clinical Notes | Private doctor notes per patient | Low |
| Revenue Dashboard | Track consultation fees and earnings | Low |

---

## 4. Admin Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Doctor Verification Queue | Review pending doctor registrations | ✅ Production |
| Doctor Approval/Rejection | Approve or reject with feedback | ✅ Production |
| Patient Management | View, search, and manage patient accounts | ✅ Production |
| Admin Dashboard | Platform metrics and system health overview | ✅ Production |
| Account Moderation | Ban or suspend abusive accounts | ✅ Production |
| Schedule Review | Review and approve doctor schedules | ✅ Production |
| Admin Notifications | System-wide notification management | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| System Logs | Audit log viewer for platform events | High |
| User Analytics | Platform-wide usage analytics | Medium |
| Content Moderation | Review and moderate user-generated content | Low |
| Support Ticket System | Handle user support requests | Medium |
| Platform Configuration | Admin panel for system settings | Low |
| Revenue Analytics | Platform revenue tracking | Low |

---

## 5. AI Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Chorui AI Assistant | Context-aware AI chat for patients and doctors | ✅ Production |
| ├─ Patient Mode | Health guidance, appointment help, general queries | ✅ Production |
| ├─ Doctor Mode | Patient summaries, clinical assistance | ✅ Production |
| Conversation Memory | Persistent chat history across sessions | ✅ Production |
| Role-Scoped Data Access | Patients see patient data, doctors see their patients | ✅ Production |
| Safety Guardrails | Blocks autonomous diagnosis and prescribing | ✅ Production |
| Privacy Mode | Configurable PII handling | ✅ Production |
| AI Doctor Search | Natural language → specialty → ranked doctor list | ✅ Production |
| Intent Classification | AI intent normalization and routing | ✅ Production |
| Navigation Engine | AI-driven in-app navigation (confidence-based) | ✅ Production |
| Voice Control (Vapi) | Hands-free voice commands for Chorui | ✅ Production |
| Voice Prescription Summary | Voice-based prescription explanation | ✅ Production |
| Voice Doctor Search | Search doctors via voice input | ✅ Production |
| ASR (Voice-to-Text) | Faster-whisper speech recognition | ✅ Production |
| PII Anonymization | Tokenize sensitive data before AI processing | ✅ Production |
| AI Orchestration | Provider-agnostic (Groq, Gemini, Cerebras) | ✅ Production |
| Schema-Validated Outputs | Pydantic validation for AI responses | ✅ Production |
| Patient Summary Card | AI-generated patient overview | ✅ Production |
| Consultation Draft | AI-assisted consultation note generation | ✅ Production |
| Voice Context | Voice session context preservation | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| AI Symptom Checker | Guided symptom assessment flow | High |
| AI Appointment Triage | Prioritize urgent appointments | Medium |
| AI-Powered Health Insights | Predictive health analytics | Medium |
| Multilingual AI Support | AI responses in Bangla | High |
| AI Medication Interaction Checker | Check drug interactions | Medium |
| AI Report Summarization | Summarize medical reports | Low |

---

## 6. OCR Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Prescription OCR | Upload prescription → structured extraction | ✅ Production |
| Medical Report OCR | Upload lab reports → structured data | ✅ Production |
| YOLO Region Detection | Detect prescription/report regions | ✅ Production |
| Azure Document Intelligence | Primary OCR engine for text extraction | ✅ Production |
| PaddleOCR Fallback | Fallback when Azure unavailable | ✅ Production |
| Medicine Matching | RapidFuzz matching against medicine database | ✅ Production |
| Dosage Extraction | Extract dosage, frequency, duration | ✅ Production |
| Multi-Language Support | Handle Bangla-English mixed text | ✅ Production |
| Image Normalization | Handle various image formats and orientations | ✅ Production |
| Debug Mode | Visualize OCR pipeline steps | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Handwriting Recognition | Improve extraction from handwritten prescriptions | High |
| Batch OCR Processing | Process multiple documents at once | Medium |
| OCR Confidence Scoring | Display confidence per extracted field | Low |
| Manual Correction UI | Allow doctors to correct OCR results | Medium |
| Historical OCR Archive | Store and search past OCR results | Low |

---

## 7. Notification System

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| In-App Notifications | Notification center with real-time updates | ✅ Production |
| Push Notifications | PWA background notifications via VAPID | ✅ Production |
| Email Notifications | SMTP-based email delivery | ✅ Production |
| Appointment Confirmation | Notify on booking confirmation | ✅ Production |
| Appointment Reminder | Reminder before appointment time | ✅ Production |
| Reschedule Request | Doctor proposes new time → patient notified | ✅ Production |
| Reschedule Acceptance | Patient accepts → doctor notified | ✅ Production |
| Reschedule Rejection | Patient rejects → doctor notified | ✅ Production |
| Prescription Issued | Notify patient when prescription is ready | ✅ Production |
| Prescription Accepted/Rejected | Notify doctor of patient response | ✅ Production |
| Medication Reminders | Timezone-aware medication reminders | ✅ Production |
| Notification Types | 10+ distinct notification categories | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| SMS Notifications | Fallback SMS for critical alerts | Medium |
| Notification Preferences | User-configurable notification settings | Low |
| Digest Emails | Weekly/monthly health summary emails | Low |
| Push Notification Analytics | Track delivery and open rates | Low |

---

## 8. Internationalization (i18n)

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| English Support | Full English translations | ✅ Production |
| Bangla Support | Full Bangla translations | ✅ Production |
| Locale Routing | `[locale]` route group for i18n URLs | ✅ Production |
| 10 Translation Categories | auth, dashboard, medicine, consultation, common, chorui, etc. | ✅ Production |
| Client-Side Translation | next-intl client hooks | ✅ Production |
| Server-Side Translation | Server action translation | ✅ Production |
| Error Message Localization | Localized form validation errors | ✅ Production |
| Healthcare Term Normalization | Bangla medical terminology | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Hindi Support | Third language option | Low |
| Urdu Support | Fourth language option | Low |
| Community Translations | Crowdsourced translation platform | Low |
| Auto-Detect Locale | Browser-based locale detection | Medium |

---

## 9. PWA Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Service Worker | Serwist-based caching strategy | ✅ Production |
| Offline Caching | Route-specific cache with TTL policies | ✅ Production |
| Background Sync Queue | Queue API mutations for offline periods | ✅ Production |
| Push Notification Handler | VAPID push subscription management | ✅ Production |
| PWA Manifest | Installable app configuration | ✅ Production |
| PWA Icons | Multi-size icon set | ✅ Production |
| Install Prompt | Add to home screen prompt | ✅ Production |
| Web Vitals Monitoring | Real user monitoring (RUM) | ✅ Production |
| Device Access Hooks | Camera, location, file picker with permissions | ✅ Production |
| Voice Recorder Hook | Audio recording for ASR | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| IndexedDB Storage | Complex offline data storage | Medium |
| Background Sync for Mutations | Proxy mutations through `/api/` for sync | Medium |
| Offline Mode Detection | UI indicator for offline state | Low |
| App Update Notification | Notify users of new versions | Low |

---

## 10. Maps & Geolocation

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| MapLibre GL Integration | Interactive maps with OpenStreetMap tiles | ✅ Production |
| Geocoding | Address → coordinates via OSRM | ✅ Production |
| Doctor Location Display | Show doctor chambers/hospitals on map | ✅ Production |
| Multi-Route Navigation | OSRM routing with alternatives | ✅ Production |
| Patient-Centric Map Centering | Map centered on patient location | ✅ Production |
| Location Search | Search Bangladesh districts (64 districts) | ✅ Production |
| Coordinate Persistence | DB-stored lat/lng per doctor location | ✅ Production |
| Mobile Map Toggle | Toggle map on mobile with fallback | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Live Location Tracking | Track patient location for nearby doctors | Low |
| Traffic-Aware Routing | Consider traffic for appointment travel time | Low |
| Area-Based Doctor Search | Search by drawn area on map | Medium |

---

## 11. Analytics & Reporting

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Patient Health Score | Composite health metric for patients | ✅ Production |
| Appointment Trends | Appointment frequency and status charts | ✅ Production |
| Medication Adherence | Track medication compliance | ✅ Production |
| Practice Analytics | Doctor appointment statistics | ✅ Production |
| Admin System Metrics | Platform-wide usage and health metrics | ✅ Production |
| Grafana Dashboards | 4 pre-configured observability dashboards | ✅ Production |
| Prometheus Metrics | Service-level metrics collection | ✅ Production |
| Lighthouse CI | Performance budget gates | ✅ Production |
| Bundle Size Checks | Frontend bundle validation | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Predictive Analytics | AI-powered health risk predictions | Medium |
| Custom Reports | User-generated analytics reports | Low |
| Population Health Insights | Aggregate anonymized health data | Low |
| Doctor Performance Benchmarks | Comparative doctor metrics | Low |

---

## 12. Performance & Engineering Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Async Backend | Async SQLAlchemy with connection pooling | ✅ Production |
| Realtime Subscriptions | Supabase channels for live updates | ✅ Production |
| Background Workers | Reminder dispatcher, appointment hold sweep | ✅ Production |
| HTTP Caching | Server-side response caching | ✅ Production |
| Connection Pooling | PgBouncer-managed database connections | ✅ Production |
| Docker Containerization | Multi-service Docker setup | ✅ Production |
| CI/CD Pipelines | GitHub Actions for automated deployment | ✅ Production |
| Auto-Scaling | Azure Container Apps auto-scaling | ✅ Production |
| Health Checks | Service health monitoring | ✅ Production |
| Structured Logging | JSON-formatted application logs | ✅ Production |
| Error Boundaries | React error boundaries for graceful degradation | ✅ Production |
| Type Safety | TypeScript strict mode, Pydantic v2 validation | ✅ Production |
| Mobile-First Responsive Design | 320px baseline, touch-friendly targets | ✅ Production |
| Dark/Light Mode | Theme support across all components | ✅ Production |
| Animation | Framer Motion and GSAP animations | ✅ Production |
| Smooth Scrolling | Lenis-based smooth scroll | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| GraphQL API | GraphQL endpoint for flexible queries | Low |
| Websocket API | Dedicated websocket layer for realtime features | Medium |
| API Versioning | Versioned API endpoints | Medium |
| Request Tracing | Distributed tracing for microservices | Medium |

---

## 13. Security & Privacy Features

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| JWT Token Verification | Backend token validation | ✅ Production |
| Role-Based Access Control | Endpoint-level RBAC | ✅ Production |
| Data Sharing Consent | Patient consent for health data access | ✅ Production |
| Access Audit Logs | Log all health data access events | ✅ Production |
| PII Anonymization | Tokenize PII before AI processing | ✅ Production |
| CORS Configuration | Restricted to production origins | ✅ Production |
| Input Validation | Pydantic schema validation | ✅ Production |
| SQL Injection Prevention | SQLAlchemy ORM parameterization | ✅ Production |
| HTTPS Enforcement | All production traffic encrypted | ✅ Production |
| Non-Root Containers | Docker containers run as non-root | ✅ Production |
| Secret Management | Azure Key Vault for credentials | ✅ Production |
| Account Moderation | Admin-controlled account suspension | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| End-to-End Encryption | Encrypt sensitive health data at rest | High |
| HIPAA Compliance Mode | Compliance framework for regulations | Medium |
| Data Export | Patient data export in standard formats | Medium |
| Right to be Forgotten | Complete data deletion on request | Medium |

---

## 14. Testing & Quality Assurance

### ✅ Implemented
| Feature | Description | Status |
|---------|-------------|--------|
| Unit Tests (Backend) | AI orchestrator, privacy, service logic | ✅ Production |
| Unit Tests (AI Service) | Matcher, parser, pipeline, YOLO | ✅ Production |
| Integration Tests | API contracts, clinical lifecycle | ✅ Production |
| E2E Tests (Playwright) | Appointment booking, verification, OCR | ✅ Production |
| Security Tests | RBAC and JWT validation | ✅ Production |
| Performance Tests | API latency, concurrency, OCR, chaos | ✅ Production |
| Load Testing (Locust) | Realistic healthcare workloads | ✅ Production |
| Stress Testing (k6) | API performance under load | ✅ Production |
| Lighthouse CI | Frontend performance gates | ✅ Production |
| Benchmark Reports | Automated benchmark summaries | ✅ Production |
| Regression Guard | Prevent performance regressions | ✅ Production |

### 🔲 Planned
| Feature | Description | Priority |
|---------|-------------|----------|
| Contract Tests | Server action ↔ backend schema validation | High |
| Mutation Testing | Test suite quality measurement | Low |
| Accessibility Tests | Automated a11y testing | Medium |
| Visual Regression Tests | Screenshot comparison tests | Low |

---

## 15. Future Roadmap (Not Yet Implemented)

### High Priority
| Feature | Description | Estimated Effort |
|---------|-------------|------------------|
| Payment Gateway | Consultation fee processing (bKash, Nagad, Stripe) | 4-6 weeks |
| Video Consultation | WebRTC-based telemedicine | 6-8 weeks |
| Pharmacy Integration | Medicine ordering and delivery | 8-10 weeks |
| Lab Test Booking | Book and receive lab test results | 4-6 weeks |
| AI Symptom Checker | Guided symptom assessment | 4-6 weeks |

### Medium Priority
| Feature | Description | Estimated Effort |
|---------|-------------|------------------|
| Family Member Profiles | Manage health records for dependents | 3-4 weeks |
| Emergency Contact | Quick ambulance and emergency services | 2-3 weeks |
| Referral System | Doctor-to-doctor patient referrals | 3-4 weeks |
| Insurance Integration | Store and verify insurance information | 4-6 weeks |
| Clinical Notes | Doctor private notes per patient | 2-3 weeks |

### Low Priority
| Feature | Description | Estimated Effort |
|---------|-------------|------------------|
| Health Goals | Fitness and wellness goal tracking | 3-4 weeks |
| Community Features | Patient support groups and forums | 4-6 weeks |
| Doctor Reviews | Patient review and rating system | 3-4 weeks |
| Appointment Waitlist | Join waitlist for fully-booked doctors | 2-3 weeks |
| Medicine Interaction Checker | Check drug interactions | 4-6 weeks |

---

## Feature Coverage Summary

| Category | Implemented | Planned | Completion |
|----------|------------|---------|------------|
| Authentication & Authorization | 10 | 4 | 71% |
| Patient Features | 28 | 6 | 82% |
| Doctor Features | 17 | 6 | 74% |
| Admin Features | 7 | 6 | 54% |
| AI Features | 19 | 6 | 76% |
| OCR Features | 10 | 5 | 67% |
| Notification System | 12 | 4 | 75% |
| Internationalization | 8 | 4 | 67% |
| PWA Features | 10 | 4 | 71% |
| Maps & Geolocation | 8 | 3 | 73% |
| Analytics & Reporting | 9 | 4 | 69% |
| Performance & Engineering | 17 | 4 | 81% |
| Security & Privacy | 12 | 4 | 75% |
| Testing & QA | 11 | 4 | 73% |
| **Total** | **198** | **64** | **76%** |

---

## Appending New Features

To add new features to this inventory:

1. **Identify the category** (e.g., Patient Features, AI Features)
2. **Add to the appropriate table** under ✅ Implemented or 🔲 Planned
3. **Update the Feature Coverage Summary** totals
4. **If creating a new category**, add a new section and update the summary table
5. **Keep the format consistent**: Feature | Description | Status/Priority

This document is designed to be appendable without restructuring, making it easy to maintain as the project evolves.
