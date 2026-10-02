# Point-by-point response to SoftwareX reviewers

Manuscript SOFTX-D-26-01036. This response is tied to GitHub release `v1.0.5`,
its Zenodo archive (version DOI <https://doi.org/10.5281/zenodo.23108532>) and the
Code Ocean capsule version <https://codeocean.com/capsule/7570240/tree/v3>, whose
reproducible run executed against the same source commit as the `v1.0.5` tag. The
exact commit, run ID and result-manifest hash are recorded in the archive's
`docs/softwarex/release_metadata.json` and in Table 1 of the manuscript; the published
ZIP's SHA-256 is recorded on the Zenodo record. The release supersedes v1.0.4, whose
automatically imported archive contained stale internal release metadata.

The revised manuscript retains the submitted paper's four-author list, CRediT roles,
deployment information, patient/clinician workflows and research reuse discussion.
Page numbers below refer to the 21-page revised manuscript PDF. The original
reviewer comments are paraphrased by topic in each response ID; the text and
limits of the response are stated explicitly for each point.

The principal limits of the revision are unchanged: no formal institutional
ethics review was obtained for the private prescription-image research; the
optional detector is not clinically validated; most assistive endpoint groups
have no task-level evaluation; and the full historical safety report was not
rerun on the published capsule. The response below identifies where the paper
narrows claims instead of claiming these studies were performed.

## Reviewer 1

| ID | Response and evidence | Status |
| --- | --- | --- |
| R1-01 | **Release identity.** The v1.0.4 archive was imported automatically from the raw Git tag and retained null DOI/commit fields, a `v1.0.4 candidate` Table 1 and a verification receipt for an earlier commit; we do not claim it satisfied this request. v1.0.5 replaces it. Its ZIP is built from the tagged commit by `tools/release/build_zenodo_deposit.py`, which injects the release version, Zenodo DOI, commit, Code Ocean capsule/run identifiers and a fresh nine-check verification receipt for that same commit, and refuses to build if any disagree. `tools/release/check_softwarex_release.py` compares the public Zenodo record, the downloaded ZIP's hash, the tagged source, the archive's internal metadata, the generated manuscript metadata and the capsule manifest. The capsule verifies only its named focused checks, not the whole suite; the full-suite receipt is the separate verification file. | Release gate applied to v1.0.5; see the submitted record for the verified identifiers |
| R1-02 | The manuscript now labels unmeasured endpoint groups as capability only and explicitly disclaims their accuracy or content validity; no task score is inferred from contract tests. | Addressed by narrowing the claims; no additional endpoint evaluation is claimed |
| R1-03 | **Privacy recall and residual exposure.** The manuscript reports 23 missed spans among 94 expected spans (75.5% recall) in the frozen synthetic suite and names the identifier types that may reach an authorized provider despite redaction. It calls this redaction and pseudonymisation, not anonymisation (pp. 10–12). The 216-case candidate was not accepted as independent validation; no new naturalistic bilingual privacy claim is made. | Risk disclosed; larger independent evaluation remains unperformed |
| R1-04 | **Navigation and emergency uncertainty.** Tables 7–8 (p. 11) separate deterministic emergency screening from recorded-provider/mock specialty outcomes. For 30 clinician-reviewed fixtures the screen has TP=7, FN=0, FP=5 and TN=18; the table reports sensitivity, specificity, PPV and NPV with two-sided Wilson 95% intervals. The seven positive cases and single reviewer cannot establish clinical triage performance. | Fixture statistics supplied; external clinical validation remains unperformed |
| R1-05 | Section 2.2 now identifies all five source roles, separates the historical deployed counts from the 44,226-row S4/S5 reconstruction, and specifies a versioned update procedure. The public rebuild records 45,135 contributor links, field changes and quarantines; the capsule run hash-verified its selected inputs and outputs. A physician reviewed approximately 100 targeted entries across four candidate sources on 29 September 2026; duplicates and missing strengths were noted. This is not a statistically representative audit, current-register comparison, or validation of completeness, obsolescence, strength, form and manufacturer fields. The manuscript explicitly limits use to identity lookup. | Provenance and update policy supplied; authoritative/currentness validation remains unperformed |
| R1-06 | **Detector reproducibility.** The manuscript and model card give the YOLO26s architecture, seven labels, inputs, reported split/preprocessing and available checkpoint settings. The capsule run checked 204 named PT/ONNX parameter correspondences; the raw predictions were not identical. Historical dataset/date/metric discrepancies and missing complete original training logs remain documented. The private prescription images and annotations are excluded; no fresh detector accuracy or full inference-equivalence claim is made (pp. 8–11). | Artifact diagnostics reproducible; original training and external accuracy study not fully reproducible |
| R1-07 | Dashboard/API now show stored-record coverage and group status, not a clinical score, AI advice or reminder-derived adherence. Formula, inputs, finite-value/UTC-window rules and readable date/snapshot labels are exposed in both locales. Matching authentic English/Bengali frontend views replace Figure 4, retaining navigation, dashboard heading and both feature panels; separate open-disclosure captures are archived. The consenting author account header is visible, while unrelated records remain outside the frame. Capture receipt is archived. | UI/API and authentic Figure 4 replacements implemented and inspected in the compiled PDF; final submission approval remains |
| R1-08 | docs/THREAT_MODEL.md now records assets, boundaries, controls, residual risks, and unverified deployment responsibilities. | Implemented; deployment verification remains the deployer's responsibility |
| R1-09 | **Prescription-image ethics and release scope.** The authors report verbal consent for research processing from friends and family, private Roboflow processing, and local storage of originals, with no image redistribution or upload to Colab/public Google Drive. No formal institutional ethics review, exemption or waiver was obtained. The paper says so on pp. 17–18 and excludes the original images, annotations and image-bearing notebooks. The derived detector weights remain publicly distributed under the recorded author/institution decision; that decision is not an ethics-board determination. | Factual disclosure and image exclusion completed; editor/institution may still require additional determination |
| R1-10 | The manuscript and `docs/INTEROPERABILITY.md` state the private JSON/REST boundary, export limitation, and absence of FHIR/IHE conformance. Related work now contrasts Medora with Discovery's patient-facing EHR exploration and the Standard Health Consent prototype, alongside clinical AI, Bengali NLP, privacy and prompt-injection studies. It locates the contribution in integration and containment, not novelty of the individual techniques. | Manuscript and document changes implemented; no interoperability conformance claimed |
| R1-11 | The historical booking protocol used 30 independent trials at 2/10/50 simultaneous attempts after per-level warm-up. Its archived JSON records the Windows host, CPU/RAM, Python, Docker, PostgreSQL, database settings, locality, timer definitions, raw latencies and correctness assertions. The manuscript limits interpretation to in-process ASGI/PostgreSQL component timing. Separately, the Code Ocean capsule run executed 90 fresh-slot trials against an isolated PostgreSQL 16 cluster from the frozen source commit. The Linux capsule results do not replace or claim timing equivalence with the historical Windows host. | Historical and source-bound capsule trials documented in the published release records |
| R1-12 | AI-native was replaced with assistive-AI terminology in the manuscript. | Implemented |
| R1-13 | The generated safety summary now uses conventional measurements and explicitly says fixture assertions do not establish correctness. | Implemented |
| R1-14 | Redaction, pseudonymisation, residual risk, prospective revocation, and clinical-validation limits were harmonised in the manuscript and governance docs. | Wording implemented; archive receipt limitation disclosed in R1-01 |
| R1-15 | The provider manifest identifies the archived configurations, and the manuscript states that other configured adapters are not evaluated. The capsule run is bound to the replacement source commit and records a deterministic mock provider; it does not replay live providers. | Scope and capsule binding documented; Zenodo archive published |
| R1-16 | **Figure readability.** Figure 4 (p. 14) now shows matching English/Bengali frontend captures, including navigation and the record-coverage panels. Figures 5–6 (pp. 15–16) show consent and assistant workflows. The full-screen captures still contain small interface text at printed A4 size; their captions and the adjacent prose state the controls and outcomes needed to follow the argument. | Layout improved; screenshot microtext remains a print-legibility limitation |

## Reviewer 2

| ID | Response and evidence | Status |
| --- | --- | --- |
| R2-00 | **Small screenshot text.** Figures 4–6 (pp. 14–16) were checked in the compiled 21-page PDF. The main panels and headings are readable at page scale; incidental interface text remains small. Captions and prose identify the relevant controls. | Main UI evidence readable; incidental text remains small |
| R2-01 | The manuscript and interoperability document provide bounded GDPR, MDR, and German AMG applicability text, explicitly without compliance or legal-advice claims. | Implemented; legal review remains optional/external |
| R2-02 | The Wallace et al. reference now includes DOI 10.1038/s41746-022-00667-w. | Implemented |
| R2-03 | docs/INTEROPERABILITY.md documents purpose/provider/scope/versioned grants, enforcement, denial, revocation, and post-disclosure limitation. | Implemented |
| R2-04 | Section 2.1 now gives a concrete human-to-machine example: a patient's selected recipient, purpose and record categories become a versioned, time-bounded local grant; unchecked categories are withheld and absent permission returns HTTP 403. `docs/INTEROPERABILITY.md` supplies a non-production JSON example. These are local terms, not FHIR-coded consent semantics. | Implemented at the local-contract level; standards conformance not claimed |
| R2-05 | The manuscript and document map the local grant conceptually to FHIR Consent and state the IHE PCF/FHIR non-conformance boundary. | Implemented; adapter/conformance testing is not claimed |

## Reviewer 3

| ID | Response and evidence | Status |
| --- | --- | --- |
| R3-01 | **Breadth of AI evaluation.** Table 5 (p. 9) distinguishes three fixture-backed groups from six groups listed only as implemented capabilities. The abstract and Evaluation avoid quantitative claims about the latter. No additional task-level evaluation of those six groups was performed. | Claims narrowed; broader quantitative evaluation remains unperformed |
| R3-02 | **Independent reproduction.** the Code Ocean capsule run verifies its source commit/tree, checks archived observations, scores current mock/rule safety, passes 26 focused tests, and reruns 90 fresh booking trials in isolated PostgreSQL 16. Selected medicine and detector checks execute. MuRIL/PHI inference, original detector training and live-provider calls are not rerun; their historical evidence is identified separately (pp. 9–13 and capsule manifest). | Focused source-bound reproduction supplied; historical model/provider experiments are not fully replayed |
| R3-03 | Privacy recall and the emergency screen include denominator-specific two-sided Wilson 95% intervals; the emergency table reports the full confusion matrix and derived rates. Historical booking results report sample counts and descriptive nearest-rank p50/p95/p99 for request-through-commit and outbox propagation separately, with 95% cluster-bootstrap intervals across the 30 independent fresh-slot trials. Raw observations and environment details are preserved. the Code Ocean capsule run adds 90 source-bound fresh-slot trials in its own result file. These environments are reported separately; no deployed-capacity or cross-host timing equivalence is inferred. | Fixture uncertainty and historical and capsule booking evidence recorded in the public v1.0.4 records |
| R3-04 | Residual provider disclosure is now stated plainly in the abstract, software description, evaluation, and threat model. | Implemented |
| R3-05 | Global safety wording was replaced with control-specific claims, and navigation fixtures are not presented as clinical triage validation. | Implemented |
| R3-06 | **Comparative baselines.** Table 11 (p. 13) compares privacy rules, MuRIL and their union on a development set and a separate synthetic probe. No controlled LLM-only/deterministic-only/full-hybrid ablation was performed. Consent, route allowlisting and schema checks are authorization/validation controls, so the paper does not claim a measured performance gain from their combination. | Component comparison supplied; requested full-system ablation remains unperformed |
| R3-07 | The Motivation section (pp. 2–4) cites and distinguishes patient-facing records, consent architecture, clinical AI, Bengali medical NLP, residual re-identification risk, and medical prompt-injection studies. Each citation has a DOI or stable article URL in the reference list (pp. 18–21). | Manuscript citations and layout checked |
| R3-08 | **Medicine-source provenance and validation.** Section 2.2 now names the roles of S1--S5, specifies S4/S5-only public reconstruction, normalization/quarantine, 44,226 rows and 45,135 source links, and a versioned update procedure. The capsule run checks selected inputs and outputs. The physician note covers about 100 targeted identity checks across four candidate sources and reports duplicate/missing-strength issues. It is not a stratified accuracy estimate, currency check or regulator validation. | Source lineage and targeted review supplied; authoritative/currentness validation remains unperformed |
| R3-09 | `docs/REPRODUCING.md` and `docs/softwarex/CODE_OCEAN_CAPSULE.md` give commands and the limits of frozen-table regeneration. The capsule run used the selected medicine and detector profiles, verified its packaged source commit/tree and wrote current-run outputs to `/results`; the safety baseline remains a frozen historical report. The v1.0.5 instructions and metadata name only the v1.0.5 release and its capsule version; the v1.0.4 text that mentioned older planned versions was corrected. | Instructions and versioning corrected in v1.0.5; verified by the release gate |
| R3-10 | Repetition across the Motivation, Evaluation, Impact and Conclusions was reduced while retaining the reviewer-requested limitations. The 21-page PDF has been checked for table separation, figure placement and readable body text. | Editorial pass implemented |

## Manuscript locations

Page numbers below refer to the 21-page manuscript PDF compiled from the updated local
TeX source. They must be rechecked after any new release DOI is inserted.

| Reviewer comments | Manuscript location | Printed pages |
| --- | --- | --- |
| R1-01 | Code metadata, Table 1 | 2 |
| R1-02, R1-12, R1-15, R3-01 | Abstract; endpoint scope and deterministic/model distinction, Tables 4–5 | 1, 8–10 |
| R1-03, R1-04, R1-13, R1-14, R3-04–06 | Privacy, emergency screen, navigation, summaries, and component evaluation, Sections 2.3 and Tables 6–12 | 10–13 |
| R1-05, R3-08 | Historical corpus and attributed rebuild, Section 2.2 and Table 3; ethics statement | 5–6, 17–18 |
| R1-06 | Detector architecture and evaluation, Table 4 and Section 2.3; model card and detector verification report | 8–11 |
| R1-07, R1-16, R2-00 | Record coverage and authentic interface views, Section 3 and Figures 4–6 | 13–16 |
| R1-08, R2-01, R2-03–05 | Trust boundaries, consent workflow, interoperability and regulatory scope, Section 2.1 and Figures 1–2 | 3–6 |
| R1-09 | Research ethics and image handling statement | 17–18 |
| R1-10, R2-02, R3-07 | Related work, Section 1 and Table 2; references | 2–4, 18–21 |
| R1-11, R3-02–03, R3-09 | Reproducibility and booking evaluation, Section 2.3 and Tables 6–12 | 10–13 |

## Completed evidence and reviewer-specific additions

R1-03, R3-01 and R3-06 now also receive the existing rules/MuRIL/union comparison
(Table 11), retaining all systems and both distinct populations. Development-set tuning
and the separate probe's limited Bengali representation are disclosed; the optional
216-case candidate is still not presented as validated evidence. Table 12 adds all five
consent-scope configurations, with source-accounting utility distinguished from clinical
summary quality and U distinguished from actual provider disclosure. These are component
experiments, not a controlled full-system LLM-only/hybrid ablation.

R2-03 now cites the two specifically suggested gICS and Greifswald dispatcher papers
(DOIs 10.1186/s12911-022-02081-4 and 10.2196/65784) and explains the adapter boundary.
R2-04 names the human-to-machine grant path and HTTP 403 denial in the paper.
R2-05 includes the suggested Consent Management 2.0 paper (DOI 10.3233/SHTI251389)
without claiming implemented FHIR/IHE conformance. R1-08 also receives a concise
threat-model paragraph distinguishing audit logging from tamper-proof auditing.

R1-09 is addressed through an explicit author disclosure: friends and family gave
verbal consent for research use but not image redistribution; images were processed
in a private Roboflow workspace and originals otherwise stayed local. The authors
report that no formal institutional ethics review was obtained. The paper does not
call this an approval, exemption or waiver. Original prescription images remain
private and are not part of the public capsule or release.

R1-16/R2-00 received a further compiled-layout pass: top table captions, wrapped safety
columns, readable booking rows, flexible float placement and consistent spacing. Six figures
and twelve tables fit the original Elsevier preprint format without shrinking the body font.

## Publication record

The v1.0.5 source release, its Zenodo archive and the Code Ocean capsule version
named above are the artifacts cited in the revised manuscript. Source licences, the
limited physician-review scope, image-consent/ethics disclosure and weight-release
decision are documented; private images are not included. The v1.0.4 release and
Code Ocean v2 remain public as superseded records.
