# Vapi Voice Integration for Chorui AI

This project now includes a Vapi-ready voice integration that reuses the existing Chorui AI backend logic.

For a complete implementation and audit reference (doctor search, prescription summary, reminders, and validation), see `docs/vapi-ai-audit-guide.md`.

## What was added

- Frontend voice control in Chorui chat UI using `@vapi-ai/web`
- Backend Vapi tool webhook endpoint at `POST /ai/vapi/tools/chorui`
- Environment placeholders for Vapi keys/secrets in:
  - `frontend/.env.example`
  - `backend/.env.example`

## Environment setup

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
NEXT_PUBLIC_VAPI_ASSISTANT_ID=
```

### Backend (`backend/.env`)

```env
VAPI_TOOL_SHARED_SECRET=
```

`VAPI_TOOL_SHARED_SECRET` is optional but recommended. If set, your Vapi tool must send the same value in `x-vapi-tool-secret`.

## Vapi dashboard setup

1. Create or edit your assistant in Vapi.
2. Create a custom function tool with one of these names:
   - `ask_chorui` (recommended)
   - `chorui_assistant`
   - `chorui_chat`
3. Set Server URL to:
   - `https://<your-backend-domain>/ai/vapi/tools/chorui`
4. Add tool parameters (object):
   - `message` (string, required)
   - `session_token` (string, required)
   - `role_context` (string, optional: `patient` or `doctor`)
   - `patient_id` (string, optional; mainly for doctor-patient context)
   - `conversation_id` (string, optional)
5. If using shared secret, add request header:
   - `x-vapi-tool-secret: <same-value-as-backend-env>`
6. In your assistant instructions, force calls to the tool for user answers.

## How auth/context is passed

When a user starts voice from the Medora Chorui chat page, frontend sends:

- `session_token` from authenticated browser cookies
- role context (`patient` or `doctor`)
- current patient id when available

The backend verifies the token and runs the request through the same Chorui route logic used by text chat.

## Response contract

The webhook returns Vapi-compatible results format:

```json
{
  "results": [
    {
      "toolCallId": "<id>",
      "result": "<chorui-reply-text>"
    }
  ]
}
```

## Notes

- This is assistive AI only. Final diagnosis and treatment decisions remain with licensed clinicians.
- If no valid session token is provided, the webhook returns an authentication guidance response.
