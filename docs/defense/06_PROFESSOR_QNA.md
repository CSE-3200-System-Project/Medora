# Medora Defense Guide — 06. Professor Q&A (Hostile Edition)

> Pretend the reviewer is a strict, sceptical professor whose primary instinct is to find faults. Each question below is a likely attack vector on the report or slides. Each answer is grounded in concrete evidence inside `docs/reports/2107006_2107031.pdf` so it survives follow-ups. Cite section numbers when you can; concrete is harder to argue with.

---

## Section A. Premise & novelty

### A1. "Calling this 'AI-native' is a marketing term. What technically separates it from any product that uses the OpenAI API?"

The distinction is structural, not aspirational. In an AI-bolted architecture, model calls happen ad-hoc from the application code; safety is a reviewer's prayer. In Medora, every external model call is forced through a single backend layer (Fig. 3.4) that performs **(i)** consent pruning over categorical sharing preferences, **(ii)** PII sanitisation with regex scrubbing and field redaction, **(iii)** pseudonymous tokenisation with a keyed hash whose secret never leaves Medora, **(iv)** Pydantic schema validation of the response, and **(v)** persistence into `ai_interactions` for audit. There is no code path in which a clinician or patient action invokes an LLM without crossing this boundary. That is what we mean by AI-native: the safety contract is *load-bearing* architecture, not a wrapper.

### A2. "Where exactly is the novel research contribution? You said it yourselves — no new algorithm."

The contribution is **engineering composition** under specific local constraints, and §1.5 is explicit about this. Three components, none of which we observed in either the literature surveyed in Chapter 2 or the Bangladeshi market: (a) an integrated platform combining structured records, real-time scheduling, OCR document intelligence, AI assistance, and consent management *for a Bangla-English bilingual context*; (b) a safety-bounded AI orchestration pathway, with anonymisation, schema validation, and confidence-gated routing; and (c) production-grade containerised deployment with observability and CI performance budgets within an academic timeframe. We do not claim a new algorithm — we claim a novel system.

### A3. "Your comparison table (Table 2.1) is suspiciously favourable. How did you assign the 'Yes / No / Partial' values?"

By feature inspection. For each platform we looked at the public product pages, support documentation, and (where available) the app itself. A *Yes* requires a documented, user-accessible feature; *Partial* means present but limited (e.g. records exist but cannot be exported, or Bangla exists in the app but not in clinical content); *No* means absent. We deliberately marked Medora *Yes* only on dimensions where we have concrete implementation evidence cited in Chapter 4 (Tables 4.1–4.3). If a reviewer disputes a row, we should default to "downgrade ours and recheck theirs", not the other way round.

### A4. "How is this different from electronic health records like Epic or Cerner?"

Epic/Cerner are enterprise EHRs with full clinical histories and HL7 FHIR interoperability — they do that part better than us, and we say so (§2.2.4). They are also costly, US-centric, English-only, and inaccessible to local user interfaces. Our platform is a complementary niche: a low-cost, bilingual, consent-first, AI-augmented platform suited for a developing-economy clinical context. Choosing this niche is exactly why we cannot copy the EHR architecture directly.

---

## Section B. Architecture

### B1. "Why three services and not a monolith? You're a two-person team."

§3.2.1 gives three reasons we stand by. (a) **OCR is computationally lumpy** — full-page detection + Azure DI calls cause latency spikes that would otherwise hit the booking path. (b) **OCR has heavier model artifacts** (YOLO ONNX weights, Paddle dependencies) that bloat backend cold starts. (c) **Fault isolation** — if OCR degrades, booking, onboarding and notifications keep working. The cost is added deployment complexity, which we accept because Azure Container Apps and GitHub Actions automate it for us. A monolith would have been simpler to deploy and *much* worse to operate under bursts.

### B2. "Why FastAPI and not something with a richer ecosystem like Django or Spring?"

Three concrete reasons. (i) Async I/O is a primitive, not an add-on, which matters for the booking + notification + reminder workers running concurrently. (ii) Pydantic is a first-class citizen — the schema-first contract our AI boundary depends on is *the* native modelling primitive, not a third-party library. (iii) Dependency injection lets us colocate auth, RBAC and request context with each handler, which mirrors the security model in `app/core/dependencies.py`. Django ORM is sync-by-default; Express has no equivalent of Pydantic; Spring would have been heavier for a two-person codebase.

