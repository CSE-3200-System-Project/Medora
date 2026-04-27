# Medora Defense Guide — 03. Mathematical Formulas & Notation

> Every equation in the report (§3.2.1, §4.5.1, Appendix A) explained in **what, why, where it lives in code, and how to defend it**. Use this when a reviewer points at a formula and asks "what is that, why βφ, why these weights?"

---

## 0. Reading conventions (Appendix A.2)

- All normalised scores live in **[0, 1]** — higher = better match / outcome.
- Weights are **non-negative and sum to one** (so the ranking score is interpretable as a convex combination).
- `W` = a finite observation window (e.g. last 7 or 30 days).
- `1[·]` = indicator (1 if true, 0 otherwise).
- `ε > 0` is a tiny stabiliser to prevent divide-by-zero in min-max normalisation.

If a reviewer asks **"why convex combination?"** → because then each weight is interpretable as "fraction of importance assigned to that signal", and the final score stays in [0, 1].

---

## 1. Specialty matching (§3.2.1)

```
k̂ = argmax_{k ∈ K}  φ(q, k)
```

- `q` = patient's free-text complaint ("chest pain after walking", "চোখে ব্যথা").
- `K` = the set of supported medical specialties (Cardiology, Dermatology, Gynaecology, ENT, ...).
- `φ(q, k)` = a semantic compatibility score (LLM-evaluated, schema-validated) between the query and specialty `k`.
- `k̂` = the chosen specialty.

### Why this form, not a classifier?
We don't have a labelled BD-specific specialty corpus large enough to train a supervised classifier, and clinical specialty taxonomies vary. Using an LLM to score `φ(q, k)` and then `argmax`ing over a *fixed* set lets us swap models without changing the contract.

### Confidence (softmax) — same φ, normalised

```
P(k | q) = exp(β · φ(q, k))  /  Σ_{k' ∈ K} exp(β · φ(q, k'))
c_search(q) = max_{k ∈ K} P(k | q)
```

- **β > 0** is a sharpness/temperature parameter. Larger β → top specialty dominates; smaller β → flatter distribution.
- `c_search(q)` is the **search-stage confidence** used by the UI: low confidence → broaden search or clarify; high confidence → commit to the resolved specialty.

### How to defend this
> Reviewer: "Why softmax over the LLM scores instead of trusting the model's own confidence?"
> Answer: We don't trust per-token logprobs from external providers because they aren't comparable across vendors. Computing `P(k|q)` over a *fixed candidate set* with a calibrated β gives us a vendor-stable confidence we can threshold deterministically.

---

## 2. Doctor ranking (§3.2.1, §4.5.1)

```
R(d) = w_e · Ẽ(d) + w_f · (1 − F̃(d)) + w_ℓ · (1 − Δ̃(d, ℓ)) + w_r · Q̃(d)
       w_e + w_f + w_ℓ + w_r = 1
```

| Term | Meaning | Why "1 −" or not |
| --- | --- | --- |
| `Ẽ(d)` | Min-max normalised **years of experience** | More experience preferred → use directly |
| `(1 − F̃(d))` | Min-max normalised **consultation fee** | Lower fee preferred → invert |
| `(1 − Δ̃(d, ℓ))` | Min-max normalised **patient-to-doctor distance** | Closer is better → invert |
| `Q̃(d)` | Min-max normalised **review-based reputation** | Higher rating preferred → use directly |

- `d` ∈ `D_k̂` (verified doctors of the resolved specialty).
- `ℓ` is the patient's location context (when shared).
- `d* = argmax_{d ∈ D_k̂} R(d)`.

### Min-max normalisation (Appendix A)

```
Z̃(d) = (Z(d) − Z_min)  /  (Z_max − Z_min + ε)        where Z ∈ {E, F, Δ, Q}
```

`ε > 0` so an all-equal column doesn't blow up. Same shape applied independently to each feature so units don't have to be commensurate.

### How to defend this
> Reviewer: "Why a linear combination, not a learned ranker?"
> Answer: We chose interpretability over marginal accuracy. Each weight is documented and tunable; a clinician or admin can audit *why* a doctor was ranked first. A learned ranker would need labelled BD-specific click data we don't have, and it would risk reinforcing existing access bias.

