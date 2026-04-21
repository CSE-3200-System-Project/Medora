# MEDORA AI Navigation Audit

## Section 1 - Chorui AI Presence Analysis

### 1.1 Chorui-related implementations found

| Implementation | File Path | Used In | Notes |
|---|---|---|---|
| `ChoruiChat` component | `frontend/components/ai/ChoruiChat.tsx` | Shared (Patient + Doctor) | Main chat UI. Accepts `roleContext` (`patient`/`doctor`). |
| `useChoruiChat` hook | `frontend/hooks/useChoruiChat.ts` | Shared (Patient + Doctor) | Handles chat state, history, calls `/ai/assistant-chat`, `/ai/assistant/conversations`, `/ai/intake/save`. |
| `ChoruiSummaryPanel` | `frontend/components/ai/ChoruiSummaryPanel.tsx` | Shared (Patient + Doctor) | Side panel for structured data. |
| `ChoruiLauncher` | `frontend/components/ai/chorui-launcher.tsx` | Shared (Patient + Doctor) | Route launcher to `/patient/chorui-ai` or `/doctor/chorui-ai`. |
| Patient Chorui page | `frontend/app/(home)/patient/chorui-ai/page.tsx` | Patient | Loads `ChoruiChat roleContext="patient"`. Redirects by role. |
| Doctor Chorui page | `frontend/app/(home)/doctor/chorui-ai/page.tsx` | Doctor | Loads `ChoruiChat roleContext="doctor"`. Redirects by role. |
| Assistant backend endpoints | `backend/app/routes/ai_consultation.py` | Shared (Patient + Doctor) | Defines `/ai/assistant-chat`, conversations endpoints, intake save, intent classification. |
| Assistant request/response schema | `backend/app/schemas/ai_orchestrator.py` | Shared | `ChoruiAssistantResponse` contains `reply`, `conversation_id`, `structured_data`, `context_mode` (no route/action field). |
| Chat persistence model | `backend/app/db/models/chorui_chat.py` | Shared | Stores conversation message text, `intent`, `context_mode`, structured data. |

### 1.2 Related but separate AI assistant implementation

| Implementation | File Path | Used In | Notes |
|---|---|---|---|
| `AIAssistantPanel` | `frontend/components/ai/AIAssistantPanel.tsx` | Doctor-only consultation flow | Separate AI suggestions panel (clinical suggestions), not Chorui chat UI. Used in `home-doctor-patient-id-consultation-ai-client.tsx`. |

### 1.3 Direct answers

- Is Chorui AI available on Patient side? **Yes** (`/patient/chorui-ai`).
- Is Chorui AI available on Doctor side? **Yes** (`/doctor/chorui-ai`).
- Is it shared or duplicated? **Core chat implementation is shared** (`ChoruiChat` + `useChoruiChat`), while role-specific pages are duplicated wrappers (`patient/chorui-ai`, `doctor/chorui-ai`).

---

## Section 2 - Route & Page Inventory (Critical for AI Navigation)

### 2.1 Patient Routes