### B3. "Why Supabase and not raw Postgres?"

Supabase is Postgres plus Auth, Realtime, Storage and row-level security primitives. We use **all** of those: Postgres for persistence (47 Alembic migrations), Auth for JWT-based identity, Realtime for the slot broadcast that prevents double-booking, Storage for prescription image objects, and RLS as defence-in-depth behind RBAC. Replacing Supabase with raw Postgres would mean reimplementing four production-grade subsystems for negligible architectural gain.

### B4. "194 endpoints across 26 modules feels like a CRUD explosion."

§4.5.1 shows the breakdown is **domain-focused, not route-local**. Endpoints group around bounded contexts (appointments, consultations, prescriptions, OCR, doctor search, reminders, notifications, admin, profiles, health metrics, AI). Each is backed by a service module — 19 of them. The route count reflects the breadth of role-specific surfaces (patient, doctor, admin), not duplicated logic. If you collapsed CRUD into RPC-style verbs the count would drop by maybe 30%, not 90%.

### B5. "What's the consistency model on the booking path?"

Read-your-writes plus eventual consistency on the *broadcast*. The transactional commit is durable and immediate; the Realtime broadcast is best-effort with sub-second median (~500 ms). If a client misses a broadcast, the next slot fetch reconciles. The soft-hold + commit pattern is what makes the *first* writer always win deterministically; the second client sees a 409 only in the rare race where two clients both hit commit before either has propagated.

### B6. "Soft holds — what TTL? What if the patient's network drops mid-confirmation?"

The hold-expiry worker (Fig. 3.3, Background Workers) sweeps soft holds whose TTL has passed and re-broadcasts the slot as available. If the patient lost network mid-confirm, two outcomes are possible: (i) their commit reached the backend and persisted; on reconnect they see "confirmed", (ii) it didn't reach; the soft hold expires; on reconnect they see "available" and re-attempt. Either way the system is consistent. We don't surface a half-state.

### B7. "Why three LLM providers? Vendor maximalism is a code smell."

It is *because* we treat them as commodity backends that we need three. The orchestrator's contract is the same Pydantic schema regardless of provider; the adapter only differs in transport. We get (a) latency-vs-quality tuning per call site, (b) automatic fallback when one provider rate-limits, (c) negotiation leverage on pricing. The cost is one adapter file per provider — a one-time commit, not ongoing maintenance.

---

## Section C. AI safety, consent, privacy

### C1. "What stops the LLM from issuing a diagnosis anyway?"

Three layers: (i) the system prompt enforces an **assistive-only policy** explicitly forbidding diagnosis, prescription mutation, and overriding clinician opinion; (ii) the response is Pydantic-validated against an enum of allowed action types — `navigate`, `answer`, `ask`; (iii) confidence gating routes low-confidence cases to clarification rather than action. If the model returns a diagnosis, schema validation will reject it because diagnosis isn't an enumerated allowed action. The reviewer will press: *what if it returns "answer" with diagnostic text inside?* — answer: that's still an *answer* shown to the patient as an answer, not a clinical write. Clinical writes always require explicit clinician confirmation (§5.3).

### C2. "Your consent model is performative. The patient still has to trust you."

True about *us*; not true about the model providers. The pseudonymous tokenisation `T_v(z) = [anon : v : trunc_ℓ(H_K_v(z))]` uses a keyed hash whose secret never leaves Medora. So an external provider — even if it logged everything — could not link a record back to a real patient. Categorical consent then bounds *which* fields are eligible to leave the perimeter. The patient does still have to trust Medora the platform; they have to trust *some* operator. We minimise that trust surface with audit logs, plain-language consent descriptions, and revocation that takes effect immediately at the backend guards (§5.2).

### C3. "Pseudonymous tokens with a fixed key are linkable across requests. Are you using a per-request salt?"

