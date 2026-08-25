"""Regression fixtures for the learned PHI span recogniser and the union ensemble.

The weights are trained in a separate GPU session, so nothing here loads a model. What is
tested is everything that can go wrong *around* a model: whether the flag is really inert
when clear, whether the ensemble composes the two systems correctly, whether a broken or
absent bundle degrades to the rules that ship today rather than to no redaction at all, and
whether the corpus generator can leak a test answer into training.

Those are the failures that would be invisible. A model that scores badly shows up in
`evaluate.py`; a feature flag that silently disables redaction does not.
"""

from __future__ import annotations

import importlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.core import phi_ner
from app.core.ai_privacy import redact_pii_text
from app.core.phi_ner import PhiSpan, apply_spans, decode_bio, merge_spans

ROOT = Path(__file__).resolve().parents[3]
DATASETS = ROOT / "tests" / "benchmarks" / "datasets"
TOOLS = ROOT / "tools" / "phi_ner"


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------


class StubRecognizer:
    """Returns spans for declared substrings. Deterministic, no weights, no onnxruntime."""

    def __init__(self, targets: dict[str, str], score: float = 0.9) -> None:
        self.targets = targets
        self.score = score
        self.calls: list[str] = []

    def predict(self, text: str) -> list[PhiSpan]:
        self.calls.append(text)
        spans = []
        for needle, label in self.targets.items():
            start = text.find(needle)
            while start != -1:
                spans.append(PhiSpan(start, start + len(needle), label, self.score))
                start = text.find(needle, start + len(needle))
        return merge_spans(spans)


class ExplodingRecognizer:
    def predict(self, text: str) -> list[PhiSpan]:
        raise RuntimeError("onnxruntime session died mid-request")


def load_jsonl(name: str) -> list[dict]:
    path = DATASETS / name
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


# ---------------------------------------------------------------------------
# The flag is inert when clear
# ---------------------------------------------------------------------------


@pytest.mark.backend
def test_default_configuration_leaves_redaction_byte_identical() -> None:
    """With PHI_NER_ENABLED clear, output must equal the rules-only output, everywhere.

    This is the fixture that stops the ensemble from changing published numbers by
    accident. Both scored populations are replayed, not a sample of them.
    """
    assert phi_ner.settings.PHI_NER_ENABLED is False
    cases = load_jsonl("pii_safety_cases.jsonl") + load_jsonl("pii_holdout_cases.jsonl")
    assert len(cases) > 150, "regression corpus shrank; the fixture is no longer covering it"
    for case in cases:
        known = case.get("known_identifiers", []) if case.get("uses_known_identifier_api") else []
        configured = redact_pii_text(case["text"], known_identifiers=known)
        rules_only = redact_pii_text(case["text"], known_identifiers=known, recognizer=None)
        assert configured.text == rules_only.text, case.get("id")
        assert configured.replacements == rules_only.replacements, case.get("id")


@pytest.mark.backend
def test_get_recognizer_returns_none_when_flag_is_clear(monkeypatch: pytest.MonkeyPatch) -> None:
    phi_ner.reset_recognizer_cache()
    monkeypatch.setattr(phi_ner.settings, "PHI_NER_ENABLED", False, raising=False)
    assert phi_ner.get_recognizer() is None
    phi_ner.reset_recognizer_cache()


