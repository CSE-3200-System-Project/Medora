# AI Navigation Implementation Plan

## 1. System Understanding Summary

### Current Chorui AI Capabilities (Verified)
- Shared chat UI exists in `frontend/components/ai/ChoruiChat.tsx`.
- Shared chat state + API hook exists in `frontend/hooks/useChoruiChat.ts`.
- Role-based launchers/pages exist:
- Patient page: `frontend/app/(home)/patient/chorui-ai/page.tsx` (`/patient/chorui-ai`)
- Doctor page: `frontend/app/(home)/doctor/chorui-ai/page.tsx` (`/doctor/chorui-ai`)
- Backend endpoint exists and is active:
- `POST /ai/assistant-chat` in `backend/app/routes/ai_consultation.py`
- Existing backend intent classification exists:
- `_classify_chorui_intent(...)` in `backend/app/routes/ai_consultation.py`

### Current Routing Structure (From Audit)
- Route namespaces are role-oriented and suitable for access control:
- Patient routes: `/patient/*`
- Doctor routes: `/doctor/*`
- Shared routes used by patient/doctor: `/settings`, `/notifications`
- Dynamic routes requiring parameters exist:
- `/doctor/patient/[id]`
- `/doctor/patient/[id]/reports`
- `/doctor/patient/[id]/consultation`
- `/doctor/patient/[id]/consultation/ai`
- `/patient/doctor/[id]`

### Key Limitations Blocking AI Navigation
- `ChoruiAssistantResponse` currently returns text/context only (no navigation action payload).
- `useChoruiChat` and `ChoruiChat` do not execute route changes from assistant output.
- No centralized intent normalization layer for natural-language variants.
- No centralized role-aware intent-to-route registry.
- Audit cleanup blockers still exist:
- Broken patient dashboard links to `/analytics` (should be `/patient/analytics`)
- Redirect mismatch to `/admin/dashboard` while active admin page is `/admin`
- Duplicate/ambiguous route targets (`/patient/prescriptions` vs `/patient/my-prescriptions`, `/patient/doctor/[id]` vs `/doctor/[doctorId]`)

---

## 2. Architecture Design

### Target Logical Pipeline
| Layer | State | Purpose | Output |
|---|---|---|---|
| Intent Detection | Existing | Detect base intent from user utterance | Raw intent label(s) |
| Intent Normalization | New | Convert raw intent + phrase variants to canonical intent | `canonical_intent`, `confidence`, `ambiguity` |
| Conversational Memory | New | Track pending multi-turn navigation tasks | `pending_intent`, `missing_params`, `last_resolved_intent` |
| Route Mapping | New | Resolve canonical intent by role to approved route | `route`, `requires_params`, `fallback` |
| Suggestion Resolver | New | Return non-forced route suggestions for broad intents | `suggested_routes` |
| Action Packaging | New | Return executable action metadata in API response | `action` object |
| Recovery Interpreter | New | Handle undo/correction phrases after navigation | `undo`, `go_back`, `re-clarify` |
| UX Transition Layer | New | Add human-like transition feedback before route change | `transition_message`, `delay_ms` |
| Frontend Execution | New | Validate and execute navigation or clarification | `router.push(...)`, prompt, or fallback |

### End-to-End Flow
1. User sends free-form message in Chorui.
2. Backend runs existing classifier.
3. Backend runs new normalization layer.
4. Backend checks conversation memory bound to `conversation_id`.
5. Backend resolves canonical intent through role-filtered route registry.
6. Backend decides one of: `navigate`, `clarify`, `suggest`, `undo`, `none`.
7. Backend returns `reply`, `action`, and optional `suggested_routes` and `memory`.
8. Frontend validates route/suggestions against local allowlist.
9. Frontend executes:
10. Auto-navigation on high confidence.
11. Confirmation on medium confidence.
12. Clarification or suggestion chips on low confidence, ambiguity, or broad requests.
13. Transition UX message is shown, then delayed navigation executes.

### Backend Response Contract Upgrade
Proposed extension to `ChoruiAssistantResponse` in `backend/app/schemas/ai_orchestrator.py`:

