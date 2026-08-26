from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data" / "maya_navigation_sft_v1"
BUILDER_PATH = ROOT / "tools" / "maya_dataset" / "build_synthetic_navigation_dataset.py"
PROMOTER_PATH = ROOT / "tools" / "maya_dataset" / "promote_clinical_review.py"


def _module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.mark.backend
def test_synthetic_corpus_has_fixed_disjoint_splits_and_language_coverage() -> None:
    builder = _module("maya_dataset_builder", BUILDER_PATH)
    rows = builder.build_rows()
    summary = builder.validate(rows)

    assert summary == {
        "rows": 120,
        "splits": {"train": 100, "validation": 20},
        "languages": {"bn": 60, "banglish": 30, "en": 30},
        "scenario_families": 30,
        "maya_overlap": 0,
    }
    train_families = {row["scenario_family"] for row in rows if row["split"] == "train"}
    validation_families = {row["scenario_family"] for row in rows if row["split"] == "validation"}
    assert len(train_families) == 25
    assert len(validation_families) == 5
    assert train_families.isdisjoint(validation_families)


@pytest.mark.backend
def test_generated_draft_is_phi_free_but_never_claims_clinical_approval() -> None:
    rows = _read_jsonl(DATA_DIR / "draft_combined.jsonl")
    required = {
        "id", "messages", "language", "split", "review_status", "reviewer_id",
        "provenance", "license", "phi_free", "scenario_family", "risk_scope",
        "evaluation_overlap", "source_urls",
    }
    assert all(required <= set(row) for row in rows)
    assert all(row["phi_free"] is True for row in rows)
    assert all(row["review_status"] == "pending_clinical_review" for row in rows)
    assert all(row["reviewer_id"] == "" for row in rows)
    assert all(row["evaluation_overlap"] is False for row in rows)
    assert all(row["risk_scope"] == "non_urgent_navigation_only" for row in rows)
    assert all([message["role"] for message in row["messages"]] == ["user", "assistant"] for row in rows)


@pytest.mark.backend
def test_committed_artifacts_match_the_manifest_and_review_queue() -> None:
    manifest = json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "pending_clinical_review_not_training_ready"
    assert manifest["summary"]["splits"] == {"train": 100, "validation": 20}
    for filename, evidence in manifest["files"].items():
        path = DATA_DIR / filename
        assert path.exists()
        assert evidence["sha256"] == _sha256(path)

    with (DATA_DIR / "clinical_review.csv").open(encoding="utf-8-sig", newline="") as handle:
        review_rows = list(csv.DictReader(handle))
    draft_rows = _read_jsonl(DATA_DIR / "draft_combined.jsonl")
    assert [row["id"] for row in review_rows] == [row["id"] for row in draft_rows]
    assert all(not row["reviewer_1_id"] and not row["reviewer_2_id"] for row in review_rows)
    assert not (DATA_DIR / "approved_combined.jsonl").exists()


@pytest.mark.backend
def test_promotion_refuses_missing_review_and_accepts_two_distinct_approvals() -> None:
    builder = _module("maya_dataset_builder_for_promotion", BUILDER_PATH)
    promoter = _module("maya_dataset_promoter", PROMOTER_PATH)
    draft_rows = builder.build_rows()
    blank_reviews = {
        row["id"]: {
            "reviewer_1_id": "", "reviewer_1_decision": "",
            "reviewer_2_id": "", "reviewer_2_decision": "",
        }
        for row in draft_rows
    }
    with pytest.raises(ValueError, match="two distinct reviewer IDs"):
        promoter.promote(draft_rows, blank_reviews)

    approved_reviews = {
        row["id"]: {
            "reviewer_1_id": "test-reviewer-a", "reviewer_1_decision": "approve",
            "reviewer_2_id": "test-reviewer-b", "reviewer_2_decision": "approve",
            "final_notes": "",
        }
        for row in draft_rows
    }
    promoted = promoter.promote(draft_rows, approved_reviews)
    assert len(promoted) == 120
    assert all(row["review_status"] == "clinician_approved" for row in promoted)
    assert all(row["reviewer_id"] == "test-reviewer-a|test-reviewer-b" for row in promoted)
