# Medora Next.js PWA Documentation

This document describes the complete Next.js PWA implementation that was added to the Medora frontend. It preserves all configuration details, architectural decisions and code examples so the system can be maintained or extended by developers.

---

## Overview
The frontend is now structured as a **Next.js progressive web app** with six implementation layers:

1. Dependency and build hardening
2. Service worker generation with Serwist
3. Manifest and install metadata
4. Runtime registration in production
5. Feature hooks for push, offline, camera, location, and files
6. Verification through successful production build and a clean audit

The implementation is centered around `next.config.ts`, `app/sw.ts`, `public/manifest.json`, `app/layout.tsx` and `components/pwa-registration.tsx`.

---

## 1. Dependency & Security Changes
The original setup included `next-pwa` and an outdated Next.js version, both of which triggered npm audit warnings.

### What changed
- Removed `next-pwa` entirely
- Added `@serwist/next` and `serwist` as the PWA stack
- Updated Next.js to **16.1.6**
- Updated `eslint-config-next` to **16.1.6**
- Ran `npm audit fix` to resolve remaining `ajv` and `minimatch` ReDoS issues

### Why Serwist?
`next-pwa` brought in vulnerable versions of **serialize-javascript** and **workbox**, visible in the audit report. Serwist is actively maintained and designed for modern Next.js apps.

### Final state
- `npm audit` now reports **0 vulnerabilities**
- `npm run build` succeeds

### Build script changes
The `package.json` scripts were modified:
```jsonc
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build --webpack",
  "start": "next start",
  "lint": "eslint"
},
```

We build with **webpack** because Serwist currently requires it. Turbopack remains default in dev.

---

## 2. PWA Build Integration
All build‑time PWA wiring lives in `next.config.ts`:

```ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist({ /* other Next config */ });
```

**Behavior**
- `sw.ts` is the authored service worker
- `public/sw.js` is the bundled output
- Generation is disabled in development to avoid cache confusion

In prod, Serwist bundles the worker, precaches assets, and emits `/sw.js` automatically.

---

## 3. App Metadata & Installability
Installability is driven by two files.

### Manifest (`public/manifest.json`)
```json
{
  "name": "Medora - Healthcare Platform",
  "short_name": "Medora",
  "description": "AI-assisted healthcare platform for Bangladesh",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#0360D9",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "en",
  "categories": ["health","medical"],
  "icons": [
    { "src": "/icons/icon-72x72.png", "sizes": "72x72", "type": "image/png", "purpose": "maskable any" },
    /* ...other sizes up to 512x512... */
  ]
}
```

> **Note:** icons are currently placeholders (copies of the logo) and should be replaced with properly sized assets for production.

### Metadata `<head>` (in `app/layout.tsx`)
Key definitions:
- `manifest: "/manifest.json"`
- `themeColor` set to `#0360D9` to match brand
- Apple-specific tags (`appleWebApp`)
- `viewport` locked to device-width with `userScalable: false` (see accessibility comment below)

```tsx
export const metadata: Metadata = {
  title: `${APP_NAME} - Healthcare Platform`,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
  formatDetection: { telephone: false },
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192x192.png", apple: "/icons/icon-192x192.png" },
};
```

> ⚠️ The `userScalable: false` setting prevents pinch-zoom; revisit if accessibility is required.

---

## 4. Root Layout Integration
`app/layout.tsx` now imports and renders the registration component:

```tsx
import { PWARegistration } from "@/components/pwa-registration";

// ... inside <body> ...
  <ThemeProvider /* ... */>
    <SmoothScrollProvider>{children}</SmoothScrollProvider>
  </ThemeProvider>
  <PWARegistration />
```

This ensures service-worker registration happens exactly once in the root tree.

No existing providers (font, theme, scroll) were altered.

---

## 5. Service Worker Design (`app/sw.ts`)
Four responsibilities are implemented:

1. **Precache & runtime caching** via Serwist
2. **Background sync queueing**
3. **Push notification display**
4. **Notification click navigation**

Key configuration:
- `skipWaiting`, `clientsClaim`, `navigationPreload` all enabled
- `runtimeCaching` uses the Serwist `defaultCache`

Background sync queue:
- Name: `medora-api-queue`
- Retention: 24 hours
- Queues only POST/PATCH/PUT on same‑origin `/api/` paths

Push handling: listens for `push` events, displays notifications (defaults defined), and routes click events to existing or new windows.

> 📌 Background queue only monitors same‑origin requests (e.g. `/api/...`). Direct calls to the FastAPI backend URL are not queued unless proxied through Next endpoints.

Example push handler snippet:

```ts
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Medora", body: "You have a new notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag || "medora-notification",
      data: data.data || {},
    }),
  );
});
```

Notification click routing focuses an existing window or opens `/` by default.

---

## 6. Service Worker Registration (`components/pwa-registration.tsx`)
Client-side only, production-only:

```tsx
export function PWARegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);
  return null;
}
```