| Page Name | Path | Component/File | Purpose | Entry Points |
|---|---|---|---|---|
| Patient Register | `/patient/register` | `frontend/app/(auth)/patient/register/page.tsx` -> `frontend/components/screens/pages/auth/auth-patient-register-client.tsx` | Patient account creation | `/selection` card |
| Patient Home | `/patient/home` | `frontend/app/(home)/patient/home/page.tsx` -> `frontend/components/dashboard/patient-home-dashboard.tsx` | Patient dashboard overview | Post-login redirect (`auth-actions`), onboarding completion, navbar logo home |
| Find Doctor | `/patient/find-doctor` | `frontend/app/(home)/patient/find-doctor/page.tsx` -> `frontend/components/doctor/pages/patient-find-doctor-client.tsx` | Search and select doctors | Patient navbar menu, patient home "Schedule Visit", appointments page CTA |
| Doctor Profile & Booking | `/patient/doctor/[id]` | `frontend/app/(home)/patient/doctor/[id]/page.tsx` -> `frontend/components/doctor/doctor-profile/DoctorProfileAppointmentPage.tsx` | Doctor public profile + booking | From Find Doctor results (`doctor-card`, `patient-find-doctor-client`), appointments doctor link |
| Appointments | `/patient/appointments` | `frontend/app/(home)/patient/appointments/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-appointments-client.tsx` -> `frontend/components/appointments/PatientAppointmentsPage.tsx` | Appointment calendar/history/reschedule/cancel | Patient navbar menu, patient dashboard "See all", profile quick action |
| Appointment Success | `/patient/appointment-success` | `frontend/app/(home)/patient/appointment-success/page.tsx` -> `frontend/components/patient/pages/appointment-success-client.tsx` | Post-booking success confirmation | Redirect from booking components (`AppointmentBookingCard`, `appointment-booking-panel`) |
| Analytics | `/patient/analytics` | `frontend/app/(home)/patient/analytics/page.tsx` -> `frontend/components/patient/analytics/AnalyticsDashboard.tsx` | Health analytics and reminders | Patient navbar menu |
| Find Medicine | `/patient/find-medicine` | `frontend/app/(home)/patient/find-medicine/page.tsx` -> `frontend/components/medicine/pages/patient-find-medicine-client.tsx` | Medicine search and medication add flow | Patient navbar menu |
| Medical History | `/patient/medical-history` | `frontend/app/(home)/patient/medical-history/page.tsx` -> `frontend/components/medical-history/pages/patient-medical-history-client.tsx` | Longitudinal medical history modules | Patient navbar menu, appointments "View History", reminders CTA, profile quick actions |
| Medical Reports List | `/patient/medical-reports` | `frontend/app/(home)/patient/medical-reports/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-medical-reports-client.tsx` | Upload/list patient reports | Mobile navbar menu ("Lab Reports"), report detail back navigation |
| Medical Report Detail | `/patient/medical-reports/[id]` | `frontend/app/(home)/patient/medical-reports/[id]/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-medical-reports-id-client.tsx` | View report detail | Opened from reports list |
| Prescriptions List | `/patient/prescriptions` | `frontend/app/(home)/patient/prescriptions/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-prescriptions-client.tsx` | Prescription list + open detail | Profile quick action |
| Prescription Detail | `/patient/prescriptions/[id]` | `frontend/app/(home)/patient/prescriptions/[id]/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-prescriptions-id-client.tsx` | Prescription detail/accept/reject/summary | Opened from prescriptions list |
| My Prescriptions (Legacy/Alt) | `/patient/my-prescriptions` | `frontend/app/(home)/patient/my-prescriptions/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-my-prescriptions-client.tsx` | Alternate prescription management page | **No direct entry point found** (uncertain/orphan) |
| Privacy & Data Sharing | `/patient/privacy` | `frontend/app/(home)/patient/privacy/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-privacy-client.tsx` | Consent, sharing controls, Chorui AI access controls | Navbar profile dropdown, mobile navbar item |
| Patient Profile | `/patient/profile` | `frontend/app/(home)/patient/profile/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-profile-client.tsx` | Patient profile and quick actions | Navbar profile dropdown |
| Reminders | `/patient/reminders` | `frontend/app/(home)/patient/reminders/page.tsx` -> `frontend/components/screens/pages/home/patient/home-patient-reminders-client.tsx` | Medication/test reminders management | Profile quick action |
| Chorui AI (Patient) | `/patient/chorui-ai` | `frontend/app/(home)/patient/chorui-ai/page.tsx` -> `frontend/components/ai/ChoruiChat.tsx` | Patient intake assistant chat | `ChoruiLauncher` from navbar (desktop) |

### 2.2 Doctor Routes

