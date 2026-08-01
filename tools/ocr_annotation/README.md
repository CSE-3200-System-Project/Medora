# Medora OCR annotation workspace

This loopback-only tool supports the SoftwareX prescription gold-standard workflow. It never uploads images. Start it from the repository root:

```powershell
python tools/ocr_annotation/server.py
```

Open `http://127.0.0.1:8765`, enter a reviewer identifier, and choose the assigned role. The `independent` role cannot read prelabels or primary-author annotations. Labels are atomically saved beneath `tests/benchmarks/annotations/` and should be reviewed before committing.

Generate or verify the corpus inventory first:

```powershell
python tests/benchmarks/generate_ocr_manifest.py --check
```

Keyboard shortcuts: `J`/`K` move between records, `S` saves, `R` selects an Rx box, `L` selects a line box, `N` adds a medication row, and `?` opens the shortcut reference. Draw a box by dragging on the full-image canvas. The first Rx box drives the crop preview.

Release rules and reviewer responsibilities are defined in [annotation_protocol.md](../../docs/softwarex/annotation_protocol.md).

After every unique record is adjudicated, freeze reviewed metadata and the
group-preserving split without editing JSON by hand:

```powershell
python tests/benchmarks/freeze_ocr_manifest.py --approval-authority "..." --approval-date YYYY-MM-DD --approval-reference "..."
python tests/benchmarks/build_ocr_gold_standard.py
```

The freeze command refuses unreviewed fields, identifying group labels, missing
adjudication, ineligible independent reviewers, or a writer/template group that
cannot be kept wholly within a 21-record development set.
