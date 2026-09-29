# SoftwareX final human gates

This is the active revision-only handoff for SOFTX-D-26-01036. No new BCOLBD work,
216-case privacy study, two-reviewer study or whole-corpus doctor audit is prescribed here.
The paper uses limited fixture/experimental claims rather than claiming clinical validation.

## Prepared and checked

- Both working TeX files contain the teacher-first merge, retaining all four authors,
  the teacher's workflow/Impact descriptions and latest review artifacts. The unchanged
  submitted text is preserved under `submission-history/`. See `README.md` for entry points.
- Local Docker frontend/backend run at http://localhost:3000 and http://localhost:8000.
  The database is shared Supabase, not disposable; startup maintenance/workers are disabled.
- Figure 4 now uses authentic English/Bengali frontend views, retaining navigation,
  dashboard heading, coverage and measurement-group panels. The consenting author's
  account header remains visible, as in the author-supplied screenshots. Other health
  records are outside the frame. Separate open-disclosure captures preserve readable timestamps
  and calculation. The figure was rebuilt and inspected in the compiled PDF. The six other
  existing panels do not automatically require recapture; inspect their final readability
  and privacy when approving the submission.
- The multi-source medicine candidate has 46,614 rows, 6,153 projected drugs and 52,767
  search terms. All rows and 72,969 contributor links were independently checked against
  hashed raw inputs. Repeat builds agree byte for byte. Per-row/field changes, exclusions,
  manifests, seed dry-run and an optional 30-case offline review packet are prepared.
  Historical CSV/runtime evidence and the shared database have not been replaced.
- Current PT/ONNX identities, sanitized training recipe, model card and parameter check
  are prepared: 204 matched named tensors agree exactly after fusion. Historical dataset
  dates/metrics are explicitly unresolved, not retrospectively invented. No held-out
  detector accuracy or complete prediction equivalence is claimed.
- The authors' stated research-use image consent and author/institution weight-release
  decision are recorded. Private images/exports and image-bearing original notebook are
  excluded. No image-publication task or invented ethics-committee approval is required.
  The combined detector/source bundle uses AGPL-3.0 with preserved MIT/third-party notices.
- Code Ocean runner, source packager, pinned direct dependencies, frozen-table renderer,
  run-receipt recorder and release/archive identity checks are prepared.

## 1. Supply actual medicine evidence, not thousands of signatures

The author selected **retain the multi-source public corpus after documenting permissions**.
The Mendeley-only alternative is not the chosen release.

Provide the applicable collection/redistribution basis for S1 (MedEx), S2 (MedEasy-described
source) and S4 (DGDA-described source). S5 Mendeley CC BY 4.0 attribution/change notice is
documented. Platform uploader licence labels alone do not establish upstream authorization.
S3 Indian indication prose is excluded from the new candidate. Keep correspondence/contacts
private and approve only a non-secret summary in
`data/medicine_reference/SOURCE_PERMISSION_RECORD.json`. A draft request is in
`revisions/MEDICINE_PERMISSION_REQUEST.md`; it has not been sent on the authors' behalf.

For the reported qualified-doctor source review, obtain one dated scope/result note:
qualification/role, source versions, what was actually checked, concerns and limited
conclusion. This is approximately 10–15 minutes, not row-by-row approval. If a doctor already
reviewed sources, do not relabel that as whole-corpus validation.

A new 30-case content spot-check is **optional for the limited claims**, about 40–70 minutes,
not population-accuracy evidence. The prepared private packet is
`dist/softwarex-medicine-v2-full-finalized/reviewer/`: open `OPEN_ME.html`, load the bundle,
select verdicts and export. Authors can do reference lookup beforehand. Instructions and
the export-summary command are in `revisions/MEDICINE_REVISION_REBUILD.md`.

Once actual permissions and review scope/corrections are recorded, the repository-side pass
can promote the chosen CSV together with provenance, build manifest and notices, update
counts/tests, and rebuild paper/response. Do not run the seed writer on the shared database:
it clears reference tables. Any live migration must preserve existing medication references.
Completeness, current DGDA registration and obsolescence remain unknown without actual checks.

