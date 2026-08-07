# Finish the remaining non-OCR SoftwareX gates

Scope, from the readiness ledger's "not fully satisfied" list, minus C5/C6 (OCR,
withdrawn) which the requester excluded:

| Gate | What is outstanding |
|---|---|
| M-C8 | Licensed clinician sign-off on the 30 navigation fixtures |
| M-M5 | Frontend Lighthouse run and API latency benchmark never executed |
| M-M7 | Authenticated Playwright journeys need synthetic credentials |
| M-M11 | Groq and Vapi retention/ZDR settings unverified in their consoles |
| M-C1 | Zenodo deposit and DOI |

## Environment findings that bound what is executable here

Recorded before starting, because three of them were not true when the earlier
sessions ran:

- `backend/venv` and `ai_service/venv` **do not exist** on this machine. CLAUDE.md
  rule 1 forbids creating them, so every Python-side suite and benchmark is
  unrunnable in this session without the owner restoring them.
- Docker is not running (`failed to connect to the docker API`), so the
  integration/security suite and the clean-container gate cannot execute.
- `frontend/node_modules` was absent; `npm ci` restores it and is not covered by
  the venv rule.
- `tests/e2e/node_modules` is present.

## Todo

- [x] Probe toolchain: venvs, Docker, Node, lockfiles, installed Lighthouse CLI
- [x] Confirm the manuscript makes no latency or Lighthouse claim, so executing
      them adds evidence rather than repairing a stated claim
- [x] `npm ci` in `frontend/` — exit 0
- [x] `npm run lint` — exit 0, zero errors and zero warnings
- [x] `npm run build` — exit 0, production build
- [x] `npm run perf:bundle-budget` — exit 0, 5,050,990 client JS bytes, within budget
- [x] Run the release gate to get the current, exact failure list
- [ ] Lighthouse mobile and desktop, three runs each, on the three public routes.
      **Do not use the committed `upload.target`** — both `lighthouserc.*.json` upload to
      `temporary-public-storage`, which publishes the report and its screenshots to a
      public Google-hosted URL. This run keeps everything local.
- [ ] Feed the mobile reports to `tests/performance/frontend_perf_guard.mjs` and get a
      verdict against `baselines/web_vitals_baseline.json` (0.78 / 4700 ms / 0.02 / 100 ms)
- [ ] Record the measured scores as evidence; do not put them in the manuscript without a
      decision (word budget is 2,995 of 3,000)
- [ ] Update `SUBMISSION_READINESS.md` §2/§4 and the agent log with what ran and what
      stayed blocked

## Two things that had to be worked around

**`lhci autorun` cannot complete on this machine.** Two separate failures. The first is
that no Chrome is installed; the Playwright-managed Chromium (`chromium-1234`, build
151.0.7922.34) works when passed as `CHROME_PATH`. The second is that
`chrome-launcher` raises `EPERM` removing its temporary Chrome profile under
`%TEMP%`, which kills the Node process and aborts the whole autorun before it collects
anything. The crash happens strictly *after* the report file is written, so the sweep
invokes `lighthouse` once per run and checks the output file rather than the exit code.

**`frontend_perf_guard.mjs` averages every report in its directory together**, across
URLs and form factors, and uses a mean rather than a median. It is only meaningful if
pointed at a single form factor at a time.

## Corrections to the ledger found while working

- `SUBMISSION_READINESS.md` §5 cites `docs/defense/06_PROFESSOR_QNA.md` and
  `frontend/.lighthouseci/` as evidence. Neither exists: the `docs/defense/` tree was
  removed in 5a36a5a8, and `.lighthouseci` has never been committed.
- The release gate's `generated report did not pass: safety_results.json` is **not** a
  defect. `deterministic_passed` is `true`; the top-level `passed` is `false` solely
  because `navigation.clinician_reviewed` is 0 and `review_state` is `required`. The
  gate is correctly refusing to pass gate M-C8 on its own.

## Blocked, with the reason each is blocked

- **M-M5 latency half** — `api_latency_benchmark.py` needs `httpx` (no venv) and
  needs `MEDORA_PATIENT_TOKEN`/`MEDORA_DOCTOR_TOKEN`/`MEDORA_DOCTOR_ID`. Without
  tokens three of its four endpoints return 401 and the run measures the auth
  rejection path, not the endpoint. It also POSTs real bookings.
- **M-M7** — needs `E2E_EMAIL`/`E2E_PASSWORD` for a synthetic account. Creating one
  means writing to the live Supabase project's `auth.users`, which holds real
  patient data. Requires the owner's explicit go-ahead; not done unilaterally.
