# Medora Defense Guide — 02. Workflows & Processes

> Walk-through for every process a reviewer can ask about: appointments, OCR, AI/Chorui, voice, consent, onboarding, reminders, notifications. Tied to Figs. 3.5–3.22 of the report and Slides 7–9.

---

## A. Appointment system (booking + reschedule + cancel)

### A.1 Why this is hard (it isn't just a CRUD form)

The booking flow is **the** showcase of "engineering correctness under concurrency" (Table 6.2 P1). Without care, two patients clicking the same slot a second apart both succeed. The platform deliberately avoids that with a **soft-hold + transactional commit + Realtime broadcast** triple-pattern.

If asked *"why couldn't you just do a SQL UNIQUE constraint?"*:
> Because a UNIQUE constraint catches the conflict only at INSERT, after both clients have committed UI state. We instead place a **soft hold row** *before* the patient confirms, broadcast a Realtime slot update, and only then run the transactional commit. This means the second patient *never sees* the slot as free, instead of seeing it free and getting a 409.

### A.2 Booking data flow (Fig. 3.7, DFD level 2)

`Search doctors → Fetch live slots → Create soft hold → Commit booking → Notify patient/doctor`. Five nodes, four data stores: doctor+specialty data, availability+realtime, appointments+audit, notifications.

### A.3 Booking sequence (Fig. 3.8, full text-traced)

```
Patient → Frontend     : request slot
Frontend → Backend     : book appointment
Backend → DB           : validate + soft hold
Backend → Admin queue  : send for approval (where required)
Admin → Backend        : approve/reject
Backend → DB           : commit booking, persist confirmed
Backend → Frontend     : emit slot update (Realtime broadcast to all subscribers)
Backend → Notifications: send alerts (email + push + in-app)
Frontend → Patient     : confirm booking
[Reschedule]
Patient → Frontend     : request reschedule
Frontend → Backend     : forward request
Backend → DB           : update slot + validate
Backend → DB           : save new schedule
Backend → Notifications: notify changes
[Cancel]
Patient → Frontend     : cancel request
Frontend → Backend     : send cancel
Backend → DB           : mark cancelled
Backend → Notifications: notify parties
```

### A.4 Schema-level entities (Figs. 3.15, 3.17)

- `profiles` — id, role, locale, verification.
- `doctor_profiles` 1:1 → `profiles`, with `speciality_id`, `experience`, plus N:1 → `specialities`.
- `patient_profiles` — DOB, emergency contact, history status.
- `doctor_availability` — weekday windows + start/end.
- `doctor_exception` — blocked dates with reason (overrides).
- `appointments` — patient_id, doctor_id, slot, hold/status.
- `appointment_reschedule_requests` — change requests joined to appointments.

### A.5 Slot consistency invariants

1. **Single source of truth**: the `appointments` table; UI never owns slot state.
2. **Soft hold** = a transient row with TTL; if the patient does not confirm, the **background hold-expiry worker** removes it (`Service Layer → Background Workers`, Fig. 3.3).
3. **Realtime broadcast** = Supabase Realtime channel keyed on `(doctor_id, date)`; every subscribed client receives slot updates within ~500 ms (Table 4.2).
4. **Doctor exceptions** are merged at query time so a once-blocked date is never bookable.
5. **Reschedule** writes into `appointment_reschedule_requests`, validates against current availability, then re-enters the same notify path.

---

## B. OCR / prescription pipeline (Fig. 3.5, §3.2.2, §4.5.1)

### B.1 The crucial framing

> "The OCR subsystem should be interpreted as a trained detection pipeline followed by targeted OCR, **not as a single end-to-end handwritten recognition model**." — §4.5.3.

If a reviewer says *"why didn't you fine-tune Donut/TrOCR end-to-end?"* — answer with the framing above and the three reasons in §3.2.2 / §4.5.1:

1. End-to-end models on **noisy full-page Bangla-English mixed Rx** drop in accuracy because the model attends to stamps, signatures, and chamber details.
2. A **detector-first** approach restricts OCR to the *medication block*, dramatically cutting noise.
3. Engineering: Azure DI gives a strong, audited recognizer for free; fine-tuning a multilingual handwriting model in 4 months is not justified given evaluation budgets.

