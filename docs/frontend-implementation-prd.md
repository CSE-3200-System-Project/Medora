# Frontend Implementation Reference

> **Current as of:** April 2026 scan of actual code.
> For detailed architecture, see [architecture/frontend.md](./architecture/frontend.md).

---

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** + **Radix UI** primitives
- **Serwist** (`@serwist/next`) — PWA / service worker
- **next-intl** — i18n (English + Bangla)
- **TanStack Query** — client-side data caching
- **Supabase JS** (`@supabase/ssr` + `@supabase/supabase-js`) — auth session, realtime
- **Framer Motion** — animations
- **MapLibre GL** — maps
- **Vapi** — voice calls
- **Recharts / ECharts** — analytics charts
- **Sonner** — toasts

---

## Route Structure

Three route groups. No `middleware.ts` — auth enforced in layouts and Server Actions.

```
(auth)/         — login, register (patient/doctor), forgot-password, auth/confirm
(home)/         — patient/* and doctor/* (auth-guarded layout)
  patient/      — home, find-doctor, appointments, medical-history, medical-reports,
                  prescriptions, my-prescriptions, reminders, analytics,
                  chorui-ai, find-medicine, privacy, profile, doctor/[id]
  doctor/       — home, patients, patient/[id], patient/[id]/consultation,
                  patient/[id]/consultation/ai, patient/[id]/reports/[reportId],
                  appointments, schedule, analytics, chorui-ai, find-medicine, profile
  notifications/, settings/, prescription/preview/
(admin)/        — admin/* (admin role guard)
(onboarding)/   — onboarding/doctor/* (multi-step wizard)
```

---

## Data Pattern

All mutations and fetches go through **Server Actions** in `frontend/lib/`. 20 action modules. Client components never call the backend directly.

Auth token is read from the Supabase session cookie on the Next.js server, injected into backend requests as `Authorization: Bearer <jwt>`.

**Real-time:** `lib/use-realtime-slots.ts` subscribes to Supabase Realtime channel on the `appointments` table for live slot availability updates.

---

## PWA

Service worker at `app/sw.ts` (Serwist). Disabled in dev (`NODE_ENV !== 'production'`).

Caching: Next.js chunks (CacheFirst 30d), images (StaleWhileRevalidate 14d), API (NetworkFirst).

Background sync: failed writes queued 24h, replayed on reconnect.

---

## i18n

next-intl. Locales: `en`, `bn`. Message files in `i18n/messages/{en,bn}/`. All user-facing strings are keyed — no hardcoded copy.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Server-side backend URL (used in Server Actions) |
| `NEXT_PUBLIC_BACKEND_URL` | Client-visible backend URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi voice integration |
| `NODE_ENV` | Controls SW registration (`production` only) |

---

## User Roles and Pages

| Role | Gate | Key Pages |
|---|---|---|
| Patient | `onboarding_completed` | home, find-doctor, appointments, medical-history, prescriptions, chorui-ai |
| Doctor | `onboarding_completed` + `verification_status == verified` | home, patients, consultations, schedule, chorui-ai |
| Admin | `role == admin` | /admin/*, verify-pending |

---

## Component Organization

```
components/
  ui/          45 primitive files (Radix-based, zero business logic)
  admin/       Admin dashboard, approval UI, audit log
  ai/          Chorui chat UI, navigation suggestions
  appointment/ Booking flow, calendar, reschedule
  consultation/ SOAP editor, prescription builder
  dashboard/   Role-specific widgets
  doctor/      Doctor profile, availability editor
  medical-history/  Conditions, allergies, medications, family history
  medicine/    Search UI, OCR result display
  prescription/ Print preview, PDF export
  onboarding/  Multi-step wizard steps
  providers/   ThemeProvider, i18n, QueryClientProvider
```

---

## Key Libraries (Exact from package.json)

```
next ^16.1.6, react 19.2.3, typescript ^5
@supabase/ssr ^0.8.0, @supabase/supabase-js ^2.89.0
@serwist/next ^9.5.6, serwist ^9.5.6
framer-motion ^12.x, gsap ^3.14.2, lenis ^1.3.17
maplibre-gl ^5.16.0
next-intl (i18n)
@tanstack/react-query (client cache)
recharts, echarts-for-react (charts)
sonner (toasts)
lucide-react (icons)
tailwindcss ^4, @radix-ui/* (primitives)
```
