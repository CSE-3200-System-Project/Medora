# Medora Defense Guide — 05. Slide-by-Slide Answer Guide

> Walk-through for `docs/slide/Medora_Presentation.pptx_1.pptx` (23 slides). For each slide: what's on it, what to *say*, the questions a strict reviewer is most likely to fire, and the rehearsed answers. Slides 1, 2, 5, 10, 11, 13–17, 21–23 are visual / divider slides — short notes only.

---

## Slide 1 — Title / Cover

**Show**: Project title "Medora: An AI-Native Healthcare Platform for Bangladesh", names (Sarwad Hasan Siddiqui — 2107006; Adiba Tahsin — 2107031), supervisor Kazi Saeed Alam, KUET, April 2026.

**Say (10 s)**: "Medora is an AI-native, consent-aware, bilingual healthcare platform built for the Bangladeshi context. We're going to walk through the problem, our approach, the architecture, the results, and the limitations."

---

## Slide 2 — Outline / Agenda

**Show**: Topic flow.

**Say**: "We'll cover the problem we set out to solve, the gap in existing solutions, our system architecture, the methodology, key engineering decisions, results, and finally limitations and future work."

---

## Slide 3 — Introduction (Medora at a glance)

**Show**: One-liner with brand. Maps to Fig. 1.1 of the report.

**Say**: "Medora is one app for patients, doctors, and admins. Patients find doctors, book, keep records, read prescriptions, set reminders, talk to an AI assistant — in Bangla or English, even on weak networks."

**Key facts to memorise**:
- Three roles, one app surface — different RBAC contexts, different dashboards.
- Bilingual (En + Bn) **side by side**, not as a translation wrapper.
- PWA + offline + ≥320 px mobile-first.

**Likely Q**: "Isn't this just three apps in a trenchcoat?"
**A**: "No — same backend, same auth, same data model, same AI boundary. The roles differ in route group, RBAC dependency, and dashboard widgets. The implementation chapter (§4.5.2) shows that distinction concretely."

---

## Slide 4 — Problem statement (numbered)

**Show**: A single number — "2" — likely calling out the scale of the problem (e.g. ≥4 disconnected systems, ~170 M population, etc.).

**Say**: "Bangladeshi patients juggle multiple disconnected systems: separate apps for search, booking, telemedicine, and paper for prescriptions. The result is missed visits, duplicate tests, medication errors, and disputes."

**Key numbers** (from §1.1, §1.2):
- Bangladesh population > 170 million; physicians per capita is limited.
- Patients interact with **≥ 4 separate systems**.
- No continuity of records, no consent enforcement, no Rx structuring.

---

## Slide 5 — Visual / divider

Brief transition slide.

---

## Slide 6 — Existing platforms comparison (the gap)

**Show**: The big comparison table:

| Platform | Records | Real-time | OCR | AI | Consent | Bangla |
| --- | --- | --- | --- | --- | --- | --- |
| DocTime | Partial | No | No | No | No | Partial |
| Sasthya Seba | No | Partial | No | No | No | Yes |
| Sebaghar | No | Partial | No | No | No | Yes |
| Praava Health | Yes | No | No | No | Partial | Yes |
| Doctorola | No | No | No | No | No | Partial |
| Epic / Cerner | Yes | Partial | Partial | No | Partial | No |
| Teladoc | Partial | Yes | No | Partial | Partial | No |
| **Medora** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |

**Say**: "Each existing player covers one or two columns. Medora is the only row with checks across all six. That's the gap, and that's what we built."

**Likely Q**: "Aren't you just claiming everything?"
**A**: "Each check has a measurable basis: structured records via the consultation/prescription schema; real-time via Supabase channels with 500 ms slot propagation; OCR via the YOLO + Azure DI pipeline at 92% medicine accuracy; AI via the schema-validated orchestrator; consent via the categorical sharing model; Bangla via next-intl across 10 functional categories. The report's Table 2.1 (p. 15) is the academic version of this slide with the same conclusion."

**Likely Q**: "Why didn't you compare with Healtha, GoodDoktor, Ada Health?"
**A**: "We did — Table 2.1 in the report has 11 platforms. The slide shows the most representative subset for the time we have."

---

## Slide 7 — Doctor workflow