### B.2 Pipeline stages

```
Input (multipart / base64 / URL)
   │
   ▼
Normalize (orientation + size + format)
   │
   ▼
YOLO ONNX region detection — multi-scale retry on low confidence
   │
   ▼  (cropped medication region)
OCR Engine: Azure Document Intelligence (primary)  /  PaddleOCR (fallback)
   │
   ▼  (raw text + per-token confidence)
Parser: dosage / frequency / quantity grammar (deterministic)
   │
   ▼  (structured tuple z = (region, x_m, x_f, x_q))
RapidFuzz matcher against ~20,000-entry medicine catalog (brand + generic)
   │
   ▼  (m*, accepted iff score ≥ τ_m = 0.7)
Structured prescription record + advisory confidence C_ocr(z)
```

### B.3 What each stage actually buys you

| Stage | Purpose | Failure handling |
| --- | --- | --- |
| Normalize | Make Azure DI happy regardless of source | Reject corrupt files early |
| YOLO ONNX | Trained on **2,000+ annotated prescriptions**; outputs region candidates `R = {r_i}` with confidence `c_i` | If max `c_i < τ_y`, retry at alternate scales; if still low, mark for manual review |
| Azure DI / PaddleOCR | Recognise text only inside the cropped med block | If Azure unavailable / rate-limited, PaddleOCR fallback (worse accuracy but available) |
| Parser | Map noisy `1-0-1` / `1+0+1` / `১+০+১` strings to canonical dosage pattern; convert "2 weeks" / "ek mash" to days | Edit-distance to nearest valid pattern; default unit = days |
| RapidFuzz match | Resolve to brand+generic in catalog; accept ≥ τ_m = 0.7 | Below threshold → flagged for human review, not stored as authoritative |
| Confidence aggregation | Composite `C_ocr = α·c̄_y(r) + β·c̄_o(z) + γ·s_med` to drive review UI | Low composite → flagged for clinician review |

### B.4 Why YOLO + Azure DI is **not** redundant

A common reviewer ambush. Rehearsed answer:
> Azure DI is a **recognizer**, not a layout-aware document classifier for handwritten Bengali prescription forms. YOLO is a **detector** that we trained on our own corpus to localise the medication block specifically. The two solve different problems: localisation vs. recognition. Removing YOLO and feeding the full page to Azure DI degrades accuracy because Azure ingests stamps, signatures, chamber addresses and ad-hoc notes as if they were medication tokens.

### B.5 OCR observed accuracy (Table 4.3, Fig. 4.15)

- Medicine-name OCR accuracy: **~92%** vs target **≥85%**.
- Dosage OCR accuracy: **~89%** vs target **≥80%**.
- Prescription processing time: **~3.5 s** vs target **<5 s**.
- Critical end-to-end suites: **Passing**.
- Security validation: **Passing**.
- Load-test stability: **<0.5%** failure rate.

### B.6 Failure modes acknowledged in §7.2

Low-legibility handwriting drops accuracy materially. Therefore OCR output is **advisory**, not authoritative — the doctor confirms before saving to the patient record. The platform is explicit about this in the safety section (§5.3, second safety requirement).

---

## C. AI orchestration & Chorui assistant (§3.2, §4.5.1, §5.2)

### C.1 The boundary (Fig. 3.4)

```
Backend service request
        │
        ▼
[Consent + PII Guard]   ── tokenisation + policy checks
        │
        ▼
[AI Orchestrator]       ── adapter registry (Groq / Gemini / Cerebras), Pydantic schema validation
        │
        ▼
[Provider call] ─► raw response ─► [Schema validate] ─► persisted into ai_interactions
                                                          and chorui_chat_messages
```

### C.2 The eight-step Chorui safe conversation flow (Fig. 3.10)

1. User sends natural-language query.
2. Chorui UI attaches role, history, session context.
3. Intent engine forms structured prompt (intent + constraints).
4. LLM orchestrator returns intent + confidence + structured output.
5. Validate intent and enforce safety rules.
6. Validated action is one of `navigate`, `answer`, or `ask` (clarify).
7. Navigation router routes to a safe destination or fallback.
8. Render response / UI update.

