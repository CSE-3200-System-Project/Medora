# SoftwareX manuscript communication check

Checked 28 September 2026. This is an internal revision note, not manuscript content.

## Section outline and paragraph roles

1. Motivation: identify researchers/users, Bangladesh context and the reusable reference
   and consent/navigation integration. Related systems provide scope comparisons.
2. Software description: explain deployment, authorization/consent flow, medicine identity,
   assistive workflows and booking. Describe evaluated behaviour after the implementation.
3. Illustrative examples: explain the displayed measure and show actual bilingual frontend
   context, sharing/audit controls and patient/clinician workflows.
4. Impact: identify reusable modules and questions researchers can investigate, then bound
   the evaluation setting without dismissive language or clinical-performance claims.
5. Conclusions: summarize what the software integrates and what its artifacts make inspectable.

## Claim-evidence map

| Claim | Evidence | Status |
| --- | --- | --- |
| Bilingual frontend with stored-record coverage | Actual local captures, receipt, formula/API and locale tests | Supported |
| New medicine rows retain source/field linkage | Independent verifier: 46,614 rows and 72,969 contributor records; repeat-build equality | Supported, structural scope |
| Medicine currentness/completeness/clinical correctness | No current authoritative concordance or population audit | Not claimed; actual source-review note pending |
| Current PT/ONNX parameter correspondence | 204 matched named tensors, exact agreement after fusion | Supported; not accuracy/full prediction equivalence |
| Historical training dataset linkage | Author v2 attribution plus metadata/date/log discrepancy record | Author-reported, not independently reconstructed |
| Privacy/navigation/summary fixture outcomes | Frozen reports and current boundary tests, separate provider conditions | Supported within described fixture scope |
| Booking latency/correctness | Raw 30-trial component observations and environment/clustered summaries | Topology-specific; immutable release binding pending |
| Published capsule/final archive identity | Runner and identity gates prepared; platform receipts not yet supplied | Pending, never described as completed |

## Five-dimension self-review

- Contribution: concrete reusable software integration; no invented adoption or superiority.
- Clarity: one message per paragraph, function-first explanations, stable terminology and
  five SoftwareX sections. Captions describe visible features rather than editorial chores.
- Experimental strength: actual measurements and retained error cases; no optimistic
  rewriting of precision/recall, OCR observations or parameter/runtime agreement.
- Evaluation completeness: distinguish current tests from frozen reports; avoid presenting
  synthetic cases as independent clinical evidence or an optional audit as completed.
- Design soundness: explain authorization, review gating and database/notification
  boundaries, with clinical and source-permission scope explicit.

The prose pass replaces pessimistic/defensive phrasing with neutral scope descriptions;
it does not hide reviewer-requested results. Figure 4 frames navigation, heading and both
feature panels instead of isolating the gauge. Compiled figure layout is inspected; dated
review notes, source permissions and final platform links remain actual human inputs.

Both local SoftwareX templates retain the five sections; their word limits differ
(3,000/4,000). The draft stays below the stricter 3,000-word limit. The official web guide
could not be retrieved in this check, so no changed online rule is asserted.
