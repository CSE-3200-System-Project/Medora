# Reproducing the SoftwareX release

Use this guide only with the immutable release whose tag, commit, version, DOI, and archive
checksum are recorded in docs/softwarex/release_metadata.json. It separates deterministic
published evidence from credentialed provider runs. A required run must never be silently
skipped or represented as a different result class.

## Code Ocean capsule

The Code Ocean capsule is the supported headless reproduction route. After the final
candidate commit is clean, prepare its platform-layout source bundle with
`python tools/release/package_softwarex_capsule.py`; follow
`docs/softwarex/CODE_OCEAN_CAPSULE.md` to upload it, configure the environment, and mark
`/code/run` as the entry point. The bundle records the exact commit and excludes assets
that are not needed for this workflow or are still under rights/privacy review. Do not
import the repository's root `data/` directory directly into a public capsule.

The run installs the pinned direct requirements, executes the focused SoftwareX boundary
tests, and regenerates the safety and booking tables from frozen machine-readable reports
in the source snapshot. Privacy/navigation metrics are not rescored because the privacy
fixtures were used in later development and are not a held-out evaluation. Booking latency
measurements are host-specific, so the capsule does not claim to rerun or match those
values. Outputs and SHA-256 values are written under `/results`.

No hosted-model API credential is needed for this run. The Code Ocean account is used through
its web interface; never place account credentials or provider keys in repository files.
The exact capsule setup and the files to inspect are listed in
`docs/softwarex/CODE_OCEAN_CAPSULE.md`. Add the stable capsule URL to manuscript C3/S3 before
freezing and running the final capsule source snapshot.

## 1. Verify the release identity

1. Obtain the repository/archive named in release_metadata.json.
2. Check that the checked-out commit equals git_commit and that the archive SHA-256 equals
   archive_sha256.
3. Use Python 3.11, Node.js 20, and PostgreSQL 16, or the pinned release containers.
4. Install frontend dependencies with npm ci. Install backend, AI-service, and test
   dependencies from their release requirements files.

Never store provider keys in the repository. Begin with the service environment examples and
supply credentials through the environment.

## 2. Reproduce deterministic evidence

From the repository root, set MEDORA_SKIP_DOCKER=1 and run run_tests.sh. Then run:

    backend\venv\Scripts\python.exe -m pytest tests\unit\backend\test_softwarex_privacy_suite.py tests\unit\backend\test_symptom_navigation_safety.py -q
    python tests\benchmarks\generate_safety_datasets.py
    python tests\benchmarks\review_navigation_cases.py --check
    python tests\benchmarks\run_safety_benchmarks.py --output docs\softwarex\generated\safety_results.json
    python tools\release\build_release_artifacts.py --pre-archive --safety docs\softwarex\generated\safety_results.json

The safety command must be run without allow-unreviewed for a release. It requires every
navigation fixture to retain its licensed review. The deterministic mock is forced for this
fixture suite; its results must not be described as live-provider performance.

For the web client, run npm ci, npm run lint, and npm run build in frontend. Install the
Playwright browser in tests/e2e before running the release's authenticated browser journeys.

## 3. Reproduce booking evidence

In PowerShell, run the following with Docker available to repeat the recorded host benchmark
and regenerate its paper table:

    $env:MEDORA_BOOKING_REPORT = "docs/softwarex/generated/booking_results.json"
    backend\venv\Scripts\python.exe -m pytest tests\performance\test_booking_contention_release.py -q -s
    python tools\release\render_softwarex_tables.py --safety docs\softwarex\generated\safety_results.json --booking docs\softwarex\generated\booking_results.json --output docs\softwarex\generated

The test starts an isolated PostgreSQL 16 Testcontainers database and
uses synthetic identities, a synthetic doctor, and a local ASGI transport; it does not access
the demo service or create real bookings. It performs one excluded warm-up plus 30 independent
fresh-slot trials at each concurrency level (2, 10, and 50). Every trial checks the winner,
expected conflicts, persisted-row uniqueness, idempotent replay, changed-payload rejection
for a reused key, and outbox processing. The raw JSON records every request latency, outbox
latency, host/database settings, topology, and 95% percentile cluster-bootstrap intervals
(2,000 resamples with seed 20260923; the independent trial is the resampling unit); the paper
reports nearest-rank p50/p95/p99 descriptively. In-process ASGI timings are component results,
not end-to-end capacity.

## 4. Published scope

The revised manuscript also presents archived privacy-component and consent-scope
comparisons. Frozen report copies and `extended_results.tex` are in
`docs/softwarex/generated/`; the table-generation command and population qualifications
are in `docs/softwarex/FINAL_REVISION_REPORT.md`. The capsule regenerates those tables,
not model inference or the credentialed-provider experiment.

The SoftwareX manuscript does not report an OCR accuracy benchmark. The prescription-image
corpus, OCR annotation workflow, and multi-configuration OCR scorer are repository utilities
for future work, not prerequisites for reproducing the published tables. Do not treat their
output as SoftwareX evidence.

## 5. Credentialed-provider runs

Provider/model/version/region/retention assumptions belong in
tests/benchmarks/provider_manifest.json. Use the manifest attached to the immutable release,
preserve configuration and response-cache hashes, and report results by provider. Never pool
live results with deterministic-mock results.

## 6. Build and verify the paper

Before the final source commit, reserve the Zenodo version DOI and date, insert the stable
Code Ocean citation, generate the release macros and tables, and compile
`docs/softwarex/medora_softwarex.tex`. Verify the figure/page references and manuscript
limits before freezing the candidate. Do not wait for Zenodo publication to add the DOI to
the paper; changing the paper after the capsule run would require a new candidate and run.

After committing the candidate, run the Code Ocean capsule against that exact commit and
record its detached manifest/run receipt. Run all nine required release checks on the same
commit, create its Git tag, build the finalized ZIP with
`python tools/release/build_zenodo_deposit.py`, and upload **that exact ZIP** to a manually
reserved Zenodo new-version draft. Do not use GitHub auto-import for this version: it
archives the raw tag snapshot without the post-commit receipts and caused the v1.0.4
internal mismatch. Publish the matching GitHub release only with that repository's
Zenodo auto-import disabled, or it may create a second record. Download the published file, run
`python tools/release/record_zenodo_archive.py <downloaded-zip>`, and finish with
`python tools/release/check_softwarex_release.py`. The gate compares the public records,
tagged source, internal archive metadata, generated paper metadata, capsule run, and hashes.
The complete author-only sequence and unresolved evidence decisions are in
`docs/softwarex/FINAL_HUMAN_GATES.md`.
