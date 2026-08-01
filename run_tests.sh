#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ -n "${MEDORA_TEST_PYTHON:-}" ]]; then
  TEST_PYTHON="$MEDORA_TEST_PYTHON"
elif [[ -x "$ROOT_DIR/backend/venv/bin/python" ]]; then
  TEST_PYTHON="$ROOT_DIR/backend/venv/bin/python"
elif [[ -x "$ROOT_DIR/backend/venv/Scripts/python.exe" ]]; then
  TEST_PYTHON="$ROOT_DIR/backend/venv/Scripts/python.exe"
else
  TEST_PYTHON="python"
fi

mkdir -p tests/benchmarks/reports/current

echo "=== Medora Backend Unit + Integration + Security Tests ==="
MEDORA_TEST_TARGET=backend "$TEST_PYTHON" -m pytest -c tests/pytest.backend.ini tests/unit/backend
(
  cd "$ROOT_DIR/backend"
  export MEDORA_TEST_TARGET=backend
  "$TEST_PYTHON" -m pytest -c ../tests/pytest.backend.ini tests
)

if [[ "${MEDORA_SKIP_DOCKER:-0}" != "1" ]]; then
  MEDORA_TEST_TARGET=backend "$TEST_PYTHON" -m pytest -c tests/pytest.backend.ini tests/integration/backend tests/security
else
  echo "Skipping docker-backed integration/security suites (MEDORA_SKIP_DOCKER=1)."
fi

echo "=== Medora AI OCR Unit Tests ==="
(
  cd "$ROOT_DIR/ai_service"
  export MEDORA_TEST_TARGET=ai_service
  "$TEST_PYTHON" -m pytest -c ../tests/pytest.ai.ini ../tests/unit/ai_service
)

if [[ "${E2E_ENABLED:-0}" == "1" ]]; then
  echo "=== Playwright E2E Tests ==="
  pushd tests/e2e >/dev/null
  npx playwright test
  popd >/dev/null
else
  echo "Skipping Playwright E2E. Set E2E_ENABLED=1 to enable."
fi

"$TEST_PYTHON" tests/scripts/build_human_report.py
echo "All selected test suites completed."
