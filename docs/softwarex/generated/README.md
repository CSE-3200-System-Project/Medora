# Generated SoftwareX artifacts

This directory is populated from immutable benchmark and release records. Generated
files are versioned release evidence; the final Zenodo archive explicitly includes
the following evidence after the release gate passes:

- `booking_results.tex` and `booking_results.json`
- `safety_results.tex` and `safety_results.json`
- `verification.json`
- dependency, container, and model checksum manifests
- `prearchive_gate_status.json` and `.md` (a fail-closed handoff snapshot, not a
  substitute for the final verification receipt)

No numerical result is edited in the manuscript by hand.

OCR accuracy is withdrawn as a claim (see `response_to_revision.md` C5/C6); no
`ocr_results.*` artifact is generated or required.

Use `tools/release/record_verification.py --name CHECK -- COMMAND...` for each
release check. It captures the tested commit, command, timestamps, exit status,
log path, and log SHA-256. A new commit invalidates earlier receipts; the release
gate requires all nine named checks to pass on the final commit.