> Reviewer: "Where do these weights come from, and what are their values?"
> Answer: They are configuration, not code. The default emphasises proximity and reputation in the BD context. The contract guarantees `Σ w = 1` so the score stays interpretable as a fractional weighting.

---

## 3. Consent pruning, sanitisation, and pseudonymisation (§4.5.1)

This is the **PII guard** — every external AI call passes through it.

### 3.1 Consent pruning

```
F(x, Π_u) = { (k_i, v_i) ∈ x : cat(k_i) ∈ Π_u }
```

- `x = {(k_i, v_i)}_{i=1..n}` — the structured context the application would *like* to send.
- `Π_u` — the **active sharing preferences** for user `u`.
- `cat(k_i)` — the category of field `k_i` (e.g. `medications`, `lab_reports`, `family_history`).

So `F(x, Π_u)` keeps only the fields whose category the user has consented to share.

### 3.2 Sanitisation operator

```
S(k_i, v_i) = (k_i, [redacted-τ(k_i)])     if k_i ∈ K_PII
S(k_i, v_i) = (k_i, ρ(v_i))                 otherwise
```

- `K_PII` = forbidden field names (name, email, phone, NID, address, DOB).
- `τ(k_i)` = the type label substituted for the redacted value (so the model sees "name redacted" instead of the value).
- `ρ(·)` = regex scrubber that catches lingering PII patterns inside non-PII fields (e.g. a phone number embedded in a free-text note).

### 3.3 Pseudonymous tokenisation

```
T_v(z) = [ anon : v : trunc_ℓ ( H_{K_v}(z) ) ]
```

- `v` = a namespace (e.g. `patient`, `doctor`, `report`).
- `H_{K_v}(·)` = a **keyed cryptographic hash** with a secret known only to the Medora backend.
- `trunc_ℓ(·)` = truncate to `ℓ` characters to keep token size small.

The provider sees `[anon:patient:9f3a...]` instead of any real identifier.

### 3.4 Outbound payload

```
q_out = P( S( F(x, Π_u) ) )
```

- `P(·)` = the prompt-construction function (templating + schema injection).
- Outbound payload is, in order: consent-filtered → PII-stripped → hash-keyed → wrapped into a prompt.

### 3.5 Full validated round-trip

```
x  ──F_{Π_u}──►  x^(c)  ──S──►  x^(s)  ──P──►  q_out  ──provider API──►  r  ──V──►  r̂
```

- `r` = raw provider response.
- `V(·)` = Pydantic schema validator. **Only `r̂` is allowed** to flow into application logic or the AI interaction log.

### How to defend this
> Reviewer: "Isn't HTTPS to the provider enough?"
> Answer: HTTPS protects the wire; it doesn't protect against the provider logging your prompts. PII-stripping + keyed hashing means even if the provider stores everything, they can't link records back to a real patient. Consent pruning means we only ship categories the patient has authorised to leave the perimeter.

> Reviewer: "Why not full homomorphic encryption / TEEs?"
> Answer: Cost-benefit. Full FHE is impractical for general LLM inference today. Anonymisation + categorical consent + provider rotation gives us most of the privacy gain at a fraction of the operational cost, and the Pydantic validation step catches schema deviations regardless of vendor.

---

## 4. OCR post-processing (§4.5.1, Appendix A.3)

### 4.1 Dosage pattern grammar

```
P = { 1+0+0,  0+1+0,  0+0+1,
      1+1+0,  1+0+1,  0+1+1,
      1+1+1 }
```

Each token is `morning + afternoon + evening`. Seven valid clinically-meaningful patterns. (Anything else is OCR noise.)

### 4.2 Normalisation

```
N(x_f) = normalise separators and glyph confusions
         (− , | , .  ↦  +)
         (l, I, |     ↦  1)
         (O           ↦  0)
```

Why? Because handwritten Bangladeshi prescriptions use mixed separators (`-`, `|`, `.`, `+`) and OCR confuses similar glyphs. Normalising up front lets us compare with edit distance against the canonical grammar.

### 4.3 Pattern correction

```
p̂ = argmin_{p ∈ P}  d_L( N(x_f), p )
```

`d_L` = **Levenshtein edit distance** over the normalised token. We snap to the nearest valid clinical pattern.

### 4.4 Daily intake count

```
f(p̂) = Σ_{i=1..3} p̂_i
```

Sum of the three slots — gives the doses-per-day used downstream by reminders.

### 4.5 Quantity / duration parser