### C.3 Hard safety rules (§5.2, §5.3)

- Chorui **must not** practice medicine — no diagnosis, no prescription mutation, no overriding clinician opinion.
- All **clinical writes** require explicit confirmation; reminder flows surface clinician-issued schedules without modifying treatment.
- OCR output is **advisory**; low-confidence fields are explicitly flagged for human review before persistence.
- Users are **never required** to use AI to complete a fundamental task. Every primary flow has a non-AI path.

### C.4 PII guardrails (§4.5.1, formal eqs.)

The orchestrator never sends raw PII outward. Sequence (with the exact formulas — see `03_MATH_AND_FORMULAS.md` for full notation):

1. **Consent pruning** removes unconsented categories: `F(x, Π_u) = { (k_i, v_i) ∈ x : cat(k_i) ∈ Π_u }`.
2. **Sanitisation operator** redacts PII fields and applies regex scrubbing on the rest.
3. **Pseudonymous tokenisation**: every PII identifier is replaced with `T_v(z) = [anon : v : trunc_ℓ(H_K_v(z))]` — a truncated keyed hash; the key lives only on the Medora backend.
4. **Outbound payload**: `q_out = P(S(F(x, Π_u)))` — *consent-filtered, PII-stripped, hash-keyed*.
5. **Schema validation** of provider response before persistence: `x → x^(c) → x^(s) → q_out → r → V → r̂`.

### C.5 Provider-agnostic orchestration

Why three providers (Groq / Gemini / Cerebras)? Vendor independence: if one rate-limits, throttles, or changes pricing, the adapter contract stays stable, the rest of Medora is unaffected.

---

## D. Voice assistant (Vapi, Figs. 3.21–3.22)

The voice surface is *another* path into Chorui, not a separate brain. Architecture:

- **Voice UI** uses Vapi SDK + mic state.
- **Assistant overrides** (role, route, locale, session metadata) are pushed at session start.
- **Vapi assistant** transcribes and exposes a tool-call router.
- **Backend webhook** receives tool calls and dispatches to:
  - `ask_chorui` → Chorui pipeline (intent + orchestration + role-aware validation).
  - `navigate_medora` → navigation registry (safe routes by role).
- **Client interceptor** listens for tool-calls events and applies validated route changes; can stop the call.
- **Chat history**, voice context, AI interaction logs are persisted server-side.

> Health-related reasoning is **always** deferred to the Medora backend; the local Vapi action is followed by a validated backend action. (§3.2.3 final paragraph.)

---

## E. Consent & data sharing (Fig. 3.18)

Two tables guard records:

- `health_data_consents` — patient-level consent objects per category (history, reports, prescriptions, etc.).
- `patient_data_sharing` — per-doctor scoping; specific doctor → specific category.

Plus `patient_access` to record actual access events (auditable).

The flow:
1. Patient sets sharing preferences in `Privacy & Data Sharing` UI (Fig. 4.4a).
2. Doctor requests record → backend checks `health_data_consents` ∩ `patient_data_sharing` for that doctor.
3. Allowed → record returned + access event written to `patient_access`.
4. Denied → 403 + reason.
5. Revocation is immediate (backend guards), and the UI re-confirms in plain language.

If asked *"what makes this consent-aware vs just access-controlled?"*:
> Access control is binary; consent-aware data sharing is **categorical, per-doctor, revocable, audited and presented bilingually so the patient understands what they're agreeing to**. Categories are pruned out of AI payloads even when the doctor has access.

---

## F. Onboarding (Figs. 3.19, 3.20)

```
Signup → Resolve role (Patient / Doctor) → Stepwise onboarding → [Doctor verification gate if doctor] → Grant dashboard access
```

The verification gate distinguishes patients from doctors: doctors must upload license + credentials, then the **admin queue** approves before the doctor's dashboard unlocks. Patients pass through stepwise onboarding directly.

