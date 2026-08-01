# Third-party notices

Medora's source code is licensed under the MIT License. Runtime dependencies keep
their own licenses; installing or deploying Medora does not relicense them.

The principal external components and services are:

| Component or service | Role | License/terms source |
|---|---|---|
| Next.js and React | Web application | Package metadata in `frontend/package-lock.json` |
| FastAPI, SQLAlchemy, Pydantic | Core and OCR APIs | Python package metadata |
| PostgreSQL/Supabase | Persistence, identity, storage, realtime | Provider and PostgreSQL terms |
| PaddleOCR/PaddlePaddle | Optional local OCR | Upstream package/model licenses |
| ONNX Runtime/YOLO model | Optional local region detection | Runtime and model-specific licenses |
| faster-whisper | Optional local speech recognition | Upstream package/model licenses |
| Azure Document Intelligence | Optional cloud OCR | Microsoft service terms |
| Groq, Gemini, Cerebras | Optional hosted text generation | Respective provider terms |
| Vapi | Optional external live-audio processing | Vapi service terms |

Model weights and medicine catalog data must be checked separately before
redistribution. The release manifest records the exact files and checksums actually
included in an archive. The identifiable prescription images are governed by
[`samples/DATA_USE_NOTICE.md`](samples/DATA_USE_NOTICE.md), not the MIT License or
the annotation-data license.

