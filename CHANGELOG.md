# Changelog

This project uses [Semantic Versioning](https://semver.org/). The release date,
archival DOI, tested commit, and archive checksum are populated only after the
release gates pass.

## [1.0.2] - 2026-08-08

Supersedes 1.0.1 under concept DOI 10.5281/zenodo.21844459.

### Changed

- Retitled: "Medora: A Bilingual, consent-gated AI-native healthcare management &
  consultation platform for Bangladesh", in the manuscript, `CITATION.cff`,
  `codemeta.json`, and the software self-citation.
- A licensed clinician reviewed all 30 symptom-navigation fixtures case by case and
  corrected two Bengali red-flag presentations, `শ্বাসকষ্ট হচ্ছে` and
  `বুক ধড়ফড় করছে এবং মাথা ঘুরছে`, from specialty candidates to emergency. Emergency
  agreement across the two scored paths goes from 5/5 to 7/7 and the false-negative count
  is now measured against a clinical label rather than an authored one.

### Fixed

- `EMERGENCY_PATTERNS` did not match `শ্বাসকষ্ট` or `ধড়ফড়`, so neither corrected
  presentation triggered emergency guidance. Both are now matched, with no new false
  positive across the fixture set.
- Correcting a fixture's expected class left four dependent fields describing the old
  class, and the scorer reads those rather than the class itself.
- `public.emit_slot_change_event`, which fires on every appointment write, had a mutable
  `search_path` (`sec_003`).
- The pre-archive gate matrix read a `safety_results.json` path that nothing writes, so
  it reported a five-day-old result.
- `check_softwarex_release.py` compared the release metadata and verification receipts
  against HEAD, which no released repository can satisfy: recording the receipts produces
  a commit of its own. It now anchors to the commit behind the tag named in `version`.
- `build_release_artifacts.py` required an OCR report for a final build, which does not
  exist because the accuracy claim is withdrawn.

## [1.0.1] - 2026-08-08

Archived as Zenodo version DOI 10.5281/zenodo.21844460 for 1.0.0; 1.0.1 supersedes it
under concept DOI 10.5281/zenodo.21844459.

### Fixed

- `CITATION.cff` and `codemeta.json` still described the software as it was before the
  2026-08-04 retitle, including `prescription OCR` as a keyword for a capability this
  release withdraws. Both now match the manuscript's title, keywords, and abstract, and
  so does the generated Zenodo deposition record.
- Eleven enum members were usable in code and rejected by the database, so writing them
  raised at insert time. Every `SurgeryUrgency` value the API accepts except `scheduled`
  was among them, along with `ConsultationStatus.CANCELLED` and the `years`, `ongoing`,
  and `as_needed` prescription durations. Two labels existed in the database with no
  member able to read them (`medicinetype.powder`, `surgeryurgency.immediate`).
- Fifteen foreign keys had no supporting index, so joins across them scanned and every
  parent delete scanned the whole child table.
- `med_001` aborted against any database whose medicine tables were loaded out of band,
  which left six of its indexes uncreated on the deployed database.
- The deployed OCR service had `AZURE_OCR_ENDPOINT` set to an empty string and answered
  every request with a 500 while reporting healthy.
- The OCR client's 5 second connect timeout turned every cold start into a 502.
- The landing page and the role-selection page both marked their largest above-the-fold
  image lazy and low priority.
- `dompurify` was pinned to 3.4.13 to close GHSA-55q2-fjhq-7xh7 in the production tree.

### Added

- `tools/release/check_enum_sync.py`, which compares the Python enums against `pg_enum`
  on a real database. The integration suite cannot catch this class of defect: it builds
  its schema with `create_all` from the same models it checks.
- `tools/release/build_zenodo_deposit.py` and `tools/release/validate_clean_containers.sh`.
- `tests/e2e/provision_synthetic_accounts.py`, which unblocked the six authenticated
  browser journeys that had never run.

## [1.0.0] - 2026-08-08

### Added

- Versioned, purpose-specific processing consent with expiry and revocation.
- Local-only OCR mode, explicit cloud OCR authorization, and review-gated drafts.
- Structured bilingual identifier redaction and sanitized operational logging.
- Navigation-only specialty suggestions with deterministic emergency red flags.
- Source-linked, read-only generated summaries.
- Prescription receipt acknowledgment and discrepancy reporting semantics.
- Appointment idempotency records and a transactional notification outbox.
- Public-corpus inventory, assisted annotation tool, blinded-review protocol,
  deterministic safety fixtures, and reproducibility gates.

### Changed

- Removed unsupported clinical-readiness, anonymity, triage, and performance claims.
- Limited the service worker to static/public assets and removed queued health writes.
- Made local processing fail closed instead of escalating to a cloud provider.

### Deprecated

- Prescription `accept` and `reject` API aliases. They map to acknowledgment and
  discrepancy reporting for this release and will be removed in the next major version.