| Page Name | Path | Component/File | Purpose | Entry Points |
|---|---|---|---|---|
| Doctor Register | `/doctor/register` | `frontend/app/(auth)/doctor/register/page.tsx` -> `frontend/components/screens/pages/auth/auth-doctor-register-client.tsx` | Doctor account creation | `/selection` card |
| Doctor Home | `/doctor/home` | `frontend/app/(home)/doctor/home/page.tsx` | Doctor dashboard | Post-login redirect, onboarding completion, navbar logo home |
| Doctor Appointments | `/doctor/appointments` | `frontend/app/(home)/doctor/appointments/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-appointments-client.tsx` | Doctor appointment operations and schedule metrics | Doctor navbar menu |
| Doctor Patients | `/doctor/patients` | `frontend/app/(home)/doctor/patients/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patients-client.tsx` | Patient list for doctor | Doctor navbar menu |
| Doctor Analytics | `/doctor/analytics` | `frontend/app/(home)/doctor/analytics/page.tsx` -> `frontend/components/doctor/analytics/DoctorAnalyticsDashboard.tsx` | Advanced doctor analytics | Doctor navbar menu; multiple cards/links from doctor home |
| Doctor Profile | `/doctor/profile` | `frontend/app/(home)/doctor/profile/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-profile-client.tsx` | Doctor profile management | Navbar profile dropdown |
| Doctor Schedule | `/doctor/schedule` | `frontend/app/(home)/doctor/schedule/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-schedule-client.tsx` | Manage doctor schedule | Doctor home "Fix Schedule" CTA when review required |
| Doctor Find Medicine | `/doctor/find-medicine` | `frontend/app/(home)/doctor/find-medicine/page.tsx` -> `frontend/components/medicine/pages/doctor-find-medicine-client.tsx` | Medicine reference/search for doctors | **No direct entry point found** (uncertain/orphan) |
| Doctor Patient Detail | `/doctor/patient/[id]` | `frontend/app/(home)/doctor/patient/[id]/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patient-id-client.tsx` | Doctor view of specific patient profile/context | From doctor patients list (`router.push('/doctor/patient/...')`) |
| Doctor Patient Reports | `/doctor/patient/[id]/reports` | `frontend/app/(home)/doctor/patient/[id]/reports/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patient-reports-client.tsx` | Patient reports list for doctor | From patient detail page |
| Doctor Patient Report Detail | `/doctor/patient/[id]/reports/[reportId]` | `frontend/app/(home)/doctor/patient/[id]/reports/[reportId]/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patient-report-detail-client.tsx` | Specific report detail for doctor | From patient reports list |
| Doctor Consultation | `/doctor/patient/[id]/consultation` | `frontend/app/(home)/doctor/patient/[id]/consultation/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patient-id-consultation-client.tsx` | Consultation workspace and drafting | From consultation AI pre-step; in-page transitions |
| Doctor Consultation AI Pre-step | `/doctor/patient/[id]/consultation/ai` | `frontend/app/(home)/doctor/patient/[id]/consultation/ai/page.tsx` -> `frontend/components/screens/pages/home/doctor/home-doctor-patient-id-consultation-ai-client.tsx` | AI-assisted pre-consultation notes | From patient detail and consultation page buttons |
| Chorui AI (Doctor) | `/doctor/chorui-ai` | `frontend/app/(home)/doctor/chorui-ai/page.tsx` -> `frontend/components/ai/ChoruiChat.tsx` | Doctor workflow assistant chat | `ChoruiLauncher` from navbar (desktop) |
| Doctor Public Profile (Alt Dynamic Route) | `/doctor/[doctorId]` | `frontend/app/(home)/doctor/[doctorId]/page.tsx` -> `frontend/components/doctor/doctor-profile/DoctorProfileAppointmentPage.tsx` | Doctor profile + booking page (same component as patient path) | **No direct entry point found** (uncertain/orphan/duplicate with `/patient/doctor/[id]`) |

### 2.3 Shared Routes