This avoids stale caches during development and matches the `disable` flag in `next.config.ts`.

---

## 7. Push Notification Hook (`lib/use-push-notifications.ts`)
Tracks:
- `isSupported`, `isSubscribed`, `subscription`

Exposes functions:
- `subscribe(authToken)`
- `unsubscribe(authToken)`
- `requestPermission()`
- `permission` read-only state

### Usage flow
```tsx
const { isSupported, isSubscribed, subscribe, unsubscribe, permission } = usePushNotifications();
```

Subscribe process:
1. Wait for service worker ready
2. GET `/notifications/vapid-key` from backend
3. Convert key and call `pushManager.subscribe`
4. POST subscription object to `/notifications/subscribe` with auth

Unsubscribe:
1. Call `subscription.unsubscribe()`
2. POST endpoint to `/notifications/unsubscribe`

Backend contract (FastAPI):
- `GET /notifications/vapid-key` → `{ public_key: string }`
- `POST /notifications/subscribe` (bearer auth)
- `POST /notifications/unsubscribe` (bearer auth)

> ⚠️ The frontend hook is ready; ensure the backend provides these endpoints and persists subscriptions.

---

## 8. Offline & Background Sync Utilities (`lib/use-offline.ts`)
Three helpers:

1. `useNetworkStatus()` – online/offline boolean + wasOffline flag
2. `requestBackgroundSync(tag)` – manually register a sync event with the service worker
3. `useOfflineCache(key, fetcher)` – caches fetch results in `localStorage`

`useOfflineCache` returns `{ data, isLoading, error, refresh }` and automatically falls back to cached data when the network fails.

> ⚠️ This is a simple `localStorage` fallback. For complex medical forms you’ll need a stronger offline store (e.g. IndexedDB).

---

## 9. Device Access Hooks (`lib/use-device-access.ts`)
Three capability wrappers:

### useCamera()
- Provides `videoRef`, `start(options)`, `stop()`, `capturePhoto()`
- Handles permissions and errors
- Returns JPEG data URLs

### useLocation()
- Provides `{ latitude, longitude, accuracy, isLoading, error, getCurrentPosition() }`
- Uses `navigator.geolocation.getCurrentPosition` with high accuracy and timeout

### useFilePicker()
- Returns `{ files, error, pickFiles(options), clearFiles() }`
- Creates a hidden `<input type="file">` element dynamically

These hooks are ready for use in onboarding, history, prescriptions, etc., but no UI currently consumes them.

---

## 10. Icon Assets
Icon files were placed under `public/icons/` by copying the existing logo at each required size. They satisfy manifest wiring but must be replaced with true assets for polished appearance.

Sizes included: 72, 96, 128, 144, 152, 192, 384, 512.

---

## 11. Production Behavior End‑to‑End
1. Layout imports `PWARegistration` and registers the service worker on load.
2. Browser caches assets and precaches routes via the generated service worker.
3. `manifest.json` allows the app to be installable on mobile/desktop.
4. Users can subscribe to push notifications; backend must handle keys and subscriptions.
5. Notifications show even when the app is closed; clicking routes users appropriately.
6. Offline writes under `/api/` are queued in `medora-api-queue` for later sync.
7. UI can use offline-cache hook to render cached data when offline.
8. Camera, location, and file APIs are available via dedicated hooks.

---

## 12. Verification Results
- `npm audit` reports **0 vulnerabilities** (all earlier issues fixed)
- `npm run build --webpack` completes successfully

The project is both secure and buildable.

---

## 13. Coverage vs. Remaining Work
### Completed
- Full PWA metadata & install support
- Production service worker with caching, background sync, notifications
- Client hooks for push, offline, camera, location, file access
- Security audit remediation

### Still to implement
- FastAPI endpoints for VAPID key / subscription management
- UI components for notification settings or camera/location usage
- Proxying all mutation requests through `/api/` if you need them synced offline
- Proper rasterized PWA icons
- Robust offline DB storage for medical records

---

## 14. Integration Suggestions (FastAPI + Supabase)
1. FastAPI generates a VAPID key pair and serves the public key.
2. Store each user’s push subscription in Supabase for later targeting.
3. Add UI in the user profile/settings screen to call the push hook.
4. Use the offline-cache hook on read-heavy pages (doctor lists, history).
5. For offline write operations, create Next.js API routes that forward to the backend; the service worker will queue them automatically.

This keeps backend logic unchanged while enabling PWA resilience.

---

## 15. File Map
| Purpose | File |
|---------|------|
| Core config | `package.json`, `next.config.ts`, `app/layout.tsx`, `public/manifest.json` |
| Runtime PW A logic | `app/sw.ts`, `components/pwa-registration.tsx` |
| Feature hooks | `lib/use-push-notifications.ts`, `lib/use-offline.ts`, `lib/use-device-access.ts` |
| Project record | `tasks/todo.md` |

---

> ✅ You now have a fully documented PWA implementation ready for review or further development. Let me know if you'd like this text converted into a README section or extended with backend API examples.

