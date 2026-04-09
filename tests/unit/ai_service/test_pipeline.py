from __future__ import annotations

import pytest

pytest.importorskip("PIL")
pytest.importorskip("onnxruntime")
pytest.importorskip("rapidfuzz")

from app.pipeline import OCRPipeline
from app.schemas import BBox, DetectedRegion, MedicationResult, OCRLine


def _fake_pipeline_result():
    meds = [MedicationResult(name="Napa", dosage="500mg", frequency="1+0+1", quantity="5 days", confidence=0.91)]
    lines = [OCRLine(text="Napa 500mg 1+0+1 5 days", bbox=BBox(x_min=0, y_min=0, x_max=100, y_max=20), confidence=0.95)]
    regions = [DetectedRegion(label="Medication", bbox=BBox(x_min=0, y_min=0, x_max=200, y_max=60), score=0.98)]
    return meds, lines, "azure_prebuilt-read", len(regions), 1, regions, 0


def test_pipeline_uses_read_path_by_default(monkeypatch) -> None:
    pipeline = OCRPipeline()
    monkeypatch.setattr("app.pipeline.settings.MODEL_TYPE", "read", raising=False)
    monkeypatch.setattr(OCRPipeline, "_run_read_pipeline", lambda self, image_bytes, subject_token=None: _fake_pipeline_result())

    response = pipeline.run(b"fake-image", debug=False, subject_token="subject_1")

    assert response.meta.model == "azure_prebuilt-read"
    assert response.meta.ocr_line_count == 1
    assert len(response.medications) == 1
    assert response.debug is None


def test_pipeline_includes_debug_payload_when_requested(monkeypatch) -> None:
    pipeline = OCRPipeline()
    monkeypatch.setattr("app.pipeline.settings.MODEL_TYPE", "custom", raising=False)
    monkeypatch.setattr(OCRPipeline, "_run_custom_pipeline", lambda self, image_bytes, subject_token=None: _fake_pipeline_result())

    response = pipeline.run(b"fake-image", debug=True, subject_token="subject_1")

    assert response.debug is not None
    assert response.debug.medicine_db_enabled is False
    assert response.debug.detected_regions
    assert response.debug.ocr_lines


@pytest.mark.parametrize(
    ("mode", "expected_model"),
    [
        ("read", "azure_prebuilt-read"),
        ("custom", "azure_prebuilt-read"),
        ("llm", "azure_prebuilt-read"),
    ],
)
def test_pipeline_mode_switching(monkeypatch, mode: str, expected_model: str) -> None:
    pipeline = OCRPipeline()
    monkeypatch.setattr("app.pipeline.settings.MODEL_TYPE", mode, raising=False)
    monkeypatch.setattr(OCRPipeline, "_run_read_pipeline", lambda self, image_bytes, subject_token=None: _fake_pipeline_result())
    monkeypatch.setattr(OCRPipeline, "_run_custom_pipeline", lambda self, image_bytes, subject_token=None: _fake_pipeline_result())
    monkeypatch.setattr(OCRPipeline, "_run_llm_pipeline", lambda self, image_bytes, subject_token=None: _fake_pipeline_result())

    response = pipeline.run(b"fake-image", debug=False)

    assert response.meta.model == expected_model
