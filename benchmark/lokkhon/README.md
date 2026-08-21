# Lokkhon — a bilingual clinical safety benchmark

**লক্ষণ** is the clinical sign: the symptom a system must not miss. It is also a homophone
of লক্ষ্মণ, whose লক্ষ্মণরেখা is the line that must not be crossed. The benchmark is named
for both.

Lokkhon asks whether the containment layer around an assistive clinical AI actually held,
in five specific ways, on inputs that are bilingual because the users are.

| Axis | Question | n |
|---|---|---|
| A | Does an emergency red flag escalate? | 30 clinician-reviewed |
| B | Does indirect prompt injection change what is disclosed? | 10 |
| C | Do identifiers leak, and is benign text over-redacted? | 134 |
| D | Does any of that hold under Bangla/English code-mixing? | 4 authored + 49 derived |
| E | Does the system decline where it would have been wrong? | risk–coverage over axis A |

Current results and their interpretation: **[RELEASE.md](RELEASE.md)**. Machine-readable
output: `results/lokkhon_v0.1.json`.

## Running it

```bash
python benchmark/lokkhon/generate_axis_d_cases.py   # rebuild the derived axis D corpus
python benchmark/lokkhon/run_lokkhon.py             # rebuild the release
```

Both are deterministic. Exit code 2 means an *undisclosed* failure; see the gate rule
below. No network access and no API key is needed — the underlying harness pins
`AI_PROVIDER=mock` and refuses to run against anything else.

## Design decisions worth knowing before you read a number

**The runner scores nothing itself.** Axes A–C are computed by
`tests/benchmarks/run_safety_benchmarks.py` — the harness that produced the archived
v1.0.2 results and that the release gate runs — imported rather than reimplemented. A
benchmark whose published numbers come from a second copy of the scoring code is measuring
the copy. Axis D's derived corpus goes through the same `score_privacy_case` function as
the authored one, for the same reason.

**Passing and being right are different booleans.** Every case carries `passed` (a hard
assertion, and the only thing that can turn the gate red) and `matched_expected` (the
measurement, which gates nothing). That split is what lets measured precision sit below
1.00 — the honest outcome for a redactor with documented blind spots — without a *known,
declared* limitation failing a release. A case flagged as a limitation that starts passing
is reported as `stale_limitation`, so the disclosure gets retired instead of quietly
misleading a reader.

**Every rate ships with its denominator and a bootstrap interval.** At n=4, n=10, n=30
a point estimate carries far more apparent precision than it has. `proportion_ci` takes
counts rather than a ratio specifically so the denominator survives into the report.

**Authored and derived cases are never pooled.** Axis D could report n=53 and a single
recall figure. It does not, because 49 of those are mechanical transforms of the other 4
and share their identifiers, clinical text, and authoring judgement. They are real evidence
about the redactor's script sensitivity and they are not independent evidence, and the
release says both.

**The transliteration map is closed and declared.** `transliterate.py` covers exactly the
tokens in the corpus and raises `UncoveredToken` on anything else. A general transliterator
would be a large table nobody reviews, silently producing cases whose annotations no longer
match their text — which would measure the generator's bugs, not the redactor.

**Nothing here is tuned against the system under test.** The derived cases were generated
before they were scored, and the result (recall 0.878, weakest on Bengali numerals) is
reported as found.

## What Lokkhon does not measure

- **Prescription OCR accuracy.** No figure appears anywhere. The handwriting pipeline is a
  review-gated prototype; every extracted row is non-authoritative and requires clinician
  confirmation. An accuracy claim needs an independently adjudicated corpus that does not
  yet exist.
- **Live-provider behaviour.** Everything runs under the deterministic mock. Mock and live
  results are never pooled.
- **Calibration.** Axis E ranks by an ordinal proxy over deployed outputs. It measures
  whether that ordering carries information about error, not whether a score is calibrated.
- **Population-level clinical performance.** These are constructed containment baselines.

## Files

| Path | |
|---|---|
| `run_lokkhon.py` | Release runner. Imports the deployed harness; adds axes D and E, intervals, and versioning |
| `generate_axis_d_cases.py` | Derives the code-mixed corpus from authored Bengali fixtures |
| `transliterate.py` | The closed, declared romanisation map |
| `abstention.py` | Axis E: risk–coverage, AURC, and the top-tier inversion diagnostic |
| `bootstrap.py` | Percentile bootstrap, fixed seed |
| `schema/case.schema.json` | Case contract for both case families |
| `datasets/axis_d_derived_cases.jsonl` | Generated; do not hand-edit |
| `results/lokkhon_v0.1.json` | The release |

Source fixtures live in `tests/benchmarks/datasets/` alongside the harness that scores
them.

## Citing

See [`CITATION.cff`](CITATION.cff). Cite the benchmark release and the archived Medora
software it scores (Zenodo `10.5281/zenodo.21846125`).
