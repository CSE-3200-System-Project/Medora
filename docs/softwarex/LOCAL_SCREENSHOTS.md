# Latest local Docker screenshot session

From the repository root:

```powershell
docker compose -p medora-screenshots -f docker-compose.screenshots.yml up -d --build
docker compose -p medora-screenshots -f docker-compose.screenshots.yml ps
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:8000/health
- Backend database readiness: http://localhost:8000/ready
- API documentation: http://localhost:8000/docs

Use the existing demo credentials privately. Frontend browser calls target localhost;
server-side calls use Docker's backend service. This is the current working-tree
source, not a frozen publication release. The frontend runs in development mode,
with live source mounts and separate Linux dependencies/cache volumes.

**Shared-data boundary:** auth, storage and database use the existing Supabase `.env`
configuration. Local Docker does not make that database private or disposable.
Normal requests can still change shared data; restrict capture to synthetic/demo
records. Startup schema repairs, avatar backfill, background appointment jobs,
reminder dispatch and migration commands are disabled in this session. Auth and
normal API controls are not bypassed. AI requests still follow the configured
providers and consent controls; this compose setup does not manufacture responses.
The separate OCR service is not started for these dashboard/consent screenshots.
Voice/OCR integrations may need their own services and existing credentials.

Figure 4 has now been captured authentically from this local session in both locales.
`patient/dashboard_frontend.png` and `patient/dashboard_frontend_bangla.png`
under `docs/softwarex/imagesui/` are the paper sources. They retain frontend navigation,
the heading and both feature panels; the consenting author's header is visible.
`dashboard.png` and
`dashboard_bangla.png` preserve the two-card views with the calculation disclosure open.
The author account was used with permission; these are not claimed to be synthetic
records. Unrelated measurements are outside the frame; the separate open-disclosure
views also exclude the account header. `generated/dashboard_capture_receipt.json` records hashes and capture
conditions. Figure 4 was rebuilt and inspected in the compiled PDF. No additional
dashboard screenshots are needed unless the UI/data state changes.

For any replacement, capture the new **Today's record coverage** gauge and **Today's measurement groups**
in English and Bengali using equivalent synthetic data. A 0/4 display means no
eligible daily records; do not fabricate populated records merely for appearance.
The day window is UTC; its dates are human-readable and the snapshot uses Bangladesh
local time. The formula is visible in the details disclosure. Use synthetic
names/contact details throughout each capture; crop the account header if its display
name/avatar is not synthetic. Do not include credentials,
real prescription images or real patient histories. Inspect the original image
before putting it in the paper directory.

Stop this session without deleting data/cache volumes:

```powershell
docker compose -p medora-screenshots -f docker-compose.screenshots.yml stop
```

Restart after source changes: the frontend hot reloads; rebuild the backend with
the first command. Do not use this mode as a full background-worker test or
production benchmark.
