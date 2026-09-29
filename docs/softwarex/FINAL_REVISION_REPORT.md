# SoftwareX revision readiness report

## Update after the authors' completed records and capsule upgrade

The authors' edited notes were found in the extracted evidence kit under `dist/`, not
in the repository's blank templates. The qualified physician reviewed four sources and
approximately 100 targeted entries on 29 September 2026. The public scope/result summary
is `author-evidence/COMPLETED_REVIEW_SUMMARIES.md`; the reviewer does not permit identification.
No repeat physician task or all-row audit is prescribed. The image record documents verbal
research consent, no image redistribution and no formal institutional review obtained;
supervisor reassurance is not represented as approval/exemption. The working manuscripts
now contain that truthful disclosure. Storage/platform visibility fields remain unspecified.

`revisions/MEDICINE_LICENCE_DEADLINE_CHECK.md` corrects the blanket three-email requirement:
applicable public licences already grant covered reuse; fresh replies are not mandatory.
The specific S1 terms conflict and S2 origin uncertainty remain source-distribution decisions.
The selected multi-source corpus has not been silently replaced or marked cleared.

The upgraded capsule executes archived-observation verification, current safety scoring,
26 focused tests and 90 fresh-slot native PostgreSQL 16 booking trials. Linux execution
of these stages passed. Explicit model profiles add MuRIL inference and detector diagnostics;
local reruns reproduce all six privacy rows and 204 matched parameter checks. Historical
tables remain separate. The final Code Ocean receipt and new release/archive identities
are still required. The aggregate-only hosted-summary archive cannot supply missing paired
outputs; full historical provider replay is not claimed. See `CAPSULE_RESULT_COVERAGE.md`
for actual per-result execution coverage; older baseline descriptions below should be read
with this update.

Checked 29 September 2026 against the three reviews for SOFTX-D-26-01036.
This report covers SoftwareX only. Already completed competition-related experiments
are reused where they support the paper; no new BCOLBD development is requested.

## Manuscript and presentation

The two working TeX entry points agree and preserve the teacher-revised submission's
four authors, contributions, five-section structure and direct explanations. The original
submission remains unchanged under `submission-history/`. Both entry points compile to
20 pages, with six figures, twelve tables and 2,994 words under the repository's stricter
word-count gate, including captions.

Verification: 77 focused pytest checks passed, covering manuscript consistency/limits,
table regeneration, corpus rebuild, detector documentation, release identity, privacy,
navigation, summaries and PHI-component boundaries. Generated-artifact exact-value secret
screening passed across 759 files. Final TeX passes have no overfull boxes or undefined
citations/references. Page 12 deliberately contains three full-width results tables; its
float-only warning does not describe an empty or incomplete page.

Float barriers and restrictive placement were removed. Tables have captions above their
bodies, consistent spacing and minimal rules. The booking table now separates transaction
and outbox rows instead of shrinking a wide table. The safety overview uses wrapped columns.
The Elsevier preprint class, 12-point body font and normal margins are retained. A full table
page is appropriate when the tables fill it; empty float pages and stretched intervening
spaces are not. Dashboard figures retain navigation, heading and both feature panels.
The consent diagram now uses a compact three-column layout with readable labels instead
of shrinking a long horizontal chain to the text width.

The writing pass uses the academic-writing and humanizer guidance to preserve straightforward,
function-first communication. It retains measured errors and distinguishes measurements,
capabilities and prospective work; favourable tone does not substitute for evidence.

## Supported results included