@pytest.mark.backend
def test_missing_bundle_fails_closed_to_rules(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Flag on, no weights on disk: no exception, no recogniser, rules still redact.

    A privacy control whose absence throws would take the AI path down; one whose absence
    silently disabled the rules would leak. Neither is acceptable, so both are asserted.
    """
    phi_ner.reset_recognizer_cache()
    monkeypatch.setattr(phi_ner.settings, "PHI_NER_ENABLED", True, raising=False)
    monkeypatch.setattr(phi_ner.settings, "PHI_NER_MODEL_DIR", str(tmp_path), raising=False)
    assert phi_ner.get_recognizer() is None
    result = redact_pii_text("Contact rahima.akter@example.org about the result")
    assert "rahima.akter@example.org" not in result.text
    assert "[redacted-email]" in result.text
    phi_ner.reset_recognizer_cache()


@pytest.mark.backend
def test_recognizer_failure_degrades_to_rules_without_raising() -> None:
    text = "Contact rahima.akter@example.org on 01712345678"
    degraded = redact_pii_text(text, recognizer=ExplodingRecognizer())
    rules_only = redact_pii_text(text, recognizer=None)
    assert degraded.text == rules_only.text
    assert "rahima.akter@example.org" not in degraded.text


# ---------------------------------------------------------------------------
# Union behaviour
# ---------------------------------------------------------------------------


@pytest.mark.backend
def test_union_catches_a_name_the_rules_miss() -> None:
    """The whole point of the ensemble, stated as a fixture.

    "Sabbir Talukder" is in the novel-identifier probe precisely because no gazetteer entry
    covers it; the rules leave it intact and the union must not.
    """
    text = "Sabbir Talukder came in today with fever"
    assert "Sabbir Talukder" in redact_pii_text(text, recognizer=None).text
    union = redact_pii_text(text, recognizer=StubRecognizer({"Sabbir Talukder": "NAME"}))
    assert "Sabbir Talukder" not in union.text
    assert "[redacted-name]" in union.text
    assert union.replacements.get("learned_name") == 1
    assert "came in today with fever" in union.text


@pytest.mark.backend
def test_union_keeps_rule_hits_as_well_as_model_hits() -> None:
    text = "Sabbir Talukder, email sabbir@example.org, phone 01712345678"
    result = redact_pii_text(text, recognizer=StubRecognizer({"Sabbir Talukder": "NAME"}))
    assert "Sabbir Talukder" not in result.text
    assert "sabbir@example.org" not in result.text
    assert "01712345678" not in result.text


@pytest.mark.backend
def test_union_is_idempotent() -> None:
    recognizer = StubRecognizer({"Sabbir Talukder": "NAME"})
    text = "Sabbir Talukder came in today with fever, contact sabbir@example.org"
    once = redact_pii_text(text, recognizer=recognizer).text
    twice = redact_pii_text(once, recognizer=recognizer).text
    assert once == twice


@pytest.mark.backend
def test_learned_pass_does_not_consume_existing_placeholders() -> None:
    """A model that tags `[redacted-name]` must not produce `[redacted-[redacted-name]]`."""
    text = "Patient [redacted-name] and Sabbir Talukder attended"
    result = apply_spans(text, [
        PhiSpan(text.index("[redacted-name]"), text.index("[redacted-name]") + len("[redacted-name]"), "NAME", 0.9),
        PhiSpan(text.index("Sabbir Talukder"), text.index("Sabbir Talukder") + len("Sabbir Talukder"), "NAME", 0.9),
    ])
    assert result[0] == "Patient [redacted-name] and [redacted-name] attended"
    assert result[1] == {"learned_name": 1}


@pytest.mark.backend
def test_union_preserves_benign_clinical_text_across_the_probe() -> None:
    """Over-redaction guard: the stub fires on names only, benign spans must all survive."""
    recognizer = StubRecognizer({
        case["must_not_contain"][0]: "NAME"
        for case in load_jsonl("pii_holdout_cases.jsonl")
        if case["category"].startswith("unlabeled_name")
    })
    for case in load_jsonl("pii_holdout_cases.jsonl"):
        result = redact_pii_text(case["text"], recognizer=recognizer)
        for benign in case.get("must_preserve", []):
            assert benign in result.text, f"{case['id']} lost benign span {benign!r}"


# ---------------------------------------------------------------------------
# Span mechanics
# ---------------------------------------------------------------------------


@pytest.mark.backend
def test_apply_spans_replaces_right_to_left_without_offset_drift() -> None:
    text = "A BB CCC DDDD"
    spans = [PhiSpan(0, 1, "NAME", 0.9), PhiSpan(2, 4, "PHONE", 0.9), PhiSpan(9, 13, "MRN", 0.9)]
    replaced, counts = apply_spans(text, spans)
    assert replaced == "[redacted-name] [redacted-phone] CCC [redacted-account-id]"
    assert counts == {"learned_name": 1, "learned_phone": 1, "learned_mrn": 1}


@pytest.mark.backend
def test_apply_spans_honours_redact_dates_false() -> None:
    text = "Visit on 7 March 2025 with Sabbir"
    spans = [PhiSpan(9, 21, "DATE", 0.9), PhiSpan(27, 33, "NAME", 0.9)]
    kept, counts = apply_spans(text, spans, redact_dates=False)
    assert "7 March 2025" in kept
    assert "Sabbir" not in kept
    assert counts == {"learned_name": 1}


@pytest.mark.backend
def test_merge_spans_unions_overlaps_and_keeps_the_stronger_label() -> None:
    merged = merge_spans([
        PhiSpan(0, 6, "NAME", 0.4),
        PhiSpan(4, 12, "DOCTOR", 0.8),
        PhiSpan(20, 24, "PHONE", 0.9),
    ])
    assert merged == [PhiSpan(0, 12, "DOCTOR", 0.8), PhiSpan(20, 24, "PHONE", 0.9)]


@pytest.mark.backend
def test_decode_bio_splits_on_b_prefix_and_accepts_orphan_i_tags() -> None:
    """`B-` separates two adjacent entities; a leading `I-` still starts one.

    Under a recall-first threshold the model routinely emits `I-` with no preceding `B-`.
    Dropping those tokens would quietly undo the threshold policy, so decoding accepts them.
    """
    labels = ["O", "B-NAME", "I-NAME"]
    #        O      I-NAME  B-NAME  I-NAME  O
    probabilities = [
        [0.99, 0.005, 0.005],
        [0.05, 0.15, 0.80],
        [0.05, 0.80, 0.15],
        [0.05, 0.15, 0.80],
        [0.99, 0.005, 0.005],
    ]
    offsets = [(0, 3), (4, 9), (10, 15), (16, 21), (22, 25)]
    spans = decode_bio(probabilities, offsets, labels, threshold=0.35)
    assert spans == [PhiSpan(4, 9, "NAME", 0.95), PhiSpan(10, 21, "NAME", 0.95)]


@pytest.mark.backend
def test_decode_bio_respects_the_threshold() -> None:
    labels = ["O", "B-NAME", "I-NAME"]
    probabilities = [[0.7, 0.2, 0.1]]  # entity score = 1 - P(O) = 0.3
    offsets = [(0, 5)]
    assert decode_bio(probabilities, offsets, labels, threshold=0.25) == [
        PhiSpan(0, 5, "NAME", pytest.approx(0.3))
    ]
    assert decode_bio(probabilities, offsets, labels, threshold=0.35) == []


# ---------------------------------------------------------------------------
# Corpus generator
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def corpus_module():
    sys.path.insert(0, str(TOOLS))
    try:
        module = importlib.import_module("generate_corpus")
        yield module
    finally:
        sys.path.remove(str(TOOLS))


@pytest.mark.backend
def test_corpus_offsets_match_the_text(corpus_module) -> None:
    holdout = corpus_module.load_holdout_strings()
    train_pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    rows, _ = corpus_module.generate(400, corpus_module.DEFAULT_SEED, train_pool, holdout, "train")
    for row in rows:
        for span in row["spans"]:
            assert row["text"][span["start"]:span["end"]] == span["text"]


@pytest.mark.backend
def test_corpus_generation_is_deterministic(corpus_module) -> None:
    holdout = corpus_module.load_holdout_strings()
    pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    first, _ = corpus_module.generate(200, 7, pool, holdout, "train")
    second, _ = corpus_module.generate(200, 7, pool, holdout, "train")
    assert [row["text"] for row in first] == [row["text"] for row in second]


@pytest.mark.backend
def test_corpus_rejects_sentences_containing_a_holdout_identifier(corpus_module) -> None:
    """The exclusion must actually fire, not merely be present in the code path.

    A planted identifier that every generated sentence would otherwise contain proves the
    filter rejects rather than passes; the real holdout collides only a handful of times in
    12,000 sentences, which is too rare to demonstrate anything.
    """
    pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    rows, stats = corpus_module.generate(50, 11, pool, {"e"}, "train")
    assert rows == [] or all("e" not in row["text"].casefold() for row in rows)
    assert stats["rejected_for_holdout_overlap"] > 0


@pytest.mark.backend
def test_corpus_never_contains_a_scored_identifier(corpus_module) -> None:
    holdout = corpus_module.load_holdout_strings()
    pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    rows, _ = corpus_module.generate(600, corpus_module.DEFAULT_SEED, pool, holdout, "train")
    for row in rows:
        folded = row["text"].casefold()
        assert not any(value in folded for value in holdout), row["text"]


@pytest.mark.backend
def test_corpus_contains_zero_phi_sentences_and_drug_hard_negatives(corpus_module) -> None:
    holdout = corpus_module.load_holdout_strings()
    pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    rows, stats = corpus_module.generate(600, corpus_module.DEFAULT_SEED, pool, holdout, "train")
    assert stats["zero_phi_rows"] >= 60, "clean text is under-represented; the model will over-redact"
    drugs = set(pool.drugs)
    tagged = {span["text"] for row in rows for span in row["spans"]}
    assert not (drugs & tagged), "a medication name was tagged as PHI in the corpus"


@pytest.mark.backend
def test_corpus_covers_every_declared_label(corpus_module) -> None:
    holdout = corpus_module.load_holdout_strings()
    pool, _ = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    _, stats = corpus_module.generate(1500, corpus_module.DEFAULT_SEED, pool, holdout, "train")
    missing = set(corpus_module.T.TAGGED_SLOTS) - set(stats["by_tag"])
    assert not missing, f"labels declared but never generated: {sorted(missing)}"


@pytest.mark.backend
def test_train_and_dev_filler_pools_are_disjoint(corpus_module) -> None:
    train_pool, dev_pool = corpus_module.build_pools(corpus_module.DEFAULT_SEED)
    assert not set(train_pool.given) & set(dev_pool.given)
    assert not set(train_pool.surnames) & set(dev_pool.surnames)
    assert not set(train_pool.hospitals) & set(dev_pool.hospitals)
    assert not set(train_pool.upazilas) & set(dev_pool.upazilas)
    assert not set(train_pool.drugs) & set(dev_pool.drugs)


@pytest.mark.backend
def test_corpus_source_pools_meet_the_registered_coverage(corpus_module) -> None:
    """The generated data must satisfy the Day 1 targets, not just document them."""
    fillers = corpus_module.F
    templates = corpus_module.T
    assert len(fillers.GIVEN_NAMES) >= 500
    assert len(fillers.SURNAMES) >= 500
    assert len(fillers.UPAZILAS) >= 495
    assert len(fillers.DIVISIONS) == 8
    assert len(fillers.DISTRICTS) == 64
    assert 60 <= len(templates.PHI_FRAMES) + len(templates.CLEAN_FRAMES) <= 100


@pytest.mark.backend
def test_upazila_snapshot_preserves_the_official_hierarchy(corpus_module) -> None:
    fillers = corpus_module.F
    assert all(len(entry) == 6 for entry in fillers.UPAZILAS)
    assert all(all(part.strip() for part in entry) for entry in fillers.UPAZILAS)
    assert len({(entry[4], entry[5]) for entry in fillers.UPAZILAS}) == 8
    assert len({(entry[2], entry[3]) for entry in fillers.UPAZILAS}) == 64
    assert fillers.UPAZILA_SOURCE["url"] == "https://bangladesh.gov.bd/views/upazila-list"
    assert fillers.UPAZILA_SOURCE["bd_admin_2022"] == 495
    assert fillers.UPAZILA_SOURCE["bd_admin_2026_extension"] == 8
    assert fillers.UPAZILA_SOURCE["current_gazetted_count"] == len(fillers.UPAZILAS)


# ---------------------------------------------------------------------------
# Training-side licence gate
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def train_module():
    sys.path.insert(0, str(TOOLS))
    try:
        yield importlib.import_module("train")
    finally:
        sys.path.remove(str(TOOLS))


@pytest.mark.backend
def test_non_commercial_model_cannot_be_exported(train_module) -> None:
    """BanglaBERT is a legitimate research comparator and an illegitimate deployment.

    The licence is enforced by the export path rather than by documentation, because a
    licence that only lives in prose eventually ends up inside a container image.
    """
    spec = train_module.MODELS["banglabert"]
    assert spec.commercial_use is False
    assert spec.deployable is False
    with pytest.raises(train_module.LicenceViolation):
        train_module.assert_export_allowed(spec)


@pytest.mark.backend
def test_deployable_models_pass_the_licence_gate(train_module) -> None:
    for key in ("muril", "xlmr"):
        train_module.assert_export_allowed(train_module.MODELS[key])


@pytest.mark.backend
@pytest.mark.parametrize(
    ("constructor", "expected_warmup"),
    [
        (lambda warmup_ratio=None, **kwargs: {"warmup_ratio": warmup_ratio, **kwargs},
         {"warmup_ratio": 0.1}),
        (lambda warmup_steps=0, **kwargs: {"warmup_steps": warmup_steps, **kwargs},
         {"warmup_steps": 0.1}),
    ],
)
def test_training_arguments_support_transformers_4_and_5(
    train_module, constructor, expected_warmup
) -> None:
    """Transformers 5 expresses a warmup ratio through ``warmup_steps``."""
    result = train_module.build_training_arguments(
        constructor,
        output_dir="checkpoints",
        learning_rate=2e-5,
        batch_size=16,
        epochs=4,
        seed=3,
    )

    for key, value in expected_warmup.items():
        assert result[key] == value
    assert result["eval_strategy"] == "epoch"


@pytest.mark.backend
def test_training_a_non_commercial_model_requires_an_explicit_flag(train_module) -> None:
    with pytest.raises(SystemExit):
        train_module.main(["--model", "banglabert"])


@pytest.mark.backend
def test_threshold_sweep_prefers_recall_within_the_over_redaction_cap(train_module) -> None:
    """Recall-first, not F1-first: the selected point is the best recall the cap allows."""
    #                          P(O)  P(entity)
    probabilities = [[[0.9, 0.1], [0.5, 0.5], [0.2, 0.8], [0.95, 0.05]]]
    gold = [[1, 1, 1, 0]]
    report = train_module.sweep_threshold(
        probabilities, gold, [0.05, 0.15, 0.45, 0.75], over_redaction_cap=0.06)
    assert report["cap_met"] is True
    assert report["chosen"]["over_redaction_rate"] <= 0.06
    assert report["chosen"]["recall"] == max(
        row["recall"] for row in report["sweep"] if row["over_redaction_rate"] <= 0.06)


@pytest.mark.backend
def test_threshold_sweep_reports_when_the_cap_cannot_be_met(train_module) -> None:
    probabilities = [[[0.1, 0.9], [0.1, 0.9]]]
    gold = [[1, 0]]
    report = train_module.sweep_threshold(probabilities, gold, [0.05, 0.5], over_redaction_cap=0.0)
    assert report["cap_met"] is False
    assert "flagged" in report["selection_reason"]


@pytest.mark.backend
def test_export_selection_refuses_seeds_that_miss_the_training_cap(train_module) -> None:
    failed = {"cap_met": False, "dev_recall": 1.0}
    eligible = {"cap_met": True, "dev_recall": 0.9}
    assert train_module.select_export_run([failed]) is None
    assert train_module.select_export_run([failed, eligible]) is eligible


@pytest.mark.backend
def test_bundle_admission_binds_weights_threshold_datasets_and_metrics(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "model.onnx").write_bytes(b"model-v1")
    (bundle / "tokenizer.json").write_text("{}", encoding="utf-8")
    (bundle / "labels.json").write_text(
        json.dumps(
            {
                "bio_labels": ["O", "B-NAME"],
                "selected_threshold": 0.35,
                "commercial_use_permitted": True,
            }
        ),
        encoding="utf-8",
    )
    admission = {
        "admission_version": phi_ner.PHI_ADMISSION_VERSION,
        "status": "passed",
        "passed": True,
        "threshold": 0.35,
        "bundle_files": {
            name: phi_ner.sha256_file(bundle / name)
            for name in ("model.onnx", "tokenizer.json", "labels.json")
        },
        "datasets": {
            name: phi_ner.sha256_file(path)
            for name, path in phi_ner.ADMISSION_DATASETS.items()
        },
        "headline_metrics": {
            "rules_recall": 0.75,
            "union_recall": 0.90,
            "union_precision": 0.95,
            "union_over_redaction": 0.04,
        },
    }
    (bundle / "admission.json").write_text(json.dumps(admission), encoding="utf-8")
    assert phi_ner.validate_bundle_admission(bundle) == 0.35
    with pytest.raises(ValueError, match="threshold"):
        phi_ner.validate_bundle_admission(bundle, threshold_override=0.4)
    (bundle / "model.onnx").write_bytes(b"tampered")
    with pytest.raises(ValueError, match="stale"):
        phi_ner.validate_bundle_admission(bundle)


# ---------------------------------------------------------------------------
# The evaluator runs without weights
# ---------------------------------------------------------------------------


@pytest.mark.backend
def test_evaluator_reports_rules_and_marks_the_model_unavailable(tmp_path: Path) -> None:
    """Shipping the gate before the weights must produce a real report, not a crash."""
    out = tmp_path / "eval.json"
    completed = subprocess.run(
        [sys.executable, str(TOOLS / "evaluate.py"),
         "--bundle", str(tmp_path / "absent"), "--iterations", "50", "--out", str(out)],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    report = json.loads(out.read_text(encoding="utf-8"))
    assert set(report["populations"]) == {"pii_safety_134", "novel_identifier_probe"}
    for population in report["populations"].values():
        assert population["systems"]["rules"]["status"] == "measured"
        assert population["systems"]["model"]["status"] == "unavailable"
        assert population["systems"]["union"]["status"] == "unavailable"
    probe = report["populations"]["novel_identifier_probe"]
    assert probe["saturated_by_rules"] is False
    assert report["populations"]["pii_safety_134"]["saturated_by_rules"] is True