| Page Name | Path | Component/File | Purpose | Entry Points |
|---|---|---|---|---|
| Landing | `/` | `frontend/app/page.tsx` | Marketing + entry to auth flow | Public entry |
| Selection | `/selection` | `frontend/app/(auth)/selection/page.tsx` | Choose patient vs doctor signup | Landing CTAs, navbar signup |
| Login | `/login` | `frontend/app/(auth)/login/page.tsx` | Authentication | Navbar login, many redirects |
| Forgot Password | `/forgot-password` | `frontend/app/(auth)/forgot-password/page.tsx` | Password reset initiation | Login page link |
| Reset Password | `/auth/reset-password` | `frontend/app/(auth)/auth/reset-password/page.tsx` | Password reset completion | Forgot-password email flow |
| Onboarding (Patient) | `/onboarding/patient` | `frontend/app/(onboarding)/onboarding/patient/page.tsx` | Patient onboarding/edit | Post-login redirect if incomplete, profile edit CTA |
| Onboarding (Doctor) | `/onboarding/doctor` | `frontend/app/(onboarding)/onboarding/doctor/page.tsx` | Doctor onboarding/edit | Post-login redirect if incomplete, doctor profile edit CTA |
| Verify Email | `/verify-email` | `frontend/app/(onboarding)/verify-email/page.tsx` | Email verification status page | Redirect after signup/login checks |
| Verification Success | `/verification-success` | `frontend/app/(onboarding)/verification-success/page.tsx` | Email verified success page | Auth confirm route redirect |
| Settings | `/settings` | `frontend/app/(home)/settings/page.tsx` -> `home-settings-client.tsx` | App/account settings | Navbar profile dropdown |
| Notifications | `/notifications` | `frontend/app/(home)/notifications/page.tsx` -> `home-notifications-client.tsx` | Full notifications center | Notification dropdown "View all", notification bell |
| Prescription Preview | `/prescription/preview/[consultation_id]` | `frontend/app/(home)/prescription/preview/[consultation_id]/page.tsx` | Print/download prescription preview | From doctor consultation page (`router.push('/prescription/preview/...')`) |
| Admin Dashboard | `/admin` | `frontend/app/(admin)/admin/page.tsx` | Admin overview | Admin navbar, role redirect |
| Admin Doctors | `/admin/doctors` | `frontend/app/(admin)/admin/doctors/page.tsx` | Doctor verification/management | Admin navbar, admin quick actions |
| Admin Patients | `/admin/patients` | `frontend/app/(admin)/admin/patients/page.tsx` | Patient management | Admin navbar, admin quick actions |
| Admin Appointments | `/admin/appointments` | `frontend/app/(admin)/admin/appointments/page.tsx` | Appointment management | Admin navbar, admin quick actions |
| Admin Audit Log | `/admin/audit-log` | `frontend/app/(admin)/admin/audit-log/page.tsx` | Audit logs | Admin navbar |
| Admin Users | `/admin/users` | `frontend/app/(admin)/admin/users/page.tsx` | User management actions | Admin navbar |
| Admin Schedule Review | `/admin/schedule-review` | `frontend/app/(home)/admin/schedule-review/page.tsx` | Schedule review/fix utility | **No direct main-nav entry found** |
| Verify Pending | `/verify-pending` | `frontend/app/(admin)/verify-pending/page.tsx` | Waiting page for unverified doctors | Redirect from login checks |
| Clear Admin Session | `/clear-admin` | `frontend/app/(admin)/clear-admin/page.tsx` | Clears admin cookies/session and redirects `/` | **No direct UI entry found** |
| Account Blocked | `/account-blocked` | `frontend/app/account-blocked/page.tsx` | Blocked account notice | Redirect from auth checks |
| Localized Account Blocked | `/[locale]/account-blocked` | `frontend/app/[locale]/account-blocked/page.tsx` | Localized blocked page | No direct UI entry found |

---

## Section 3 - Navigation Structure

### 3.1 Patient Navigation Menu (active implementation: `frontend/components/ui/navbar.tsx`)

#### Desktop top menu
- `Find Doctor` -> `/patient/find-doctor`
- `Analytics` -> `/patient/analytics`
- `Appointments` -> `/patient/appointments`
- `Find Medicine` -> `/patient/find-medicine`
- `Medical History` -> `/patient/medical-history`

#### Profile dropdown
- `Profile` -> `/patient/profile`
- `Settings` -> `/settings`
- `Privacy & Data Sharing` -> `/patient/privacy`

#### Mobile menu items
- `Find Doctor` -> `/patient/find-doctor`
- `Analytics` -> `/patient/analytics`
- `Appointments` -> `/patient/appointments`
- `Find Medicine` -> `/patient/find-medicine`
- `Medical History` -> `/patient/medical-history`
- `Lab Reports` -> `/patient/medical-reports`
- `Privacy & Data Sharing` -> `/patient/privacy`
- `My Profile` -> `/patient/profile`
- `Settings` -> `/settings`

#### Additional navigation triggers
- Navbar logo -> `/patient/home` (role-aware)
- Notification bell -> `/notifications` (via dropdown "View all")
- Chorui launcher (desktop action area) -> `/patient/chorui-ai`

