# Security Policy

Medora is research software and has not undergone an independent security audit or
penetration test. See [README.md](README.md) for the full scope of what has and has not
been validated.

## Reporting a vulnerability

Email **saeed.alam@cse.kuet.ac.bd** with a description of the issue, the affected
component, and steps to reproduce. Please do not open a public GitHub issue for
unpatched vulnerabilities involving patient data, authentication, or authorization.

We aim to acknowledge reports within 5 business days.

## Scope

In scope: the `backend/`, `frontend/`, and `ai_service/` applications in this repository.

Out of scope: third-party services Medora integrates with (Supabase, Groq, Gemini,
Cerebras, Vapi, Azure Document Intelligence) — report those to the respective vendor.

## Known limitations

Rate limiting (`backend/app/core/rate_limit.py`) is in-process and per-worker; it does
not provide a cluster-wide guarantee behind multiple replicas. Deployments running more
than a couple of workers should front the API with a shared-store limiter or a gateway
that enforces limits centrally.
