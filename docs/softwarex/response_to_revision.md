# Draft point-by-point response to SoftwareX reviewers

This is a working revision record, not a final submission letter. A row marked
Implemented names a completed repository/manuscript change. A row marked Pending evidence
needs a frozen run, data audit, or independent review. A row marked External decision needs
an authorized human or publication service. No row should be presented as closed until the
replacement immutable release is published.

The revised manuscript now uses the actual teacher-revised Overleaf submission as its
narrative baseline. Both working TeX sources agree; the submitted original is preserved
under `submission-history/`. The four-author list, CRediT roles, deployment information,
patient/clinician workflows and research reuse discussion are retained.

## Reviewer 1

| ID | Response and evidence | Status |
| --- | --- | --- |
| R1-01 | The release gate now reads archived metadata and an evidence-manifest hash inventory, comparing version, commit, and DOI to the release record. It exposes the existing v1.0.2 archive inconsistency rather than masking it. A consistent replacement archive is still required. | External decision |
| R1-02 | The manuscript now labels unmeasured endpoint groups as capability only and explicitly disclaims their accuracy or content validity; no task score is inferred from contract tests. | Addressed by narrowing the claims; no additional endpoint evaluation is claimed |
| R1-03 | The manuscript and threat model identify 23/94 misses in the frozen v1.0.2 report, name residual identifier types that may reach an authorized provider, and call the operation redaction/pseudonymisation rather than anonymisation. Later source changes are not presented as independently evaluated on the saturated fixture set. The optional expansion requested "if possible" is not claimed as completed; the 216-case candidate is excluded from validated performance evidence. | Limited fixture interpretation and residual-risk wording implemented; expanded bilingual evaluation is optional for these limited claims, not a mandatory two-reviewer gate; final editorial assessment remains |
| R1-04 | The generated tables separate the deterministic emergency screen from recorded-provider/mock specialty outcomes and report TP=7, FN=0, FP=5, TN=18 with sensitivity, specificity, PPV, and NPV plus two-sided Wilson 95% fixture intervals. The manuscript calls the 30-case, one-reviewer sample preliminary software validation, using the reviewer's expressly permitted limited-scope route. | Statistical reporting and preliminary-fixture qualification implemented; an additional clinical reviewer/larger set is optional for these limited claims, not a mandatory gate; final editorial assessment remains |
| R1-05 | A new non-overwriting, versioned rebuild now links all 46,614 emitted rows to hashed source files and 72,969 original contributor records, with per-field transformations, deterministic deduplication, conflict quarantine and change reports. It omits inferred/Indian indication prose. The historical 71,795-row runtime snapshot remains separately identified; its missing original lineage is not invented. A 30-case descriptive clinician spot-check tool/packet is ready. The author selects multi-source publication after documenting source permissions. | Automated rebuild/linkage/seed checks completed; actual prior doctor-review scope or new spot-check results, source permissions and final corpus promotion remain human-gated; no national completeness/currentness claim |
| R1-06 | YOLO26s architecture, seven labels, input/output schema, author-reported v2 origin/split/preprocessing and observed checkpoint parameters are documented. PT 8.4.21 agrees with notebook settings; all 204 matched named ONNX parameter tensors agree exactly after fusion, despite ONNX export metadata 8.4.19. Historical dataset/date/metric discrepancies and nonmatching raw top-k rows are disclosed; no accuracy/full-equivalence claim is made. Output-free recipe, PT/ONNX and AGPL/corresponding-source bundle are prepared under the recorded author/institution weight-release decision. | Experimental-pipeline documentation and current-artifact verification completed; final immutable packaging remains, not private-image publication or mandatory new accuracy evaluation |
| R1-07 | Dashboard/API now show stored-record coverage and group status, not a clinical score, AI advice or reminder-derived adherence. Formula, inputs, finite-value/UTC-window rules and readable date/snapshot labels are exposed in both locales. Matching authentic English/Bengali frontend views replace Figure 4, retaining navigation, dashboard heading and both feature panels; separate open-disclosure captures are archived. The consenting author account header is visible, while unrelated records remain outside the frame. Capture receipt is archived. | UI/API and authentic Figure 4 replacements implemented and inspected in the compiled PDF; final submission approval remains |
| R1-08 | docs/THREAT_MODEL.md now records assets, boundaries, controls, residual risks, and unverified deployment responsibilities. | Implemented; deployment verification remains pending |
| R1-09 | Authors report friend/family research-use consent, not image redistribution. Their stated author/institution decision permits derived-weight distribution and is recorded without inventing an ethics-committee reference. Raw images, private exports, consent forms and notebook imagery stay private. Public Roboflow attribution and the model's AGPL/corresponding-source distribution route are documented. | Author-supplied scope/decision recorded; no public prescription-image upload task; authors verify the final ethics wording matches their actual determination |
| R1-10 | The manuscript and docs/INTEROPERABILITY.md state the private JSON/REST boundary, export limitation, and absence of FHIR/IHE conformance. Related work now includes recent clinical summarization, clinician-AI workflow, Bengali medical NLP, clinical text privacy, and prompt-injection studies. | Manuscript/document changes implemented; final bibliography/layout check remains |
| R1-11 | The booking protocol was rerun with 30 independent trials at 2/10/50 simultaneous attempts after a per-level warm-up. The archived JSON records Windows 11 host/kernel/build, CPU/RAM, Python 3.13.14, Docker and PostgreSQL 16.15, database settings, client/app/database locality, monotonic request timer and event-timestamp definitions, source commit/dirty state, raw latencies, and correctness assertions. The manuscript limits interpretation to in-process ASGI/PostgreSQL component timing. A clean immutable-release rerun remains pending. | Host-run evidence recorded; final release-bound run pending |
| R1-12 | AI-native was replaced with assistive-AI terminology in the manuscript. | Implemented |
| R1-13 | The generated safety summary now uses conventional measurements and explicitly says fixture assertions do not establish correctness. | Implemented |
| R1-14 | Redaction, pseudonymisation, residual risk, prospective revocation, and clinical-validation limits were harmonised in the manuscript and governance docs. | Implemented; final global release audit pending |
| R1-15 | The provider manifest identifies the archived configurations and the manuscript now states that other configured adapters are not evaluated. The manifest still needs binding to the replacement release commit and final evidence. | Scope clarification implemented; final release binding remains |
| R1-16 | The figures have been rebuilt at journal widths and inspected in the compiled PDF. Figure 4 uses authentic bilingual frontend views with navigation and both feature panels; existing consent and assistant panels retain their wider interface context. | Layout/readability pass implemented; final author approval remains |

