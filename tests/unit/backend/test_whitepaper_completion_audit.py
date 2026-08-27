from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
AUDITOR_PATH = ROOT / "tools/release/audit_whitepaper_completion.py"


def _auditor():
    spec = importlib.util.spec_from_file_location("whitepaper_completion_audit", AUDITOR_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.backend
def test_completion_audit_is_weighted_and_keeps_human_gates_open(tmp_path: Path) -> None:
    auditor = _auditor()
    audit = auditor.build_audit()
    assert audit["total_weight"] == 100
    assert audit["completion_percentage"] == audit["completed_weight"]

    items = {item["id"]: item for item in audit["items"]}
    assert items["phi_admission"]["status"] == "complete"
    assert items["maya_automated"]["status"] == "complete"
    assert items["maya_clinical_review"]["status"] == "remaining"
    assert items["staging"]["status"] == "remaining"
    assert items["canary"]["status"] == "remaining"
    assert items["maya_clinical_review"]["owner"] == "human_clinical"

    output = tmp_path / "audit.json"
    output.write_text(json.dumps(audit), encoding="utf-8")
    assert json.loads(output.read_text(encoding="utf-8"))["total_weight"] == 100


@pytest.mark.backend
def test_completion_audit_reports_missing_evidence_instead_of_crashing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    auditor = _auditor()
    monkeypatch.setattr(auditor, "ROOT", tmp_path)
    audit = auditor.build_audit()
    assert audit["completion_percentage"] == 0.0
    assert all(item["status"] == "remaining" for item in audit["items"])
    assert any(item["check_error"] for item in audit["items"])
