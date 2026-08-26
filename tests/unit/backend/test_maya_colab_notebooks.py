from __future__ import annotations

import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
MAYA_DIR = ROOT / "experiments" / "maya"
BASELINE = MAYA_DIR / "Maya_Qwen35_2B_Baseline_Colab.ipynb"
QLORA = MAYA_DIR / "Maya_Qwen35_2B_QLoRA_Colab.ipynb"
MODEL_REVISION = "15852e8c16360a2fea060d615a32b45270f8a8fc"


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _source(notebook: dict) -> str:
    return "\n".join(
        "".join(cell.get("source", []))
        for cell in notebook["cells"]
    )


@pytest.mark.backend
@pytest.mark.parametrize("path", [BASELINE, QLORA])
def test_maya_colab_notebooks_are_clean_valid_notebooks(path: Path) -> None:
    notebook = _load(path)
    assert notebook["nbformat"] == 4
    assert notebook["nbformat_minor"] >= 5
    assert notebook["cells"]
    assert all(cell["cell_type"] in {"code", "markdown"} for cell in notebook["cells"])
    for cell in notebook["cells"]:
        if cell["cell_type"] == "code":
            assert cell.get("execution_count") is None
            assert cell.get("outputs") == []


@pytest.mark.backend
def test_baseline_notebook_has_a_reproducible_gate_response_contract() -> None:
    notebook = _load(BASELINE)
    contract = notebook["metadata"]["medora"]
    assert contract == {
        "purpose": "maya_untuned_generation",
        "model_id": "Qwen/Qwen3.5-2B",
        "model_revision": MODEL_REVISION,
        "case_count": 35,
        "response_schema": ["case_id", "response"],
        "thinking": False,
    }
    source = _source(notebook)
    assert "run_gate.py" in source and "--write-template" in source
    assert "do_sample=False" in source
    assert "max_new_tokens=256" in source
    assert "qwen35_2b_untuned.jsonl" in source
    assert "sha256" in source


@pytest.mark.backend
def test_qlora_notebook_fails_closed_and_keeps_maya_evaluation_only() -> None:
    notebook = _load(QLORA)
    contract = notebook["metadata"]["medora"]
    assert contract["purpose"] == "maya_qlora_training"
    assert contract["model_id"] == "Qwen/Qwen3.5-2B"
    assert contract["model_revision"] == MODEL_REVISION
    assert contract["seeds"] == [17, 42, 73]
    assert contract["requires_clinician_review"] is True
    assert contract["forbids_maya_overlap"] is True
    assert contract["selection_metric"] == "validation_loss"
    assert contract["response_schema"] == ["case_id", "response"]

    source = _source(notebook)
    for required_field in (
        "review_status",
        "reviewer_id",
        "provenance",
        "license",
        "split",
        "messages",
    ):
        assert required_field in source
    assert "clinician_approved" in source
    assert "target_modules=\"all-linear\"" in source
    assert "bnb_4bit_quant_type=\"nf4\"" in source
    assert "bnb_4bit_use_double_quant=True" in source
    assert "run_gate.py" in source and "--write-template" in source
    assert "Maya prompts are evaluation-only" in source
    assert "selected_seed.json" in source
    assert "tuned_seed_" in source