## 2. Approve the final text and capsule citation

Confirm that the ethics wording reflects the authors' actual consent/institutional decision,
without asserting an unavailable ethics approval number. No new public prescription-image
release is requested. Review the compiled PDF and point-by-point response; Figure 4 is done.

Separately record the institutional-review determination for the **original identifiable
image collection and research/training use**: approval, exemption, waiver, or absence of
formal review, who determined it, and a reference only if one exists. Research-use consent
and approval to release derived weights do not by themselves establish that status.
Private images and consent records do not need to be uploaded to provide this scope statement.

`FINAL_REVISION_REPORT.md` lists every remaining mandatory gate and the later agent-doable
promotion, final testing, packaging and response updates; this file is not a claim that
only human work remains.

Sign in to the author-owned Code Ocean account. Create the capsule draft and return its stable
reader-accessible citation URL/version, or coordinate an editor-approved review link if that
is the journal's requested form. Never put account credentials or an owner-only private URL
in public manuscript metadata. Insert the citation before freezing the final source.
See `CODE_OCEAN_CAPSULE.md` for platform layout and the bounded reproduction claim.

## 3. Freeze and verify the exact capsule candidate

After corpus decisions/promotion, manuscript/response, version, reserved Zenodo version DOI
and capsule citation are final, align `CITATION.cff`, `codemeta.json` and
`release_metadata.json`, commit the clean candidate and record verification receipts.
Match the approved manuscript title, four-author list and contributions in new-release
citation/capsule metadata; do not rewrite historical release identities or author records.

```powershell
python tools/release/package_softwarex_capsule.py --dry-run
python tools/release/package_softwarex_capsule.py
```

Upload `dist/Medora-SoftwareX-CodeOcean-<commit>.zip` with `code/` in `/code`, enter
`metadata/metadata.yml`, choose CPU Python 3.11 and mark `/code/run` as the run file.
This focused run uses synthetic boundary tests and frozen reports, not live AI credentials,
medicine data, private images, detector accuracy or freshly measured host-specific latency.
The approved detector is distributed separately with AGPL/corresponding source; its omission
from this fixture capsule is a scope choice, not another permission decision.

Perform Code Ocean's Reproducible Run. Preserve the capsule/version URL, DOI if minted,
run ID, source commit and downloaded `reproduction_manifest.json`. Record it using:

```powershell
python tools/release/record_code_ocean_run.py <downloaded-manifest> --capsule-url <url> --capsule-version <version> --run-id <run-id>
```

The receipt must refer to the exact candidate. Any source/data/manuscript/environment change
after the run needs a new candidate and run. The Code Ocean run is a computation receipt,
not new clinical or independent held-out performance evidence.

## 4. Publish one consistent new release

The existing v1.0.2 tag/Zenodo record has an archive that embeds v1.0.1 identity. Editing
current files cannot repair those published bytes. Use a new version (expected next patch
v1.0.3, confirm tags before release), not the old DOI `10.5281/zenodo.21846125`.

1. Complete the nine required verification checks and save receipts/logs on the final source
   commit, including its Code Ocean run. Do not silently retitle historical benchmarks as
   fresh measurements of the rebuilt corpus.
2. Push the corresponding new GitHub tag/release, resolving to that commit.
3. Run `python tools/release/build_zenodo_deposit.py` from the tagged candidate. The builder
   binds exact identity and detached verification/capsule receipts into the archive; its
   checksum is recorded externally, not self-referentially inside the ZIP. A combined
   detector-containing deposit must not be labelled blanket MIT.
4. Upload that exact archive to its reserved Zenodo version DOI. Download the published file
   and run `python tools/release/record_zenodo_archive.py <downloaded-zip>`.
5. Run `python tools/release/check_softwarex_release.py`. Tag, commit, DOI, capsule,
   internal metadata, artifact hashes and downloaded file must agree. Compile the frozen
   paper and verify the final response's page references.

The final check is intentionally not green before these platform receipts and permissions
exist. Do not edit old IDs or claim a completed capsule/deposit to bypass it. If published
bytes are wrong, correct the source/package and make another version under the concept DOI.
