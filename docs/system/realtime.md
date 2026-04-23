# Real-time System

Medora uses two mechanisms for real-time updates: **Supabase Realtime** (WebSocket channel subscriptions for client-facing updates) and **asyncio background tasks** (server-side loops for reminders and hold expiry).

---

## Supabase Realtime — Slot Availability

### When it's used

When a patient views a doctor's available booking slots, those slots must stay live — if another patient books a slot simultaneously, the first patient's slot list should immediately reflect the change.

### Implementation

**Hook:** `frontend/lib/use-realtime-slots.ts`

```
useRealtimeSlots(doctorId, date)
  │
  ├─ supabase.channel(`slots-${doctorId}-${date}`)
  │     .on('postgres_changes', {
  │         event: 'INSERT' | 'UPDATE',
  │         schema: 'public',
  │         table: 'appointments',
  │         filter: `doctor_id=eq.${doctorId}`
  │     }, callback)
  │     .subscribe()
  │
  └─ callback → triggers refetch of available slots
       └─ GET /availability/{doctorId}/slots/{date} called fresh
```

When any appointment is inserted or updated for the given doctor, all clients subscribed to that channel receive a notification and re-fetch slot availability.

**Cleanup:** Channel is unsubscribed on component unmount.

---

## Background Tasks — Reminder Dispatcher

**File:** `backend/app/services/reminder_dispatcher.py`

Runs as an asyncio Task launched in the FastAPI lifespan on startup. Continues until app shutdown.

```
_run_dispatcher_loop()
  │
  Loop:
  ├─ base_interval: max(300, REMINDER_DISPATCH_INTERVAL_SECONDS)
  ├─ max_interval: max(base * 12, 30 min)
  │
  ├─ Query: SELECT reminders WHERE status='pending'
  │          AND due_at <= now() + lookahead_window
  │          WITH joined appointment + profile data
  │
  ├─ For each due reminder:
  │   ├─ ReminderType.APPOINTMENT:
  │   │   ├─ push → send_push_to_user(user_id, notification_payload)
  │   │   ├─ email → send_appointment_reminder_email(profile, appointment)
  │   │   └─ in_app → create_notification(to_user_id, type, message)
  │   │
  │   └─ ReminderType.ITEM (medication, general):
  │       └─ send_item_reminder_email(profile, reminder)
  │
  ├─ UPDATE reminder SET status='sent', sent_at=now()
  │   └─ Logs to ReminderDeliveryLog
  │
  ├─ On provider error:
  │   └─ Exponential backoff up to max_interval
  │   └─ Reminder stays 'pending', retried next cycle
  │
  └─ asyncio.wait_for(stop_event, timeout=interval) — stops cleanly on shutdown
```

**Configuration:**
- `REMINDER_DISPATCH_ENABLED` — boolean to disable dispatcher entirely
- `REMINDER_DISPATCH_INTERVAL_SECONDS` — base polling interval (min 300s)

---

## Background Tasks — Hold Expiry Loop

**File:** `backend/app/main.py#_run_hold_expiry_loop`

Prevents appointment slots from being permanently locked when a booking flow is abandoned.

```
_run_hold_expiry_loop(stop_event)
  │
  Every APPOINTMENT_HOLD_SWEEP_INTERVAL_SECONDS (default: 60s):
  │
  ├─ appointment_service.expire_pending_holds(db)
  │   └─ UPDATE appointments
  │      SET status = 'CANCELLED'
  │      WHERE status = 'PENDING'
  │        AND hold_expires_at IS NOT NULL
  │        AND hold_expires_at < now()
  │
  ├─ If expired_count > 0: db.commit() + log
  └─ Otherwise: db.rollback()
```

When a slot is freed by expiry, any Supabase Realtime subscriber watching that doctor's slots will receive the appointment UPDATE event and refresh their slot list.

---

## Push Notifications

**Service:** `backend/app/services/push_service.py` (pywebpush library, VAPID protocol)

### Subscription Flow

```
1. Frontend: use-push-notifications.ts
   ├─ navigator.serviceWorker.ready
   ├─ GET /notifications/vapid-key → public VAPID key
   └─ pushManager.subscribe({ applicationServerKey: vapidKey })
        └─ Returns PushSubscription { endpoint, keys: { p256dh, auth } }

2. POST /notifications/subscribe { subscription: { endpoint, keys } }
   └─ Backend stores subscription linked to user_id

3. On event (reminder, new appointment, etc.):
   └─ push_service.send_push_to_user(user_id, payload)
        └─ Loads subscriptions for user from DB
        └─ webpush(subscription, payload, vapid_credentials)
        └─ Browser receives push → service worker shows notification
```

**VAPID config:** `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_CLAIMS_EMAIL` in backend env.

---

## In-App Notifications

Created by `notification_service.create_notification()` which inserts into the `notifications` table.

Frontend polling: `use-push-notifications.ts` or direct fetch via `notification-actions.ts#getNotifications()`. The notification dropdown in the nav bar displays unread count from `GET /notifications/unread-count`.

No WebSocket subscription for in-app notifications — they are polled on focus/navigation. The push notification triggers a frontend refresh when received.

---

## Summary

| Mechanism | Trigger | Delivery | Latency |
|---|---|---|---|
| Supabase Realtime | DB change on `appointments` table | WebSocket → client | ~100ms |
| Hold expiry loop | Every 60s sweep | DB update → triggers Realtime | 0–60s |
| Reminder dispatcher | Due-window check every 300s+ | Push / email / in-app | 0–5 min |
| Push notification | `send_push_to_user()` call | VAPID → browser SW | seconds |
| In-app notification | DB insert via `create_notification()` | Polled on page load | seconds–minutes |
