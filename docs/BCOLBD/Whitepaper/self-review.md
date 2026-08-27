# Adversarial self-review

This review applies the `research-paper-writing` rejection-risk checklist to the
BCOLBD whitepaper. The status vocabulary is intentionally strict: **Pass**,
**Needs revision**, or **Needs new experiment**.

## Post-whitepaper implementation addendum (updated 27 Aug 2026)

The compiled competition whitepaper remains a point-in-time artifact. Since that review,
Arohon, Akkhor's versioned API, Lokkhon v0.1, the Shimana reporter/sweep, the learned-PHI
build and runtime gate, the Maya admission harness, and the stewardship thin slice have
landed in the repository. Status changes below distinguish code/harness completion from an
experimental result. A controlled MuRIL bundle is now measured: on the small 36-span novel-name
probe, model recall is 0.972 and the rules-plus-model union reaches 1.000 recall and precision with
0.000 over-redaction. Admission v1.1 binds the external ONNX weights as well as the graph and
metadata. The repository still lacks the registered XLM-R control and auditable per-seed training
records. Maya base-versus-tuned responses still do not exist, and no Maya result is inferred.
Shimana did run, but its binary utility is non-monotone and its archived sweep lacks per-patient
rows for the promised paired analysis. The MuRIL bundle is now measured, not shipped or deployed.

## Review-triggered revisions

- Replaced the abstract's ambiguous “four artifacts build on” phrasing with a
  single framework-level claim.
- Restricted Shimana's unrestricted comparator to an offline, de-identified
  research control.
- Added redistributability, de-identification, licensing, and ethics gates to
  the Maya tuning protocol.
- Rewrote the conclusion to restate the strongest measured evidence, name the
  evaluation-scale limitation, and end with concrete next experiments.
- Replaced the mismatched landscape inset in the interface figure with a second
  mobile workflow, aligning form factors and removing the visible dead area.
- Simplified crowded tables and diagrams until the compiled PDF had no
  horizontal overflow or unresolved references.
- Replaced the binary built/planned visual language with explicit **deployed**,
  **measured**, **specified**, and **planned** labels in every artifact node.
- Replaced the “13 of 19 deterministic” AI-depth headline with a task-level
  inventory covering model, data, training/inference, status, evaluation, and
  safety boundary.
- Added the planned learned-PHI build without implying a corpus, model, or
  result exists; restricted non-commercial BanglaBERT to research comparison.
- Converted Maya from a loosely framed ablation into a pass/fail deployment
  admission gate and stated that its corpus and adapter do not yet exist.
- Kept Akkhor open and unmonetised, marked all subscription prices as hypotheses,
  and replaced token-only cost with a deployment-aligned planning envelope that
  leaves support labour explicitly unresolved.
- Added the deployed 21-endpoint inventory and booking contention timings as
  separate evidence claims, without implying that every AI endpoint was load-tested.
- Added the fixed Chorui registry cardinality and the archived v1.0.2 release gates,
  while excluding approximate full-report latency and withdrawn OCR figures.
- Dated the 69.4% medicine-spending figure to the 2015 national accounts and
  replaced the unusual WHO multimodal-model URL with its canonical item page.
- Added the stewardship layer (scoped multi-tier administration) to the architecture
  section as Specified over the deployed flat-admin role, with a matching risk-register
  row and claim-evidence entries; it is not presented as deployed and adds no sixth artifact.
- Added a sourced adjacent-sector note (2026 Cabinet Division and Bangladesh Bank AI-data
  cautions) to the distribution section as demand signal, not as a Medora result.
- Strengthened Revenue & Distribution: four explicit service streams that keep Akkhor free
  (open core), a conservative TAM/SAM/SOM (Statista US$849.3m by 2029; BMDC 134,568 physicians),
  and a phased distribution plan gated on measured evidence. Prices remain labelled hypotheses.
- Extended the rule redactor to cover the leaking classes (names, obfuscated emails, textual
  dates, bare IDs, addresses). Reported honestly: 134-case closure is a DEVELOPMENT figure
  (rules tuned on that set); a held-out probe shows cued/structured classes generalise and the
  residual is unlabelled unseen names, which motivates the learned NER. No inflated recall
  number is claimed. Over-redaction fell to 2.4% and the benchmark gate stays green.

## 1. Contribution

| Question | Status | Evidence or required action |
|---|---|---|
| What new knowledge does the paper give? | Pass | It frames model authority, consent scope, and disclosure cost as separate testable objects and composes Arohon, Lokkhon, Shimana, Maya, and Akkhor around one policy chokepoint. |
| Is the failure case meaningful? | Pass | Disclosure, emergency false negatives, unsupported source references, and non-authoritative writes are consequential clinical-AI failure modes. |
| Is the idea non-obvious beyond common practice? | Pass | The novelty is the executable composition and conformance plan, not any single familiar safeguard. The paper avoids claiming that consent or redaction alone is novel. |
| Is there a surprising empirical gain? | Needs new experiment | The MuRIL union closes all 36 spans in the small synthetic novel-name probe, but no SOTA claim follows from that population. XLM-R and per-seed comparisons remain absent; Maya still needs its out-of-band run. |
| Is a novelty type clear? | Pass | New framework/design task, Bangladesh medicine identity artifact, consent--utility protocol, and reassurance-drift ablation. |

