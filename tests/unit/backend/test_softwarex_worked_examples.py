from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
FIXTURE = ROOT / "tests" / "benchmarks" / "datasets" / "worked_examples.json"


def test_worked_examples_preserve_review_and_consent_boundaries() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    prescription = fixture["prescription"]
    draft = prescription["ocr_intermediate"]["structured_draft"]
    assert draft["review_required"] is True
    assert draft["authoritative_writeback"] is False
    assert prescription["human_review"]["verified_against_source_image"] is True
    assert draft["medicine"] != prescription["human_review"]["final_row"]["medicine"]

    assistant = fixture["assistant"]
    consent = assistant["authorization"]["consent"]
    assert assistant["authorization"]["active_care_relationship"] is True
    assert consent["valid"] is True and consent["revoked"] is False
    request = assistant["navigation_request"]
    assert "Test Rahim" not in request["redacted_prompt"]
    assert "01700000000" not in request["redacted_prompt"]
    assert set(request["required_schema"]) == set(request["result"])
    assert request["result"]["manual_browse"] is True
    assert assistant["disallowed_follow_up"]["result"]["safe_refusal"]
