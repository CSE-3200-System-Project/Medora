# Frontend Architecture

Medora's frontend is a **Next.js 15 App Router** application (React 19, TypeScript). It is a PWA backed by a Serwist service worker, supports English and Bangla via next-intl, and communicates with the FastAPI backend exclusively through **Server Actions** — no direct client-to-API calls from the browser.

---

## Stack

| Tool | Purpose |
|---|---|
| Next.js 15 / React 19 | App Router, Server Actions, RSC |
| TypeScript | Strict typing throughout |
| Tailwind CSS + Radix UI | Styling and accessible UI primitives |
| Serwist / `@serwist/next` | Service worker, PWA, offline support |
| next-intl | i18n (EN + BN) |
| TanStack Query | Client-side data caching |
| Framer Motion | Animation |
| Supabase JS | Auth session, realtime channel subscriptions |
| Recharts / ECharts | Analytics charts |
| MapLibre GL | Doctor location maps |
| Vapi | Voice call integration |
| Sonner | Toast notifications |

---

## App Router Structure

Route groups control layout and auth. No `middleware.ts` exists — authentication and role-guards are enforced inside layouts and Server Actions.

```
frontend/app/
│
├── page.tsx                          # Public landing page
├── layout.tsx                        # Root: fonts, ThemeProvider, i18n provider, PWA registration
├── sw.ts                             # Serwist service worker (compiled → public/sw.js)
├── global-error.tsx
│
├── (auth)/                           # Unauthenticated routes
│   ├── login/page.tsx
│   ├── patient/register/page.tsx
│   ├── doctor/register/page.tsx
│   ├── selection/page.tsx            # Role selection after Supabase signup
│   ├── forgot-password/page.tsx
│   ├── auth/confirm/route.ts         # Supabase email confirmation callback
│   └── logout/route.ts
│
├── (home)/                           # Authenticated: patient + doctor
│   ├── layout.tsx                    # Auth guard, role check, nav shell
│   ├── patient/
│   │   ├── home/                     # Patient dashboard
│   │   ├── find-doctor/              # Doctor search + AI search
│   │   ├── appointments/             # Appointment list + calendar
│   │   ├── medical-history/          # Conditions, allergies, medications, surgery, family history
│   │   ├── medical-reports/          # Uploaded lab/report images
│   │   ├── prescriptions/            # Received prescriptions
│   │   ├── my-prescriptions/         # Patient-managed medication list
│   │   ├── reminders/                # Appointment/medication reminders
│   │   ├── analytics/                # Health metrics charts
│   │   ├── chorui-ai/                # Chorui assistant chat
│   │   ├── find-medicine/            # Medicine database search + OCR
│   │   ├── privacy/                  # Data sharing + consent management
│   │   ├── profile/
│   │   ├── doctor/[id]/              # Doctor public profile
│   │   └── appointment-success/
│   │
│   ├── doctor/
│   │   ├── home/                     # Doctor dashboard
│   │   ├── patients/                 # Patient list
│   │   ├── patient/[id]/             # Patient overview
│   │   ├── patient/[id]/consultation/          # Consultation editor
│   │   ├── patient/[id]/consultation/ai/       # AI-assisted SOAP notes
│   │   ├── patient/[id]/reports/               # Patient lab reports
│   │   ├── patient/[id]/reports/[reportId]/    # Single report detail
│   │   ├── appointments/             # Appointment list
│   │   ├── schedule/                 # Availability / slot management
│   │   ├── analytics/                # Practice analytics
│   │   ├── chorui-ai/                # Chorui assistant
│   │   ├── find-medicine/
│   │   └── profile/
│   │
│   ├── notifications/
│   ├── settings/
│   └── prescription/preview/         # Printable prescription preview
│
├── (admin)/                          # Admin-only
│   ├── admin/
│   │   ├── page.tsx                  # Admin dashboard
│   │   ├── appointments/, doctors/, patients/, users/
│   │   ├── audit-log/, requests/
│   │   └── layout.tsx               # Admin role guard
│   ├── verify-pending/
│   └── clear-admin/
│
└── (onboarding)/
    └── onboarding/doctor/            # Multi-step doctor onboarding wizard
```

---

## Server Actions (`frontend/lib/`)

All data fetching and mutations run on the **Next.js server** via Server Actions. They inject the Supabase session JWT and call the FastAPI backend over HTTP. No browser-side API calls.

| File | Responsibility |
|---|---|
| `auth-actions.ts` | Signup, login, logout, password reset |
| `appointment-actions.ts` | CRUD, slot availability, cancellation |
| `ai-consultation-actions.ts` | SOAP notes, structured intake, patient summary |
| `doctor-actions.ts` | Doctor discovery, profiles |
| `patient-dashboard-actions.ts` | Aggregated patient home data |
| `prescription-actions.ts` | Prescriptions list, accept/reject |
| `medical-report-actions.ts` | Upload, OCR parsing, list |
| `health-metrics-actions.ts` | Health readings (weight, BP, glucose, etc.) |
| `health-data-consent-actions.ts` | Consent read/write |
| `patient-data-sharing-actions.ts` | Per-doctor data sharing permissions |
| `notification-actions.ts` | Push subscription, notification list |
| `medicine-actions.ts` | Medicine search, brand OCR matching |
| `admin-actions.ts` | Doctor verification, user management |
| `availability-actions.ts` | Doctor slot templates and exceptions |
| `reminder-actions.ts` | Reminder CRUD |
| `file-storage-actions.ts` | Supabase Storage uploads |
| `google-calendar-actions.ts` | Google Calendar OAuth + event sync |
| `voice-actions.ts` | Voice recording, ASR transcription |
| `patient-access-actions.ts` | Access log queries |
| `patient-ai-access-actions.ts` | AI permission tracking |

