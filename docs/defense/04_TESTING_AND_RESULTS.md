# Medora Defense Guide — 04. Testing, Evaluation & Results

> Defends Chapter 4 (Implementation, Results & Discussion) and Slide 18 (performance budgets). Memorise Tables 4.1–4.3 and Figures 4.14–4.15.

---

## 1. Experimental setup (§4.2)

- **Local dev**: 8 CPU cores, 16 GB RAM, SSD.
- **Staging**: containerised infrastructure on Azure Container Apps with **independent scaling for frontend, backend, OCR**.
  - Backend scales on **CPU + concurrent request pressure**.
  - OCR scales **more aggressively on CPU-bound workload**.
- **Persistence**: Supabase PostgreSQL + Auth + Storage + Realtime.
- **Tooling per layer** (this is *the* table to memorise):

| Layer | Tool | What it measures |
| --- | --- | --- |
| API + workflow load | **Locust** + **k6** | latency p50/p95/p99, throughput, error rate |
| Backend correctness | **Pytest** unit + integration + security | logic, contracts, RBAC, JWT, isolation |
| End-to-end journeys | **Playwright** | onboarding, booking, reschedule, Rx upload |
| Frontend quality | **Lighthouse CI** + bundle-size checks | LCP, CLS, perf score, JS bundle KB |
| OCR | labelled prescription set + curated medicine catalog | medicine accuracy, dosage accuracy, latency |
| AI provider | structured-output compliance | schema validity rate, fallback behaviour |
| Real-time sync | propagation delay between two client sessions | client-to-client slot update ms |

If asked *"which tool runs in CI?"* → unit + integration + Playwright + Lighthouse + bundle-size + OCR regression. Locust/k6 are run in staging on demand and on release.

---

## 2. Evaluation metrics (§4.3) — what was measured & why

| Family | Metric | Why this metric |
| --- | --- | --- |
| Backend | API latency p50, **p95, p99** | User trust is shaped by tail latency, not averages |
| Backend | Reminder + slot-update responsiveness | Reminders late = missed doses; stale slots = double-bookings |
| Backend | DB query latency under concurrency | Verifies async SQLAlchemy + connection pool behaviour |
| OCR | Extraction latency | UX ceiling — must feel like one user action |
| OCR | Structured-field accuracy | Match against ground-truth annotations |
| Frontend | **Largest Contentful Paint (LCP)** + **Cumulative Layout Shift (CLS)** | Mobile-first BD context, Lighthouse mobile profile |
| Validation | E2E journey completion | Full critical-flow regression |
| Validation | Security control enforcement | RBAC, JWT, cross-user isolation tests |
| Validation | Regression resistance in CI | Stability over time, not one snapshot |

> Quote from §4.3: *"These metrics were chosen because they directly reflect the perceived quality of booking, consultation, report upload and guided-assistant flows."*

---

## 3. Datasets (§4.4) — three sources

| Dataset | Size | Purpose |
| --- | --- | --- |
| Synthetic scheduling workload | many patient/doctor actors over a multi-week horizon | Stress booking / reschedule / cancellation paths concurrently |
| OCR corpus | **~100 prescription images** with field-level annotations (medicine name, dosage, frequency) | Ground truth for OCR accuracy |
| Medicine catalog | **~20,000 entries** (brand + generic) | RapidFuzz target for the medicine matcher |

> Important caveat (§7.2): the corpus is sufficient for **directional** validation but not large enough to characterise the full long-tail of BD prescription writing. Acknowledge it openly — don't oversell.

> Why is this dataset described as "anonymised and selected" (§1.9.5)? Because privacy policy forbids publishing real patient data. The benchmarks are reproducible *in approach*; exact numbers depend on a comparable corpus.

---

## 4. Quantitative performance results (Table 4.2, Fig. 4.14)

> "Every metric passed. Several metrics passed comfortably — design confidence comes from sustained margin, not from barely satisfying thresholds." (§4.5.3)

### Memorise this table

| Metric | Target | Observed | Status | Headroom |
| --- | --- | --- | --- | --- |
| API latency p50 | < 200 ms | ~150 ms | Pass | 25% under |
| API latency p95 | < 500 ms | ~380 ms | Pass | 24% under |
| API latency p99 | < 1000 ms | ~750 ms | Pass | 25% under |
| OCR processing time | < 5 s | ~3.5 s | Pass | 30% under |
| Realtime slot propagation | < 1 s | ~500 ms | Pass | 50% under |
| DB query latency p95 | < 100 ms | ~70 ms | Pass | 30% under |
| Frontend LCP | < 2.5 s | ~1.8 s | Pass | 28% under |
| Frontend CLS | < 0.1 | ~0.05 | Pass | 50% under |

