"""Protect the teacher-first revision merge and its publication boundaries."""

from pathlib import Path

from tools.release.check_softwarex_release import manuscript_figure_count, manuscript_word_count

ROOT = Path(__file__).resolve().parents[3]
DOCS = ROOT / "docs/softwarex"


def test_overleaf_and_release_sources_remain_aligned():
    canonical = (DOCS / "medora_softwarex.tex").read_text(encoding="utf-8")
    assert canonical == (DOCS / "Medora-Overleaf-First-Submission.tex").read_text(encoding="utf-8")


def test_teacher_authors_and_workflows_are_preserved():
    source = (DOCS / "medora_softwarex.tex").read_text(encoding="utf-8")
    capsule_metadata = (ROOT / "codeocean/metadata/metadata.yml").read_text(encoding="utf-8")
    for name in ("Sarwad Hasan Siddiqui", "Adiba Tahsin", "Kazi Saeed Alam", "Sk. Imran Hossain"):
        assert name in source
        assert name in capsule_metadata
    for description in ("https://medorahealth.vercel.app/", "Vapi", "11 patient, 11", "Condition-to-doctor discovery"):
        assert description in source


def test_submission_baseline_stays_historical():
    baseline = (DOCS / "submission-history/Medora-Overleaf-First-Submission.tex").read_text(encoding="utf-8")
    assert "AI-Native Bilingual" in baseline
    assert "Sk. Imran Hossain" in baseline
    assert "Written\nindependently of the patterns" in baseline
    assert "independently of the patterns" not in (DOCS / "medora_softwarex.tex").read_text(encoding="utf-8")


def test_manuscript_meets_existing_length_and_figure_gates():
    source = DOCS / "medora_softwarex.tex"
    assert manuscript_word_count(source) <= 3000
    assert manuscript_figure_count(source) == 6


def test_revision_artifacts_and_measurement_scope_are_explicit():
    source = (DOCS / "medora_softwarex.tex").read_text(encoding="utf-8")
    for evidence in ("46,614", "72,969", "204", "94.7", "75.5", "Code Ocean", "AGPL-3.0"):
        assert evidence in source
    assert "application navigation" in source
    assert "All 21 endpoints receive contract" not in source
    assert "clinician who reviewed the navigation fixtures is a sibling" in source