| Result | What is presented | Evidence boundary |
| --- | --- | --- |
| Original privacy baseline | 134 cases; 71 TP, 4 FP, 23 FN over 94 identifier spans; precision 94.7%, recall 75.5%, false redaction 3.2%; Wilson recall interval | Frozen v1.0.2 fixture results, not current-code or independent naturalistic performance |
| Completed privacy extensions | Rules / optional MuRIL / union: all six rows across the 134-case development population and separate 36-case probe, with recall intervals | Development recall is 100% but false redaction increases from 2.4% to 5.6% for model/union. Probe recall is 75.0% / 97.2% / 100%; only three probe cases are Bengali. No independent clinical/bilingual validation claim |
| Consent-scope experiment | All five configurations on 24 synthetic summaries; source-accounting contract utility and offline identifier exposure | Scope and redaction vary together. U is an offline exposure counterfactual, not actual unredacted provider disclosure. Aggregate results cannot establish a paired causal ablation or clinical summary quality |
| Navigation | Full emergency confusion matrix: TP=7, FN=0, FP=5, TN=18; sensitivity, specificity, PPV and NPV with Wilson intervals; recorded/mock specialty outcomes separately | Preliminary 30-case fixtures; reviewer relationship and development corrections disclosed |
| Summary references | 12/12 deterministic mock fixture assertions | Source-accounting/schema checks, not clinical correctness of live summaries |
| Booking | 30 independent fresh-slot trials at each of 2/10/50 attempts; 30/30 correctness trials per level; transaction/outbox n, p50/p95/p99; raw data and trial-cluster bootstrap intervals | One in-process ASGI/PostgreSQL topology, not deployment capacity. A final clean-release rerun remains |
| Corpus rebuild | 46,614 candidate rows; 72,969 source contributors; deterministic row/field lineage, transformations, quarantines and repeated-build checks | Prospective attributed rebuild, not reconstructed historical lineage or national/clinical completeness; permissions and promotion remain |
| Current detector artifacts | Hashes, recipe, metadata and exact agreement of 204 matched named parameters after fusion | Current parameter correspondence, not historic dataset authentication, full runtime equivalence or detection accuracy |
| Dashboard | Stored-record coverage = 100 × available groups / 4; authentic bilingual frontend illustrations | Record presence, not an AI health score or adherence/clinical outcome |

No marketing, adoption forecasts, planned training, unfinished Maya experiments, duplicate
counts of the same privacy fixtures, or unsupported full-system superiority are imported.
Existing feature improvements such as bilingual PWA, voice access and consent enforcement
are described as capabilities unless their named tests support a narrower measured claim.

### Reproducing the added tables

`tools/softwarex/build_revision_evidence.py` prepares the already existing component reports.
It verifies fixture hashes and privacy metric arithmetic; `--verify-local-model` additionally
checked the local MuRIL bundle's four recorded hashes. This check is not a new inference run.
The verification receipt and original-report checksums are in
`generated/extended_evidence_verification.json`.

The privacy report was executed on 27 August 2026. Its broad `held_out` header is qualified
by its own population-specific caveat: the rules were extended on the 134-case set.
The paper follows that caveat, not the broad header. The component uses threshold 0.30.
Its scripts and synthetic fixture files remain in the source snapshot; the optional local
model bundle is not silently added to the public release or claimed to be retrained here.

The consent report derives from a 16 August 2026 Groq run, 24 synthetic patients and one
seed. `tests/benchmarks/reports/shimana_report.json` preserves its aggregate observations.
The utility column is a binary source-accounting contract, not coverage of all medical
facts. Both report copies are frozen in `generated/`; their tables are regenerated by:

```powershell
python tools/release/render_softwarex_tables.py --safety docs/softwarex/generated/safety_results.json --booking docs/softwarex/generated/booking_results.json --privacy-extension docs/softwarex/generated/privacy_extension_results.json --consent-scope docs/softwarex/generated/consent_scope_results.json --output docs/softwarex/generated
```

The capsule regenerates these tables and runs focused current-code boundary fixtures.
It does not rerun MuRIL inference, hosted-model experiments, clinical evaluation or booking
latency. A successful capsule must not be presented as reproducing those unexecuted tasks.

## Every reviewer item

The complete 32-item point-by-point map is in `response_to_revision.md`: 16 Reviewer 1
items, six Reviewer 2 items and ten Reviewer 3 items. Section/figure/table references are
updated for this compiled draft and must be checked again after final identifiers are inserted.