| Field | Type | Description |
|---|---|---|
| `action.type` | `"navigate" \| "clarify" \| "none"` | Assistant action mode |
| `action.route` | `string \| null` | Destination route when navigable |
| `action.confidence` | `number` | Confidence score `0.0-1.0` |
| `action.requires_confirmation` | `boolean` | Ask user before navigation |
| `action.missing_params` | `string[]` | Required unresolved params (example: `id`) |
| `action.options` | `Array<{label, canonical_intent, route}>` | Clarification choices |
| `action.reason` | `string \| null` | Optional explanation for logging/UI |
| `action.delay_ms` | `number \| null` | Optional navigation delay (300-800ms) |
| `suggested_routes` | `Array<{label, route, canonical_intent}>` | Non-forced click targets |
| `memory.pending_intent` | `string \| null` | Multi-turn unresolved intent |
| `memory.missing_params` | `string[]` | Params still required to resolve route |
| `memory.last_resolved_intent` | `string \| null` | Most recent successfully resolved intent |
| `navigation_meta.previous_route` | `string \| null` | Route used for undo/go-back |
| `navigation_meta.last_navigation_route` | `string \| null` | Last successful destination |

### Security and Scope Model
- Patient users: patient + shared routes only.
- Doctor users: doctor + shared routes only.
- Admin routes: fully excluded from registry and action generation.
- Frontend must re-validate role, route pattern, and params before `router.push`.

---

## 3. Step-by-Step Implementation Plan

### Phase 1 - Cleanup and Preparation

**Goal:** Remove route inconsistencies before AI navigation rollout.

**Tasks**
1. Fix patient dashboard links from `/analytics` to `/patient/analytics` in `frontend/components/dashboard/patient-home-dashboard.tsx`.
2. Fix login redirect mismatch from `/admin/dashboard` to `/admin` in `frontend/lib/auth-actions.ts`.
3. Canonicalize duplicate routes:
4. Prescriptions: keep `/patient/prescriptions` as canonical; deprecate or redirect `/patient/my-prescriptions`.
5. Doctor booking profile: keep `/patient/doctor/[id]` as canonical patient flow; mark `/doctor/[doctorId]` as uncertain/legacy unless explicitly needed.
6. Confirm orphan routes policy:
7. `/doctor/find-medicine` (uncertain/orphan in audit)
8. `/clear-admin` and `/admin/schedule-review` remain non-navigable for Chorui scope

**Deliverables**
1. Route cleanup checklist signed off.
2. Canonical route decisions documented.

**Exit Criteria**
1. No broken or inconsistent high-traffic patient/doctor navigation links.

---

### Phase 2 - Backend Enhancements

**Goal:** Return actionable navigation metadata from Chorui backend.

**Tasks**
1. Extend `ChoruiAssistantResponse` with optional `action` object in `backend/app/schemas/ai_orchestrator.py`.
2. Add action builder in assistant flow within `backend/app/routes/ai_consultation.py`.
3. Enforce admin exclusion (`/admin` and `/admin/*`) at registry lookup and response assembly.
4. Keep backward compatibility:
5. If no valid navigation, return `action.type = "none"` and normal `reply`.
6. Log action decisions for observability.
7. Add response support for soft suggestions:
8. `suggested_routes` for non-forced navigation cases.
9. Add conversation memory payload support:
10. `memory.pending_intent`, `memory.missing_params`, `memory.last_resolved_intent`.
11. Add correction-aware action support:
12. `action.type = "undo"` with safe fallback behavior.

**Deliverables**
1. Versioned API response contract with action metadata.
2. Backend action generation with role-safe filtering.

**Exit Criteria**
1. `POST /ai/assistant-chat` returns stable `action` payload for navigable prompts.

---

### Phase 3 - Intent Normalization Layer (New)

**Goal:** Map natural language variants to canonical navigation intents.

