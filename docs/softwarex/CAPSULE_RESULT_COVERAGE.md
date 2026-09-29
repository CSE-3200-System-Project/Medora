# Code Ocean coverage of the paper's results

This is the exact distinction between source availability, table regeneration, and rerunning
an experiment. The current capsule is a **focused fixture/table run**, not a full-system
performance rerun. A successful run cannot be presented as regenerating unexecuted measurements.

Code Ocean's [run-file guidance](https://docs.codeocean.com/user-guide/v4.1.0/compute-capsule-basics/reproducible-runs)
calls for an automated headless workflow. Its [verification guidance](https://docs.codeocean.com/osl-guide/publishing-on-code-ocean/the-verification-process/code-oceans-verification-process-for-computational-reproducibility-and-quality)
expects the published computational results to be produced by the declared run. Merely
copying a reported score is not rerunning its originating inference or timing experiment.

## What the existing transport bundle contains

It includes the committed application source, frontend/backend/AI-service code, tests,
benchmark scripts, synthetic fixtures, dependency files, provider/configuration records,
frozen reports and run entry point. Its manifest names every included/withheld file and
hash. It excludes private images, unresolved medicine data, the separately distributed
approved detector, competition-only material and screenshots not used by this run.
Including frontend source does not mean the run launches or benchmarks that frontend.

## Every measured result and the remaining execution step

| Paper evidence | Current automatic capsule run | What is needed to claim an originating-experiment rerun |
| --- | --- | --- |
| Tables 6–9: historical privacy, navigation and mock summaries | Regenerates tables from the archived safety report; runs selected current-code boundary fixtures | Historical privacy scores require the original evaluated redactor/configuration, not later tuned rules. `tests/benchmarks/run_safety_benchmarks.py` can score current code, with a new report/date clearly separated. Archived recorded-provider outcomes are replay evidence, not new live-provider performance |
| Table 10: booking correctness and latency | Regenerates table from recorded raw timings | Run `tests/performance/test_booking_contention_release.py` against isolated PostgreSQL 16. Its existing launcher uses Docker/Testcontainers; the capsule needs a tested PostgreSQL setup compatible with its environment before claiming this rerun. New timings need not equal the old host's timings; record topology and preserve the original run separately |
| Table 11: rules/MuRIL/union | Regenerates all six rows; local preparation verified fixture/model hashes and arithmetic | Include the exact optional MuRIL bundle and its applicable notices/redistribution basis, pin inference dependencies, and run `tools/phi_ner/evaluate.py` on both supplied synthetic populations at threshold 0.30. The current capsule does not include this local bundle or rerun inference |
| Table 12: consent-scope summaries | Regenerates five aggregate rows from the archived report | `tests/benchmarks/run_shimana_sweep.py` needs its actual provider/model settings and authorized API access for a fresh run. Existing aggregates lack paired/raw model outputs needed for full historical replay. A mock run is not a reproduction of the Groq measurements; do not fabricate the missing outputs |
| Attributed medicine rebuild counts | Source builder and archived verification records available; dataset excluded from run | Release-cleared exact input bytes, candidate CSV/provenance and notices; run `data/medicine_reference/rebuild_corpus.py` and `tools/softwarex/verify_medicine_build.py`. Upstream redistribution evidence is still pending. A synthetic fixture demonstrates builder logic, not the full-corpus counts |
| Detector hash/204-parameter correspondence | Documentation/verification records available; weights not consumed | Approved PT/ONNX, sanitized recipe, AGPL/corresponding source and pinned verification dependencies; execute `tools/softwarex/verify_detector_pair.py` on synthetic inputs. This needs no private prescription images and is not an accuracy or retraining claim |
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

After permitted input/configuration decisions, the agent can expand the headless analyses,
prepare model/data profiles and notices, test their environment, run permitted computations,
and align paper results with what actually executed. Platform authentication/publication and
actual source/ethics/review evidence remain author tasks. The current ZIP must not be called
the final all-result reproducibility capsule before that execution/coverage pass.