## Reviewer 2

| ID | Response and evidence | Status |
| --- | --- | --- |
| R2-00 | Figures 4–6 were inspected in the compiled teacher-first revision; screenshot legibility is coupled to R1-16. | Layout/readability pass implemented; final author approval remains |
| R2-01 | The manuscript and interoperability document provide bounded GDPR, MDR, and German AMG applicability text, explicitly without compliance or legal-advice claims. | Implemented; legal review remains optional/external |
| R2-02 | The Wallace et al. reference now includes DOI 10.1038/s41746-022-00667-w. | Implemented |
| R2-03 | docs/INTEROPERABILITY.md documents purpose/provider/scope/versioned grants, enforcement, denial, revocation, and post-disclosure limitation. | Implemented |
| R2-04 | The same document traces the patient sharing decision to stored fields, policy check, payload authorization, and patient-visible receipt, with a non-production JSON example. | Implemented |
| R2-05 | The manuscript and document map the local grant conceptually to FHIR Consent and state the IHE PCF/FHIR non-conformance boundary. | Implemented; adapter/conformance testing is not claimed |

## Reviewer 3

| ID | Response and evidence | Status |
| --- | --- | --- |
| R3-01 | The paper explicitly narrows the measured contribution to the fixture-backed behaviors, labels unmeasured groups as capabilities, and disclaims clinical/content-performance evidence for them. | Addressed by claim narrowing |
| R3-02 | A headless Code Ocean entry point, setup instructions, pinned direct requirements, output hashes, and table renderer are prepared. The capsule runs current boundary tests and regenerates tables from frozen reports; it does not rescore the development privacy fixtures or rerun host-specific booking timings. | Repository preparation implemented; authors must create/run/publish the capsule, and independent reevaluation remains a separate evidence decision |
| R3-03 | Privacy recall and the emergency screen include denominator-specific two-sided Wilson 95% intervals; the emergency table reports the full confusion matrix and derived rates. Booking reports sample counts and descriptive nearest-rank p50/p95/p99 for request-through-commit and outbox propagation separately. Its JSON includes 95% percentile cluster-bootstrap intervals resampling the 30 independent fresh-slot trials (fixed seed; simultaneous requests remain clustered), plus every raw observation and environment detail. No deployed-capacity inference is made. A clean immutable-release rerun remains pending. | Fixture uncertainty and host-run booking summaries recorded; final release-bound run pending |
| R3-04 | Residual provider disclosure is now stated plainly in the abstract, software description, evaluation, and threat model. | Implemented |
| R3-05 | Global safety wording was replaced with control-specific claims, and navigation fixtures are not presented as clinical triage validation. | Implemented |
| R3-06 | No controlled LLM-only/deterministic-only/hybrid ablation is claimed. The paper now says consent, redaction, route allowlisting, and schema checks are authorization/validation invariants, not comparative performance components. | Limitation and rationale stated; no ablation result is claimed |
| R3-07 | The Motivation section now cites and distinguishes clinical summarization, clinician-AI workflow evaluation, Bengali medical NLP, residual re-identification risk, and medical prompt-injection studies. Each citation has a DOI or stable article URL. | Manuscript writing implemented; final bibliography/layout check remains |
| R3-08 | The v2 build inventories five sources and uses four for attributed identity fields; every emitted row and original contributor field has been verified, with explicit conflict quarantine, excluded indication prose and change records. Authors report a qualified-doctor source review, whose actual scope needs a dated note; no current DGDA completeness/concordance is claimed. The selected multi-source release still needs its upstream permission records. | Documentation boundary implemented; audit and rights evidence pending |
| R3-09 | docs/REPRODUCING.md and docs/softwarex/CODE_OCEAN_CAPSULE.md give the Code Ocean path, commands, outputs, hashes, and explicit limits of table regeneration from frozen reports. The final capsule execution record is not yet available. | Preparation implemented; final Code Ocean run and clean-release execution remain |
| R3-10 | The manuscript was compacted while retaining the reviewer-requested caveats; the current gate count is below 3,000 words including captions. | Implemented |

