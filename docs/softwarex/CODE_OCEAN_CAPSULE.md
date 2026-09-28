# Code Ocean capsule handoff

This is a narrow SoftwareX reproduction capsule, not a deployment of the full Medora
application. Its headless run executes the focused synthetic fixture tests and regenerates
the safety and booking tables from the frozen machine-readable reports. It does not
rescore the development privacy data as held-out evidence, rerun the host-specific booking
timing experiment, call hosted AI providers, or establish clinical validity. The run needs
no patient account, provider key, clinical dataset, or live booking.

The Code Ocean source check is mechanical: it verifies that the declared run can execute
and produce outputs. It does not independently verify that the paper's scientific claims
follow from those outputs.

## Prepared source bundle

The repository is not laid out as a Code Ocean capsule at its root. The project source is
at the repository root, while the Code Ocean metadata draft is nested at
`codeocean/metadata/metadata.yml`; a direct GitHub import will not necessarily map those
files into the platform's `/code` and `/metadata` areas. The root `data/` tree also
contains assets that must not be uploaded without a rights decision.

After the final candidate is committed to a clean Git tree, create the prepared bundle:

```powershell
python tools/release/package_softwarex_capsule.py --dry-run
python tools/release/package_softwarex_capsule.py
```

The builder creates `dist/Medora-SoftwareX-CodeOcean-<commit>.zip` with this layout:

- `code/`: the committed project snapshot, focused tests, synthetic fixtures, frozen
  reports, run entry point, and a manifest recording the exact source commit and hashes;
- `metadata/metadata.yml`: the capsule metadata draft;
- `README_UPLOAD.md`: upload and scope notes.

The bundle deliberately withholds the consolidated medicine CSV, YOLO weights, BCOLBD-only
materials, raw and derived UI screenshots, and review correspondence. Those files are not needed
for this run. Medicine-source permissions still need evidence; private prescription
images are intentionally not distributable. The authors/institution have approved
derived detector-weight distribution, and a separate AGPL/corresponding-source bundle
is prepared. Omitting that optional model from this focused CPU fixture run is a scope
choice, not a request for another author approval. The full list and reasons are in
`/code/CAPSULE_SOURCE_MANIFEST.json`. This scoped capsule is not a substitute for resolving the separate
public-release decisions listed in `FINAL_HUMAN_GATES.md`.

The builder refuses a dirty worktree, so the bundle cannot silently contain an uncommitted
mix of files. It stamps the commit into `/code/CAPSULE_SOURCE_COMMIT`; the run manifest
uses that stamp instead of borrowing an unrelated commit from the old release metadata.

## Author-side platform steps

1. Sign in to the author-owned Code Ocean account in the browser. Do not share passwords,
   session cookies, patient/doctor credentials, or provider keys in the repository or this
   capsule.
2. Confirm with the SoftwareX editor whether they expect a journal-integrated private
   peer-review capsule or a public published capsule. Do not put an owner-only private URL
   into manuscript metadata intended for readers. Code Ocean's journal integration is
   journal-specific; do not assume SoftwareX uses its peer-review integration.
3. Create the capsule, then use the platform's current file-import/upload workflow to put
   the bundle's `code/` contents in `/code` and enter `metadata/metadata.yml` in the
   metadata editor. The source commit and omissions are recorded in
   `/code/CAPSULE_SOURCE_MANIFEST.json`.
4. In the Environment Editor, select a CPU environment with Python 3.11 and allow network
   access to install the pinned requirements used by the run. The entry script installs
   `backend/requirements-release.txt` and `tests/requirements-release.txt`; no hosted
   provider credentials should be configured. Mark `/code/run` as the run file.
5. Click **Reproducible Run**. Inspect the complete `/results` output and preserve the
   Code Ocean capsule ID/URL, capsule version, computation/run ID, and the source commit
   shown in `reproduction_manifest.json`. The manifest must identify the packaged commit,
   not the current v1.0.2 release by fallback.
6. If any code, data, environment, or metadata that affects execution changes, commit the
   capsule changes and perform another Reproducible Run. Use the run from the final
   committed capsule version for the revision response.
7. Save these results for the release handoff: the reader-accessible capsule/version URL;
   Code Ocean DOI if publication mints one; capsule version; run ID; source commit; and
   confirmation that every required output exists and the run succeeded. If the journal
   separately requests an editor-approved private review link, return it for the editorial
   portal only; the article and release receipt still require the reader-accessible URL.
   Download `/results/reproduction_manifest.json`, then from the unchanged candidate
   checkout record its public receipt with:

   ```powershell
   python tools/release/record_code_ocean_run.py <downloaded-manifest> `
     --capsule-url <public-capsule-url> --capsule-version <version> --run-id <run-id> `
     --doi <doi-if-minted>
   ```

   Omit `--doi` if Code Ocean has not minted one. This stores the manifest hash and run
   identity in the detached release receipt; it does not alter the candidate source commit.

The manuscript C3/S3 field uses the stable capsule URL. A capsule DOI is minted only after
publication, so the URL/DOI choice must be coordinated with the editor before freezing
the paper. If the DOI is only known after publication and the manuscript is changed to add
it, freeze and rerun the final capsule from the resulting source snapshot.

## Expected run outputs

`/results` must contain:

- `fixture-tests.xml` — all focused tests passed;
- `safety_results.json` and `booking_results.json` — exact copies of the frozen reports;
- `safety_results.tex` and `booking_results.tex` — regenerated paper tables;
- `reproduction_manifest.json` — source commit, scope statement, and SHA-256 for each
  output.

The booking table is regenerated from recorded observations, not remeasured on the Code
Ocean host. The privacy/navigation metrics are not rescored because the development cases
are not an untouched evaluation set. The output manifest is a computation receipt, not new
performance or clinical evidence.

## Local sanity run

The Code Ocean bundle should be tested on the platform after upload. For a local Linux/WSL
sanity run, keep results inside a task-specific directory rather than writing to the
platform-only `/results` path:

```bash
RESULTS_DIR="$PWD/dist/softwarex-capsule-results" bash run
```

The local run installs pinned direct dependencies from package indexes. A successful local
run is useful preparation but does not replace the Code Ocean Reproducible Run.

## Author returns

When the capsule run is complete, provide the public capsule/version URL (or the
editor-approved review link), DOI if minted, capsule version, run ID, source commit, and
the saved `/results/reproduction_manifest.json`. Do not send credentials. The manuscript
and response can then replace the C3/S3 placeholder and cite only the exact capsule version
that passed.

The current platform behavior and the repo-specific folder/metadata constraints are
documented with first-party links in
[`revisions/code_ocean_workflow_research.md`](revisions/code_ocean_workflow_research.md).