**Tasks**
1. Create canonical intent taxonomy (patient/doctor/shared only; admin excluded).
2. Build phrase clusters and synonyms:
3. Example: `"need doctor"`, `"book doctor"`, `"find specialist"` -> `find_doctor`.
4. Add correction lexicon:
5. `"go back"`, `"undo"`, `"not this"`, `"cancel"` -> `navigation_correction`.
4. Merge signals:
5. Existing classifier output
6. Phrase similarity match
7. Role context (`patient` vs `doctor`)
8. Conversation context mode
9. Pending-memory context (`pending_intent`, `missing_params`)
9. Produce deterministic output:
10. `canonical_intent`
11. `confidence`
12. `ambiguity_candidates`
13. `missing_params`
14. `intent_mode` (`direct`, `follow_up`, `correction`, `suggestion`)

**Deliverables**
1. Versioned intent dictionary artifact.
2. Normalization service/module integrated into Chorui backend path.

**Exit Criteria**
1. Priority navigation phrases map consistently across role contexts.

---

### Phase 4 - Route Registry Creation (New)

**Goal:** Centralize intent-to-route mapping with role constraints.

**Tasks**
1. Create registry schema:
2. `canonical_intent`
3. `role`
4. `route`
5. `requires_params`
6. `fallback_route`
7. `enabled`
8. `notes`
9. Populate with audited patient/doctor/shared routes only.
10. Exclude all admin routes by definition.
11. Add dynamic route resolvers for templates like `/doctor/patient/[id]`.
12. Add fallback behavior for unresolved params (example fallback `/doctor/patients`).

**Deliverables**
1. Central route registry module.
2. Mapping governance notes (ownership + update process).

**Exit Criteria**
1. Every canonical intent has exactly one primary route or explicit clarify flow.

---

### Phase 5 - Frontend Navigation Execution (New)

**Goal:** Execute route actions safely in `ChoruiChat`.

**Tasks**
1. Extend frontend AI response types in `frontend/types/ai.ts`.
2. Parse and surface action metadata in `frontend/hooks/useChoruiChat.ts`.
3. Add execution handling in `frontend/components/ai/ChoruiChat.tsx`.
4. Add guard checks before navigation:
5. Role allowlist validation
6. Route pattern validation
7. Dynamic parameter completeness
8. Add confidence policy:
9. `>= 0.85`: auto navigate with brief transition message
10. `0.60-0.84`: confirmation prompt
11. `< 0.60`: clarification options only
12. Add invalid-route fallback UI with safe suggestions.
13. Add suggestion-chip UI for `suggested_routes` (click to navigate, no auto-redirect).
14. Add undo/recovery UI handling:
15. recognize correction actions and route to previous page when safe.
16. Add transition UX:
17. assistant pre-navigation message
18. optional loading state
19. configurable delay `300-800ms` before `router.push`.

**Deliverables**
1. End-to-end action execution for patient and doctor Chorui pages.
2. User-safe fallback behavior for invalid/blocked actions.

**Exit Criteria**
1. Navigation actions work without unsafe role or route transitions.

---

### Phase 6 - Testing and Edge Cases

**Goal:** Validate reliability, safety, and UX quality before rollout.

**Test Scope**
1. Backend unit tests:
2. Normalization accuracy
3. Role filtering
4. Admin exclusion
5. Dynamic param handling
6. Multi-turn memory merge (`pending_intent` + follow-up message)
7. Suggestion-mode payload generation
8. Correction intent detection (`undo`, `go back`, `not this`)
6. Frontend unit tests:
7. Action parsing
8. Confidence policy behavior
9. Guardrail failures and fallbacks
10. Suggestion-chip click navigation
11. Undo flow and previous-route recovery
12. Transition delay and loading indicator behavior
10. Integration tests:
11. `assistant-chat` returns expected `action` for canonical prompts
12. `assistant-chat` preserves and updates conversation memory by `conversation_id`
12. E2E tests:
13. Patient: `"I need a doctor"` -> `/patient/find-doctor`
14. Patient: `"Show my appointments"` -> `/patient/appointments`
15. Patient: `"Open medical history"` -> `/patient/medical-history`
16. Doctor: `"Show my patients"` -> `/doctor/patients`
17. Doctor: `"Open my schedule"` -> `/doctor/schedule`
18. Forbidden: `"Open admin dashboard"` -> blocked + safe alternatives
19. Multi-step: `"Open patient reports"` then `"For Rahim"` -> resolve `/doctor/patient/[id]/reports` (after ID resolution)
20. Soft suggestion: `"I forgot my medicine"` -> suggestion chips for `/patient/reminders` and `/patient/prescriptions`
21. Recovery: `"go back"` immediately after navigation -> return to previous route or clarify

