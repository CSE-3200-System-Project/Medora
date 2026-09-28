# Medora supplied YOLO26s prescription-region detector

## Current artifacts and use

Architecture: Ultralytics YOLO26s, object detection, seven labels in order: Date,
Frequency, Lines, Medication, Passport-as2v, Pilgrim, Quantity. The application uses
Medication (index 3) as the prescription text-region parent class. The inherited label
names are not a declaration that private passport/identity images are distributed.

ONNX input: float32 RGB `[1,3,640,640]`, scaled to `[0,1]`; output `[1,300,6]` end-to-end
detection rows. Use the application's existing resize/coordinate mapping in
`ai_service/app/yolo.py`, not an invented new preprocessing pipeline.

- PT SHA-256: `5976dfe367bc4586b9c4c908570b03af17bfbacd1240ae52b8a615e9292f33a2`
- ONNX SHA-256: `476ed2eaacaa8452ddc96a3a18e38b5cb60237c8cf14b78473cf314cecfdf2a8`
- Corrected private notebook SHA-256:
  `12f9afb0a406f9802b4c5b7830757d46283f9ac0b3ed1083d7b05d2811c0e0e3`

Checksums were recorded prospectively, not at training. Copying the same bytes from Colab
does not change their checksum; retraining or a new export may change it. No retraining is
needed to retain or distribute these exact artifacts.

## Training recipe and dataset availability

The author identifies workspace project `prescription-oeiss-f5hvb-v8dd2`, version 2:
4,805 training, 513 validation and 128 test generated images; the provided dashboard
lists 1,641 project images before version generation. Preprocessing: auto-orient,
640×640 stretch, contrast stretching. Roboflow training augmentation: five outputs per
training example, ±15° rotation/shear, grayscale 4%, hue ±5°, brightness ±15%, blur
up to 0.1 px, noise up to 0.1% and 10-px motion blur. These are author-provided version
settings, not a independently recovered hash of the private export.

The notebook logs Colab NVIDIA T4, Python 3.12.12, PyTorch 2.10.0+cu128, Ultralytics
8.4.21, 40 epochs, 640-pixel input, batch 16, seed 0 and deterministic training. Supplied
PT metadata independently records 8.4.21, detect/yolo26s, epochs 40, batch 16, image
size 640, seed 0, deterministic true and `/content/datasets/data.yaml`. That path does
not itself identify a Roboflow version.

The PT embedded date is 2026-03-08; the author's v2 dashboard says generated
2026-03-09. Clock/time-zone or different-run explanations have not been established.
The public documentation therefore distinguishes author-reported dataset lineage from
observed checkpoint metadata, rather than treating the notebook as a contemporaneous
artifact attestation.

## Prospective verification and limitations

`docs/softwarex/generated/detector_metadata_inspection.json` records inspected metadata.
The ONNX identifies export library 8.4.19 and date 2026-03-19. The supplied PT and ONNX
have **204 matching named parameter tensors**, all agreeing exactly after standard PT
fusion in the verification environment. This links the currently supplied learned
parameters; it is not proof of the historical dataset/export process. The remaining
ONNX initializers are not asserted identical by this comparison.

Three non-patient synthetic inputs produce finite `[1,300,6]` outputs in both runtimes.
Raw row-wise predictions are not allclose; near-zero-confidence top-k rows differ while
confidence-vector differences are below 9×10^-8 in these probes. Consequently
full prediction equivalence is not claimed. The report retains both positive parameter
agreement and negative raw-output agreement; it is not an accuracy benchmark.

The notebook validation log (P 0.943, R 0.938, mAP50 0.964, mAP50–95 0.647) and the
supplied PT's embedded metrics (P 0.9621, R 0.95353, mAP50 0.97719, mAP50–95 0.68073)
are separate historical records. Their different values are not reconciled by assuming
the same run or split. Neither is presented as freshly measured accuracy of the released
ONNX or as a result on the 128-image test split. No held-out accuracy, independent
source-split validation, clinical utility or handwriting-recognition accuracy is claimed.

Intended use: experimental research integration, with mandatory user review of extracted
medication text. Handwritten OCR remains the paper's negative finding. See
AUTHOR_DISTRIBUTION_DECISION.md for private-image exclusion and DISTRIBUTION.md for
the AGPL/source distribution route.

## Reproducing artifact inspection without private images

Create an isolated environment and install the verification pins in
`tools/softwarex/requirements-detector-verification.txt` (CPU torch/torchvision index noted
there). The metadata inspector uses ONNX Runtime without executing arbitrary checkpoint
pickle globals. The numerical comparison loads the trusted author-provided PT through
Ultralytics.

```powershell
python tools/softwarex/inspect_detector_artifacts.py --pt ai_service/models/Yolo26s/Yolo26s-prescription-5.pt --onnx ai_service/models/Yolo26s/Yolo26s-prescription-5.onnx --output detector-metadata.json
python tools/softwarex/verify_detector_pair.py --pt ai_service/models/Yolo26s/Yolo26s-prescription-5.pt --onnx ai_service/models/Yolo26s/Yolo26s-prescription-5.onnx --output detector-pair.json
```

For a new prospective export, copy the frozen checkpoint to a new directory first and run
`yolo export model=<copy.pt> format=onnx imgsz=640 batch=1 opset=12 dynamic=False half=False simplify=True`.
Record the new hash and export environment as a new artifact. Do not overwrite the supplied
file or call this proof of the old historical export. Training uses the output-free
notebook and private authorized dataset access. Exact retraining cannot be reproduced from
the public package because the images are intentionally withheld.