## Current manuscript locations

These refer to the checked 21-page revision draft, not the eventual frozen submission.
Recheck them after inserting capsule/release metadata and approved corpus evidence.

| Review topics | Current location |
| --- | --- |
| Recent related work and system positioning | Section 1, pp. 2–4; Table 2 |
| Consent, database boundaries, FHIR/IHE and EU applicability | Section 2.1, pp. 4–5; Figures 1–2 |
| Historical corpus and attributed rebuild | Section 2.2, p. 6; Table 3; ethics, p. 18 |
| Endpoint scope and deterministic/model distinction | Section 2.2, pp. 6–10; Tables 4–5 |
| Privacy, navigation, summaries, booking and reproduction scope | Section 2.3, pp. 10–13; Tables 6–10 |
| Detector artifacts and experimental OCR scope | Section 2.3, p. 13; model card and verification reports |
| Record coverage and authentic interface figures | Section 3, pp. 13–17; Figures 4–6 on pp. 14–16 |
| Ethics, private images, clinician review and competing interest | Unnumbered statements, pp. 18–19 |

## Release blockers

The final response must be updated with page numbers, the Code Ocean capsule link, final
DOI/version, archive checksum, and links to frozen evidence. It cannot close items requiring
actual source permissions/review-scope records, author approval, the Code Ocean run, and
a consistent immutable release. The author-supplied weight-release decision and authentic
Figure 4 replacement are already recorded; private-image publication is not required.