**Show**: Bullets describing the doctor journey:
- Upload license & credentials → admin review → dashboard unlocks.
- Weekly schedule, exceptions, optional Google Calendar sync.
- AI patient summary on the side, voice-to-notes, draft auto-saves.
- Structured medication, tests, surgery — patient sees it instantly.
- Analytics, follow-ups, reschedule negotiations, completed reviews.
- Consent-filtered context from past visits.
- Reference info for specific conditions.
- Speech recognition → editable note draft.
- Structured note generation, clinician edits.

**Say**: "The doctor surface combines schedule control, structured consultation, AI scaffolding (not authoring), and bounded reference info. The clinician always edits and confirms; AI never writes to the patient record without the doctor's review."

**Likely Q**: "What does 'consent-filtered context' actually mean?"
**A**: "Before we send any context to the LLM, we run the consent-pruning operator F(x, Π_u) — only the categories the patient has authorised survive. So even if a doctor has access to a record, it won't leave the perimeter to an external model unless the patient has explicitly consented to that category being shared with AI."

**Likely Q**: "Speech-to-notes — how reliable?"
**A**: "We use faster-whisper for STT plus Vapi for the voice tool surface. The transcript is **always** an editable draft, not a saved note. The doctor edits before saving. We don't claim ASR-quality clinical accuracy — we claim a productivity scaffold."

---

## Slide 8 — Patient workflow

**Show**: Bullets describing the patient journey:
- Types symptoms; AI maps to a specialty + shows verified doctors near them.
- Sees live slots via Supabase Realtime; soft hold prevents double-booking.
- Doctor writes a structured prescription. Patient sees it instantly inside the app.
- Old handwritten prescriptions photographed → OCR pipeline extracts medicines and dosages.
- Smart reminders, adherence analytics, ask Chorui to navigate or summarise.
- Personal queries on consent basis.
- Health score based on many health metrics.
- Voice + Text → ranked doctor matching.
- Prescription summary in voice + text.

**Say**: "Patients describe symptoms in plain language. We resolve a specialty via φ(q,k), filter to verified doctors, rank by experience / fee / proximity / rating with explicit weights. Booking uses soft holds + realtime to avoid conflicts. After the visit, structured prescriptions are captured, plus paper prescriptions can be OCR-ingested. Reminders and adherence close the loop."

**Likely Q**: "What's the 'health score'?"
**A**: "Currently the surfaced number is **adherence** — H_W, the windowed reminder-compliance percentage. The composite health-trend score G_W is documented as a future-ready extension supported by the /health-metrics API but not deployed as a diagnostic dashboard. We're explicit about this in Appendix A.6 to avoid overclaiming."

---

## Slide 9 — Tech stack

**Show**: Four boxes:
- Next.js 16 PWA
- FastAPI Backend
- AI / OCR Service
- LLM Providers

**Say**: "Four explicit service boundaries. Frontend = Next.js 16 App Router with shadcn/ui + Tailwind 4 + Serwist for PWA; backend = FastAPI on Python 3.11 with async SQLAlchemy 2 over Supabase Postgres; AI/OCR = a separate FastAPI microservice with YOLO ONNX + Azure DI + PaddleOCR fallback + RapidFuzz; LLM providers = Groq + Gemini + Cerebras through schema-validated adapters."

**Memorise the numbers**:
- 194 endpoints across 26 route modules.
- 19 service modules.
- 47 Alembic migrations.
- 45 shadcn/ui primitives, ~10 i18n functional categories.
- ~20,000-entry medicine catalog, ~100-image OCR corpus.

**Likely Q**: "Why three LLM providers?"
**A**: "Vendor independence. Each adapter conforms to the same Pydantic schema. If one rate-limits or prices changes, the orchestrator fails over without UI changes. It also lets us pick latency-vs-quality differently per call site."

**Likely Q**: "Why FastAPI specifically?"
**A**: "Async I/O for booking under concurrency, Pydantic for the schema-first contracts that the AI boundary relies on, and structured dependency injection for RBAC + request context. The combination of these three is hard to get cleanly with Django or Express."

---

## Slide 10 — Visual / divider

Architecture transition.

---

## Slide 11 — Visual / divider

