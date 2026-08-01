# Pre-Zenodo release handoff

The code and deterministic evidence are prepared, but the repository is not yet a
valid SoftwareX release. Complete these gates in order. Do not tag or deposit while
the fail-closed checker exits nonzero.

1. Complete the OCR labels in the loopback annotation workspace. The primary
   trained author corrects all 103 assisted drafts; a different licensed clinician
   or pharmacist labels the same 103 images in the blinded independent role; then
   adjudicate every disagreement.
2. Freeze reviewed corpus metadata and the group-preserving split:

   ```powershell
   python tests/benchmarks/freeze_ocr_manifest.py --approval-authority "VERIFIED AUTHORITY" --approval-date YYYY-MM-DD --approval-reference "VERIFIED REFERENCE"
   python tests/benchmarks/build_ocr_gold_standard.py
   python tests/benchmarks/ocr_accuracy_benchmark.py
   ```

3. Have the licensed reviewer assess the 12 bilingual navigation fixtures without
   seeing model output:

   ```powershell
   python tests/benchmarks/review_navigation_cases.py --reviewer-id REVIEWER --credential-role licensed_clinician
   python tests/benchmarks/run_safety_benchmarks.py
   ```

4. Record the actual Azure resource region, Groq organization zero-data-retention
   state, Vapi organization retention/zero-data-retention state, and frozen-run
   execution date in `tests/benchmarks/provider_manifest.json`.
5. Supply non-production synthetic patient, doctor, and administrator credentials
   and run Playwright without `E2E_ALLOW_SKIPS`.
6. Commit the curated changes. On that exact clean commit, use
   `tools/release/record_verification.py` for all nine named checks and generate the
   final OCR, booking, safety, checksum, and manuscript tables.
7. Copy `release_metadata.example.json` to `release_metadata.json` and enter the
   final commit and approval citation. Leave DOI/archive fields pending until the
   manual Zenodo deposit returns them.

Only after steps 1–7 pass should the release manager create `v1.0.0`, deposit the
exact tested archive manually, insert the DOI and archive SHA-256, rebuild the paper,
and rerun `python tools/release/check_softwarex_release.py`.
