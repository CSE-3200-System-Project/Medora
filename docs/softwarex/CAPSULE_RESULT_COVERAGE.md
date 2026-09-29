# Code Ocean coverage of the paper's results

This is the exact distinction between source availability, table regeneration, and rerunning
an experiment. The upgraded capsule executes current safety scoring and a native PostgreSQL
16 booking rerun, checks archived observations, and regenerates historical tables. Model
profiles add actual inference/parameter diagnostics. It is not a full deployed-system or
clinical-performance rerun. A successful run cannot validate unexecuted measurements.

Code Ocean's [run-file guidance](https://docs.codeocean.com/user-guide/v4.1.0/compute-capsule-basics/reproducible-runs)
calls for an automated headless workflow. Its [verification guidance](https://docs.codeocean.com/osl-guide/publishing-on-code-ocean/the-verification-process/code-oceans-verification-process-for-computational-reproducibility-and-quality)
expects the published computational results to be produced by the declared run. Merely
copying a reported score is not rerunning its originating inference or timing experiment.

## What the existing transport bundle contains

It includes the committed application source, frontend/backend/AI-service code, tests,
benchmark scripts, synthetic fixtures, dependency files, provider/configuration records,
frozen reports and run entry point. Its manifest names every included/withheld file and
hash. Private images, competition-only material and screenshots not used by this run
remain excluded. The selected S4/S5 profile adds licensed raw inputs, public CSV,
provenance and notices; the detector profile adds approved weights and source.
Including frontend source does not mean the run launches or benchmarks that frontend.

## Every measured result and the remaining execution step

| Paper evidence | Current automatic capsule run | What is needed to claim an originating-experiment rerun |
| --- | --- | --- |
| Tables 6–9: historical privacy, navigation and mock summaries | Recomputes archived observation counts, regenerates tables and executes current-code mock/rule scoring | Historical privacy scores are not expected from later tuned rules. Fresh results have a separate report/date. Archived provider observations are not new live-provider performance |
| Table 10: booking correctness and latency | Recomputes historical statistics and reruns 30 trials at 2/10/50 attempts in fresh native PostgreSQL 16 | Linux run passed all 90 trials. `current_booking_results.json` records new raw timings/topology; original host timings remain historical, not required to match |
| Table 11: rules/MuRIL/union | Model-enabled profile executes both populations at threshold 0.30 using exact hashed assets | Local inference rerun matches all six metric rows. Profile inclusion is explicit; default bundle without weights remains table-only. No new training/generalization claim |
| Table 12: consent-scope summaries | Regenerates five aggregate rows from the archived report | `tests/benchmarks/run_shimana_sweep.py` needs its actual provider/model settings and authorized API access for a fresh run. Existing aggregates lack paired/raw model outputs needed for full historical replay. A mock run is not a reproduction of the Groq measurements; do not fabricate the missing outputs |
| Attributed medicine rebuild counts | Selected medicine profile replays S4/S5 raw inputs and compares five output SHA-256 hashes to the selected public build | This establishes exact reconstruction of 44,226 rows and 45,135 contributor links, not clinical correctness or official-register completeness. The default bundle without this profile does not replay the corpus |
| Detector hash/204-parameter correspondence | Detector-enabled profile executes approved artifacts in a separate pinned CPU environment | Local rerun confirms 204 matched tensors; complete raw prediction identity is not asserted. AGPL/corresponding source is included; no private images, accuracy evaluation or retraining required |
| Stored-record coverage | Formula/UI/API and tests in source; authentic screenshots provided in paper | Run the coverage calculation/locale tests with synthetic records. It does not require private prescriptions or validate clinical health |

## Required final artifact structure

1. **Exact source:** final immutable application/benchmark source commit, licence notices,
   dependency locks and environment configuration. Do not upload `.env` files or tokens.
2. **Permitted inputs:** synthetic test cases and allowed corpus/model assets needed by the
   declared analyses; hashes, origin, versions, licences and change records. Keep private
   images excluded. Any omitted input must have an explicit restriction and claim boundary.
3. **Analyses:** scripts for scoring, uncertainty, source verification and rendering;
   a headless `run` that actually invokes the analyses it promises.
4. **Outputs:** freshly executed reports/logs, generated tables/figures and provenance manifest.
   Preserve historical observations in a separately labelled location, not as new outputs.
5. **Platform receipt:** capsule/version URL, computation ID, source commit and downloaded
   result manifest. An unchanged candidate must produce the declared outputs successfully.

The full public release and the runnable capsule need not expose confidential originals.
But restricted inputs mean some scientific experiments cannot be independently repeated
from public materials. That restriction must be disclosed; a successful fixture capsule
does not eliminate it. The paper presently makes no detector-accuracy or clinical-efficacy
claim, so no private-image training or clinical validation is added to this revision.

## What remains agent work, rather than another human certificate

The headless analyses and explicit model profiles are implemented; Linux safety/booking
and local inference/parameter checks have executed successfully. Exact final source packaging
and Code Ocean platform verification must still be run after the release identity is frozen.
The aggregate-only hosted summary evidence and private images remain declared
availability boundaries, not closed by passing unrelated tests. Platform authentication/publication and
final author approval of the recorded ethics/review scope remain author tasks. The current ZIP must not be called
the final all-result reproducibility capsule before that execution/coverage pass.
