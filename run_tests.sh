#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ -n "${MEDORA_TEST_PYTHON:-}" ]]; then
  BACKEND_TEST_PYTHON="$MEDORA_TEST_PYTHON"
  AI_TEST_PYTHON="$MEDORA_TEST_PYTHON"
elif [[ -x "$ROOT_DIR/backend/venv/bin/python" ]]; then
  BACKEND_TEST_PYTHON="$ROOT_DIR/backend/venv/bin/python"
  AI_TEST_PYTHON="$ROOT_DIR/ai_service/venv/bin/python"
elif [[ -x "$ROOT_DIR/backend/venv/Scripts/python.exe" ]]; then
  BACKEND_TEST_PYTHON="$ROOT_DIR/backend/venv/Scripts/python.exe"
  AI_TEST_PYTHON="$ROOT_DIR/ai_service/venv/Scripts/python.exe"
else
  BACKEND_TEST_PYTHON="python"
  AI_TEST_PYTHON="python"
fi

mkdir -p tests/benchmarks/reports/current

echo "=== Medora Backend Unit + Integration + Security Tests ==="
MEDORA_TEST_TARGET=backend "$BACKEND_TEST_PYTHON" -m pytest -c tests/pytest.backend.ini tests/unit/backend
(
  cd "$ROOT_DIR/backend"
  export MEDORA_TEST_TARGET=backend
  "$BACKEND_TEST_PYTHON" -m pytest -c ../tests/pytest.backend.ini tests
)

if [[ "${MEDORA_SKIP_DOCKER:-0}" != "1" ]]; then
  MEDORA_TEST_TARGET=backend "$BACKEND_TEST_PYTHON" -m pytest -c tests/pytest.backend.ini tests/integration/backend tests/security
else
  echo "Skipping docker-backed integration/security suites (MEDORA_SKIP_DOCKER=1)."
fi

echo "=== Medora AI OCR Unit Tests ==="
(
  cd "$ROOT_DIR/ai_service"
  export MEDORA_TEST_TARGET=ai_service
  "$AI_TEST_PYTHON" -m pytest -c ../tests/pytest.ai.ini ../tests/unit/ai_service
)

if [[ "${E2E_ENABLED:-0}" == "1" ]]; then
  echo "=== Playwright E2E Tests ==="
  pushd tests/e2e >/dev/null
  npx playwright test
  popd >/dev/null
else
  echo "Skipping Playwright E2E. Set E2E_ENABLED=1 to enable."
fi

"$BACKEND_TEST_PYTHON" tests/scripts/build_human_report.py
echo "All selected test suites completed."
