import copy
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("capsule_verification", ROOT / "tools/release/verify_capsule_observations.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def inputs():
    return [json.loads((ROOT / f"docs/softwarex/generated/{name}_results.json").read_text(encoding="utf-8")) for name in ("safety", "booking")]


def test_archived_statistics_are_recomputed_from_observations():
    report = mod.verify(*inputs())
    assert report["passed"]
    assert report["privacy_recomputed"]["true_positives"] == 71
    assert len(report["booking_recomputed"]) == 3


@pytest.mark.parametrize("field", ["true_positives", "false_positives", "recall"])
def test_changed_archived_privacy_metrics_are_rejected(field):
    safety, booking = copy.deepcopy(inputs())
    safety["privacy"][field] += 1
    with pytest.raises(AssertionError):
        mod.verify(safety, booking)


def test_changed_booking_latency_is_rejected():
    safety, booking = copy.deepcopy(inputs())
    booking["results"][0]["transaction_latency_ms"]["p95"] += 1
    with pytest.raises(AssertionError):
        mod.verify(safety, booking)


def test_capsule_does_not_require_docker_in_docker_or_accept_skips():
    runner = (ROOT / "tools/release/run_capsule_booking.sh").read_text()
    assert "initdb" in runner and "medora_capsule_benchmark" in runner
    assert "not list(root.iter('skipped'))" in runner
    assert "dropdb" not in runner


def test_private_doctor_identity_is_not_in_public_summary():
    # The public test is portable; do not require the private author's workstation kit.
    public = (ROOT / "docs/softwarex/author-evidence/COMPLETED_REVIEW_SUMMARIES.md").read_text(encoding="utf-8")
    assert "approximately 100" in public and "no formal institutional ethics review" in public.lower()
    assert "@gmail.com" not in public