```
D(x_q) = n · κ(u),       κ(day) = 1, κ(week) = 7, κ(month) = 30
```

- `x_q` = raw "10 days", "2 weeks", "ten days", "ek mash" (Bangla).
- Numeral normalisation maps Bangla digits and English/Bangla number words → integer `n`.
- `u` ∈ {day, week, month}; default = day if a bare integer is detected.
- `D(x_q)` = canonical duration in days.

### 4.6 Medicine name matching

```
ψ(x) = lowercase + character cleanup of x
m*   = argmax_{m ∈ M}  s( ψ(x_m), ψ(m) )
accept iff  s( ψ(x_m), ψ(m*) ) ≥ τ_m       with τ_m = 0.7
```

`s ∈ [0, 1]` is the **RapidFuzz** similarity score over normalised strings.

### 4.7 Piecewise name similarity (the "tiered" matcher)

```
s_name(x_m, m) = 1.0                           if ψ(x_m) = ψ(m)
              = 0.9                           if ψ(x_m) ⊆ ψ(m) or ψ(m) ⊆ ψ(x_m)
              = RF( ψ(x_m), ψ(m) )            otherwise
```

So **exact** = 1.0, **substring** = 0.9, **fallback** = RapidFuzz ratio. This makes the matcher robust to "Napa" matching "Napa Extra" or "Napa Extend" without over-rewarding partials.

### 4.8 Brand vs generic matching

```
s_med(x_m, m) = max( s_name(x_m, b(m)),  s_name(x_m, g(m)) )
m* = argmax_{m ∈ M} s_med(x_m, m)
```

Each catalog entry has a brand alias `b(m)` and a generic alias `g(m)`. We score against both and take the better. This avoids forcing patients to write generic names.

### 4.9 Composite advisory confidence

```
C_ocr(z) = α · c̄_y(r) + β · c̄_o(z) + γ · s_med(x_m, m*)
           α + β + γ = 1
z = (r, x_m, x_f, x_q)
```

- `c̄_y(r)` = aggregate **YOLO detector** confidence for crop `r`.
- `c̄_o(z)` = aggregate **OCR engine** confidence over the contributing tokens.
- `s_med(·)` = **catalog-match** confidence.
- `α, β, γ` are non-negative and sum to 1.

This single number is what the **review UI** uses to decide whether to flag a field for clinician review.

### How to defend this
> Reviewer: "Why edit distance, why 0.7, why three confidences?"
> Answer:
> - Edit distance because clinical Rx errors are character-level (digit/glyph confusion, separator swaps), not semantic.
> - 0.7 because below it, false matches dominate in our 100-image evaluation set; we tuned this against the labelled corpus.
> - Three confidences because failure modes are different at each stage: bad crop, bad text, bad catalog match. Combining them lets the reviewer see *which* stage is uncertain.

---

## 5. Adherence analytics (§4.5.1)

### 5.1 Daily adherence ratio

```
a_t = ( n_t^taken + λ · n_t^partial )  /  max( 1, n_t^sched )       with 0 ≤ λ ≤ 1
```

- `n_t^sched` = doses scheduled on day `t`.
- `n_t^taken` = doses fully taken.
- `n_t^partial` = doses partially taken.
- `λ` = partial-completion discount factor.
- `max(1, n_t^sched)` ensures a 0-scheduled day doesn't divide by 0 (returns 0 / 1 = 0).

### 5.2 Windowed adherence score

```
H_W = 100 · (1/|W|) · Σ_{t ∈ W} a_t
```

A percentage averaged over a window `W` (typically 7 or 30 days) — the headline number on the patient analytics page.

### 5.3 Perfect-day count

```
P_W = Σ_{t ∈ W}  1[ a_t = 1 ]
```

Number of days in the window where adherence was 100%.

### 5.4 Current streak

```
S_t = S_{t-1} + 1   if a_t = 1
    = 0             otherwise
```

Consecutive perfect-adherence days up to day `t`.

### 5.5 Missed-dose trend

```
M_t = n_t^sched − n_t^taken
```

Daily count for the trend chart.

### How to defend this
> Reviewer: "Why isn't this a clinical risk score?"
> Answer: Because we explicitly **don't claim diagnostic capability** (Appendix A.6). These are **operational signals about reminder compliance** — actionable for self-monitoring and follow-up, not for triage. The report calls them "adherence analytics", not "health risk score".

