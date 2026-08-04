# Contributing

Medora is research software accompanying a SoftwareX submission. Contributions are
welcome, with a few expectations specific to a healthcare codebase.

## Before you start

- Read [README.md](README.md) for scope, safety semantics, and local setup.
- Read [SECURITY.md](SECURITY.md) before touching auth, consent, or data-sharing code.
- Check [docs/INDEX.md](docs/INDEX.md) for the maintained architecture and workflow
  reference; `docs/architecture/` and `docs/workflows/` are ground truth over anything
  else in `docs/`.

## Ground rules

1. **Medical safety.** Never write code that diagnoses, prescribes, or makes autonomous
   clinical decisions. AI features are assistive only — they summarize, structure, and
   suggest for a human clinician to approve. See the AI privacy stack described in
   README.md before adding any new AI feature.
2. **Root-cause fixes.** No temporary patches or silent workarounds. If a fix reveals a
   deeper issue, say so in the PR description rather than papering over it.
3. **Minimal blast radius.** Keep changes scoped to what the task requires. Avoid
   bundling unrelated refactors into a fix or feature PR.
4. **Naming convention.** Frontend is camelCase, backend is snake_case. Server Actions
   convert explicitly at the boundary.
5. **No emojis in UI.** Vector icons (lucide-react) only.
6. **i18n.** All user-facing strings go in `frontend/i18n/messages/{en,bn}/*.json` — no
   hardcoded copy. Verify Bangla text doesn't break layout.

## Workflow

1. Fork and branch from `main`.
2. Make your change, following the patterns already established in the surrounding code
   (reuse existing utilities and services rather than introducing parallel ones).
3. Run the relevant test suite before opening a PR:
   ```bash
   MEDORA_SKIP_DOCKER=1 ./run_tests.sh   # fast pass
   ./run_tests.sh                         # full suite, needs Docker
   ```
4. For schema changes: model → schema → route (PATCH and GET) →
   `alembic revision --autogenerate` → frontend. See the "Adding an onboarding field"
   convention in `docs/architecture/database.md`.
5. Open a PR describing the change and its motivation. Link any related issue.

## Reporting bugs and security issues

Functional bugs: open a GitHub issue with reproduction steps.

Security vulnerabilities: do **not** open a public issue. Follow the process in
[SECURITY.md](SECURITY.md).
