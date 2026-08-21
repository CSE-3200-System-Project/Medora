# Shimana — the consent–utility frontier

**সীমানা**, the frontier. The registered question is one sentence: *what does consent
cost?* For a fixed clinical task, how does utility trade against measured PHI exposure as
the consent scope widens from local-only to unrestricted?

```bash
python tests/benchmarks/run_shimana_sweep.py --provider groq   # measure
python tests/benchmarks/run_shimana_report.py                  # analyse
```

The sweep calls a provider. The reporter does not — it reads a sweep file and computes, so
it cannot change the numbers it reports on.

## The five configurations

| | Records disclosed | Redaction |
|---|---|---|
| `L` | none | — |
| `L+K` | none, knowledge base only | — |
| `L+K+R` | 3 of 6 categories | on |
| `L+K+R+H` | all 6 categories | on |
| `U` | all 6 categories | **off** |

`U` is an offline counterfactual. Exposure under `U` is counted from the policy; the
payload is never sent to a provider.

## What the reporter emits

**Paired results.** Configurations compared on the same patients. At n=24 an unpaired
comparison mostly measures how much patients differ from one another rather than what
consent did. This needs per-patient values in the sweep; a sweep without them reports
`paired.available = false` rather than quietly substituting an unpaired number.

**Bootstrap intervals** on the deltas, not only on the levels, with the seed recorded.
`separates_at_95` says whether the interval clears zero — "we cannot tell these apart at
this n" is a finding, not a gap to fill with a point estimate.

**The non-dominated set.** A configuration is dominated when another achieves at least as
much utility with no more exposure. Dominated configurations are not points on a trade-off;
they are configurations with no reason to exist, and `dominated_by` names what beat them.

**A knee**, as maximum perpendicular distance from the chord between the front's extremes,
on min-max normalised axes. Suppressed for fronts under three points. Flagged
`degenerate: true` when it lands on a zero-utility configuration, because disclosing
nothing trivially minimises exposure and that is geometry rather than an operating point.

Plus `shimana_frontier.csv` in long format, one row per point, plottable without reshaping.

## Current result (archived `groq` sweep, 24 synthetic patients)

| Config | Utility | Exposure /1k | |
|---|---|---|---|
| L | 0.000 | 0 | non-dominated (trivially) |
| L+K | 0.000 | 0 | non-dominated (trivially) |
| **L+K+R** | **0.333** | **958** | **non-dominated** |
| L+K+R+H | 0.125 | 1,958 | **dominated by L+K+R** |
| U | 0.083 | 6,000 | **dominated by L+K+R** |

**Utility is not monotone in disclosure.** Past the redacted three-category subset, wider
consent bought *less* utility and more exposure. `L+K+R` reaches 400% of unrestricted
utility at 16% of its exposure.

That inverts the registered framing, which asked what fraction of unrestricted utility a
narrower configuration *recovers* — presuming unrestricted is the ceiling. It is not, on
this task. The report keeps the fraction above 1.0 and explains it rather than
renormalising to make the phrasing work.

Read it carefully before drawing a conclusion. Utility here is **source accounting**:
whether a grounded, correctly-sourced summary could be produced at all, not how good it
reads. A plausible mechanism for the drop is that more records give the model more chances
to emit an item it cannot ground, and one ungrounded item fails the whole contract. That is
a hypothesis this sweep does not test.

## Limitations

- n=24 synthetic patients; intervals are wide.
- Configurations vary both the record subset **and** the redaction policy, so a single
  delta cannot attribute a change to one of them.
- Utility is a binary contract check per patient, not a quality score.
- **Paired analysis is not available for the archived sweep.** It predates per-patient
  recording. The capability ships and the next live sweep populates it; the report says
  `unavailable` in the meantime rather than improvising.
- A mock-provider sweep was run during development and discarded: the mock satisfies the
  source-accounting contract unconditionally, so it measures the mock rather than consent.
  No mock frontier is published.