- **M-C8, M-M11, M-C1** — a licensed clinician, provider console access, and a
  Zenodo deposit respectively. No automation can close these truthfully.

## Second pass (authorized): venvs, Docker, M7, latency, all blockers

The author authorized creating the virtual environments, starting Docker, and
provisioning synthetic accounts, and asked for all three open decisions to be taken.

- [x] Rebuild both venvs on **Python 3.13** (3.14 fails: `pyiceberg` has no cp314 wheel)
- [x] Start Docker Desktop
- [x] Fix the landing-page LCP defect and re-measure: 0.72 → 0.91, LCP 12,282 → 2,205 ms
- [x] Vapi: browser `User-Agent` clears the Cloudflare 1010 block. `GET /assistant` 200,
      org endpoints 401 for both keys. Manifest records the documented worst case
- [x] Provision synthetic patient/doctor/admin; fix five defects in journeys that had
      never run; **Playwright 12 passed, 0 skipped, exit 0**
- [x] API latency benchmark: three protocol defects fixed, final run 155/155 zero failures
- [x] Suites: backend 62, ai_service 16, integration+security 29, booking 30/30, safety
      unchanged, clean containers pass, manuscript 18 pages / 2,995 words / 6 figures
- [x] Commit `f99079d`, record all nine verification receipts on it, all passing
- [x] Write `release_metadata.json`; gate matrix 19 passed / 2 blocked / 1 deferred
- [x] Clean up the 120 synthetic appointments the two benchmark runs created

## Review

**Executed and green:** `npm ci`, `npm run lint` (0 errors, 0 warnings), `npm run build`,
`npm run perf:bundle-budget` (5,050,990 client JS bytes, within budget), and an
independent manuscript recompile confirming 18 pages with zero overfull boxes and zero
undefined references or citations.

**Executed and red, which is the point of running it:** the frontend Lighthouse
benchmark, 18 runs across two form factors and three routes. Mobile `/` medians 0.72 /
12,282 ms LCP, failing both the 0.75 score floor and the 5,500 ms LCP ceiling in the
project's own `lighthouserc.mobile.json`. `frontend_perf_guard.mjs` exits 1 at
`lcp regressed by 28.79%`. Every other route/form-factor pair passes. Root cause
identified and reproducible across all three runs; not fixed, because the fix is a UX
behaviour change. Written up in `SUBMISSION_READINESS.md` §13.

**Found and fixed:** `dompurify <=3.4.12` (moderate XSS, GHSA-55q2-fjhq-7xh7) had
reappeared in the production dependency tree via `html2pdf.js`/`jspdf`, contradicting
the gate's "0 production vulnerabilities". Pinned to 3.4.13 through the existing
`overrides` block. `npm audit fix` was tried and reverted: it prunes `@playwright/test`,
`playwright`, `playwright-core`, and `fsevents` out of the lockfile, which breaks
`npm ci` for the dev toolchain. Re-verified with `npm ci` / lint / build / audit, all 0.

**Confirmed blocked, with the specific reason:**

- M-C8 — needs a licensed clinician. The release gate's
  `generated report did not pass: safety_results.json` is exactly this and nothing else:
  `deterministic_passed` is true, `navigation.clinician_reviewed` is 0.
- M-M11 — `GET https://api.vapi.ai/org` with the project key returns 403, so the
  organization ZDR flag is not readable outside the console. Groq exposes no such API.
- M-C1 — needs a Zenodo deposit.
- M-M5 latency half and M-M7 — both need the backend running, which needs
  `backend/venv`, which this repository's rules forbid recreating. M-M7 additionally
  needs synthetic accounts in a Supabase project that holds real patient data.

**Files changed:** `frontend/package.json` and `package-lock.json` (dompurify pin),
`docs/softwarex/SUBMISSION_READINESS.md` (§4, §6, §13, §14, agent log), and a new
`tests/performance/frontend_lighthouse_benchmark.mjs`. The manuscript was not touched:
it makes no performance claim, and at 2,995 of 3,000 words there is no room to add one
without cutting something else.

## Final state after the second pass

Two commits: `f99079d` (the fixes) and `20cc7d3` (receipts and gate corrections). All
nine verification receipts pass at `20cc7d3`. Gate matrix 19 passed / 2 blocked / 1
deferred. `check_softwarex_release.py` exits 2 with exactly three failures, all of them
M-C8 (licensed navigation review, deliberately out of scope) or M-C1 (Zenodo deposit).

`verification.json` and `release_metadata.json` are intentionally left modified in the
working tree — committing them advances HEAD and invalidates the receipts they carry.
That is the release manager's final step.
