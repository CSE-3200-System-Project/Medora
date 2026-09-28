# Distribution scope and source

The provided detector weights carry Ultralytics' AGPL-3.0 notice. The optional combined
Medora+detector distribution must be conveyed under AGPL-3.0, with the full corresponding
application, training/inference scripts and configuration source, and existing copyright
and MIT notices preserved. Merely attaching an AGPL notice to weights in a blanket-MIT
archive is not the prepared route. No enterprise licence is asserted.

The source-only Medora modules retain their existing notices. `COPYING.AGPL-3.0` contains
the full model/combined-distribution licence. The final combined archive needs one exact
source commit, the weight files and their hashes, this model card, the sanitized recipe,
verification scripts/reports, dependency pins and an explicit combined-distribution
licence notice. `tools/softwarex/package_detector_release.py` prepares a local working
bundle for inspection; the final release must bind the same contents to the frozen commit.

Upstream source and terms:

- Ultralytics 8.4.21: https://github.com/ultralytics/ultralytics/tree/v8.4.21
- ONNX metadata identifies export library 8.4.19:
  https://github.com/ultralytics/ultralytics/tree/v8.4.19
- Licence explanation: https://www.ultralytics.com/license
- Public-source attribution: MedicalImage, *Prescription Dataset*, Roboflow Universe,
  https://universe.roboflow.com/medicalimage-z4t5b/prescription-oeiss , CC BY 4.0.

Private training images are deliberately not distributed. Consequently recipients can
inspect/reuse the released inference artifacts and recipe, but cannot independently
retrain on the exact private dataset from this public package. No equivalent-data or
byte-identical retraining claim is made. This is compatible with describing the detector
as an integrated experimental pipeline, rather than an accuracy-validated reusable asset.
