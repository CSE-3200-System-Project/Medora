# SoftwareX threat model and residual-risk boundary

This threat model describes controls implemented in the repository. It does not assert a
production security certification, deployment encryption configuration, provider deletion,
or penetration-test result.

## Assets and trust boundaries

Protected assets are patient records, appointment state, consent grants, uploaded documents,
authentication tokens, provider prompts/responses, and audit records. The browser, core API,
PostgreSQL database, local-model processes, and each hosted provider are separate trust
boundaries. Hosted text, Azure OCR, and Vapi receive data only after a purpose/provider/scope
grant; local OCR and speech paths do not cross those external boundaries.

## Threats, implemented controls, and residual risk

| Threat | Repository control | Residual risk |
| --- | --- | --- |
| Unauthorized API call | Authentication plus role, ownership, care-relationship, appointment-state, and consent checks | A valid credential can still be misused; deployment rate limits and monitoring are not evaluated here |
| Database path bypasses API checks | Row-level security and revoked anonymous direct-table grants; negative tests cover the second path | Database configuration must remain correct in each deployment |
| Unauthorized external processing | Deny-by-default processing grant with subject, purpose, provider/recipient, scope, validity, and revocation checks | A permitted disclosure cannot be recalled after transmission |
| Identifier disclosure to provider | Configured bilingual redaction and a pseudonymous header | The published synthetic suite has 75.5% span recall; unknown, indirect, and missed identifiers can remain in an authorized payload |
| Prompt injection or unsafe route selection | Fixed role-scoped route registry; administrative routes absent; schema validation | This bounds destinations but does not establish content correctness or clinical safety |
| Prompt/transcript leakage through logs | Raw prompts, transcripts, findings, and stable subject tokens are not logged by default; operational logs use sanitized categories and random correlation IDs | Deployment logging, backups, and incident retention need operator verification |
| Provider retention or transfer | Provider/region/retention assumptions are recorded per run in provider_manifest.json | Provider terms and account settings can change and are outside application control |
| Client-side persistence after logout | Service worker caches public/static assets only; logout clears Medora cache, IndexedDB, session storage, and sensitive local-storage keys | Browser, device, and OS compromise are outside this software boundary |

## Operational assumptions not verified by this repository

Operators must configure transport encryption, database-at-rest encryption, backup access,
secret custody and rotation, audit-log access/tamper protection, breach response,
retention/deletion execution, and provider data-processing agreements. These items are
deployment responsibilities, not properties demonstrated by unit tests. No penetration test
or clinical security certification is claimed.

## Evidence pointers

Consent enforcement: backend/app/services/processing_consent.py.
Consent API: backend/app/routes/processing_consent.py.
Privacy boundary: backend/app/core/ai_privacy.py and docs/DATA_GOVERNANCE.md.
Authorization and negative tests: tests/security and tests/unit/backend.
Provider assumptions: tests/benchmarks/provider_manifest.json.