### 3.2 Doctor Navigation Menu (active implementation: `frontend/components/ui/navbar.tsx`)

#### Desktop top menu
- `Appointments` -> `/doctor/appointments`
- `Patients` -> `/doctor/patients`
- `Analytics` -> `/doctor/analytics`

#### Profile dropdown
- `Profile` -> `/doctor/profile`
- `Settings` -> `/settings`

#### Mobile menu items
- `Appointments` -> `/doctor/appointments`
- `Patients` -> `/doctor/patients`
- `Analytics` -> `/doctor/analytics`
- `My Profile` -> `/doctor/profile`
- `Settings` -> `/settings`

#### Additional navigation triggers
- Navbar logo -> `/doctor/home` (role-aware)
- Notification bell -> `/notifications`
- Chorui launcher (desktop action area) -> `/doctor/chorui-ai`

### 3.3 Note on duplicate/legacy nav component

- `frontend/components/doctor/doctor-navbar.tsx` defines extra items (`/doctor/settings`, chorui launcher, etc.) but **no active usage found** in the current route components.

---

## Section 4 - AI Intent Coverage Analysis (Very Important)

### 4.1 Intent -> route mapping candidates

### Patient-facing intents
- `"take me to find doctor"` -> `/patient/find-doctor`
- `"show my appointments"` -> `/patient/appointments`
- `"open medical history"` -> `/patient/medical-history`
- `"show my lab reports"` -> `/patient/medical-reports`
- `"show my prescriptions"` -> `/patient/prescriptions` (ambiguous with `/patient/my-prescriptions`)
- `"open reminders"` -> `/patient/reminders`
- `"open privacy settings"` -> `/patient/privacy`
- `"open my profile"` -> `/patient/profile`
- `"open patient analytics"` -> `/patient/analytics`
- `"open chorui ai"` -> `/patient/chorui-ai`
- `"find medicine"` -> `/patient/find-medicine`

### Doctor-facing intents
- `"show my appointments"` -> `/doctor/appointments`
- `"show my patients"` -> `/doctor/patients`
- `"open doctor analytics"` -> `/doctor/analytics`
- `"open my schedule"` -> `/doctor/schedule`
- `"open my profile"` -> `/doctor/profile`
- `"open chorui ai"` -> `/doctor/chorui-ai`
- `"open patient [id]"` -> `/doctor/patient/[id]`
- `"open patient [id] reports"` -> `/doctor/patient/[id]/reports`
- `"open patient [id] consultation"` -> `/doctor/patient/[id]/consultation`
- `"open ai pre-consultation for patient [id]"` -> `/doctor/patient/[id]/consultation/ai`

### Shared intents
- `"open notifications"` -> `/notifications`
- `"open settings"` -> `/settings`
- `"go to login"` -> `/login`

### 4.2 Missing routes for common intents

- `"doctor settings"` -> **missing route** (`/doctor/settings` appears in unused doctor navbar component but no page exists).
- `"analytics"` (without role) -> **ambiguous/misaligned**; there is no `/analytics` page, but patient home dashboard links to `/analytics` in multiple places.

### 4.3 Ambiguous route targets

- Prescriptions:
  - `/patient/prescriptions`
  - `/patient/my-prescriptions`
  - Both render "My Prescriptions"-type experiences; intent disambiguation required.
- Doctor profile booking:
  - `/patient/doctor/[id]`
  - `/doctor/[doctorId]`
  - Both use `DoctorProfileAppointmentPage`.
- Account blocked:
  - `/account-blocked`
  - `/[locale]/account-blocked`
- Admin landing:
  - Existing page: `/admin`
  - Redirect in `auth-actions.ts` points to `/admin/dashboard` (non-existent page).

### 4.4 Existing Chorui intent logic vs navigation

- Backend Chorui already classifies many intents (`_classify_chorui_intent` in `backend/app/routes/ai_consultation.py`) including service/help intents.
- However, current response schema (`ChoruiAssistantResponse`) does **not** include navigation action fields (no `route`, `action`, `requires_role`, etc.).
- Current frontend `ChoruiChat`/`useChoruiChat` does **not** execute route navigation from AI output (`router.push` is absent in Chorui chat flow).

