"""Keep archived results and manuscript layout reproducible without model inference."""

import json
from pathlib import Path

from tools.release.build_release_artifacts import publication_table_layout, render_booking, render_safety
from tools.softwarex.build_revision_evidence import render_consent, render_privacy, validate_privacy

ROOT = Path(__file__).resolve().parents[3]
GENERATED = ROOT / "docs/softwarex/generated"


def load(name):
    return json.loads((GENERATED / name).read_text(encoding="utf-8"))


def test_archived_privacy_report_matches_fixtures_and_count_arithmetic():
    assert validate_privacy(load("privacy_extension_results.json"))["passed"]


def test_tables_reproduce_all_comparators_without_cherry_picking():
    privacy = render_privacy(load("privacy_extension_results.json"))
    assert privacy.count("Development &") == 3
    assert privacy.count("Separate probe &") == 3
    assert "75.0 (58.9--86.2" in privacy
    assert "100.0 (90.4--100.0" in privacy
    assert "93.1" in privacy and "5.6" in privacy
    consent = render_consent(load("consent_scope_results.json"))
    assert "L+K+R & 33.3 & 958.3" in consent
    assert "U & 8.3 & 6000.0" in consent
    assert "offline exposure counterfactual" in consent
    assert (GENERATED / "extended_results.tex").read_text(encoding="utf-8") == privacy + consent


def test_generated_tables_have_top_captions_and_flexible_float_placement():
    for rendered in (render_booking(load("booking_results.json")), render_safety(load("safety_results.json"))):
        assert "resizebox" not in rendered
        assert "[!h]" not in rendered
        for block in rendered.split(r"\begin{table")[1:]:
            assert block.index(r"\caption{") < block.index(r"\begin{tabular")
        assert publication_table_layout(rendered) == rendered


def test_capsule_includes_extended_frozen_reports_without_model_inference():
    runner = (ROOT / "tools/release/run_softwarex_capsule.sh").read_text(encoding="utf-8")
    assert "--privacy-extension" in runner and "--consent-scope" in runner
    assert "model inference not rerun" in runner
    assert "--verify-local-model" not in runner


def test_manuscript_avoids_forced_float_barriers_and_cites_requested_consent_work():
    source = (ROOT / "docs/softwarex/medora_softwarex.tex").read_text(encoding="utf-8")
    assert r"\FloatBarrier" not in source
    for citation in ("gics2022", "ttp2024", "consent2025"):
        assert r"\bibitem{" + citation + "}" in source
    assert r"\input{generated/extended_results.tex}" in source