If asked *"why these particular thresholds?"*:
- **p50 < 200 ms** — interactive UI budget (taps must feel instant).
- **p95 < 500 ms** — tail latency inside an interactive ceiling.
- **p99 < 1 s** — even worst-case stays inside one second of perception.
- **OCR < 5 s** — single-user-action perception ceiling for document upload.
- **Realtime < 1 s** — every booking client sees the same availability before the next user can act.
- **DB < 100 ms p95** — leaves headroom in the API budget for serialisation + middleware.
- **LCP < 2.5 s, CLS < 0.1** — Google Core Web Vitals "Good" thresholds.

If asked *"why pass with margin matters in healthcare"*:
> Healthcare workflows experience burst load (start of doctor shift, end of pharmacy hours). Passing at the threshold means failing under burst. Sustained margin gives operational cushion.

---

## 5. OCR validation results (Table 4.3, Fig. 4.15)

| Indicator | Target | Observed | Interpretation |
| --- | --- | --- | --- |
| Medicine-name OCR accuracy | ≥ 85% | **~92%** | Above documented acceptance threshold |
| Dosage OCR accuracy | ≥ 80% | **~89%** | Reliable for advisory display with review |
| Prescription OCR processing time | < 5 s | **~3.5 s** | Stays interactive |
| Critical end-to-end suites | All passing | **Passing** | Onboarding + booking + reschedule + OCR regression-protected |
| Security validation | RBAC + JWT + isolation | **Passing** | Boundaries tested, not assumed |
| Load-test stability | Failure rate < baseline guard | **< 0.5%** | Healthcare workloads stay operational |

Slide 18 also lists ≥ **75%** as a usability bar in real chambers with handwritten Rx — this is the user-facing line for OCR; engineering targets in Table 4.3 are stricter.

If asked *"why is medicine accuracy higher than dosage accuracy?"*:
> Medicine names benefit from a 20k-entry catalog and tiered exact-substring-fuzzy matching. Dosage tokens have less redundancy: a single character flip (`1+0+1` vs `1+0+l`) changes meaning. The grammar projection helps but doesn't fully recover from low-legibility samples — exactly the failure mode acknowledged in §7.2.

---

## 6. Test architecture (§4.5.4) — five layers, separate guarantees

```
Unit tests          : backend services, route contracts, frontend logic
Integration tests   : booking, OCR, AI boundaries with real contracts
E2E (Playwright)    : onboarding, booking, reschedule, prescription processing
Security tests      : JWT validity, RBAC, cross-user isolation
Load tests          : Locust + k6 — sustained traffic, p95/p99 verification
```

Each layer answers a different question:

| Layer | Question it answers |
| --- | --- |
| Unit | Does this function meet its contract? |
| Integration | Do the pieces talk to each other correctly? |
| E2E | Does the user journey actually work end-to-end? |
| Security | Are role boundaries enforced *at* the boundary? |
| Load | Does it stay within budget under representative concurrency? |

If asked *"why this layered approach instead of just E2E?"*:
> Failures isolate cheaper at lower layers. A unit test catches a regression in 50 ms; an E2E catches it in 30 s. We push tests downward when possible and upward when needed — security and journey correctness can't be inferred from unit tests, they must be exercised end-to-end.

---

## 7. Provider compliance evaluation (§4.2 last paragraph)

> "AI-provider evaluation focused on **structured-output compliance** rather than unrestricted text quality because the platform depends on schema-valid responses."

We don't grade the model on essay quality. We grade it on:
1. Did it return JSON that validates against our Pydantic schema? (binary)
2. Does the validated content lie inside expected ranges (confidence ∈ [0,1], category ∈ enumerated set)? (range checks)
3. Was a fallback provider engaged when the primary failed? (resilience check)

This is the "structured-output compliance" framing — and it is *why* provider rotation across Groq/Gemini/Cerebras is safe.

---

## 8. Frontend performance posture (Slide 18 + §4.5.3)