Sequence (Fig. 3.20): User → Frontend → Auth API (create account) → Profile API (init profile) → Profile API (submit onboarding steps) → Admin Queue (doctor docs if needed) → Profile API (onboarding complete) → Frontend (dashboard access).

---

## G. Reminders & notifications

- **Reminder dispatcher** runs as a backend background worker (Fig. 3.3, Background Workers).
- **Channels**: in-app (Realtime), email, web push (VAPID via `pywebpush`).
- **Trigger sources**: medicine schedule, follow-up window, appointment T-N hours, doctor reschedule, admin moderation.
- **Adherence pipeline**: each reminder event becomes a row that aggregates into the analytics widgets (`a_t`, `H_W`, `P_W`, `S_t`, `M_t` — see formula doc).
- **Lifecycle-managed async**: §6.2 P3 — reminders run in the background without impacting the request path.

---

## H. Doctor consultation workflow (Fig. 3.9)

```
Doctor → Frontend                  : open visit
Frontend → Consultation API        : load summary
Consultation API → AI Layer        : generate AI assist (consent-filtered context)
AI Layer → Consultation API        : validated note draft (Pydantic-checked)
Frontend → Consultation API        : save consultation + prescription
Consultation API → Patient (notif) : notify ready
Consultation API → Frontend        : status update
```

Key points:
- The AI assist is **scaffolding**, not authoring. The clinician edits and saves.
- Prescription generation is a structured form (medications, tests, surgery), not free text.
- The patient sees the structured prescription instantly inside the app (Slide 7).

---

## I. Health metrics & analytics (§4.5.1, Tables A.5)

The patient analytics dashboard is **adherence-oriented, not a diagnostic risk score** (Appendix A.6 is explicit). Surface widgets:

- **Adherence score** `H_W = 100 · (1/|W|) Σ a_t` over a 7- or 30-day window.
- **Perfect-day count** `P_W = Σ 1[a_t = 1]`.
- **Current streak** `S_t = S_{t-1} + 1 if a_t = 1 else 0`.
- **Missed-dose trend** `M_t = n_sched − n_taken`.

The `/health-metrics` API also stores raw vitals (weight, glucose, BP, etc.) per `health_metrics` table, with bands `[L_j, U_j]`. The deviation `δ_j(t)` and composite `G_W` are written up as **future-ready** rule-based extensions, **not deployed as a diagnostic dashboard** — say so explicitly if a reviewer asks.

---

## J. Doctor search & ranking (§3.2.1, §4.5.1, Slide 8)

Two stages, two interpretable equations:

1. **Specialty resolution** from free-text complaint:
   - `k̂ = argmax φ(q, k)` over supported specialties `K`.
   - Confidence: `P(k|q) = exp(βφ(q,k)) / Σ exp(βφ(q,k'))` and `c_search(q) = max P(k|q)`.
   - Low `c_search` → broaden the search or ask for clarification.
2. **Doctor ranking** over verified doctors `D_k̂`:
   - `R(d) = w_e Ẽ(d) + w_f (1 − F̃(d)) + w_ℓ (1 − Δ̃(d, ℓ)) + w_r Q̃(d)`.
   - Min-max normalised features: experience, fee (lower better), proximity, review-based reputation.
   - Weights sum to one and are explicit — the search is **not a black-box ranker**.

The reputation term `Q̃(d)` closes the trust loop: only patients with a completed appointment can rate the doctor, and the rating then influences ranking. Anti-gaming by construction.

---

## K. Process map summary (one chart in your head)

```
[Patient signup] ─► [Search doctors (φ, R)] ─► [Soft-hold + commit] ─► [Notifications]
                                                  │
                                                  ▼
                                          [Consultation w/ AI assist (consent-filtered, schema-valid)]
                                                  │
                                                  ▼
                                          [Structured prescription] ─► [Reminders + adherence]
                                                  │
                                                  ▼
                                          [OCR ingest of older paper Rx (YOLO + Azure + RapidFuzz)]
                                                  │
                                                  ▼
                                          [Records (consent-gated)  ─► Chorui assistance + voice]
```

If you can re-draw and verbalise that map, you can answer 80% of process questions.
