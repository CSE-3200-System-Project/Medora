# Medora Defense Pack

Generated from `docs/reports/2107006_2107031.pdf` (79-page CSE-3200 report) and `docs/slide/Medora_Presentation.pptx_1.pptx` (23 slides).

Read these in order to walk into a viva fully prepared:

| # | File | Use it for |
| --- | --- | --- |
| 01 | [01_OVERVIEW_AND_METHODOLOGY.md](01_OVERVIEW_AND_METHODOLOGY.md) | Elevator pitch, problem, objectives, novelty, tech stack, system architecture, planning, "where's X documented?" cheatsheet. |
| 02 | [02_WORKFLOWS_AND_PROCESSES.md](02_WORKFLOWS_AND_PROCESSES.md) | Appointment booking, OCR pipeline, AI/Chorui orchestration, voice, consent + sharing, onboarding, reminders, consultation, analytics, doctor search. |
| 03 | [03_MATH_AND_FORMULAS.md](03_MATH_AND_FORMULAS.md) | Every equation in §3.2.1, §4.5.1 and Appendix A — what it means, why it's that form, how to defend it. |
| 04 | [04_TESTING_AND_RESULTS.md](04_TESTING_AND_RESULTS.md) | Experimental setup, datasets, evaluation metrics, Tables 4.2–4.3, Figs. 4.14–4.15, defending the testing approach. |
| 05 | [05_SLIDE_BY_SLIDE_GUIDE.md](05_SLIDE_BY_SLIDE_GUIDE.md) | Slide-by-slide narration + likely Q&A for each of the 23 slides. |
| 06 | [06_PROFESSOR_QNA.md](06_PROFESSOR_QNA.md) | Hostile-reviewer Q&A across premise, architecture, AI safety, OCR, ranking, concurrency, testing, ethics, ownership, limitations, and trick questions. |

## Twelve numbers to memorise

| Value | What |
| --- | --- |
| **194** | backend endpoints |
| **26** | route modules |
| **19** | service modules |
| **47** | Alembic migrations |
| **45** | shadcn/ui components |
| **~20,000** | medicine catalog entries |
| **~100** | OCR corpus images |
| **~2,000** | YOLO training images |
| **150 / 380 / 750 ms** | API p50 / p95 / p99 |
| **~3.5 s** | OCR processing time (model time) |
| **~500 ms** | Realtime slot propagation |
| **92% / 89%** | Medicine / dosage OCR accuracy |

## Three formulas to memorise

```
k̂ = argmax_{k ∈ K} φ(q, k)                     — specialty resolution
R(d) = w_e Ẽ(d) + w_f (1 − F̃(d)) + w_ℓ (1 − Δ̃(d, ℓ)) + w_r Q̃(d)   — doctor ranking
q_out = P( S( F(x, Π_u) ) )                     — outbound AI payload after consent + sanitisation
```

## Three sentences to memorise

1. **What is Medora?** "An AI-native, consent-aware, bilingual healthcare platform for Bangladesh that fuses authenticated appointment booking, prescription OCR, telemedicine context, and safety-bounded AI assistance into one Next.js + FastAPI + dedicated AI/OCR microservice stack on Supabase."
2. **What's novel?** "The composition: integrated bilingual platform, safety-bounded AI orchestration pathway, and production-grade deployment within an academic timeframe — none of which we observed in the surveyed literature or BD market."
3. **What did we measure?** "Every metric in Table 4.2 passes with 25–50% margin; OCR exceeds documented thresholds at 92% medicine and 89% dosage accuracy; critical end-to-end and security suites pass at 100%, load tests stay under 0.5% error."