---

## 6. Future-ready health-trend score (§4.5.1, Table A.6)

These exist as **future extensions**, not as deployed dashboards. State that explicitly when asked.

### 6.1 Per-metric deviation

```
δ_j(t) = 0                                                if L_j ≤ v_{j,t} ≤ U_j
       = min(|v_{j,t} − L_j|, |v_{j,t} − U_j|)  /  σ_j     otherwise
```

- `j` = metric type (weight, glucose, BP, ...).
- `v_{j,t}` = reading at time `t`.
- `[L_j, U_j]` = clinician-defined acceptable band.
- `σ_j` = scale parameter for metric `j`.

### 6.2 Composite trend score

```
G_W = 100 · max( 0,  1 − Σ_{j ∈ J} ω_j · δ̄_j(W) )
δ̄_j(W) = (1/|W_j|) · Σ_{t ∈ W_j} δ_j(t)
Σ_{j} ω_j = 1
```

A clinician-weighted, rule-based out-of-band penalty composited into one [0, 100] number. **Implemented in the data layer (`/health-metrics`), not in the deployed dashboard.** Stated as future work.

---

## 7. The "what's the math?" 60-second pitch

If a reviewer says "summarise the math", reply:

> "Five families. (1) An argmax-over-LLM-scores specialty resolver with a softmax confidence. (2) An interpretable convex-combination doctor ranker over min-max normalised features. (3) A consent-pruning, PII-redacting, keyed-hash pseudonymisation pipeline gating every external AI call. (4) A staged OCR post-processor: edit-distance dosage correction, unit-aware duration parsing, tiered fuzzy medicine matching, and a composite α-β-γ advisory confidence. (5) A reminder-driven adherence model with windowed score, perfect-day count, streak and missed-dose trend, plus a future-ready out-of-band health-trend score that's *deliberately not deployed* yet."

Then drill into whichever family they ask about.

---

## 8. Quick lookup — every symbol in one place

| Symbol | Where | Meaning |
| --- | --- | --- |
| `q`, `K`, `φ(q,k)`, `k̂`, `P(k|q)`, `c_search(q)`, `β` | §3.2.1 | Specialty matching + softmax confidence |
| `D_k̂`, `R(d)`, `Ẽ`, `F̃`, `Δ̃`, `Q̃`, `w_e, w_f, w_ℓ, w_r` | §3.2.1 | Doctor ranking |
| `Z̃(d) = (Z−Z_min)/(Z_max−Z_min+ε)` | §4.5.1 | Min-max normalisation |
| `Π_u`, `cat(k_i)`, `F(x, Π_u)` | §4.5.1 | Consent pruning |
| `K_PII`, `τ(k_i)`, `ρ(·)`, `S(k_i, v_i)` | §4.5.1 | Sanitisation |
| `H_{K_v}`, `trunc_ℓ`, `T_v(z)` | §4.5.1 | Pseudonymisation |
| `q_out = P(S(F(x, Π_u)))`, `V(·)`, `r̂` | §4.5.1 | Validated round-trip |
| `R, r_i, c_i, τ_y, τ_iou, IoU` | Table A.2 | YOLO detection |
| `x_f`, `P` (pattern set), `N(·)`, `d_L`, `p̂`, `f(p̂)` | §4.5.1 | Dosage parsing |
| `x_q`, `D(x_q)`, `κ(u)` | §4.5.1 | Duration parsing |
| `x_m`, `ψ(·)`, `s_name`, `b(m)`, `g(m)`, `s_med`, `τ_m=0.7`, `m*` | §4.5.1 | Medicine matching |
| `c̄_y(r)`, `c̄_o(z)`, `C_ocr(z)`, `α, β, γ` | §4.5.1 | OCR composite confidence |
| `n_t^sched, n_t^taken, n_t^partial, λ, a_t` | §4.5.1 | Daily adherence |
| `H_W, P_W, S_t, M_t` | §4.5.1 | Windowed adherence |
| `v_{j,t}, [L_j, U_j], σ_j, δ_j(t), δ̄_j(W), ω_j, G_W` | §4.5.1 | Health-trend (future) |

> Cross-reference: every symbol above also appears in **Appendix A** (Tables A.1–A.6) of the report, with practical interpretation. If a reviewer wants the canonical legend, point them there.
