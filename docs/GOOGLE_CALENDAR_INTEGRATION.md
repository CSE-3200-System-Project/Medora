# Google Calendar Integration Guide

## Overview

Medora's Google Calendar integration provides seamless synchronization of appointments and medication reminders with users' Google Calendars. The implementation includes:

- **Google Sign-In (OpenID Connect)** for secure account linking
- **Automatic appointment sync** when appointments are confirmed
- **Recurring medication reminders** as Google Calendar events
- **Bidirectional sync** for both patients and doctors
- **Account management** in settings with Google profile display

---

## Architecture

```
┌─────────────────┐         OAuth2 Flow          ┌──────────────────┐
│   Medora User   │ ────────────────────────────▶ │  Google Identity │
│   (Patient/     │                               │  & Calendar API  │
│   Doctor)       │ ◀─────────────────────────── │                  │
└────────┬────────┘   Tokens + User Info         └──────────────────┘
         │
         │ Calendar Sync Triggers
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Medora Backend                            │
│                                                               │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ Appointment      │    │ Reminder Dispatcher          │   │
│  │ Status Change    │    │ (Medication Reminders)       │   │
│  │                  │    │                               │   │
│  │ → CONFIRMED      │    │ → New Reminder Created       │   │
│  │   → Create Event │    │   → Create Recurring Event   │   │
│  │ → CANCELLED      │    │ → Reminder Updated           │   │
│  │   → Delete Event │    │   → Update Event             │   │
│  └──────────────────┘    └──────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Google Calendar Service                       │   │
│  │                                                       │   │
│  │  - OAuth2 token management with auto-refresh         │   │
│  │  - OpenID Connect user info extraction               │   │
│  │  - One-time event creation (appointments)            │   │
│  │  - Recurring event creation (medications)            │   │
│  │  - Event update and deletion                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Guide

### 1. Google Cloud Console Configuration

**Step 1: Create a Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "Medora Healthcare")
4. Click "Create"

**Step 2: Enable Required APIs**

1. Go to "APIs & Services" → "Library"
2. Search and enable:
   - **Google Calendar API** (required)
   - (Optional) Google People API (for enhanced profile data)

**Step 3: Configure OAuth Consent Screen**

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select **External** user type (or Internal for G Suite only)
3. Fill in required fields:
   - App name: Medora
   - User support email: your-email@domain.com
   - Developer contact email: your-email@domain.com
4. Add scopes:
   ```
   openid
   email
   profile
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/calendar.readonly (optional)
   ```
5. Add test users (if in testing mode):
   - Add your test Google accounts
6. Publish the app (when ready for production)

**Step 4: Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: Medora Backend
5. Authorized redirect URIs:
   - Development: `http://localhost:8000/oauth/google/callback`
   - Production: `https://your-backend-domain.com/oauth/google/callback`
6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

---

### 2. Backend Configuration

**Update `.env` file** (backend):

```bash
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/oauth/google/callback

# Frontend URL for OAuth redirects
FRONTEND_URL=http://localhost:3000
```

**For production**:

```bash
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_REDIRECT_URI=https://medora-backend.azurecontainerapps.io/oauth/google/callback
FRONTEND_URL=https://medora-app.azurewebsites.net
```

**Install Python dependencies**:

```bash
cd backend
pip install -r requirements.txt
```

Required packages (already in requirements.txt):
- `google-auth>=2.0.0`
- `google-auth-oauthlib>=1.0.0`
- `google-api-python-client>=2.0.0`
- `requests>=2.31.0`

**Run database migration**:

```bash
cd backend
alembic upgrade head
```

This applies the `oauth_001_add_google_account_info.py` migration which adds:
- `google_email` column
- `google_sub` column
- `google_profile` JSON column

---

### 3. Frontend Configuration

No additional environment variables needed for the frontend. The frontend communicates with the backend OAuth endpoints.

The Google Calendar connect component is already integrated in the Settings page at `/settings`.

---

## Features

### 1. Google Sign-In (OpenID Connect)

When users connect their Google Calendar, the system:

1. **Requests OpenID Connect scopes** (`openid`, `email`, `profile`)
2. **Extracts Google account info** after OAuth callback:
   - Google email address
   - Google account name
   - Google profile picture
   - Unique Google user ID (sub)
3. **Syncs to Medora profile** if fields are empty:
   - First name (from `given_name`)
   - Last name (from `family_name`)
   - Avatar URL (from `picture`)

**User Experience**:
- Users see their Google account info in Settings after connecting
- Profile pictures and names are displayed for confirmation
- No separate Google Sign-In button needed—Calendar connection doubles as account linking