Architecture continued.

---

## Slide 12 — Consent + PII Guard

**Show**: A boundary diagram with the label "Consent + PII Guard".

**Say**: "Every external AI call passes through a gate. We do four things: (1) prune fields to those the patient has consented to, (2) redact PII fields and regex-scrub the rest, (3) replace identifiers with truncated keyed hashes, (4) Pydantic-validate the response before it's allowed back into application logic. The keyed hash secret never leaves the Medora backend."

**Likely Q**: "Show me the formula?"
**A**: "F(x, Π_u) = { (k_i, v_i) ∈ x : cat(k_i) ∈ Π_u } — that's consent pruning. S(·) handles redaction. T_v(z) = [anon : v : trunc_ℓ(H_K_v(z))] is the pseudonymous token. The payload sent out is q_out = P(S(F(x, Π_u))). All in §4.5.1 of the report."

**Likely Q**: "Why not full encryption?"
**A**: "FHE on LLM inference isn't operationally viable today. Our threat model: a logged prompt at the provider should not be linkable back to a real patient. Anonymisation + categorical consent + provider rotation achieves that at acceptable cost."

---

## Slide 13–17 — Architecture / diagrams (visual slides)

Likely some combination of: system diagram (Fig. 3.1), backend diagram (Fig. 3.3), AI/OCR pipeline (Figs. 3.4–3.5), DFDs (Figs. 3.6–3.7), sequence diagrams (Figs. 3.8–3.10).

**Talking points to rotate through**:
- "Three services, three failure domains, three scaling profiles."
- "OCR pipeline is detector + recognizer + parser + matcher — staged, not end-to-end."
- "Booking is soft-hold + transactional commit + realtime broadcast — that's how we prevent double-booking under concurrency."
- "Chorui takes a confidence-gated path: navigate / answer / ask."

---

## Slide 18 — Performance budgets (the results card)

**Show**:
- < 200 ms — booking and search feel instant — no waiting between taps.
- < 500 ms — even tail-latency stays inside an interactive budget.
- < 5 s — document upload still feels like a single user action.
- ≥ 75% — usable in real chambers with handwritten Rx.
- < 1 s — every client sees the same availability live.
- < 2.5 s — loads fast on weaker phones and weak connectivity.
- 120 rps, < 0.5%, 100%.

**Say**: "These are the budgets we set up front. Every one was met with margin: API p50 ~150, p95 ~380, p99 ~750 ms; OCR ~3.5 s; realtime ~500 ms; LCP ~1.8 s; CLS ~0.05; OCR usability ≥ 80% medicine and dosage accuracy on the corpus; load tests stable under 0.5% error at the documented rps. Margin matters because healthcare workloads burst."

**Likely Q**: "120 rps doesn't sound like a lot."
**A**: "It's the sustained representative load for a CSE-3200 academic deployment, not a national rollout target. The system scales horizontally on Azure Container Apps; the architectural pattern supports more without code changes. National-scale validation is listed as future work in §7.2."

---

## Slide 19 — Risks & mitigations

**Show** (paraphrased from the deck):
- Concurrency causes booking conflicts → **Soft holds + real-time sync**.
- Different APIs, limits, formats → **Adapter + schema validation**.
- Bangla + English text is hard to read → **YOLO + Azure DI + RapidFuzz pipeline**.
- Reminders slow down system → **Lifecycle-managed async runs in background**.
- Prototypes aren't reliable → **CI/CD + containerised deployment**.

**Say**: "Five biggest engineering risks, five concrete mitigations. None are abstract — each maps to a deployed component."

**Likely Q**: "Pick one and walk me through how the mitigation actually works."
**A** (picking concurrency): "A patient clicking 'book' creates a soft-hold row keyed on (doctor_id, slot, patient_id) with a TTL. We immediately broadcast a slot update via Supabase Realtime, so every other subscribed client removes that slot from their UI. The transactional commit then upgrades the soft hold to a confirmed appointment. If the patient never confirms, the background hold-expiry worker removes the soft hold and re-broadcasts. There is no window where two clients see the same slot as free."

---

## Slide 20 — Limitations & future work