**Exit Criteria**
1. Critical-path intents pass target accuracy and safety checks.

---

## 4. Intent Dictionary Design

### Canonical Intents (Admin Excluded)

| Canonical Intent | Role | Example Phrases | Target Route | Params | Notes |
|---|---|---|---|---|---|
| `go_home` | patient | "go home", "dashboard" | `/patient/home` | none | Useful fallback |
| `find_doctor` | patient | "I need a doctor", "book doctor", "find specialist" | `/patient/find-doctor` | none | Primary patient discovery intent |
| `appointments` | patient | "my appointments", "upcoming visits" | `/patient/appointments` | none | High frequency |
| `medical_history` | patient | "open medical history", "health timeline" | `/patient/medical-history` | none | Clarify against reports |
| `medical_reports` | patient | "show reports", "lab reports" | `/patient/medical-reports` | none | Clarify against history if vague |
| `prescriptions` | patient | "my prescriptions", "medication orders" | `/patient/prescriptions` | none | Canonical over `/patient/my-prescriptions` |
| `reminders` | patient | "missed dose", "medicine reminders", "I forgot medicine" | `/patient/reminders` | none | May overlap with find medicine |
| `find_medicine` | patient | "find medicine", "search drug" | `/patient/find-medicine` | none | Clarify when broad medicine query |
| `patient_analytics` | patient | "my analytics", "health trends" | `/patient/analytics` | none | Ensure fixed links in Phase 1 |
| `patient_profile` | patient | "my profile", "account details" | `/patient/profile` | none | Direct profile intent |
| `patient_privacy` | patient | "privacy settings", "data sharing settings" | `/patient/privacy` | none | Includes Chorui permissions context |
| `go_home` | doctor | "go home", "dashboard" | `/doctor/home` | none | Useful fallback |
| `doctor_appointments` | doctor | "my appointments", "today schedule" | `/doctor/appointments` | none | Clarify against doctor_schedule |
| `doctor_patients` | doctor | "my patients", "patient list" | `/doctor/patients` | none | Primary doctor list intent |
| `doctor_analytics` | doctor | "analytics", "practice insights" | `/doctor/analytics` | none | Clear mapping |
| `doctor_schedule` | doctor | "open schedule", "availability" | `/doctor/schedule` | none | Clarify against appointments |
| `doctor_profile` | doctor | "open profile" | `/doctor/profile` | none | Direct profile intent |
| `doctor_find_medicine` | doctor | "medicine lookup", "drug reference" | `/doctor/find-medicine` | none | **Uncertain** until orphan-route decision |
| `doctor_patient_detail` | doctor | "open patient PT-123", "patient profile [id]" | `/doctor/patient/[id]` | `id` | Ask for ID if missing |
| `doctor_patient_reports` | doctor | "patient [id] reports" | `/doctor/patient/[id]/reports` | `id` | Ask for ID if missing |
| `doctor_patient_consultation` | doctor | "consult patient [id]" | `/doctor/patient/[id]/consultation` | `id` | Ask for ID if missing |
| `doctor_patient_consultation_ai` | doctor | "AI pre-consultation for [id]" | `/doctor/patient/[id]/consultation/ai` | `id` | Ask for ID if missing |
| `notifications` | patient, doctor | "show notifications", "my alerts" | `/notifications` | none | Shared route |
| `settings` | patient, doctor | "open settings", "app settings" | `/settings` | none | Shared route |

### Clarification Buckets (Ambiguity)
1. Medicine queries:
2. `/patient/reminders`
3. `/patient/prescriptions`
4. `/patient/find-medicine`
5. Doctor schedule queries:
6. `/doctor/appointments`
7. `/doctor/schedule`
8. Reports queries:
9. `/patient/medical-history`
10. `/patient/medical-reports`

---

## 5. Role-Based Access Rules

