#!/usr/bin/env bash
# Build the pinned backend and AI images from a clean context and check that each one
# resolves its dependency graph and imports its application.
#
# The "Clean container validation" gate has always been recorded from a log carrying a
# MEDORA_GATE_PASSED marker, but the commands that produced it lived only in a shell
# history. This script is that procedure, written down so the gate can be re-run.
#
#   bash tools/release/validate_clean_containers.sh
#
# Writes tests/benchmarks/reports/current/docker_validation.log and exits non-zero if
# either image fails.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG="tests/benchmarks/reports/current/docker_validation.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

status=0

run() {
  echo "$@" >> "$LOG"
  "$@" >> "$LOG" 2>&1 || status=1
}

echo "=== building medora-backend:release-check ===" >> "$LOG"
run docker build -f backend/Dockerfile -t medora-backend:release-check backend

echo "=== building medora-ai:release-check ===" >> "$LOG"
run docker build -f ai_service/Dockerfile -t medora-ai:release-check ai_service

echo "=== backend dependency check ===" >> "$LOG"
run docker run --rm --entrypoint python medora-backend:release-check -m pip check

# The application reads settings at import time, so placeholders stand in for the real
# ones; this proves the module graph loads, not that the deployment is configured.
echo "=== backend import ===" >> "$LOG"
run docker run --rm \
  -e SUPABASE_URL=https://placeholder.supabase.co \
  -e SUPABASE_KEY=placeholder \
  -e SUPABASE_SERVICE_ROLE_KEY=placeholder \
  -e SUPABASE_DATABASE_URL=postgresql+asyncpg://placeholder:placeholder@127.0.0.1:5432/placeholder \
  -e SUPABASE_STORAGE_BUCKET=placeholder \
  -e PRELOAD_WHISPER_ON_STARTUP=false \
  --entrypoint python medora-backend:release-check \
  -c "import app.main; print('backend import passed with placeholder configuration')"

echo "=== ai dependency check ===" >> "$LOG"
run docker run --rm --entrypoint python medora-ai:release-check -m pip check

echo "=== ai import ===" >> "$LOG"
run docker run --rm --entrypoint python medora-ai:release-check \
  -c "import app.main; print('ai import passed')"

if [[ $status -eq 0 ]]; then
  echo "MEDORA_GATE_PASSED exit_code=0" >> "$LOG"
else
  echo "MEDORA_GATE_FAILED exit_code=$status" >> "$LOG"
fi

tail -n 20 "$LOG"
exit $status
