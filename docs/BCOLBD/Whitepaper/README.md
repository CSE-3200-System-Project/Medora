# Medora 2.0 BCOLBD whitepaper

This directory contains the BCOLBD 2026 AI-category whitepaper source, its
review artifacts, and the vector diagrams created for the submission.

Submission copy: `Team_Medora_Medora_2.0_BCOLBD_2026_AI.pdf`. The standard
build also writes `medora_bcolbd_whitepaper.pdf`; both files should be identical.

## Build

From this directory:

```powershell
xelatex -interaction=nonstopmode -halt-on-error medora_bcolbd_whitepaper.tex
xelatex -interaction=nonstopmode -halt-on-error medora_bcolbd_whitepaper.tex
```

XeLaTeX is required because the artifact names are rendered in Bengali script.
The English body uses Times New Roman at 12 pt. Bengali wordmarks use Kalpurush.

## Evidence policy

- Repository-generated JSON/TeX and executable tests are the evidence of record.
- The SoftwareX manuscript supplies reusable descriptions but not new results.
- A result is never inferred from a proposed experiment.
- `Shimana`, `Maya`, and learned PHI recognition are labelled as planned until
  archived result files exist; Arohon is specified, Lokkhon is measured, and
  Akkhor is deployed.
- Prescription-OCR accuracy is not claimed.

See `claim-evidence-map.md` for the provenance and status of each major claim,
`outline.md` for the paper story and paragraph roles, and `self-review.md` for the
adversarial reviewer pass and unresolved experimental work.
