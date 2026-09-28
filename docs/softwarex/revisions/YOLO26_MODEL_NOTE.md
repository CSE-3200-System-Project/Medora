# Supplied prescription-region detector: completed prospective evidence

The approved release artifacts are documented in
[the model card](../../../ai_service/models/Yolo26s/MODEL_CARD.md), with current PT/ONNX
hashes, the correct seven-class mapping, training metadata, output-free notebook and
[recorded author/institution distribution decision](../../../ai_service/models/Yolo26s/AUTHOR_DISTRIBUTION_DECISION.md).
Raw prescription images and original notebook outputs remain private. No public image
upload is a remaining task.

The corrected notebook is versioned separately from the checkpoint. Direct checkpoint
inspection establishes Ultralytics 8.4.21, YOLO26s detection, 40 epochs, batch 16, size
640, seed 0 and deterministic true. The ONNX records export 8.4.19. Prospective comparison
finds 204 named parameter tensors matching exactly after PT fusion. Current learned
parameter correspondence is supported despite the export-library difference.

Historical training-data linkage remains author-reported: checkpoint path data.yaml is
not a dataset manifest, its embedded date precedes the supplied v2 generation date, and
checkpoint metrics differ from notebook validation values. These observations are
disclosed, not retroactively repaired. Neither record is headline detector accuracy.
Raw top-k prediction rows are not allclose on the three non-patient probes, so full
prediction equivalence is also not claimed. See the positive and negative findings in
`docs/softwarex/generated/detector_pair_verification.json`.

This meets the reviewer's experimental-pipeline route: release inspectable artifacts,
architecture/version, author-reported origins/splits/preprocessing, observed parameters
and licences; do not claim independently validated region/OCR accuracy. No retraining or
private image publication is required for this limited claim.

The optional combined distribution uses AGPL-3.0 with full corresponding working
application/training/inference source and existing notices preserved, not blanket MIT.
A prepared local bundle is at `dist/Medora-Detector-Prepared-FinalWorking.zip`. It includes
pinned upstream source archives for 8.4.21/8.4.19 and excludes private images, raw notebook,
medicine data, credentials and reviewer correspondence. The final archive still needs
binding to the final frozen source commit; the working bundle is not labelled immutable.
