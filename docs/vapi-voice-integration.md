# Vapi Voice Integration for Chorui AI

This project includes a Vapi-ready voice integration that reuses the existing Chorui AI backend logic, now with full system-aware capabilities.

For a complete implementation and audit reference (doctor search, prescription summary, reminders, and validation), see `docs/vapi-ai-audit-guide.md`.

## Architecture

The Chorui voice assistant mirrors all text-chat capabilities via a hybrid server + client design:

1. **Server-side tools** (webhook at `POST /ai/vapi/tools/chorui`): The VAPI assistant calls tools, which hit the Medora backend. The backend processes the request using the same Chorui AI pipeline used by the text chat and returns a spoken-text result.

2. **Client-side interception**: The frontend listens for `tool-calls` messages on the VAPI SDK event stream. For tools that require client action (navigation, ending the call), the frontend executes the action locally via Next.js router while the assistant simultaneously speaks the server's confirmation text.

3. **Dynamic assistant overrides**: At call start, the frontend injects `assistantOverrides` with:
   - `variableValues` / `metadata`: role, patient_id, session_token, current route, locale.
   - `model.messages`: a system prompt listing all available Medora pages and tool descriptions for the user's role.
   - `tools:append`: all Medora tool definitions appended to whatever's configured in the VAPI dashboard.
   - `clientMessages`: includes `tool-calls` so the frontend can intercept tool invocations.

## Supported tools

| Tool name                   | Server | Client | Description |
| --------------------------- | :----: | :----: | ----------- |
| `ask_chorui`                | Yes    | No     | Natural Q&A — routes through the full Chorui AI pipeline (symptoms, navigation, clinical info, etc.) |
| `navigate_medora`           | Yes    | Yes    | Navigate to a Medora page. Server confirms; client performs `router.push()`. |
| `get_upcoming_appointments` | Yes    | No     | Returns upcoming appointments for the user's role. |
| `find_patient`              | Yes    | No     | Doctor-only: search patients by name, ID, or condition. |
| `summarize_prescription`    | Yes    | No     | Explain a prescription in plain language. |
| `get_voice_context`         | Yes    | No     | Returns current session context (role, route, next appointment). |
| `end_voice_call`            | Yes    | Yes    | End the voice session. Server confirms; client calls `vapi.stop()`. |

## What was added / changed

- `frontend/lib/vapi-tools.ts` — shared library with tool definitions, assistant overrides builder, navigation resolution, and tool-call extraction.
- `frontend/components/ai/chorui-vapi-voice-control.tsx` — rewritten to inject system-aware overrides at call start, intercept tool-calls for navigation/end-call, send route-change context updates to the assistant, and display last action feedback.
- `backend/app/routes/ai_consultation.py` — extended VAPI webhook to handle `navigate_medora`, `get_upcoming_appointments`, `find_patient`, `get_voice_context`, and `end_voice_call` tools.

## Environment setup

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
NEXT_PUBLIC_VAPI_ASSISTANT_ID=
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
VAPI_TOOL_SHARED_SECRET=
```

`VAPI_TOOL_SHARED_SECRET` is optional but recommended. If set, your Vapi tool must send the same value in `x-vapi-tool-secret`.

## Vapi dashboard setup

### Minimal setup (tools auto-appended)

The frontend now auto-appends all Medora tool definitions via `assistantOverrides["tools:append"]` at call start. You only need to:

1. Create an assistant in VAPI dashboard.
2. Set the assistant's **Server URL** to: `https://<your-backend-domain>/ai/vapi/tools/chorui`
3. If using shared secret, add request header: `x-vapi-tool-secret: <same-value-as-backend-env>`
4. Copy the assistant ID into `NEXT_PUBLIC_VAPI_ASSISTANT_ID`.
5. Copy your VAPI public key into `NEXT_PUBLIC_VAPI_PUBLIC_KEY`.

The system prompt, tools, first message, and client message config are all injected at call start — no need to configure them in the dashboard.

### Manual setup (if tools:append doesn't work)

If your VAPI plan doesn't support `tools:append` overrides, manually create these function tools in the dashboard, all pointing to the same Server URL:

1. **ask_chorui** — params: `message` (string, required)
2. **navigate_medora** — params: `destination` (string, required), `route` (string, optional)
3. **get_upcoming_appointments** — params: `limit` (number, optional)
4. **summarize_prescription** — params: `prescription_id` (string, required)
5. **find_patient** (doctor only) — params: `query` (string, required)
6. **get_voice_context** — no params
7. **end_voice_call** — no params (set async: true)

## How auth/context flows

When a user starts voice from the Medora Chorui chat page, the frontend sends:

- `session_token` from authenticated browser cookies (via `variableValues` and `metadata`)
- Role context (`patient` or `doctor`)
- Current patient ID when available
- Current route and page label
- UI locale (`en` or `bn`)

The backend verifies the token and runs the request through the same Chorui AI pipeline used by text chat.

## Client-side navigation flow

1. User says "take me to my appointments".
2. VAPI assistant calls `navigate_medora({ destination: "my appointments", route: "/patient/appointments" })`.
3. VAPI sends the tool call to the server webhook (returns spoken confirmation: "Opening Appointments now.").
4. Simultaneously, the frontend receives the `tool-calls` message event, extracts the tool call, validates the route against the role-aware navigation registry, and calls `router.push("/patient/appointments")`.
5. User hears confirmation AND sees the page change.
6. When the new page loads, the frontend sends a context-update message to the assistant so it knows where the user is now.

## Response contract

The webhook returns Vapi-compatible results format:

```json
{
  "results": [
    {
      "toolCallId": "<id>",
      "result": "<spoken-text-reply>"
    }
  ]
}
```

## Notes

- This is assistive AI only. Final diagnosis and treatment decisions remain with licensed clinicians.
- If no valid session token is provided, the webhook returns an authentication guidance response.
- For local development, the backend must be accessible from VAPI's cloud servers. Use a tunnel (e.g., ngrok) if running locally.
