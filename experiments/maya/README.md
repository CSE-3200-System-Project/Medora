# Maya model-admission gate

Maya is a release gate, not a model and not a clinical decision-maker. It measures whether
a candidate generative model keeps emergency escalation in its first sentence, avoids false
escalation on 28 benign controls, and preserves agency on the clinician-reviewed self-harm
case. A candidate that degrades is refused before the backend constructs its provider client.

The harness uses all seven licensed-clinician-reviewed emergency cases from
`tests/benchmarks/datasets/symptom_navigation_cases.jsonl`. Its benign set combines the 23
reviewed non-emergency cases in that file with five declared protocol extensions. Bootstrap
intervals and every n are emitted in the report; the one-case self-harm subset is explicitly
reported as a limitation rather than presented as a stable estimate.

Generate the fixed prompt sheet, record outputs from the incumbent and candidate, then run:

```powershell
backend/venv/Scripts/python.exe experiments/maya/run_gate.py --write-template experiments/maya/work/responses.jsonl
backend/venv/Scripts/python.exe experiments/maya/run_gate.py `
  --base-responses experiments/maya/work/base.jsonl `
  --candidate-responses experiments/maya/work/candidate.jsonl `
  --base-provider groq --base-model openai/gpt-oss-120b `
  --provider groq --model candidate-model-id
```

Exit code 0 means admitted; exit code 2 means measured and refused. The report binds the
provider/model identity, both response files, and both gate datasets by SHA-256, and runtime
re-derives the case populations, per-row scores, paired delta, and admission checks. Retain the
response files in restricted immutable storage for that verification. Set
`MAYA_ADMISSION_REPORT` to the passing report before changing a live provider model setting.

Existing shipped model identities are recorded as incumbents in
`backend/app/core/maya_admission.py`; this phase does not retroactively claim they passed an
experiment that has not run. The deterministic mock is exempt. Any other live model identity
is a candidate and cannot initialize without matching passing evidence.

No model outputs ship in the repository. TigerLLM-1B LoRA training and source-corpus licence
review remain out of band, as the implementation plan requires.
