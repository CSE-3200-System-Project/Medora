# Optional MuRIL inference profile

The base model is `google/muril-base-cased`, declared Apache-2.0 by its publisher.
The recorded training-script base revision is
`afd9f36c7923d54e97903922ff1b260d091d202f`. See
https://huggingface.co/google/muril-base-cased/tree/afd9f36c7923d54e97903922ff1b260d091d202f
and the accompanying `COPYING.Apache-2.0` licence copy.

The Medora-derived ONNX graph, external weights, tokenizer and labels are hashed against
the archived evaluation's four asset identities before packaging. Their source is the
author-supplied local bundle, not a new Hub download. The profile evaluates existing
weights; it does not authenticate an unavailable historical three-seed training run or
retrain the model. The fine-tuning/generation recipes remain in the source snapshot.

The full derived training corpus is not included in this profile. Existing repository
notes flag unresolved administrative-data redistribution/language-review questions for
that corpus. Packing inference assets locally does not declare those issues resolved or
authorize public publication of the derived assets. Confirm the intended asset publication
basis separately; do not demand a new physician study to run these synthetic inference tests.

Approved prescription detector distribution uses its separate AGPL-3.0 notices and
corresponding source. Neither model profile contains private prescription images.
