from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.main import app
from app.schemas.ai_orchestrator import AIClinicalInfoResponse
from app.schemas.ai_search import AIDoctorSearchResponse
from app.schemas.upload import PrescriptionExtractionResponse


pytestmark = [pytest.mark.backend, pytest.mark.integration, pytest.mark.contract]


BASELINE_PATH = Path("tests/benchmarks/baselines/schema_contract_snapshot.json")


def _schema_property_names(schema: dict) -> list[str]:
    return sorted((schema.get("properties") or {}).keys())


def test_openapi_exposes_critical_healthcare_contracts() -> None:
    spec = app.openapi()
    required_paths = {
        "/appointment/": {"post"},
        "/ai/search": {"post"},
        "/upload/prescription/extract": {"post"},
        "/consultation/{consultation_id}/prescription": {"post"},
    }

    for path, methods in required_paths.items():
        assert path in spec["paths"], f"Missing path contract: {path}"
        for method in methods:
            assert method in spec["paths"][path], f"Missing method contract: {method.upper()} {path}"


def test_pydantic_schema_snapshot_for_cross_service_contracts() -> None:
    actual = {
        "AIDoctorSearchResponse": _schema_property_names(AIDoctorSearchResponse.model_json_schema()),
        "AIClinicalInfoResponse": _schema_property_names(AIClinicalInfoResponse.model_json_schema()),
        "PrescriptionExtractionResponse": _schema_property_names(PrescriptionExtractionResponse.model_json_schema()),
    }

    if os.getenv("MEDORA_UPDATE_BASELINES") == "1":
        BASELINE_PATH.write_text(json.dumps(actual, indent=2, sort_keys=True), encoding="utf-8")

    assert BASELINE_PATH.exists(), "Schema baseline missing. Set MEDORA_UPDATE_BASELINES=1 once to initialize."
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    assert actual == baseline
