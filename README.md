# Medora

Medora is open-source research software for bilingual health-record management,
human-reviewed prescription digitization, specialty navigation, and appointment
coordination. The interface supports English and Bangla and has patient, doctor, and
administrator workflows.

Medora has not been clinically validated, independently security-audited, or cleared
as a medical device. It is not production-ready clinical software. OCR, generated
summaries, and specialty candidates are drafts that require human judgment.

## What is in the repository

- `frontend/`: Next.js 16 and React 19 browser application.
- `backend/`: FastAPI business API, PostgreSQL models, authorization, consent,
  appointment transactions, and text-provider orchestration.
- `ai_service/`: FastAPI OCR service with optional local PaddleOCR, YOLO region
  detection, Azure Document Intelligence, parsing, and review metadata.
- `tests/`: unit, integration, security, end-to-end, performance, and frozen
  SoftwareX benchmark protocols.
- `tools/ocr_annotation/`: loopback annotation workspace for the prescription corpus.
- `docs/softwarex/`: revised manuscript, diagrams, checklist response, and release gates.
- `samples/`: 105 public prescription images subject to a separate
  [data-use notice](samples/DATA_USE_NOTICE.md).

## Safety and data semantics

External processing is deny-by-default and purpose-specific:

| Purpose | External recipient | Local alternative |
|---|---|---|
| `external_text_ai` | Selected hosted text provider | Deterministic mock for tests; manual workflow |
| `cloud_document_ocr` | Azure Document Intelligence | PaddleOCR/YOLO local mode |
| `external_live_audio` | Vapi | Local faster-whisper workflow |
| `clinical_sharing` | Named clinician | Patient retains unshared categories |
| `research_export` | Named export recipient | No export |

A grant records its subject, provider/recipient, purpose, scopes, policy version,
validity, grant/revocation time, and audit metadata. Revocation blocks future use but
cannot retrieve material already disclosed. Local mode never silently escalates to
a cloud provider.

Known bilingual identifier patterns are redacted before hosted text processing and
external requests use random correlation IDs. This lowers exposure; it does not make
the content anonymous or guarantee that unknown identifiers are removed. Raw OCR,
prompt, transcript, and finding logs are disabled by default.

- OCR output is an unconfirmed, provider-labelled draft until explicit review.
- Generated summaries are read-only and link each item to a source record/timestamp.
- Prescription receipt acknowledgment is not approval of the medication.
- Specialty search is navigation, not diagnosis or triage. Deterministic red flags
  show emergency-care guidance before a model can run.
- The service worker caches static/public assets only. Health writes are not queued
  offline, and logout clears Medora browser stores.

See [data governance](docs/DATA_GOVERNANCE.md) and the
[backend permission matrix](docs/ROLE_PERMISSION_MATRIX.md).

## Appointment consistency

Appointment creation requires an `Idempotency-Key`. The backend writes the
appointment, idempotency result, audit entry, and notification outbox event in one
transaction while retaining advisory locking and an active-slot uniqueness
constraint. Events are published after commit. Realtime delivery improves freshness,
but reconnecting clients re-query PostgreSQL as the authoritative state.

## Local development

Prerequisites: Python 3.11, Node.js 20, PostgreSQL 15, and optional provider/model
credentials for live OCR, text, or audio features.

Frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Core API:

```powershell
cd backend
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m alembic upgrade head
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

OCR API:

```powershell
cd ai_service
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

Copy the example environment files and provide only the values needed for the mode
you intend to run. Do not commit credentials. Paid-provider configuration is not
required for deterministic mock tests or local-only workflows.

## Tests

```powershell
bash run_tests.sh
cd frontend
npm run lint
npm run build
```

For a fast Python pass without Docker:

```powershell
$env:MEDORA_SKIP_DOCKER='1'
bash run_tests.sh
```

Targeted suites and the clean release procedure are documented in
[REPRODUCING.md](docs/REPRODUCING.md). Required provider benchmarks fail if
credentials are absent; they are never recorded as skipped passes.

## OCR annotation and evaluation

The inventory retains all 105 images and excludes two exact duplicate files from
metrics, leaving 103 unique prescriptions. The release protocol requires:

1. Assisted prelabels from Paddle, Azure, and the current pipeline.
2. Correction of every draft by a trained author.
3. Independent, blinded labelling of all 103 unique records by a licensed clinician
   or pharmacist.
4. Adjudication of every disagreement.
5. A frozen 21-record development split and 82-record held-out test split.

Start the local workspace with:

```powershell
python tools/ocr_annotation/server.py --reviewer-id REVIEWER --role primary
```

The benchmark evaluates configurations A–H on immutable provider responses and
publishes text/field metrics, prescription-level paired-bootstrap confidence
intervals, failures, exclusions, raw scores, and local/provider runtime. AI output is
never treated as ground truth.

## SoftwareX release state

The revised manuscript source compiles, but `v1.0.0` is intentionally not tagged or
archived until all release gates pass. Run:

```powershell
python tools/release/check_softwarex_release.py
```

The checker currently fails until the human annotation/adjudication, verified
approval metadata, live-provider runs, full clean test evidence, exact archive
checksum, and resolving Zenodo DOI exist. The point-by-point state is in
[response_to_revision.md](docs/softwarex/response_to_revision.md).

## Licensing and citation

Code is licensed under the [MIT License](LICENSE). Authored annotations, synthetic
fixtures, and results use CC BY 4.0. Identifiable prescription images are excluded
from both blanket licenses and remain under their consent-based research and
reproducibility notice. Citation metadata is in [CITATION.cff](CITATION.cff).