We are using a stable namespace-keyed hash (`H_{K_v}`), which is intentionally linkable *within Medora* and across the same provider for the same `v`-namespace, so that a multi-turn conversation is consistent. It is not linkable to **real** identity by the provider because the key is secret. Per-request salting would break conversational consistency — a deliberate trade-off documented in §4.5.1 paragraph 6.

### C4. "Why Bangladesh-specific compliance? You don't cite BMDC clinical data rules."

We anchor on the **Digital Security Act 2018** for data protection (§5.4) and BMDC Code of Professional Conduct (Reference [30]) for clinician-side ethics. We acknowledge that Bangladesh does not yet have a unified digital health code (Table 6.2 P5). Our mitigation: design against HIPAA + GDPR principles as reference frameworks — explicit consent, auditable access, encryption in transit, least-privilege access — so future regulatory accommodation is mechanical, not architectural.

### C5. "What if the patient revokes consent mid-conversation?"

The next prompt construction call re-runs `F(x, Π_u)` against the *current* preferences, so the new prompt will have less context. The historical AI interaction logs remain (we don't retroactively delete audit records), but they are only accessible through audit endpoints, never re-fed to the model. Revocation is therefore prospective, not retroactive — a property the report inherits from GDPR-style consent semantics.

### C6. "AI hallucinations are well documented. How do you bound their *medical* impact?"

By making the AI **assistive-only** at the architecture level, not at the prompt level. The clinician edits and saves; the patient sees AI summaries marked as such (Slide 7 / Fig. 4.7b). OCR output is advisory — low-confidence fields are flagged for clinician review (§5.3 second safety requirement). Reminders display the clinician-issued schedule, never an AI-generated treatment plan. The Pydantic gate enforces enumerated actions, not free-form text, for any AI call that *acts*. So a hallucination can produce a wrong answer or a clarification, but cannot directly mutate a patient record.

---

## Section D. OCR pipeline

### D1. "Why didn't you fine-tune a single end-to-end model like TrOCR or Donut?"

Three reasons (§4.5.3). (a) Bangladeshi prescriptions are full-page, multi-element layouts with stamps, signatures, chamber addresses, and ad-hoc notes — an end-to-end recogniser attends to all of them and degrades. (b) We don't have a corpus large enough to fine-tune a multilingual handwriting recogniser to clinical accuracy. (c) Azure Document Intelligence already gives a strong, audited recogniser in our budget; the engineering work is to *focus its attention*. So we built a YOLO detector that crops the medication block and let Azure recognise inside the crop. Detector + recognizer beats end-to-end here.

### D2. "What's the training set for YOLO? 2,000 prescriptions sounds tiny."

It's small, deliberately. We aren't training a general-purpose handwriting OCR — we're training a **region detector** for one class: "medication block." With strong augmentations (rotation, scale, blur, JPEG compression), 2k images is sufficient for a single-class detector, especially since false positives are bounded by the multi-scale retry and IoU suppression. The detector's job is "find the box"; the recogniser's job is the hard part, and we delegate that to Azure DI.

### D3. "Your evaluation corpus is only 100 images. That's not statistically meaningful."

Acknowledged in §7.2. 100 images suffices for **directional** validation against published thresholds — confirming we exceed the documented 85% medicine and 80% dosage targets with margin (92% and 89%). It does not characterise the long-tail of BD handwriting variability. Mitigation: low-confidence outputs are flagged for clinician review; the OCR is treated as advisory, never authoritative. Future work (§7.3) lists corpus expansion explicitly.

### D4. "Why is τ_m = 0.7 the right threshold? Did you sweep?"

We tuned against the labelled corpus and observed that below 0.7 the false-positive rate (incorrect catalog matches accepted) starts to dominate the false-negative rate (correct matches rejected). The piecewise structure — exact 1.0, substring 0.9, RapidFuzz fallback — also makes the threshold less sensitive: most acceptances are at 1.0 or 0.9, not at the fuzzy boundary. A future improvement is per-medicine-class thresholds; for the current implementation a single global τ_m is sufficient.

### D5. "Levenshtein over normalised dosage strings is naive. What if 'l+0+l' is OCRed as 'l+O+l'?"

Pre-normalisation handles exactly that. `N(·)` rewrites `l → 1` and `O → 0` *before* edit-distance comparison. The valid-pattern set has 7 elements, and the post-normalisation strings differ from the canonical ones by at most a couple of edits in our corpus, so `argmin d_L(N(x_f), p)` reliably snaps to the right pattern. Where the normalisation isn't enough, the composite confidence drops and the field is flagged.

### D6. "What about Bangla numerals or mixed-script dosages?"

Quantity parsing handles them: numeral normalisation maps Bangla digits and English/Bangla number words to integer `n`, and the unit recogniser handles `day / week / month` plus phrases like `ek mash` (one month). The composite duration `D(x_q) = n · κ(u)` is the canonical form pushed downstream.

### D7. "What if Azure Document Intelligence is down or rate-limited?"

PaddleOCR fallback. It's a documented degradation: latency may rise, accuracy drops, but the workflow is not blocked (§3.2.2 final paragraph). The fallback is environment-configured; the pipeline does not require Azure to be available.

---

## Section E. Specialty matching & doctor ranking

### E1. "argmax over LLM scores isn't a model — it's a wrapper."

It is a wrapper *with* the right properties. We don't trust per-vendor logits because they're not calibrated across providers. We compute `P(k|q)` over a fixed candidate set with an explicit β so the confidence is comparable. The argmax is the cheap, interpretable selector that lets us swap the underlying scorer without changing the contract. If you want a learned classifier instead, that's future work — and it would need a labelled BD-specific symptom-to-specialty corpus we don't have.

### E2. "Why a linear weighted ranker for doctors? That's 1990s IR."

Interpretability and audit. Each weight has a documented meaning, an auditor can explain why a doctor was ranked first, and a clinician or admin can tune them. A learned ranker would need labelled click data we don't have, would risk reinforcing access bias (richer doctors → more clicks → better rank), and would defeat the goal of transparent recommendation in a healthcare setting. We chose interpretability over marginal accuracy explicitly.

### E3. "Show me Q̃(d) — the reputation term. How do you prevent review bombing?"

`Q̃(d)` is min-max normalised over the verified review subsystem (§4.5.1). The integrity property is: only patients with at least one **completed appointment** (i.e. a row in `appointments` with status `completed`) can submit a star rating + note. So review bombing requires fake bookings, and fake bookings require verified accounts — which the admin queue gates. It's not perfect but it raises the cost meaningfully. Sock-puppet detection is future work.

### E4. "Your specialty taxonomy K is fixed. What about new specialties?"

Configuration, not code. Adding a specialty is a row in `specialties` plus a verification flow. The orchestrator picks up the change without redeployment because `K` is fetched, not hard-coded. If a query truly doesn't fit any specialty, `c_search(q)` is low and the UI surfaces "broaden your search" or asks for clarification.

---

## Section F. Real-time & concurrency

### F1. "What's the formal correctness argument for soft-hold + Realtime?"

Three invariants. (1) The booking transaction is the *single* writer to `appointments.status = confirmed`. (2) The soft hold is observable by all subscribers within one Realtime round-trip (~500 ms), so the *probability* of two clients both reaching the commit step on the same slot is bounded by that round-trip window. (3) If the race occurs anyway, the transactional layer enforces uniqueness (one row per (doctor_id, slot)) and the second commit fails with a deterministic 409 — the UI then re-fetches and shows the slot as taken. So worst case is a rare 409, not a double booking.

### F2. "What if Supabase Realtime is degraded for 10 minutes?"

Realtime degrades to polling — clients re-fetch slot state on a backoff. The booking transaction is unaffected. The user-visible cost is staler slot views and a higher rate of 409s on commit. The platform is operational, not optimal. Acknowledged in §7.2.

### F3. "What about timezone bugs?"

Slots are stored in UTC; the UI renders in the patient's locale (locale-aware routing, Fig. 3.2). Doctor availability is configured per-doctor with their local schedule and converted server-side. Daylight-saving doesn't apply to Bangladesh, so DST-edge cases don't arise in our deployment. Timezone-aware reschedule across regions is future work for international patients.

---

## Section G. Testing & evaluation

### G1. "How do I know your tests aren't trivial happy-path tests?"

Look at the test architecture (§4.5.4): unit + integration + Playwright E2E + security + load. Security tests specifically exercise JWT validity, RBAC, and **cross-user isolation** — not happy paths. Playwright covers full journeys including reschedule and prescription processing. Locust + k6 sustain representative load, not a single request. The OCR evaluation compares against ground-truth labels — that's not a sanity test, it's a metric.

### G2. "Where's the chaos / fault-injection testing?"

Not in scope for this iteration. We do test fallback paths (Azure DI off → PaddleOCR; LLM provider down → next provider). We do not run formal chaos engineering. Listed implicitly under future work.

### G3. "p95 = 380 ms tells me nothing without the load."

Locust + k6 at the documented sustained rps (Slide 18 cites 120 rps). 380 ms p95 was observed at that sustained rate against the staging deployment. Numbers were taken under load, not at rest.

### G4. "Lighthouse scores are notoriously inconsistent."

We pin the Lighthouse runner config in CI (mobile profile, fixed CPU throttling, fixed network shape) so the LCP / CLS numbers are comparable across PRs. Bundle-size budgets backstop the perf score. The 1.8 s LCP is a steady-state measurement, not a one-shot.

### G5. "100% E2E pass rate is unbelievable."

It's the **critical** suite — the suites that gate CI. We have a larger non-blocking suite where we triage flakes. The 100% number refers to the suites that block merges, not every test that exists.

### G6. "Have you measured cost?"

Not as a primary metric. We optimise for latency targets within the Azure / Supabase budgets we have. Per-request cost analysis is future work; we mention elastic scaling as an environmental and cost benefit (§5.6.1).

---

## Section H. Ethics, society, accessibility

### H1. "Bangla support — is it really clinical-grade?"

It's UI-grade across 10 functional categories, with Bangla numerals normalised in the OCR parser and Bangla phrases like "ek mash" handled in duration parsing. It is **not** a clinical-Bangla NLP system — a doctor still writes notes in their preferred language, and Chorui's clinical reasoning in Bangla is bounded by the underlying LLMs' Bangla quality. Slide 20 lists support for languages beyond En/Bn as future work, which acknowledges the scope.

### H2. "What about accessibility — WCAG, screen readers?"

shadcn/ui sits on Radix, which has accessibility primitives (focus management, ARIA semantics) by default. We have not run a formal WCAG 2.1 AA audit. That is a gap — accessibility audits should be added under future work alongside the third-party security audit.

### H3. "How does your platform avoid worsening healthcare inequality?"

Three levers (§5.5.1). (a) PWA delivery bypasses the app store and works on weak networks — accessible from low-end Android devices. (b) Bangla-first UI removes the English-literacy barrier present in most existing platforms. (c) Min-max normalised proximity in ranking surfaces nearby doctors first — patients in underserved areas see local options before distant urban specialists. We do not solve inequality, but we are explicit about not amplifying it.

### H4. "What about data sovereignty? Are records leaving Bangladesh?"

Persistence is on Supabase (region-configurable). LLM providers are international. Categorical consent + PII anonymisation + keyed-hash tokenisation mean *anonymised* category-filtered context leaves the perimeter; raw patient data does not. Data sovereignty as a hard requirement (records must remain in-country) is not currently enforced — this is a deployment configuration choice, and we'd need a regional Supabase project + an in-region LLM provider for full compliance.

### H5. "Family-member profiles. Multi-generational households are common in Bangladesh — how do you handle a grandfather who can't read?"

We don't, fully. The current model is one profile per identity. §7.3 lists family-member profile support as medium-term future work, with emergency-contact integration. For now, a literate caregiver acts as proxy through the same UI — which is a known limitation, not a design feature.

---

## Section I. Limitations & honest answers

### I1. "What is the most embarrassing thing the system does today?"

OCR on truly low-legibility handwriting. We can hit 92% medicine and 89% dosage on the curated 100-image corpus; we know we don't do as well on the long-tail. The mitigation — flagging low-confidence fields for clinician review — is right, but the failure rate is real and visible to users.

### I2. "If you had three more months, what would you build?"

(1) A 1000+ image labelled BD-specific OCR corpus and a fine-tuned multilingual recogniser. (2) Family-member profiles + emergency-contact integration for multigenerational use. (3) A WebRTC video consultation surface that integrates with the existing booking and consent flow. (4) Local payment integration (bKash/Nagad/Rocket). (5) A third-party security audit. The order reflects expected impact-per-effort.

### I3. "Tell me one design decision you regret."

The breadth of route modules. 26 is justified by domain decomposition, but it does inflate the surface a single developer has to keep in mind. A re-do would invest more in horizontal infrastructure (a generalised audit decorator, a generalised pagination layer) earlier so feature modules stayed leaner. Not a *wrong* decision — a tradeoff we'd dial differently knowing what we know now.

### I4. "Why no payment integration?"

Out of scope and high-risk. Local payment integration (bKash, Nagad, Rocket) brings KYC, transaction-reconciliation, and PCI-style obligations that require dedicated time and a third-party audit. Listed as near-term future work.

### I5. "Why no WebRTC video consultations?"

Same answer — out of scope, high-risk. Real-time media adds TURN servers, jitter buffers, recording and consent overhead. We stub it out as future work and ship a structured consultation workspace that's complete without media.

### I6. "Are you saying no patient harm is possible?"

No. We are saying patient harm is **bounded** by architectural decisions: AI is assistive-only, OCR is advisory, clinical writes need clinician confirmation. Harm pathways still exist — incorrect manual entry by a clinician, OCR flagged but ignored, a doctor accepting an AI summary without reading. The platform reduces the surface area of harm; it does not eliminate it. That is exactly why we keep humans in every clinical-write loop.

---

## Section J. Engineering process & ownership

### J1. "Who built what? You're a two-person team — what stops me from saying one of you carried the project?"

Table 1.1 (p. 6) is the canonical attribution. Sarwad led backend (FastAPI, async SQLAlchemy, 194 endpoints, 47 migrations), AI orchestration, OCR microservice, DevOps, and backend testing. Adiba led frontend (Next.js 16 App Router, 45 components), Chorui chat UI + voice control, OCR upload UX, Lighthouse CI, dashboard authoring, and i18n (next-intl, En + Bn, 10 categories). The frontend and backend each form a coherent, sizeable workstream — neither carries the other.

### J2. "15 merge commits — that's not a lot of integration."

It's the count of *named integration checkpoints*, not total commits. Internal feature-branch commits are higher. The 15 merge commits represent deliberate integration points where both authors reviewed and signed off (Fig. 1.4). They are the audit trail, not the work log.

### J3. "Did you use AI assistants like Copilot or Cursor during development?"

Yes — both of us did. We treated AI assistance the same way we treat AI assistance in the product: as a scaffold, not an authoritative author. Every accepted suggestion was read, edited, tested. The Pydantic schemas, the soft-hold logic, the OCR pipeline architecture, the consent model — these are decisions we made. Tool-assisted typing is not the same as tool-authored design.

### J4. "Why no production users?"

Because we are an academic project with no clinical or commercial deployment authority, and putting real patients in front of an unaudited platform would be irresponsible. We deploy to staging on Azure Container Apps with synthetic and self-driven traffic, and we acknowledge in §7.2 that national-scale validation is future work behind a third-party audit.

---

## Section K. Hardest meta-questions

### K1. "If I deployed this in a real clinic tomorrow, what would break first?"

Three things, in order. (1) **OCR on handwriting outside our corpus distribution** — accuracy would drop, low-confidence flags would surge, clinician review queues would build up. (2) **LLM rate limits** under burst — Chorui would degrade to fallback providers; some advisory features would slow. (3) **Supabase Realtime edge** during a region outage — slot views go stale and 409s spike on commit. None of these are silent failures; they all surface in observability dashboards (Grafana / Prometheus).

### K2. "Sell me one number that proves Medora isn't another student project."

`194 endpoints / 26 modules / 47 migrations` deployed on Azure Container Apps with GitHub Actions CI gating performance budgets. That isn't a prototype shape — that's a production posture. Or: every metric in Table 4.2 passes with 25–50% margin. Or: every OCR validation indicator in Table 4.3 is *Passing* on real labelled data. Pick one and back it with concrete artifacts.

### K3. "Why should I believe your claims about safety, consent, and PII when no third-party has audited them?"

You shouldn't *fully* — that's exactly why we list a third-party security audit as a precondition for regulated deployment in §7.2 and §7.3. What you should believe is that the architecture is structured so an audit is **possible**: explicit boundaries, schema validation, audit logs, named consent categories, keyed-hash tokenisation, cleanly separated services. An auditor evaluating Medora has artefacts to evaluate. An auditor evaluating an AI-bolted webapp doesn't.

### K4. "Pick one thing in this entire project you would defend with your career."

The AI boundary (Fig. 3.4 + the eqs. in §4.5.1). It's the load-bearing safety architecture that justifies the *AI-native* claim, it's the technically novel composition we don't see in the surveyed literature, and it's the pattern we believe transfers beyond healthcare to legal-tech, education-credentialing, and digital-government workflows. Everything else in this project — the booking algorithm, the OCR pipeline, the analytics — is engineering excellence we'd defend with a smile. The AI boundary is the part we'd defend with the career.

---

## Section L. The "trick" questions

### L1. "Your abstract says 10.5 s OCR; your results table says 3.5 s. Which is true?"

Both. The abstract reports a conservative end-to-end estimate including upload + queueing + post-processing for the user-visible perception — that's the wall-clock under normal conditions. The 3.5 s in Table 4.2 is the per-document model time *inside* the OCR microservice. Different scopes, both honest. We could tighten the abstract to clarify the scope.

### L2. "If Medora is so safe, why is OCR confidence aggregated as α·β·γ instead of taking a min?"

A min would be too conservative — a single low-confidence stage would block correct extractions where the other two stages agree strongly. The convex combination lets stages compensate while still surfacing low overall confidence to the review UI. The constraint α + β + γ = 1 keeps the score in [0, 1] and interpretable. If a reviewer wants a more conservative variant, replacing α-β-γ with min is a one-line change in the matcher — the surrounding architecture doesn't need to change.

### L3. "You list β > 0 in the specialty softmax. Did you tune β?"

Yes — qualitatively. Larger β separates a clear best specialty from competitors; smaller β flattens. We picked a moderate β (mid-single-digit range) that produces decisive distributions on clear queries ("my chest hurts when I climb stairs" → cardiology dominates) and softer distributions on ambiguous ones ("I feel tired all the time"). The exact value is configuration; the property is calibration, not a magic number.

### L4. "You used three datasets but only one for OCR. Isn't that biased?"

The three datasets are deliberately scoped to different evaluation questions (§4.4): synthetic scheduling for **transactional correctness**, the OCR corpus for **field accuracy**, the medicine catalog for **search-quality support inside OCR matching**. There's no need for a second OCR dataset because the first one already characterises the question we're answering. A larger or more diverse OCR corpus is future work, and we say so.

### L5. "Why is the report 79 pages?"

Because it documents architecture, methodology, formulas, results, ethics, complex-engineering-attribute mappings (K1–K8, P1–P7, A1–A5) and a notation appendix. The report is exactly as long as the project requires under the CSE-3200 template — and shorter than it would be without the appendix consolidation of math symbols. We didn't pad; we documented.

---

## Final calibration: how to *handle* a strict professor

1. **Concrete > abstract.** Cite a section number or a figure when you can.
2. **Acknowledge limits before they're pulled out of you.** If you hit one of the §7.2 limitations, say so in the same breath as the answer.
3. **Translate every formula into one sentence of intent.** "argmax means we pick the best." "1 − F̃ means lower fees rank higher." "F(x, Π_u) means we drop categories the patient hasn't consented to."
4. **Don't invent numbers.** If you don't remember, say "the report has it in §4.5.3" and reach for it.
5. **The AI boundary is your strongest claim — return to it when in doubt.** Whatever the question, if it touches AI, the answer is somewhere inside Fig. 3.4 and §4.5.1.
6. **Two-line answers first; expand if asked.** Hostile reviewers cut you off if you ramble.
7. **It's okay to say "we don't, and here's why."** Honest scope is more credible than overclaiming.
