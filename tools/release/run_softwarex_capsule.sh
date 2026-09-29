#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS_DIR="${RESULTS_DIR:-/results}"
cd "$ROOT"
mkdir -p "$RESULTS_DIR"

export AI_PROVIDER=mock
export SUPABASE_DATABASE_URL="${SUPABASE_DATABASE_URL:-postgresql+asyncpg://placeholder:placeholder@127.0.0.1:5432/placeholder}"
export SUPABASE_URL="${SUPABASE_URL:-https://placeholder.supabase.co}"
export SUPABASE_KEY="${SUPABASE_KEY:-placeholder}"
export SUPABASE_STORAGE_BUCKET="${SUPABASE_STORAGE_BUCKET:-placeholder}"

python -m pip install --disable-pip-version-check \
  -r backend/requirements-release.txt \
  -r tests/requirements-release.txt

python -m pytest -c tests/pytest.backend.ini -q \
  tests/unit/backend/test_softwarex_privacy_suite.py \
  tests/unit/backend/test_symptom_navigation_safety.py \
  tests/unit/backend/test_softwarex_worked_examples.py \
  --junitxml "$RESULTS_DIR/fixture-tests.xml"

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
)
manifest = {
    "scope": "SoftwareX revision evidence only",
    "source_commit": commit,
    "ai_provider": "deterministic mock",
    "frozen_safety_report_executed_at": json.loads(
        (results / "safety_results.json").read_text(encoding="utf-8")
    ).get("executed_at"),
    "safety_metrics": "frozen report copied from the source snapshot; focused tests check current code separately",
    "booking_scope": "table regenerated from the frozen report; latency experiment not rerun",
    "extended_scope": "archived privacy/consent component tables regenerated; model inference not rerun",
    "artifacts": {
        name: hashlib.sha256((results / name).read_bytes()).hexdigest()
        for name in files
    },
}
(results / "reproduction_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

echo "SoftwareX fixture reproduction completed; outputs are in $RESULTS_DIR"