**Hooks and utilities also in `/lib/`:**
`use-realtime-slots.ts` (Supabase realtime), `use-voice-recorder.ts`, `use-push-notifications.ts`, `use-pagination.ts`, `use-offline.ts`, `vapi-audio.ts`, `vapi-tools.ts`, `prescription-document-export.ts`, `clinical-prescription-document.ts`, `motion.ts`, `notify.ts`

---

## Component Structure

### UI Primitives — `components/ui/`

~45 files. Built on Radix UI + Tailwind. Zero business logic.

Core: `button`, `input`, `textarea`, `select`, `dialog`, `checkbox`, `switch`, `label`, `radio-group-native`, `table`, `pagination-controls`, `dropdown-menu`, `navigation-menu`

Domain-specific primitives: `appointment-calendar`, `map`, `map-lazy`, `location-picker`, `medora-loader`, `notification-dropdown`, `reminder-dialog`, `confirmation-dialog`, `skeleton-loaders`, `page-loading-shell`, `mobile-filter-sheet`, `theme-provider`, `app-background`, `pwa-registration`, `mobile-viewport-fix`

### Feature Components — `components/<domain>/`

20+ domain folders. Compose UI primitives with Server Action calls.

| Folder | Contents |
|---|---|
| `admin/` | Dashboard, approval workflows, audit log views |
| `ai/` | Chorui assistant UI, navigation suggestions display |
| `appointment/` | Booking flow, calendar, reschedule UI |
| `appointments/` | Multi-role appointment lists |
| `auth/` | Login/register forms |
| `consultation/` | SOAP editor, prescription builder |
| `dashboard/` | Role-specific dashboard widgets |
| `doctor/` | Doctor profile, availability scheduling |
| `medical-history/` | Conditions, allergies, medications, family history editors |
| `medical-test/` | Test form and results |
| `medicine/` | Search UI, OCR result display |
| `patient/` | Patient-specific components |
| `prescription/` | Preview, PDF export |
| `reminders/` | Reminder management |
| `onboarding/` | Multi-step wizard steps |
| `landing/` | Public landing page sections |
| `screens/` | Reusable screen templates |
| `providers/` | ThemeProvider, i18n provider, QueryClientProvider |

---

## Data & State Flow

```
Browser
  └─ Client component triggers Server Action
       └─ Server Action (Next.js server process)
            ├─ Reads Supabase session → extracts JWT
            ├─ HTTP POST/GET to FastAPI backend (with Bearer token)
            └─ Returns typed response to component

On mutation: revalidatePath() / revalidateTag()
  └─ Next.js invalidates RSC cache → page re-fetches on next render

Real-time (appointment slots):
  └─ useRealtimeSlots() → Supabase Realtime channel subscription
       └─ Pushes slot availability changes to subscribed components
```

TanStack Query is used for client-side caching of repeated reads (e.g., medicine search results, doctor profiles).

---

## PWA — Service Worker (`app/sw.ts`)

Built with **Serwist**. Disabled automatically in `NODE_ENV === 'development'` (see `next.config.ts`).

| Asset type | Caching strategy | TTL |
|---|---|---|
| Next.js JS/CSS chunks | CacheFirst | 30 days |
| Images | StaleWhileRevalidate | 14 days |
| API responses | NetworkFirst | `API_CACHE_TTL` env var |
| Install-critical assets | Precached on SW install | — |

**Background sync:** Failed API writes are queued with a 24-hour retention window and replayed when the device reconnects.

---

## i18n

**Library:** next-intl | **Locales:** `en` (English), `bn` (Bangla)

```
i18n/
├── config.ts            # Locale list, default locale
├── locale.ts            # Server-side locale resolution
├── locale-client.ts     # Client-side locale resolution
├── client.ts            # next-intl client init
├── message-loader.ts    # Dynamic message loading per locale
└── error-map.ts         # Error code → translated string

i18n/messages/{en,bn}/
  common.json, auth.json, consultation.json, prescription.json,
  chorui.json, voice.json, nav.json, settings.json,
  notifications.json, errors.json
```

Locale is resolved on the server from the request and injected into the root layout. All user-facing strings, error messages, and navigation labels are keyed through these JSON files — no hardcoded copy.

---

## Build Config (`next.config.ts`)

```ts
withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})

nextConfig = {
  images: { formats: ["avif", "webp"], deviceSizes: [...] },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      // Tree-shakes: lucide-react, echarts, framer-motion, all @radix-ui/*
    ]
  }
}
```