---

### 2. Automatic Appointment Sync

**Trigger**: Appointment status changes to `CONFIRMED`

**What happens**:
1. Backend creates Google Calendar event for **doctor**
2. Backend creates Google Calendar event for **patient**
3. Event details include:
   - Summary: "Appointment with [Patient/Doctor Name]"
   - Description: Full appointment details with Medora ID
   - Start/End times based on appointment date and duration
   - Location (if provided)
   - Reminders: 30 minutes and 24 hours before

**On Cancellation**:
- Google Calendar event is **automatically deleted**
- Works for all cancellation statuses:
  - `CANCELLED`
  - `CANCELLED_BY_PATIENT`
  - `CANCELLED_BY_DOCTOR`
  - `NO_SHOW`

**Event Storage**:
- `google_event_id` stored on `appointments` table
- Used for future updates/deletions

---

### 3. Recurring Medication Reminders

**Trigger**: User manually syncs a medication reminder from the Reminders page

**What happens**:
1. Frontend calls `syncMedicationReminderToCalendar()` API
2. Backend creates **recurring Google Calendar event** with RRULE
3. Event recurrence based on:
   - `days_of_week`: Which days to repeat (e.g., Mon/Wed/Fri)
   - `reminder_times`: Multiple daily times (e.g., 08:00, 14:00, 20:00)
   - `start_date`: When medication starts
   - `end_date`: Optional end date for finite courses

**RRULE Generation**:

| Configuration | Generated RRULE |
|---------------|----------------|
| All 7 days | `FREQ=DAILY` |
| Mon/Wed/Fri | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| With end date | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20260531T235959Z` |

**Event Details**:
- Summary: "💊 [Medication Name]"
- Description: Full medication schedule and notes
- Duration: 5 minutes (quick reminder)
- Reminders: 15 minutes before and at time

**Note**: Google Calendar doesn't support multiple times per day in one recurring event. The implementation creates an event for the first reminder time with description showing all times.

---

### 4. Settings UI with Account Management

**Location**: `/settings` page → "Google Calendar" section

**Disconnected State**:
- Shows benefits list
- "Connect Google Calendar" button
- Opens Google OAuth in same window

**Connected State**:
- **Google Account Card**:
  - Profile picture (from Google)
  - Full name
  - Email address
  - "Connected" badge
- **Features Info**:
  - Appointment sync explanation
  - Medication reminder sync explanation
- **Disconnect Button**:
  - Deactivates OAuth tokens
  - Does NOT delete from Google (tokens just marked inactive)

---

## API Endpoints

### Backend OAuth Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/google/connect` | GET | Get Google OAuth authorization URL |
| `/oauth/google/callback` | GET | OAuth callback handler (redirect from Google) |
| `/oauth/google/status` | GET | Get connection status + Google account info |
| `/oauth/google/disconnect` | DELETE | Disconnect Google Calendar |
| `/oauth/google/sync/medication/{reminder_id}` | POST | Sync medication reminder to calendar |
| `/oauth/google/sync/appointment/{appointment_id}` | POST | Sync appointment to calendar |

### Frontend Server Actions

| Function | Location | Purpose |
|----------|----------|---------|
| `getGoogleCalendarStatus()` | `lib/google-calendar-actions.ts` | Get connection status and Google account info |
| `getGoogleConnectUrl()` | `lib/google-calendar-actions.ts` | Get OAuth authorization URL |
| `disconnectGoogleCalendar()` | `lib/google-calendar-actions.ts` | Disconnect calendar integration |
| `syncMedicationReminderToCalendar()` | `lib/google-calendar-actions.ts` | Sync medication reminder as recurring event |
| `syncAppointmentToCalendar()` | `lib/google-calendar-actions.ts` | Sync single appointment to calendar |

---

## Usage Examples

### 1. Connect Google Calendar from Settings

```typescript
// User clicks "Connect Google Calendar" button
const url = await getGoogleConnectUrl();
window.location.href = url; // Redirects to Google OAuth
// After authorization, redirects back to /settings?gcal=connected
```

### 2. Sync Medication Reminder

```typescript
// From medication reminder page
import { syncMedicationReminderToCalendar } from "@/lib/google-calendar-actions";

const result = await syncMedicationReminderToCalendar(reminderId, {
  item_name: "Metformin 500mg",
  reminder_times: ["08:00", "20:00"],
  days_of_week: [0, 1, 2, 3, 4, 5, 6], // Daily
  start_date: "2026-04-13T00:00:00",
  end_date: "2026-07-13T00:00:00", // 3-month course
  notes: "Take after meals",
});

console.log(result.event_id); // Google Calendar event ID
```

