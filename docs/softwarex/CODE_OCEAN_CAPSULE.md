# Code Ocean capsule handoff

This is a narrow SoftwareX reproduction capsule, not a deployment of the full Medora
application. Its headless run executes synthetic fixture tests, recomputes archived safety
counts/booking statistics, scores current mock/rule safety and runs 90 fresh-slot booking
trials against a new native PostgreSQL 16 cluster. New reports are separate from the historical
tables. It does not treat development data as independent evidence, call hosted AI providers,
or establish clinical validity. The run needs
no patient account, provider key, clinical dataset, or live booking.

The runner also copies the archived privacy-extension and consent-scope reports and
regenerates `extended_results.tex`. Model-enabled profiles additionally execute MuRIL
inference at threshold 0.30 and the approved PT/ONNX synthetic-input parameter diagnostics.
`model_execution_coverage.json` states which profiles actually ran. No model is silently
downloaded, substituted or marked reproduced when absent. The archived consent-scope
provider experiment is not rerun; no hosted-provider key is required.

See `CAPSULE_RESULT_COVERAGE.md` for the result-by-result execution boundary. The
archived hosted-provider consent study is presented as an archived observation, not
as a fresh Code Ocean provider call.

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
# Selected public S4/S5 corpus + approved detector assets:
python tools/release/package_softwarex_capsule.py --medicine-build F:/CODE/System-Project/Medora/dist/softwarex-medicine-v2-licensed-public-portable --medicine-source-root F:/CODE/System-Project/Medora-Datasets/Medicine --detector-source-dir F:/CODE/System-Project/Medora/dist/detector-upstream-source
```

The builder creates a commit-bound ZIP; detector and PHI suffixes reflect included model
profiles. The name and content hash change with the
final commit. The bundle layout is:

- `code/`: the committed project snapshot, focused tests, synthetic fixtures, frozen
  reports, run entry point, and a manifest recording the exact source commit and hashes;
- `metadata/metadata.yml`: the capsule metadata draft;
- `environment/postInstall`: self-contained pinned environment build script;
- `environment/Dockerfile`: locally tested reference, not automatically a valid
  Code Ocean starter Dockerfile;
- `README_UPLOAD.md`: upload and scope notes.

The base bundle withholds the medicine CSV and detector weights; the selected public
S4/S5 and approved-detector flags add those exact inputs and source notices. It also
withholds BCOLBD-only materials, raw and derived UI screenshots, and review
correspondence. Private prescription images remain excluded in every profile. The
authors/institution have approved derived detector-weight distribution; an
AGPL/corresponding-source bundle is prepared. The full list and reasons are in
`/code/CAPSULE_SOURCE_MANIFEST.json`. This scoped capsule is not a substitute for resolving the separate
public-release decisions listed in `FINAL_HUMAN_GATES.md`.

The detector profile includes approved weights, sanitized recipe, AGPL licence and both
pinned Ultralytics source archives. The optional PHI profile includes four exact hashed
inference assets, not the full training corpus; author/publication rights are a separate
decision. Additional asset hashes are distinguished from committed application-source hashes.
Private image exports remain excluded. The medicine profile packages exact S4/S5 raw
inputs and build outputs, then reconstructs all five hashed core outputs during the run.

The builder refuses a dirty worktree. It stamps the commit into
`/code/CAPSULE_SOURCE_COMMIT` and records the complete included-file inventory, byte
counts, SHA-256 values, Git tree, and candidate release version in
`/code/CAPSULE_SOURCE_MANIFEST.json`. The run verifies every declared byte and the
commit marker before testing. Model profiles named in the manifest are required: if
their files are missing, the run fails instead of silently claiming an archival-only
result. The version is a candidate identifier, not a minted Zenodo DOI.

## Open Science Library/free-account fit

Code Ocean's [OSL quota guide](https://docs.codeocean.com/osl-guide/account-management/quota-measurement-usage)
lists **1 computation hour per month and 5 GB account storage for most users**;
the account menu shows the actual remaining quota and collaborating publishers
may allocate more. Its [Git-file guide](https://docs.codeocean.com/user-guide/v2.11.0/faq/faq-general)
states a **100 MB individual Git-file** and **2 GB repository** limit; the
[workspace guide](https://docs.codeocean.com/user-guide/v2.21.0/compute-capsule-basics/the-capsule-interface/file-navigation-app-builder-panel)
states a **5 GB workspace** limit. The selected package now rejects files above
100 MB. Its 140 MB medicine-provenance JSONL is transported as deterministic
gzip and decompressed/hashed during the run; private images and the unapproved
optional MuRIL bundle are not in the recommended free-account capsule.

The two virtual environments occupy about 2.8 GB together in the local Debian
test, before base-image/system packages. The environment script disables pip
caches and uses CPU-only detector dependencies. The author must check the
actual account quota and available CPU starter/slot before uploading: these
local size checks cannot certify account-specific capacity or platform success.
Avoid repeated trial runs until configuration is complete because run time
counts toward the monthly allowance.

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
4. Select a Code Ocean-supported **Python 3.11 CPU starter** and preserve its
   platform-generated Dockerfile and base image. Do not replace its `FROM` with the
   supplied PostgreSQL-image recipe merely because that recipe passed locally. Paste
   the bundled `environment/postInstall` into the Environment Editor's post-install
   script, or adapt its commands to the supported starter. It installs PostgreSQL 16,
   the exact main Python dependency pins, and (for a selected detector profile) a
   separate CPU PyTorch environment under `/opt/medora-detector`. The build needs
   internet for package indexes; the **Reproducible Run needs no package-index access**.
   Code Ocean's post-install build cannot access `/code` or `/data`, so the generated
   script embeds the committed pins. Do not replace it with a command referring to
   `/code/backend/requirements-release.txt`. Set these environment variables for the run:

   ```text
   PATH=/opt/medora-python/bin:/usr/lib/postgresql/16/bin:<keep-existing-PATH>
   MEDORA_CAPSULE_DEPENDENCY_MODE=preinstalled
   MEDORA_CAPSULE_DETECTOR_PYTHON=/opt/medora-detector/bin/python  # detector profile only
   ```

   Configure PATH in the Environment Editor without literally storing the
   `<keep-existing-PATH>` placeholder: prepend both paths to the image's actual PATH.
   `run` checks Python 3.11, every pinned main dependency, `pip check`, and the
   detector environment's pins before computation. Do not configure hosted-provider,
   patient, or production database credentials. Mark `/code/run` as the run file.
   The [Environment Editor guide](https://docs.codeocean.com/user-guide/v4.3.0/setting-up-the-environment/starter-environment)
   explains its starter/Dockerfile workflow; the [post-install guidance](https://docs.codeocean.com/user-guide/v4.1.0/setting-up-the-environment/the-post-install-script)
   explains why `/code` is unavailable during environment build. If a selected starter
   does not permit PostgreSQL 16 package installation or sufficient memory/storage for
   the model profile, choose another supported starter and rebuild; a local Docker pass
   does not substitute for this platform check.
5. Click **Reproducible Run**. Inspect the complete `/results` output and preserve the
   Code Ocean capsule ID/URL, capsule version, computation/run ID, and the source commit,
   Git tree and release candidate version shown in `reproduction_manifest.json`. The
   manifest must identify the packaged final commit, not historical v1.0.2 metadata.
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

The planned application release is **v1.0.3**; this is not an assigned Zenodo version
DOI, Code Ocean capsule version, or public URL. The manuscript C3 field uses the
reader-accessible capsule URL. A capsule DOI is minted only after capsule publication;
coordinate the URL/DOI choice before freezing the paper. If changing the paper later
changes the source commit, package and run again from that final commit.

## Expected run outputs

`/results` must contain:

- `capsule_input_verification.json` — every packaged input verified against its hash
  and source commit marker before the tests;
- `fixture-tests.xml` — all focused tests passed;
- `safety_results.json` and `booking_results.json` — exact copies of the frozen reports;
- `safety_results.tex` and `booking_results.tex` — regenerated paper tables;
- `privacy_extension_results.json`, `consent_scope_results.json` and `extended_results.tex`
  — copied archived component reports and regenerated comparison tables;
- `current_safety_results.json`, `current_booking_results.json`, and their test XMLs —
  fresh current-code measurements, separate from the archived tables;
- `current_privacy_extension_results.json` and `current_detector_verification.json` —
  fresh inference/conversion diagnostics only when those profiles are selected;
- `model_execution_coverage.json` — executed-profile evidence;
- `reproduction_manifest.json` — source commit/tree, release candidate, verification
  status, scope statements, and SHA-256 for each output.

The archived booking table is regenerated from recorded observations; a fresh 90-trial
booking experiment is stored separately. Development privacy cases can be rescored
with the selected MuRIL profile but remain development cases, not an independent
untouched evaluation. The output manifest is a computation receipt, not clinical evidence.

## Local sanity run

The Code Ocean bundle should be tested on the platform after upload. For a local Linux/WSL
sanity run, keep results inside a task-specific directory rather than writing to the
platform-only `/results` path:

```bash
MEDORA_CAPSULE_DEPENDENCY_MODE=install RESULTS_DIR="$PWD/dist/softwarex-capsule-results" bash run
```

`install` is a local-only fallback that downloads dependencies during the run. The
platform default is `preinstalled`, matching the prepared environment. A local pass
is useful preparation but does not replace the Code Ocean Reproducible Run.

## Author returns

When the capsule run is complete, provide the public capsule/version URL (or the
editor-approved review link), DOI if minted, capsule version, run ID, source commit, and
the saved `/results/reproduction_manifest.json`. Do not send credentials. The manuscript
and response can then replace the C3 placeholder and cite only the exact capsule version
that passed.

The current platform behavior and the repo-specific folder/metadata constraints are
documented with first-party links in
[`revisions/code_ocean_workflow_research.md`](revisions/code_ocean_workflow_research.md).
