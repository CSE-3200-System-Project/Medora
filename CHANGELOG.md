# Changelog

This project uses [Semantic Versioning](https://semver.org/). The release date,
archival DOI, tested commit, and archive checksum are populated only after the
release gates pass.

## [1.0.0] - Unreleased

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

