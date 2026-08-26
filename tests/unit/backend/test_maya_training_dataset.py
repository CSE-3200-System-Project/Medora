from __future__ import annotations

import csv
import hashlib
import importlib.util
import io
import json
import shutil
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data" / "maya_navigation_sft_v1"
BUILDER_PATH = ROOT / "tools" / "maya_dataset" / "build_synthetic_navigation_dataset.py"
PROMOTER_PATH = ROOT / "tools" / "maya_dataset" / "promote_clinical_review.py"
WIZARD_PATH = ROOT / "tools" / "maya_dataset" / "review_wizard.py"


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


def _working_store(tmp_path: Path):
    wizard = _module(f"maya_review_wizard_{tmp_path.name}", WIZARD_PATH)
    reviews = tmp_path / "clinical_review_working.csv"
    shutil.copy2(DATA_DIR / "clinical_review.csv", reviews)
    return wizard, wizard.ReviewStore(DATA_DIR / "draft_combined.jsonl", reviews)


@pytest.mark.backend
def test_reviewer_code_cannot_be_the_role_number() -> None:
    wizard = _module("maya_review_wizard_reviewer_id", WIZARD_PATH)
    with pytest.raises(ValueError, match="must include letters"):
        wizard._validate_reviewer_id("1")
    assert wizard._validate_reviewer_id("clinician-a") == "clinician-a"
    output = io.StringIO()
    inputs = iter(["1", "clinician-a"])
    reviewer_id = wizard._ask_reviewer_id(lambda _prompt: next(inputs), output)
    assert reviewer_id == "clinician-a"
    assert "Invalid reviewer code" in output.getvalue()


@pytest.mark.backend
def test_interactive_review_saves_immediately_and_resumes_without_unblinding(tmp_path: Path) -> None:
    wizard, store = _working_store(tmp_path)
    reviewer_1_inputs = iter(["a", "English notes are allowed for this Bangla case", "q"])
    saved = wizard.run_primary_review(
        store,
        "reviewer1",
        "clinician-a",
        input_fn=lambda _prompt: next(reviewer_1_inputs),
        output=io.StringIO(),
    )
    assert saved == 1

    _, persisted = wizard.load_review_rows(store.reviews_path)
    assert persisted[0]["reviewer_1_decision"] == "approve"
    assert persisted[0]["reviewer_1_notes"] == "English notes are allowed for this Bangla case"
    assert persisted[1]["reviewer_1_decision"] == ""

    reloaded = wizard.ReviewStore(DATA_DIR / "draft_combined.jsonl", store.reviews_path)
    assert len(wizard.primary_pending(reloaded, "reviewer1")) == 119
    reviewer_2_output = io.StringIO()
    reviewer_2_inputs = iter(["a", "বাংলা নোটও গ্রহণযোগ্য", "q"])
    wizard.run_primary_review(
        reloaded,
        "reviewer2",
        "clinician-b",
        input_fn=lambda _prompt: next(reviewer_2_inputs),
        output=reviewer_2_output,
    )
    assert "English notes are allowed" not in reviewer_2_output.getvalue()


@pytest.mark.backend
def test_adjudication_requires_independent_reviewer_and_matching_revision_script(tmp_path: Path) -> None:
    wizard, store = _working_store(tmp_path)
    first = store.review_rows[0]
    first.update(
        {
            "reviewer_1_id": "clinician-a",
            "reviewer_1_decision": "revise",
            "reviewer_1_notes": "Clarify the next action.",
            "reviewer_2_id": "clinician-b",
            "reviewer_2_decision": "approve",
            "reviewer_2_notes": "",
        }
    )
    store.save()
    with pytest.raises(ValueError, match="independent"):
        wizard.run_adjudication(store, "clinician-a", output=io.StringIO())

    inputs = iter(
        [
            "v",
            "This is English and must be rejected for a Bangla row.",
            "বাংলায় সংশোধিত নিরাপদ নেভিগেশন উত্তর।",
            "Resolved wording.",
        ]
    )
    output = io.StringIO()
    saved = wizard.run_adjudication(
        store,
        "clinician-c",
        input_fn=lambda _prompt: next(inputs),
        output=output,
    )
    assert saved == 1
    assert "does not match the required bn script" in output.getvalue()
    _, persisted = wizard.load_review_rows(store.reviews_path)
    assert persisted[0]["final_decision"] == "approve"
    assert persisted[0]["revised_response"] == "বাংলায় সংশোধিত নিরাপদ নেভিগেশন উত্তর।"
    assert persisted[0]["adjudicator_id"] == "clinician-c"


@pytest.mark.backend
def test_review_progress_requires_every_row_to_be_resolved(tmp_path: Path) -> None:
    wizard, store = _working_store(tmp_path)
    assert wizard.progress(store)["promotion_ready"] is False
    for row in store.review_rows:
        row["reviewer_1_id"] = "clinician-a"
        row["reviewer_1_decision"] = "approve"
        row["reviewer_2_id"] = "clinician-b"
        row["reviewer_2_decision"] = "approve"
    status = wizard.progress(store)
    assert status["reviewer_1_complete"] == 120
    assert status["reviewer_2_complete"] == 120
    assert status["promotion_ready"] is True
