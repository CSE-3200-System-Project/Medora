# Third-party notices and combined distribution

Project-authored Medora source files retain the MIT licence grant and copyright notice
in `LICENSE`. Third-party data and trained models are not covered by that grant.

**When Medora is distributed with the bundled Ultralytics YOLO26s detector, the combined
distribution is under AGPL-3.0, with the complete corresponding application/training/
inference source and configuration available.** Preserve all existing MIT and other
copyright/permission notices; the aggregate licence does not erase those original grants.
Do not describe the detector-containing archive as blanket MIT.

The full AGPL text is `ai_service/models/Yolo26s/COPYING.AGPL-3.0`. That directory also
contains the author/institution release decision, model card and output-free training
recipe. Pinned upstream versions are Ultralytics 8.4.21 (checkpoint/training metadata)
and 8.4.19 (ONNX export metadata). The prepared local distribution includes both upstream
source archives and the corresponding working application source.

Private prescription images, private Roboflow exports, consent forms and the original
image-bearing notebook are not distributed. Public training-source attribution:
MedicalImage, *Prescription Dataset*, Roboflow Universe, CC BY 4.0,
https://universe.roboflow.com/medicalimage-z4t5b/prescription-oeiss . See the model card
for the boundary between author-reported lineage and directly inspected artifacts.

Medicine records have separate source-specific terms. The author's selected v2
multi-source candidate is prepared locally, pending documented source permissions.
See `data/medicine_reference/DATA_LICENSE.md` and `SOURCE_PERMISSION_RECORD.json`.
No blanket CC BY/MIT licence is asserted over the multi-source corpus.

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
MIT grant nor an annotation-data licence permits identifiable-image distribution.
