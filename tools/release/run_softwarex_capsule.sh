#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS_DIR="${RESULTS_DIR:-/results}"
cd "$ROOT"
mkdir -p "$RESULTS_DIR"

export AI_PROVIDER=mock
export CHORUI_PRIVACY_MODE=strict_local
export PHI_NER_ENABLED=false
export PRELOAD_WHISPER_ON_STARTUP=false
export REMINDER_DISPATCH_ENABLED=false
export SUPABASE_DATABASE_URL="${SUPABASE_DATABASE_URL:-postgresql+asyncpg://placeholder:placeholder@127.0.0.1:5432/placeholder}"
export SUPABASE_URL="${SUPABASE_URL:-https://placeholder.supabase.co}"
export SUPABASE_KEY="${SUPABASE_KEY:-placeholder}"
export SUPABASE_STORAGE_BUCKET="${SUPABASE_STORAGE_BUCKET:-placeholder}"

python -m pip install --disable-pip-version-check \
  -r backend/requirements-release.txt \
  -r tests/requirements-release.txt
python -m pip freeze > "$RESULTS_DIR/requirements-resolved.txt"

python -m pytest -c tests/pytest.backend.ini -q \
  tests/unit/backend/test_softwarex_privacy_suite.py \
  tests/unit/backend/test_symptom_navigation_safety.py \
  tests/unit/backend/test_softwarex_worked_examples.py \
  tests/unit/backend/test_record_coverage.py \
  -p no:cacheprovider \
  --junitxml "$RESULTS_DIR/fixture-tests.xml"

python tools/release/verify_capsule_observations.py --output "$RESULTS_DIR/archived_observation_verification.json"
python tests/benchmarks/run_safety_benchmarks.py --output "$RESULTS_DIR/current_safety_results.json"
bash tools/release/run_capsule_booking.sh
python tools/release/run_capsule_models.py --results "$RESULTS_DIR"

cp docs/softwarex/generated/safety_results.json "$RESULTS_DIR/safety_results.json"
cp docs/softwarex/generated/booking_results.json "$RESULTS_DIR/booking_results.json"
cp docs/softwarex/generated/privacy_extension_results.json "$RESULTS_DIR/privacy_extension_results.json"
cp docs/softwarex/generated/consent_scope_results.json "$RESULTS_DIR/consent_scope_results.json"
python tools/release/render_softwarex_tables.py \
  --safety "$RESULTS_DIR/safety_results.json" \
  --booking "$RESULTS_DIR/booking_results.json" \
  --privacy-extension "$RESULTS_DIR/privacy_extension_results.json" \
  --consent-scope "$RESULTS_DIR/consent_scope_results.json" \
  --output "$RESULTS_DIR"

python - "$ROOT" "$RESULTS_DIR" <<'PY'
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

root, results = Path(sys.argv[1]), Path(sys.argv[2])
commit_candidates = []
marker = root / "CAPSULE_SOURCE_COMMIT"
if marker.is_file():
    commit_candidates.append(("package marker", marker.read_text(encoding="utf-8").strip()))
environment_commit = os.environ.get("MEDORA_CAPSULE_SOURCE_COMMIT", "").strip()
if environment_commit:
    commit_candidates.append(("MEDORA_CAPSULE_SOURCE_COMMIT", environment_commit))
try:
    git_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
except (OSError, subprocess.CalledProcessError):
    git_commit = ""
if not commit_candidates and git_commit:
    commit_candidates.append(("Git HEAD", git_commit))
if not commit_candidates:
    raise SystemExit("source commit is unknown; package the clean Git commit or set MEDORA_CAPSULE_SOURCE_COMMIT")
commit = commit_candidates[0][1]
if any(value != commit for _, value in commit_candidates[1:]):
    raise SystemExit("capsule source commit marker and MEDORA_CAPSULE_SOURCE_COMMIT disagree")
if not re.fullmatch(r"[0-9a-f]{40}", commit):
    raise SystemExit(f"capsule source commit is not a full Git SHA-1: {commit!r}")

files = (
    "safety_results.json",
    "booking_results.json",
    "safety_results.tex",
    "booking_results.tex",
    "privacy_extension_results.json",
    "consent_scope_results.json",
    "extended_results.tex",
    "fixture-tests.xml",
    "archived_observation_verification.json",
    "current_safety_results.json",
    "current_booking_results.json",
    "booking-tests.xml",
    "model_execution_coverage.json",
    "requirements-resolved.txt",
)
model_coverage = json.loads((results / "model_execution_coverage.json").read_text())
files = list(files)
for profile, filename in (("phi_inference", "current_privacy_extension_results.json"),
                          ("detector", "current_detector_verification.json")):
    if model_coverage[profile]["status"] == "executed":
        files.append(filename)
manifest = {
    "scope": "SoftwareX revision evidence only",
    "source_commit": commit,
    "ai_provider": "deterministic mock",
    "frozen_safety_report_executed_at": json.loads(
        (results / "safety_results.json").read_text(encoding="utf-8")
    ).get("executed_at"),
    "safety_metrics": "frozen report copied from the source snapshot; focused tests check current code separately",
    "booking_scope": "historical table preserved; 90 fresh-slot trials rerun in a native isolated PostgreSQL 16 capsule cluster and stored separately",
    "current_safety_scope": "current-code mock/rule scoring stored separately from the historical baseline",
    "extended_scope": "historical tables preserved; model_execution_coverage records included profiles actually executed; no live consent-scope provider rerun",
    "model_execution": model_coverage,
    "artifacts": {
        name: hashlib.sha256((results / name).read_bytes()).hexdigest()
        for name in files
    },
}
(results / "reproduction_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

echo "SoftwareX fixture reproduction completed; outputs are in $RESULTS_DIR"