- Mobile-first from **320 px**, evaluated under Lighthouse mobile simulation.
- Bundle-size checks in CI prevent JS-bloat regressions.
- Serwist service worker provides offline + background sync — measurable in the PWA install + repeat-visit metrics.
- Slide 18 explicit budgets:
  - **< 200 ms** — booking and search feel instant.
  - **< 500 ms** — tail latency inside interactive budget.
  - **< 5 s** — document upload feels like a single user action.
  - **≥ 75%** — OCR usability with handwritten Rx in real chambers.
  - **< 1 s** — every client sees the same availability.
  - **< 2.5 s** — fast on weaker phones / weak connectivity.
  - **120 rps**, **< 0.5%** error, **100%** critical-suite pass.

---

## 9. Real-time sync evaluation (§1.9.6)

Methodology: changes made in one client session are observed in another concurrent session; the lag between commit and visible update is measured.

Result: ~500 ms median, well inside the < 1 s target. The mechanism is Supabase Realtime channels broadcasting from the backend after the booking transaction commits (Fig. 3.8 "emit slot update").

---

## 10. Frontend qualitative evaluation (§1.9.6)

Manual user-task evaluation under representative scenarios:
- Patient registration + first appointment.
- AI doctor search from symptom string.
- Prescription OCR upload + review.

Measurements: execution time, task completion rate, usability factors (subjective). Used to confirm that engineering metrics translate into actual user task success.

---

## 11. Defending the testing approach against tough questions

### "Your dataset is too small to be statistically significant."
> Acknowledged in §7.2. The 100-image OCR corpus is sufficient for directional validation and matches the documented acceptance thresholds. It does not characterise the full long-tail. We treat OCR output as **advisory**, not authoritative — a low-confidence field is flagged, not auto-saved. This is a *design decision*, not an evaluation hand-wave. A larger dataset is listed as future work.

### "Why p95/p99 instead of just average?"
> Average latency hides the slow tail. In healthcare a 1% slow request is often the *consequential* one — a doctor mid-consultation, a reminder during a pharmacy run. p95/p99 is what users actually feel.

### "Was this tested under realistic concurrency?"
> Locust + k6 with virtual users sustained at the documented rate (Slide 18 cites 120 rps). The synthetic scheduling workload runs many patient/doctor actors over a multi-week horizon to stress booking + reschedule + cancellation paths concurrently. Limitations (§7.2): not national-scale, not regulated production traffic.

### "How do you know the AI orchestration is reliable?"
> Three layers of evidence: (1) Pydantic schema validation rejects malformed responses; (2) provider rotation tested via fallback path; (3) AI-interaction logs in Supabase let us replay any failure case. We grade compliance, not creative quality.

### "What about the frontend? CLS = 0.05 sounds suspicious."
> CLS measures visual stability. We use shadcn/ui primitives with reserved space for async content (skeletons), and Lighthouse CI fails the build if CLS regresses. Frontend bundle-size budgets prevent layout-shift regressions from new components.

### "Have you done a security audit?"
> Internal security tests cover JWT validity, RBAC, cross-user isolation. We are explicit (§7.2) that **no third-party security audit was performed** and we cite this as a precondition for regulated production deployment. Saying so up front is honesty, not weakness.

### "What if Supabase goes down?"
> Realtime degrades to polling; database persistence is captured in §7.2 limitations as a dependency. Graceful degradation cannot fully preserve the ideal path when external services are impaired — also acknowledged in §7.1.

---

## 12. The 60-second results pitch

> "We measured the system the way it's used. Backend: 150 / 380 / 750 ms at p50/p95/p99 against 200 / 500 / 1000 ms targets. OCR: 92% medicine accuracy, 89% dosage accuracy, 3.5 s end-to-end against 5 s budget. Realtime slot propagation: 500 ms against 1 s. Frontend: LCP 1.8 s and CLS 0.05 against 2.5 s and 0.1 — both Core Web Vitals 'Good'. Every critical end-to-end and security suite passes; load tests stay under 0.5% error. Every metric passes with sustained margin, which matters more than threshold-hitting in a healthcare context where bursts are routine."

---

## 13. Cross-reference

- Performance numbers: **Table 4.2** + **Fig. 4.14** (p. 44).
- OCR numbers: **Table 4.3** + **Fig. 4.15** (p. 45–46).
- Modules with explicit logic: **Table 4.1** (p. 37).
- Slide 18 = the user-facing performance card.
- Slide 19 = risks-and-mitigations chart (concurrency, multi-provider, OCR difficulty, reminder backpressure, deployment reliability).