### 3. Manual Appointment Sync

```typescript
// From appointment detail page
import { syncAppointmentToCalendar } from "@/lib/google-calendar-actions";

const result = await syncAppointmentToCalendar(appointmentId, {
  summary: "Appointment with Dr. Sarah Ahmed",
  description: "Reason: Follow-up consultation\nType: General",
  start_datetime: "2026-04-15T10:00:00",
  duration_minutes: 30,
  location: "Ibn Sina Hospital, Dhaka",
});

console.log(result.event_id); // Google Calendar event ID
```

---

## Database Schema

### OAuthToken Model (`user_oauth_tokens`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String | FK to profiles |
| `provider` | String(50) | "google" |
| `access_token` | Text | Google access token |
| `refresh_token` | Text | Google refresh token |
| `token_expiry` | DateTime | Access token expiration |
| `scopes` | Text | Granted OAuth scopes |
| `is_active` | Boolean | Connection status |
| `google_email` | String(255) | Google account email |
| `google_sub` | String(255) | Unique Google user ID |
| `google_profile` | JSON | Full Google profile data |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

### Appointment Model Enhancement

| Column | Type | Description |
|--------|------|-------------|
| `google_event_id` | String | Google Calendar event ID (for deletion) |

---

## Token Management

### Auto-Refresh Logic

Google access tokens expire after **1 hour**. The system:

1. **Checks token expiry** before each API call
2. **Auto-refreshes** using refresh token if expired (with 5-min buffer)
3. **Updates database** with new access token and expiry
4. **Deactivates connection** if refresh fails (user must reconnect)

### Security

- Access tokens stored in database (not client-side)
- Refresh tokens enable offline token renewal
- Disconnect sets `is_active=False` (soft delete)
- Tokens never exposed to frontend JavaScript
- All communication via backend API with Bearer auth

---

## Troubleshooting

### Issue: "Google Calendar integration is not configured"

**Cause**: `GOOGLE_CLIENT_ID` not set in environment

**Solution**:
```bash
# Check if env var is set
echo $GOOGLE_CLIENT_ID

# Set it in .env file
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

### Issue: OAuth callback fails with "Missing authorization code"

**Cause**: User denied consent or Google redirected without `code` parameter

**Solution**:
- Check user denied consent on Google screen
- Verify redirect URI matches exactly in Google Cloud Console
- Check browser console for redirect errors

---

### Issue: Calendar events not created on appointment confirmation

**Cause**: Doctor hasn't connected Google Calendar

**Solution**:
- Doctor must connect Google Calendar in Settings first
- Check backend logs for calendar sync errors
- Verify `google_event_id` is being stored on appointments

---

### Issue: Token refresh fails

**Cause**: Refresh token expired or revoked

**Solution**:
- User must reconnect Google Calendar in Settings
- Google refresh tokens expire if:
  - User revokes access in Google Account settings
  - Token unused for 6 months
  - User changes Google password

---

### Issue: Recurring events not showing all reminder times

**Limitation**: Google Calendar RRULE doesn't support multiple times per day in one event

**Workaround**:
- Event description shows all reminder times
- Future enhancement: Create separate events for each time

---

## Future Enhancements

### Planned Features

1. **Two-way sync**: Updates in Google Calendar reflect in Medora
2. **Calendar selection**: Let users choose which calendar to sync to
3. **Custom reminders**: User-configurable reminder times (not just 30min/24hr)
4. **Batch sync**: Sync all upcoming appointments at once
5. **Event color coding**: Different colors for appointments vs reminders
6. **Meeting links**: Add Google Meet links to appointment events
7. **Timezone handling**: Better support for cross-timezone appointments

---

## Testing

### Local Testing

1. **Start backend**:
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test OAuth flow**:
   - Go to `/settings`
   - Click "Connect Google Calendar"
   - Complete Google OAuth
   - Verify redirect to `/settings?gcal=connected`
   - Check database for `user_oauth_tokens` record

4. **Test appointment sync**:
   - Book an appointment
   - Doctor confirms it
   - Check Google Calendar for new event
   - Cancel appointment
   - Verify event deleted from Google Calendar

5. **Test medication reminder sync**:
   - Create a medication reminder
   - Click "Add to Google Calendar"
   - Check Google Calendar for recurring event

---

## References

- [Google Identity Platform Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Calendar API Reference](https://developers.google.com/calendar/api/v3/reference)
- [OpenID Connect Core Spec](https://openid.net/specs/openid-connect-core-1_0.html)
- [RRULE Specification](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html)

---

*Last Updated: April 13, 2026*
