# Reproducing Medora v1.0.0

This document separates deterministic checks from credentialed provider runs. A
release is invalid if a required live run is silently skipped.

## Environment

- Git checkout: the commit recorded in `docs/softwarex/release_metadata.json`.
- Python: 3.11; Node.js: 20; PostgreSQL: 16.
- Install frontend packages with `npm ci` so `package-lock.json` is authoritative.
- Install direct Python dependencies from each service's `requirements-release.txt`.
  Install the release test tools from `tests/requirements-release.txt`.
  The archived release also contains transitive `pip freeze` outputs and
  container/model checksums generated on the clean release host; these must match the
  release metadata before publication. Frontend dependencies use `package-lock.json`.

Never place provider keys in the repository. Begin with `backend/.env.example` and
the corresponding AI-service example, then provide secrets through the environment.

## Deterministic tests

From the repository root on Windows PowerShell:

```powershell
$env:MEDORA_SKIP_DOCKER='1'
bash run_tests.sh
backend\venv\Scripts\python.exe -m pytest tests\unit\backend\test_softwarex_privacy_suite.py tests\unit\backend\test_symptom_navigation_safety.py -q
cd frontend
npm ci
npm run lint
npm run build
cd ..\tests\e2e
npm ci
npx playwright install chromium
```

The mock-provider results are reported separately and must not be represented as
live-provider performance.

## OCR corpus and annotation

1. Verify the 105-file inventory and duplicate groups:
   `python tests/benchmarks/generate_ocr_manifest.py --check`.
2. Run `python tools/ocr_annotation/server.py`, open the loopback URL, select the
   primary role, enter the reviewer identifier, and correct the Paddle, Azure, and
   pipeline drafts for every included record.
3. Give the licensed clinician/pharmacist a clean repository copy without prelabels,
   then start the same tool and select the independent role in the interface.
4. Reconcile both labels by selecting the adjudication role in the interface.
5. Freeze the reviewed writer/template grouping, image metadata, and approval
   citation without editing the manifest manually:
   `python tests/benchmarks/freeze_ocr_manifest.py --approval-authority "..." --approval-date YYYY-MM-DD --approval-reference "..."`.
6. Run `python tests/benchmarks/build_ocr_gold_standard.py`.

Only the 103 hash-unique records enter metrics. The duplicate files remain in the
archive. The deterministic split contains 21 development and 82 held-out records;
the test hashes are evaluated once after thresholds are locked.

Provider calls are cached by provider manifest version, input SHA-256, and response
SHA-256. Configurations A–H consume those same cached OCR responses. Run the scorer
only after the gold builder succeeds; it emits raw prescription-level scores,
paired-bootstrap confidence intervals, failure/exclusion tables, and LaTeX tables.

## Booking contention

Provision 90 fresh slots per concurrency level after a warm-up and execute the
booking benchmark at 2, 10, and 50 concurrent requests, 30 repetitions each. Each
request carries an idempotency key. The harness checks one committed appointment,
no duplicate row, stable replay, rollback/retry behavior, and outbox delivery after
commit. Transaction and notification-propagation latency are reported separately.

## Final release gate

Run `python tools/release/check_softwarex_release.py`. It fails for an unfrozen
corpus, missing/adjudication-incomplete labels, incomplete provider metadata,
missing live-provider results, copied/approximate manuscript figures, a manuscript
over 3,000 words, failed test/lint/build evidence, or unresolved DOI/hash/checksum.
The tag and Zenodo deposit are made only from the tested commit. After Zenodo returns
the DOI, update the release metadata, rebuild the paper, verify the DOI resolves, and
run the gate again before publishing `v1.0.0`.