### Access Matrix
| Role | Allowed Route Groups | Explicitly Forbidden |
|---|---|---|
| Patient | `/patient/*`, `/settings`, `/notifications` | `/doctor/*`, `/admin/*` |
| Doctor | `/doctor/*`, `/settings`, `/notifications` | `/patient/*` (except public/explicitly shared routes), `/admin/*` |
| Admin | Not in Chorui AI navigation scope | All Chorui navigation actions disabled |

### Enforcement Rules
1. Backend registry lookup must be role-scoped first.
2. Backend must never emit admin routes.
3. Frontend must re-check route against role allowlist before executing.
4. Unknown or unmapped routes must be converted to `action.type = "none"` or `clarify`.

---

## 6. Edge Case Handling

### Ambiguous Intent
1. Condition: multiple intents near score threshold.
2. Behavior: return `action.type = "clarify"` with 2-3 options.
3. UI: user selects option; no auto-navigation.

### Missing Parameters for Dynamic Routes
1. Condition: route template requires param (example `id`) and value absent.
2. Behavior: ask targeted follow-up question for required param.
3. Fallback:
4. Doctor patient flows fallback to `/doctor/patients`.
5. Do not construct partial dynamic URLs.

### Invalid Role Requests
1. Patient asks for doctor page -> deny and suggest patient-safe alternatives.
2. Doctor asks for patient-only page -> deny and suggest doctor-safe alternatives.
3. Admin requests -> explicitly refused in Chorui navigation scope.

### Invalid or Unsafe Route in Response
1. Frontend rejects route if not allowlisted or malformed.
2. Show recovery prompt with valid suggestions.
3. Log event for mapping review.

### Confidence-Driven Execution Policy
1. `confidence >= 0.85` -> auto navigate.
2. `0.60 <= confidence < 0.85` -> confirm with user.
3. `confidence < 0.60` -> clarification options only.

---

## 7. Risks and Recommendations

### Key Risks
1. Intent drift from real-world phrasing not covered in dictionary.
2. Route drift when frontend pages change but registry is stale.
3. Over-clarification causing friction.
4. Duplicate/legacy routes creating persistent ambiguity.
5. Safety gap if backend and frontend validations diverge.

### Recommendations
1. Treat route registry + intent dictionary as versioned configuration assets.
2. Add CI checks:
3. Every mapped route exists in `frontend/app/**/page.tsx`.
4. No mapped route matches `/admin` or `/admin/*`.
5. Keep cleanup tasks as release blockers:
6. `/analytics` broken links fix.
7. `/admin/dashboard` redirect fix.
8. Canonical decisions for duplicate routes.
9. Roll out behind feature flag:
10. Internal testing
11. Doctor pilot
12. Full rollout
13. Add telemetry dashboards:
14. navigation success rate
15. clarification rate
16. user correction rate ("not what I meant")
17. blocked/forbidden navigation attempts

### Scalability Considerations
1. Dictionary and registry can expand by locale without changing execution layer.
2. Same contract supports future deep links and query-param navigation.
3. Confidence thresholds can be tuned using production telemetry.

---

## 8. Conversational Memory System

### Purpose
Enable multi-step intent completion when user requests are split across messages.

### Integration Point
1. Backend assistant flow in `backend/app/routes/ai_consultation.py`.
2. Bind memory to existing `conversation_id` used by Chorui message history.
3. Persist in conversation-scoped state (DB-backed preferred for reliability across refresh/device).

### Conversation State Schema (Example)
```json
{
  "conversation_id": "conv_abc123",
  "pending_intent": "doctor_patient_reports",
  "missing_params": ["id"],
  "collected_params": {},
  "last_resolved_intent": "doctor_patients",
  "updated_at": "2026-04-09T19:22:00Z"
}
```

### Resolution Flow
1. Detect missing params from normalized intent.
2. Store `pending_intent` and `missing_params`.
3. Return follow-up question (example: "Which patient should I open reports for?").
4. On next user message, parse values and merge into `collected_params`.
5. If params complete, resolve route and clear `pending_intent`.
6. If still incomplete, continue guided follow-up.

### Guardrails
1. Apply role checks before memory resolve and before final route build.
2. Expire stale pending state after configurable inactivity window.
3. Do not carry pending state across different role contexts.

