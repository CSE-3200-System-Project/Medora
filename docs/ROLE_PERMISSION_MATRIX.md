# Backend role and permission matrix

This matrix describes authorization enforced by the FastAPI backend. Hiding a
button or route in the frontend is a convenience only and is never authorization.
All protected operations first require a valid bearer token and an active profile.
Administrator endpoints use the same bearer-token boundary and additionally
require the database profile role `admin`; shared password headers are rejected.

| Resource/action | Patient | Doctor | Administrator | Additional backend predicate |
|---|---|---|---|---|
| Own profile/history | Read/write own | No | Moderation fields only | `resource.patient_id == subject.id` |
| Doctor profile/schedule | Public fields read | Write own | Verify/suspend | Doctor identity and verification state |
| Appointment create | Create for self | No | No | Valid slot; mandatory idempotency key; active-slot uniqueness |
| Appointment read/change | Own appointments | Assigned appointments | Operational oversight where endpoint allows | Ownership plus allowed state transition |
| Consultation | Read own | Assigned doctor creates/updates | No routine access | Active appointment/care relationship |
| Prescription | Read own; acknowledge receipt/report discrepancy | Issuing doctor writes | No routine access | Consultation relationship and state |
| Shared patient record | Grant/revoke scoped access | Read only granted categories | No routine access | Current care relationship and unexpired `clinical_sharing` grant |
| External text AI | Own workflow | Own/assigned workflow | No clinical data use | Active `external_text_ai` grant for provider/purpose/scope |
| Cloud document OCR | Own upload | Authorized workflow | No | Active `cloud_document_ocr` grant; otherwise local offered |
| External live audio | Own call | Own/assigned call | No | Active `external_live_audio` grant before start and at webhook |
| Research export | Export subject-authorized material | No by default | Execute authorized export | Active `research_export` grant and approved export purpose |
| Account/doctor moderation | No | No | Yes | Administrator role; auditable status transition |

Consent is an additional predicate, not a substitute for role, ownership, or care
relationship checks. Revocation prevents future processing but cannot retract data
already disclosed to a recipient. Negative combinations are exercised by the
security and consent suites under `tests/security` and `tests/unit/backend`.