---

## Section 5 - System Summary

- Total Patient Pages: **18**
- Total Doctor Pages: **15**
- Shared Pages: **23**
- Total Pages (frontend `page.tsx` routes): **56**

### 5.1 Routes not exposed in primary UI

- `/patient/my-prescriptions` (no direct navigation references found)
- `/doctor/find-medicine` (no direct navigation references found)
- `/doctor/[doctorId]` (no direct navigation references found)
- `/admin/schedule-review` (no main navbar link)
- `/clear-admin` (utility route, no main UI link)

### 5.2 Duplicate/inconsistent routes

- `/patient/prescriptions` vs `/patient/my-prescriptions` (overlapping purpose)
- `/patient/doctor/[id]` vs `/doctor/[doctorId]` (same component)
- `/account-blocked` vs `/[locale]/account-blocked` (duplicate surface)
- Redirect mismatch: `redirect("/admin/dashboard")` exists but route is `/admin`
- Broken/legacy links in patient dashboard: multiple links to `/analytics` (route not present)

---

## Section 6 - Chorui AI Integration Gaps

### 6.1 Where Chorui AI is not present but likely should be

- Mobile navigation: no explicit Chorui menu item in mobile sheet (`Navbar`), while desktop has `ChoruiLauncher`.
- In-context pages (e.g., patient appointments, patient medical history, doctor patient detail/consultation) rely on separate workflows; no embedded Chorui quick-action there.

### 6.2 Can current implementation support navigation actions?

- **Not yet.**
- Evidence:
  - Frontend hook `useChoruiChat` only consumes `reply`, `structured_data`, `context_mode`.
  - No route action execution in `ChoruiChat` (`router.push` absent for AI replies).
  - Backend `ChoruiAssistantResponse` lacks navigation payload fields.
  - `service_information` replies in backend are plain text guidance, not executable navigation commands.

### 6.3 Multiple Chorui/AI versions

- Core Chorui chat: shared patient/doctor chat (`ChoruiChat` + `/ai/assistant-chat`).
- Separate doctor consultation AI panel (`AIAssistantPanel`) with different API and behavior.
- This split can create UX inconsistency unless route-action contracts are standardized.

---

## Section 7 - AI Navigation Readiness

### 7.1 Is current routing structure suitable?

- **Partially suitable.**
- Strengths:
  - Clear role-prefixed route namespaces (`/patient/*`, `/doctor/*`).
  - Stable top-level nav destinations for core tasks.
  - Chorui already has role context (`patient` vs `doctor`) and backend intent classification.
- Weaknesses:
  - No executable navigation contract from assistant to frontend.
  - Route duplication and orphan pages increase ambiguity.
  - Some nav links are inconsistent (`/analytics` bug, `/admin/dashboard` mismatch).
  - Mobile Chorui discoverability gap.

### 7.2 Missing pieces to support

### Intent detection
- Add explicit navigation intent taxonomy (e.g., `navigate_find_doctor`, `navigate_appointments`, `navigate_medical_history`) separate from medical Q&A intents.
- Add role-scoped intent resolution rules and ambiguity handling.

### Route mapping
- Create a canonical, centralized route registry (role + intent + route template + required params).
- Define aliases/synonyms (`"appointments"`, `"my bookings"`, `"next visit"`) mapped to canonical routes.
- Mark deprecated/duplicate routes and choose canonical targets.

### Role-based navigation
- Add assistant action schema in backend response:
  - Example fields: `action_type`, `target_route`, `required_role`, `required_params`, `confidence`.
- Add frontend action executor in Chorui UI:
  - Validate role and required params.
  - Confirm before navigation when ambiguous.
  - Fallback to suggestion chips if missing params (e.g., patient ID for doctor routes).

### 7.3 High-priority fixes before enabling AI route actions

- Fix invalid route links from patient dashboard (`/analytics` -> `/patient/analytics`).
- Resolve admin redirect mismatch (`/admin/dashboard` -> `/admin`).
- Decide canonical prescriptions route (`/patient/prescriptions` vs `/patient/my-prescriptions`).
- Decide canonical doctor public profile route (`/patient/doctor/[id]` vs `/doctor/[doctorId]`).
- Add mobile-accessible Chorui entry point.