**Show**:
- *Wins*: continuity of care, fewer medication errors, bilingual access, patient autonomy, reusable engineering.
- *Limitations*: OCR drops on poor handwriting; specialised clinical queries; real-time depends on Supabase; small OCR eval corpus; no third-party security audit.
- *Future*: local payment integration; WebRTC video consultations; pharmacy integration; family-member profiles; predictive health analytics.

**Say**: "We're upfront about the limits. OCR is advisory not authoritative. Highly specialised clinical queries can exceed Chorui's reliability envelope — confidence gating mitigates but doesn't eliminate. Realtime depends on Supabase, so degradation is graceful but not invisible. The OCR corpus is sufficient for directional validation, not full long-tail characterisation. And no third-party security audit was in scope — that's a precondition for regulated production deployment, listed in §7.3."

**Likely Q**: "Which limitation worries you most?"
**A** (rehearsed): "OCR accuracy on truly low-legibility handwriting. We mitigate with detector + recogniser + threshold + advisory framing, but the corpus is small. The honest answer is: we'd need a 1000+ image labelled BD-specific corpus and probably a fine-tuned multilingual recogniser to push medicine accuracy from 92% to 98%. We treat that as the highest-impact future-work item."

**Likely Q**: "Why no third-party audit?"
**A**: "Out of scope for an academic project — both budget and timeline. We did internal RBAC + JWT + cross-user isolation tests, and we explicitly call out the audit gap in §7.2 as a precondition for regulated deployment. We'd want a SOC 2 Type II or equivalent before any real PHI processing."

---

## Slide 21–23 — Closing / Q&A

Likely contact / thanks / Q&A.

**Have ready (one each)**:
- A 30-second restatement of contribution.
- A pithy "what we're proudest of" — answer: "the AI boundary, because that's what makes Medora *AI-native* not AI-bolted."
- A clean acknowledgment of limits — "OCR corpus, third-party audit, BD-specific compliance code."

---

## Cross-cutting Q&A drills (any slide)

| Question | One-liner answer |
| --- | --- |
| "What's the one most novel thing here?" | Safety-bounded AI orchestration: consent + PII + schema + confidence-gated routing inside one architectural layer. |
| "What if Supabase goes down?" | Realtime degrades to polling; the booking transaction still commits; the UI shows a stale-data banner. Acknowledged in §7.2. |
| "Have you tested in production?" | Staging on Azure Container Apps with synthetic traffic; not national-scale production, also acknowledged. |
| "Why Bangla support?" | It's a primary objective, not a wrapper — 10 functional i18n categories, Bangla numerals normalised in the OCR parser, Bangla phrases like "ek mash" handled in duration parsing. |
| "Show me the math one more time." | argmax + softmax for specialty resolution; convex weighted sum for ranking; consent pruning + sanitisation + keyed hash for AI privacy; edit-distance + tiered fuzzy + composite confidence for OCR; reminder-windowed adherence aggregates. Five families. |
| "What did each of you build?" | Sarwad: backend, AI orchestration, OCR microservice, DevOps, backend tests. Adiba: frontend, Chorui chat UI + voice control, OCR upload UX, Lighthouse + Playwright, i18n, frontend docs. (Table 1.1, p. 6.) |
| "Why didn't you build X?" | Honest answer: scope vs timeline. Then point to §7.3 if X is on the future-work list. |

---

## Pre-presentation checklist

- ☐ Re-read **Tables 1.1, 2.1, 4.1, 4.2, 4.3, 6.1, 6.2, 6.3** — these are the most quotable parts.
- ☐ Memorise four numbers: **194 / 47 / 26 / 19** (endpoints / migrations / route modules / service modules).
- ☐ Memorise the formula triplet: `k̂ = argmax φ(q,k)`, `R(d) = Σ w_i Z̃_i(d)`, `q_out = P(S(F(x, Π_u)))`.
- ☐ Memorise five performance numbers: **150 / 380 / 750 ms** (p50/p95/p99), **3.5 s** OCR, **500 ms** realtime, **1.8 s** LCP, **92% / 89%** OCR accuracy.
- ☐ Have one example of each of: a soft-hold race, a low-confidence OCR path, a denied AI request due to consent.
- ☐ Have a slow, calm answer for "what didn't work / what would you do differently?" — the OCR corpus + third-party audit answer.