## 2. Writing clarity

| Question | Status | Evidence or required action |
|---|---|---|
| Can a knowledgeable reader reproduce the method? | Pass for shipped code; comparative runs pending | Shimana and Lokkhon ship frozen outputs. PHI admission v1.1 binds the controlled MuRIL artifact and regenerated report; the repository does not ship the weights or per-seed checkpoints. Maya ships a hashed protocol and blank prompt sheet, but no responses. |
| Is each module technically specified? | Pass | Each named artifact has a purpose, mechanism, measurement boundary, and one of four explicit statuses. The AI inventory separately exposes task, model, data, train/infer, evaluation, and authority boundary. |
| Is every module motivated? | Pass | Arohon addresses authority, Lokkhon failure evidence, Shimana disclosure cost, Maya domain-fluency risk, and Akkhor local drug identity. |
| Are terms consistent? | Pass | Latin-first artifact names, Arohon levels, Lokkhon axes, Shimana configurations, and deployed/measured/specified/planned terminology are stable across prose and figures. |
| Does each paragraph carry one message? | Pass | Topic sentences were retained as a reverse-outline device; the outline records every paragraph role. |

## 3. Experimental strength

| Question | Status | Evidence or required action |
|---|---|---|
| Are improvements over strong baselines meaningful? | Needs new experiment | On the same 36-span probe, MuRIL improves model recall over rules from 0.750 to 0.972 and the union reaches 1.000. The sample is too small for a broad gain claim, XLM-R is missing, Shimana lacks paired rows, and Maya remains unrun. |
| Is absolute performance sufficient? | Needs new experiment | The admitted union passes its registered mechanical thresholds on 36 synthetic spans, but intervals and script subsets are small. Larger independently reviewed Bengali/Banglish populations are required; OCR accuracy remains withdrawn. |
| Are gains consistent across settings? | Needs new experiment | Existing fixtures are small and constructed. Larger bilingual, code-mixed, and independently adjudicated sets are required. |
| Are strengths and failures reported? | Pass | Sample sizes accompany metrics; 43 redaction limitations, five emergency false positives, four code-mix cases, and the OCR negative result are explicit. |

## 4. Evaluation completeness

| Question | Status | Evidence or required action |
|---|---|---|
| Are key ablations included? | Needs new experiment | PHI rules/model/union rows are now measured on identical cases, but XLM-R and the research-only BanglaBERT comparator remain unrun. Shimana lacks paired rows and Maya still needs base-versus-LoRA responses. |
| Are strong baselines fair and current? | Needs new experiment | PHI rules and MuRIL share identical fixtures, but the registered XLM-R control is absent. The systems table remains a scope comparison, not a performance benchmark, and Maya responses must use identical decoding. |
| Are metrics sufficient? | Pass for protocol | Privacy span precision/recall, emergency FN/FP, source accounting, risk--coverage, medicine precision, paired CIs, and Pareto reporting cover the stated containment questions. |
| Are scenarios challenging enough? | Needs new experiment | Thirty navigation fixtures, 134 privacy cases, and four code-mix cases do not establish population-level safety. |
| Are protocols documented? | Pass at whitepaper level | Interventions, primary outcomes, failure accounting, mock/live separation, seeds, confidence intervals, licensing gates, and non-dominated reporting are specified. Execution manifests remain future artifacts. |

## 5. Method-design soundness

| Question | Status | Evidence or required action |
|---|---|---|
| Is the setting realistic? | Pass with scope boundary | Current paths execute in the deployed PWA/API/database stack; unrestricted Shimana evaluation is offline and de-identified. |
| Are hidden defects or assumptions exposed? | Pass | Redaction recall, no silent cloud fallback, consent non-retroactivity, OCR failure, reviewer capacity, and provider retention remain visible. |
| Does the method avoid per-case tuning? | Pass for design | Authority follows declared risk class and registry configuration rather than model confidence or prompt-specific thresholds. |
| Do benefits outweigh complexity? | Pass for proposal | Learned perception/drafting is separated from deterministic authority, but the paper does not infer safety from component counts. Cost, licensing, and staffing remain explicit residual risks. |
| Could net benefit be negative? | Needs new experiment | Clinician adoption, alert burden, consent friction, reassurance drift, and staffed support cost require measured evidence before scale-up. Subscription prices are not treated as validation. |

## Submission decision

**Pass as an evidence-bounded competition whitepaper, not as a completed empirical
research paper.** No unsupported result remains in the abstract. The highest reject risks
are still evaluation scale, absent PHI comparative/per-seed evidence, absent Maya responses,
unvalidated clinician adoption, and unpriced support labour. Those gaps are named in the
risk register and roadmap rather than hidden behind stronger wording.
