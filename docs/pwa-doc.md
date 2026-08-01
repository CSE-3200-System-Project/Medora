# Medora progressive web application policy

The Next.js client uses Serwist for installation metadata, push support, and a small
runtime cache. Health information is deliberately excluded from offline persistence.

## Allowed service-worker storage

- Build-versioned static assets.
- Fonts and public images/resources that contain no account or health data.
- Push subscription mechanics, subject to normal browser controls.

## Prohibited storage and synchronization

- Authenticated API responses, medical reports, prescriptions, consultations,
  summaries, transcripts, or OCR results in Cache Storage.
- Queued or replayed health-data mutations.
- Health records in IndexedDB or local storage.

`frontend/lib/use-offline.ts` reports network state and may retain non-sensitive data
in process memory for the current page lifetime. It does not create a background-sync
queue. `frontend/app/sw.ts` defines the static/public allowlist.

Logout routes through the session-cleanup page, which removes every Medora cache,
IndexedDB database, session-storage entry, and sensitive local-storage key. Locale
and theme preferences may remain. Reconnecting views reload server state; for
appointments, PostgreSQL is authoritative and realtime events are hints.

The Playwright release suite must inspect Cache Storage, IndexedDB, and local storage
before and after logout and across offline/reconnect flows. Any sensitive value is a
release failure.

