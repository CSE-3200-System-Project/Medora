# Vapi Voice Integration for Chorui AI

This project includes a Vapi-ready voice integration that reuses the existing Chorui AI backend logic, now with full system-aware capabilities.

For a complete implementation and audit reference (doctor search, prescription summary, reminders, and validation), see `docs/vapi-ai-audit-guide.md`.

## Architecture

The Chorui voice assistant mirrors all text-chat capabilities via a hybrid server + client design:

1. **Server-side tools** (webhook at `POST /ai/vapi/tools/chorui`): The VAPI assistant calls tools, which hit the Medora backend. The backend processes the request using the same Chorui AI pipeline used by the text chat and returns a spoken-text result.

2. **Client-side interception**: The frontend listens for `tool-calls` messages on the VAPI SDK event stream. For tools that require client action (navigation, ending the call), the frontend executes the action locally via Next.js router while the assistant simultaneously speaks the server's confirmation text.

3. **Dynamic assistant overrides**: At call start, the frontend injects `assistantOverrides` with:
   - `variableValues` / `metadata`: role, patient_id, session_token, current route, locale.
   - `model.messages`: a strict system prompt forcing the Vapi model to route every health/medical/Medora question through `ask_chorui` instead of answering itself.
   - `firstMessage`: short greeting.
   - `clientMessages`: includes `tool-calls` so the frontend can intercept tool invocations.

   **Tools are NOT sent as overrides.** They must be configured on the Vapi dashboard assistant (keyed by `NEXT_PUBLIC_VAPI_ASSISTANT_ID`). Earlier versions sent `tools:append`, which Vapi's web SDK rejects as an unknown key — that was the `POST https://api.vapi.ai/call/web 400` you may see in logs. The fallback path swallowed it and started without tools.

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

Tools must be configured on the dashboard assistant. The frontend only injects per-session context at start time.

1. Create an assistant in the Vapi dashboard.
2. **Model** — to keep cost down, use the cheapest tool-capable model available on your plan (e.g. `gpt-4o-mini` on OpenAI, or Vapi's fast/low-cost model). The Vapi model is a thin router here — the real AI work happens in our orchestrator via `ask_chorui`, so reasoning quality on the Vapi side is not important. Avoid GPT-4 class models on this assistant.
3. **Transcriber** — any supported model; Deepgram Nova is a good cost/latency balance.
4. **Voice** — any supported voice. TTS is billed per second, so the short replies produced by the backend's voice-shaping (≤ 3 sentences) keep cost in check.
5. Set the assistant's **Server URL** to: `https://<your-backend-domain>/ai/vapi/tools/chorui`.
6. If using a shared secret, add request header: `x-vapi-tool-secret: <same-value-as-backend-env>`.
7. Under **Tools** / **Functions**, create these function tools pointing at the same Server URL:
   1. **ask_chorui** — params: `message` (string, required). This is the main tool — it routes the user's verbatim question into Medora's own AI orchestrator.
   2. **navigate_medora** — params: `destination` (string, required), `route` (string, optional).
   3. **get_upcoming_appointments** — params: `limit` (number, optional).
   4. **summarize_prescription** — params: `prescription_id` (string, required).
   5. **find_patient** (doctor-only assistant) — params: `query` (string, required).
   6. **get_voice_context** — no params.
   7. **end_voice_call** — no params (set `async: true`).
8. Copy the assistant ID into `NEXT_PUBLIC_VAPI_ASSISTANT_ID`.
9. Copy your Vapi public key into `NEXT_PUBLIC_VAPI_PUBLIC_KEY`.

The system prompt and first message can be left minimal in the dashboard — the frontend overrides them at start time with role-aware, router-strict instructions. Source-of-truth tool definitions live in `frontend/lib/vapi-tools.ts` (`getMedoraToolDefinitions`) so you can diff the dashboard against code.

### Cost & reliability notes

- **Pick a cheap Vapi model.** The Vapi LLM only routes to `ask_chorui`. Any token spend on the Vapi side beyond that is waste.
- **Keep voice replies short.** The backend webhook already trims orchestrator replies to ≤ 3 sentences / 500 chars before handing them to Vapi's TTS (`_shape_reply_for_voice` in `ai_consultation.py`). The full reply still shows in the on-screen Chorui panel.
- **Timeouts.** The `ask_chorui` webhook branch wraps the orchestrator in a 12s `asyncio.wait_for`. If the orchestrator stalls, Vapi gets a spoken apology instead of a silent hang. Same pattern on `/ai/vapi/tools/doctor-search`.
- **Two brains, one system.** Keep the Vapi model prompt strict ("you are a router, not an answerer") — the `buildSystemPrompt` in `frontend/lib/vapi-tools.ts` does this. If the Vapi model ever starts answering directly, tighten the prompt further or move to an even smaller router model.

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