| Reviewer | Repository/manuscript response | Actual remaining gates |
| --- | --- | --- |
| 1 | Narrowed high-risk claims; conventional privacy/navigation metrics and uncertainty; corpus rebuild procedure; experimental detector documentation; repurposed dashboard; threat model; ethics scope; recent work; booking protocol; terminology/provider scope; readable figures | R1-01 new consistent immutable release; R1-05 actual source-review note/permissions and chosen-corpus promotion; R1-09 original identifiable-image collection/research-use ethics determination; R1-11 final clean-release timing run; R1-15 final configuration/evidence binding; author approval of figures/text |
| 2 | Figure readability, bounded EU/German deployment discussion, Wallace DOI, concrete human/machine grant enforcement, gICS/Greifswald comparison and all three suggested consent references, conceptual FHIR/IHE boundary | Final author/editorial acceptance of wording and presentation; no implemented FHIR adapter or new legal certification claimed |
| 3 | Quantitative fixture/component results; methods and artifact inventory; uncertainty; residual privacy and safety scope; feasible component comparisons with confounding disclosed; recent literature; attributed corpus procedure; bounded reproducibility commands; concise prose | Corpus evidence/rights gates shared with R1; actual Code Ocean run/citation; exact-release verification and archive identity; final response references |

The reviewers decide whether the response is sufficient. Conditional acceptance does not
authorize us to mark missing permissions, ethics records, platform runs or archives as done.

## Complete mandatory remaining sequence

1. **Medicine rights — authors/source owners.** Record collection/redistribution permission
   or another applicable basis for S1 MedEx, S2 MedEasy-described and S4 DGDA-described inputs.
   S5 Mendeley attribution/change notice is prepared. Uploader licence labels alone do not
   resolve upstream rights. The selected multi-source public corpus stays gated until this
   basis is documented; confidential correspondence need not be public.
2. **Actual doctor source-review record — qualified reviewer/authors.** Supply a dated note
   naming qualification/role, exact source versions, checks actually performed, findings,
   concerns and limited conclusion. Recording an already completed source review is roughly
   10–15 minutes, an estimate, not a new whole-corpus audit. A new 30-case descriptive
   spot-check is optional under the current limited claims, approximately 40–70 minutes.
3. **Original image ethics determination — authors/authorized institution.** Record whether
   identifiable-image collection and research/training use were approved, exempted, waived,
   or conducted without formal review, and who made that determination. Give a reference
   only if one exists. Research-use consent and derived-weight release are already author
   reported; neither independently establishes original institutional-review status.
   Images remain private because consent did not authorize distribution. No new public
   image upload or invented approval number is needed.
4. **Approved candidate promotion — agent after 1–2.** Promote the selected attributed CSV
   with lineage/changes/notices; update counts/tests/manuscript where needed. Do not overwrite
   the shared database with the destructive seed writer. Live migration, if requested,
   must preserve medication references. Confirm the detector's prepared AGPL/source bundle
   is included in the intended final distribution, without private images or notebook outputs.
5. **Author approval and publication identifiers — authors, with agent edits.** Approve four
   authors/CRediT, actual ethics/source-review wording and final authentic figures. Create
   the author-owned Code Ocean capsule, supply a reader-accessible citation or editor-approved
   review route, and reserve the new Zenodo version DOI. Align new-version citation metadata
   and paper identifiers before freezing; do not reuse the inconsistent old archive identity.
6. **Freeze, exact-release tests and Code Ocean — agent plus author platform access.** Commit
   the final candidate; run required release checks, the clean-release booking benchmark and
   final provider/artifact binding. Upload the exact prepared capsule and execute its
   Reproducible Run. Return its version/run ID and downloaded reproduction manifest. The
   agent records and checks the receipt. Source changes require a refreshed candidate/run.
   Before claiming all reported experiments rerun, complete the per-result coverage pass
   in `CAPSULE_RESULT_COVERAGE.md`. The existing runner only regenerates frozen tables
   and runs focused boundary tests; extending its analyses remains agent work.
7. **New GitHub/Zenodo release — authorized author account, agent packaging/checks.** Push
   the final commit/tag, build the exact archive, publish under the reserved new DOI, download
   and verify it. Record detached receipts and run the identity gate. GitHub authentication
   is currently needed for pushing the prepared revision branch; no AI coauthor is added.
8. **Final submission package — agent assembly, authors submit.** Recompile the frozen paper,
   inspect figures/tables, replace draft links/identifiers, refresh every response page
   reference, and assemble the manuscript, response and requested reproducibility artifacts.

Items 4, parts of 5–7 and package assembly are still agent-doable after their prerequisites;
they are not incorrectly labelled human-only. No new competition work, compulsory bilingual
review study, full medicine-row audit, image distribution, FHIR implementation or detector
accuracy claim is added to this revision plan.
