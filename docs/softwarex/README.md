# SoftwareX manuscript sources

`medora_softwarex.tex` is the canonical revised manuscript used by the build and release
checks. `Medora-Overleaf-First-Submission.tex` is now its aligned Overleaf working copy.
Both contain the teacher-first merge; use either, not two different manuscript versions.

The unchanged submitted source is preserved in
`submission-history/Medora-Overleaf-First-Submission.tex`. It is historical reference,
not the current manuscript, corpus-permission statement, or reproducibility evidence.

The merge retains the teacher's four-author list and CRediT statement, five-section
structure, patient/clinician workflows, reference deployment, voice features, and research
reuse discussion. Review-required changes cover claim scope, measurements, provenance,
detector documentation, ethics/privacy, interoperability, references, and dashboard figures.
See `revisions/MANUSCRIPT_COMMUNICATION_CHECK.md` for the merge/evidence map.
`FINAL_REVISION_REPORT.md` consolidates the retained results, all-reviewer status and
complete remaining revision-only sequence. `response_to_revision.md` maps all 32 items.

Build from this directory:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error medora_softwarex.tex
pdflatex -interaction=nonstopmode -halt-on-error medora_softwarex.tex
```

The resulting `medora_softwarex.pdf` is the reviewable revision draft. Submission still
requires actual source-permission/review-scope records, the Code Ocean citation/run, and
new release/archive identity. `FINAL_HUMAN_GATES.md` is the current revision-only handoff.
Historical metadata still describes v1.0.2; it must not be relabelled as a completed new
release. Final citation metadata must match the approved manuscript title and four authors.
