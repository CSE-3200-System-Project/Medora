# Consent and interoperability boundary

Medora currently exposes private JSON/REST APIs for its own web client. Its released
exports are human-readable text/PDF outputs, not structured EHR exchange. The project does
not claim HL7 FHIR, IHE Privacy Consent on FHIR (PCF), or terminology conformance.

## Human decision to enforced grant

The patient sharing screen names the recipient/provider, purpose, requested categories,
expiry, and revocation action. Saving it creates an immutable versioned
processing_consent_grants record. Before an external call, the consent service requires an
active record matching the subject, purpose, provider/recipient, time window, and all
requested scopes. A mismatch returns HTTP 403 with processing_consent_required; it never
silently falls back to a hosted provider. Revocation blocks later calls but cannot recall an
already disclosed payload.

Illustrative machine record, with non-production identifiers:

    {
      "subject_id": "patient-demo",
      "purpose": "external_text_ai",
      "provider": "groq",
      "recipient_id": "groq",
      "scopes": ["conditions", "medications"],
      "policy_version": "softwarex-v1",
      "valid_from": "2026-09-22T00:00:00Z",
      "valid_until": "2026-10-22T00:00:00Z",
      "version": 3,
      "revoked_at": null
    }

The implementation is in backend/app/routes/processing_consent.py and
backend/app/services/processing_consent.py. The patient-visible access history is a receipt
for Medora activity; it is not an interoperable provenance exchange.

## Conceptual standards mapping

| Medora field/control | Closest FHIR R5 concept | Current gap |
| --- | --- | --- |
| subject_id | Consent.patient | No FHIR resource serialization |
| recipient_id and provider | Consent.grantee / provision actor | Local strings, not referenced actors |
| purpose | provision purpose | Local enum, not a bound value set |
| valid_from, valid_until, revoked_at | Consent status and provision period | Prospective revocation only; no FHIR lifecycle operation |
| scopes | provision data/actions | Local category labels, not FHIR data references/actions |
| policy version and audit metadata | policy basis / Provenance-like audit data | No FHIR Provenance resource or policy document exchange |

IHE PCF is relevant as a future consent-exchange profile, but Medora has not implemented
its profiles, transactions, terminology bindings, actors, or conformance tests. A future
adapter would need to serialize a FHIR Consent resource, map local categories to a governed
terminology, and validate profile-specific exchange behavior. This document is a mapping
and implementation boundary, not a conformance statement.

## Deployment and regulatory scope

For an EU deployment, health data remain personal data after pseudonymisation. A deployment
would need a lawful basis and Article 9 condition, defined controller/processor roles,
retention/deletion and international-transfer arrangements, data-subject workflows, and a
deployment-specific assessment such as a DPIA where applicable. Medora makes no GDPR
compliance claim. Medical-device classification depends on intended purpose and use, and
clinical-investigation use has separate obligations. German AMG provisions concern
medicinal-product clinical trials; Medora is not designed or assessed as a trial system.
This is technical scoping, not legal advice.
