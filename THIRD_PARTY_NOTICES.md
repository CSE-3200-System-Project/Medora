# Third-party notices and combined distribution

Medora, including the bundled Ultralytics YOLO26s detector, is licensed under
**AGPL-3.0-only** (full text in `LICENSE.txt`), with the complete corresponding
application/training/inference source and configuration available. Releases v1.0.0 to
v1.0.2 were published under MIT; from v1.0.3 the whole distribution is AGPL-3.0-only.
Third-party data, models and dependencies keep their own licences and notices, listed below.

A copy of the AGPL text also sits beside the weights in
`ai_service/models/Yolo26s/COPYING.AGPL-3.0`. That directory also
contains the author/institution release decision, model card and output-free training
recipe. Pinned upstream versions are Ultralytics 8.4.21 (checkpoint/training metadata)
and 8.4.19 (ONNX export metadata). The prepared local distribution includes both upstream
source archives and the corresponding working application source.

Private prescription images, private Roboflow exports, consent forms and the original
image-bearing notebook are not distributed. Public training-source attribution:
MedicalImage, *Prescription Dataset*, Roboflow Universe, CC BY 4.0,
https://universe.roboflow.com/medicalimage-z4t5b/prescription-oeiss . See the model card
for the boundary between author-reported lineage and directly inspected artifacts.

Medicine records have separate source-specific terms. The distributed
`Final_Medicine_Dataset.csv` is the 44,226-row licensed-public reconstruction from
Kaggle S4 (publisher-declared MIT) and Mendeley Data S5 (CC BY 4.0) only; S1/S2/S3
contributions are excluded. Their notices and changes are in
`data/medicine_reference/PUBLIC_SOURCE_NOTICES.md`; see also
`data/medicine_reference/DATA_LICENSE.md` and `SOURCE_PERMISSION_RECORD.json`.

## Other runtime dependencies and services

Installing/deploying Medora does not relicense third-party dependencies. Preserve their
upstream notices and consult the exact package/model/provider terms.

| Component/service | Role | Licence/terms source |
| --- | --- | --- |
| Next.js, React | Web client | `frontend/package-lock.json` and upstream package notices |
| FastAPI, SQLAlchemy, Pydantic | APIs | Python package metadata/notices |
| PostgreSQL, Supabase | Persistence, identity, storage, realtime | PostgreSQL/provider terms |
| PaddleOCR, PaddlePaddle | Optional local OCR | Upstream package and model licences |
| ONNX Runtime | Region detection runtime | Upstream runtime licence |
| faster-whisper | Optional local speech recognition | Upstream package/model licences |
| Azure Document Intelligence | Cloud OCR | Microsoft service terms |
| Groq, Gemini, Cerebras | Hosted text generation | Each provider's terms |
| Vapi | External live audio | Vapi service terms |

Prescription-image restrictions also remain in `samples/DATA_USE_NOTICE.md`; neither the
software licence nor an annotation-data licence permits identifiable-image distribution.