---

## 9. Soft Navigation Suggestion System

### Purpose
Support user-friendly, non-forced navigation for broad or ambiguous intents.

### Response Pattern
```json
{
  "reply": "You can manage your medicine from here:",
  "action": {
    "type": "suggest",
    "confidence": 0.72
  },
  "suggested_routes": [
    {
      "label": "Reminders",
      "route": "/patient/reminders",
      "canonical_intent": "reminders"
    },
    {
      "label": "Prescriptions",
      "route": "/patient/prescriptions",
      "canonical_intent": "prescriptions"
    }
  ]
}
```

### Selection Policy
1. Use suggestion mode when confidence is medium/low or intent is broad.
2. Never auto-redirect in `suggest` mode.
3. Suggestion list limited to role-safe routes only.

### Frontend UX
1. Render `suggested_routes` as chips/buttons in `ChoruiChat.tsx`.
2. Click action performs validated `router.push(route)`.
3. Log selected suggestion for model/dictionary tuning.

---

## 10. Undo and Recovery System

### Purpose
Recover gracefully when navigation target was incorrect.

### Trigger Phrases
1. `"go back"`
2. `"undo"`
3. `"not this"`
4. `"cancel"`

### State Tracking
1. Track `previous_route` and `last_navigation_route` on frontend session state.
2. Optionally mirror summary metadata in backend `navigation_meta` for analytics and server-side reasoning.

### Recovery Behavior
1. If `previous_route` is available and safe, execute go-back navigation.
2. If unavailable, return clarification prompt with safe alternatives.
3. After undo, optionally suggest top alternatives related to last intent.

### Safety Rules
1. Undo cannot navigate to forbidden/admin routes.
2. Undo should require confirmation if leaving unsaved critical forms (uncertain: depends on page-level guards).
3. Correction intent should interrupt pending auto-navigation queue.

---

## 11. Navigation UX Layer

### Purpose
Make navigation behavior understandable and human-like.

### UX Sequence
1. User asks for destination.
2. Assistant responds with transition cue (example: "Taking you to your appointments...").
3. UI shows optional loading indicator in chat bubble/action row.
4. Delay execution by `300-800ms`.
5. Run `router.push()` if still valid and not cancelled by user correction.

### UX Policy
1. High confidence: short delay (around `300-500ms`).
2. Medium confidence with confirmation: no navigation until explicit user confirmation.
3. Suggestion mode: no delay-based auto-navigation.

### Frontend Integration
1. Implement transition controller in `frontend/components/ai/ChoruiChat.tsx`.
2. Keep execution and timing state in `frontend/hooks/useChoruiChat.ts` or a dedicated navigation hook.
3. Ensure cancellation support if user sends correction during delay window.

---

## 12. Navigation Engine Abstraction

### Purpose
Centralize intent resolution, role safety, ambiguity handling, and action strategy in one reusable module.

### Proposed Interface
```ts
NavigationEngine.resolve({
  message,
  role,
  conversationId,
  context
})
```

### Proposed Return Shape
```ts
{
  action: "navigate" | "clarify" | "suggest" | "undo" | "none",
  route: string | null,
  suggestions: Array<{ label: string; route: string; canonical_intent: string }>,
  confidence: number,
  missingParams: string[],
  memory: {
    pending_intent: string | null,
    missing_params: string[],
    last_resolved_intent: string | null
  },
  fallback: {
    route: string | null,
    reason: string
  }
}
```

### Internal Responsibilities
1. Consume existing intent classifier output.
2. Apply intent normalization dictionary.
3. Read/write conversational memory.
4. Resolve canonical route via role-aware registry.
5. Enforce admin exclusion and route safety.
6. Choose action mode (`navigate`, `clarify`, `suggest`, `undo`, `none`).
7. Return frontend-ready response payload.

### Placement Recommendation
1. Backend-first implementation as service module to keep policy centralized.
2. Optional mirrored lightweight validator on frontend for defense-in-depth checks.

### Compatibility with Existing Plan
1. Uses the existing normalization and route registry phases.
2. Extends current response contract without breaking legacy text-only clients.
3. Preserves patient/doctor scope and strict admin exclusion.
