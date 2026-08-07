#!/usr/bin/env bash
# Run the benchmark suite and report, per step, whether it ran, was skipped, or failed.
#
# Two steps used to end in `|| true`, so a failure was indistinguishable from a pass and
# the script always claimed to finish. That is how several benchmarks stayed unexecuted
# without anyone noticing. Every step now records an outcome, the summary names each one,
# and the script exits non-zero if anything failed.
#
#   ./run_benchmarks.sh                    # everything available
#   MEDORA_SKIP_LOAD=1 ./run_benchmarks.sh # skip the long Locust and k6 runs

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

mkdir -p tests/benchmarks/reports/current

MEDORA_BASE_URL="${MEDORA_BASE_URL:-http://localhost:8000}"
LOCUST_USERS="${LOCUST_USERS:-120}"
LOCUST_SPAWN_RATE="${LOCUST_SPAWN_RATE:-12}"
LOCUST_RUNTIME="${LOCUST_RUNTIME:-6m}"
PYTHON="${MEDORA_PYTHON:-python}"

# Several benchmarks do `from tests.scripts.metrics import ...`, but running them as
# `python tests/performance/x.py` puts tests/performance on sys.path rather than the
# repository root, so the import fails before any measurement happens. They could never
# have run from this pipeline. Putting the root on PYTHONPATH fixes all of them at once.
export PYTHONPATH="$ROOT_DIR${PYTHONPATH:+:$PYTHONPATH}"

# The database benchmark reads its DSN from the environment, and the value lives in
# backend/.env rather than the shell, so the step skipped itself on every run.
if [[ -z "${MEDORA_DB_URL:-}" && -z "${SUPABASE_DATABASE_URL:-}" && -f backend/.env ]]; then
  SUPABASE_DATABASE_URL="$(sed -n 's/^SUPABASE_DATABASE_URL=//p' backend/.env | head -1 | tr -d '"'"'"'\r')"
  export SUPABASE_DATABASE_URL
fi

declare -a STEP_NAMES=()
declare -a STEP_RESULTS=()
failures=0

record() {
  STEP_NAMES+=("$1")
  STEP_RESULTS+=("$2")
  if [[ "$2" == FAILED* ]]; then
    failures=$((failures + 1))
  fi
}

run_step() {
  local name="$1"
  shift
  echo "=== $name ==="
  if "$@"; then
    record "$name" "ran"
  else
    local code=$?
    echo "!!! $name failed with exit $code"
    record "$name" "FAILED (exit $code)"
  fi
}

skip_step() {
  echo "=== $1 (skipped) ==="
  echo "    $2"
  record "$1" "skipped: $2"
}

if [[ -n "${MEDORA_SKIP_LOAD:-}" ]]; then
  skip_step "Locust load test" "MEDORA_SKIP_LOAD is set"
elif ! command -v locust >/dev/null 2>&1; then
  skip_step "Locust load test" "locust is not installed"
else
  run_step "Locust load test" locust -f tests/locust/locustfile.py \
    --host "$MEDORA_BASE_URL" --headless -u "$LOCUST_USERS" -r "$LOCUST_SPAWN_RATE" -t "$LOCUST_RUNTIME"
fi

# Both of these call authenticated endpoints. Without tokens every request is a 401 and
# the report records the latency of the auth rejection while looking like an endpoint
# measurement, which is worse than no report at all. Provision credentials with
# tests/e2e/provision_synthetic_accounts.py and export the three variables.
if [[ -n "${MEDORA_PATIENT_TOKEN:-}" && -n "${MEDORA_DOCTOR_ID:-}" ]]; then
  run_step "API latency benchmark" "$PYTHON" tests/performance/api_latency_benchmark.py
else
  skip_step "API latency benchmark" "MEDORA_PATIENT_TOKEN and MEDORA_DOCTOR_ID are not set; every request would be a 401"
fi

if [[ -n "${MEDORA_DB_URL:-${SUPABASE_DATABASE_URL:-}}" ]]; then
  run_step "Database concurrency benchmark" "$PYTHON" tests/performance/db_concurrency_benchmark.py
else
  skip_step "Database concurrency benchmark" "neither MEDORA_DB_URL nor SUPABASE_DATABASE_URL is set"
fi

if [[ -n "${MEDORA_PATIENT_TOKEN:-}" ]]; then
  run_step "OCR pipeline benchmark" "$PYTHON" tests/performance/ocr_pipeline_benchmark.py
else
  skip_step "OCR pipeline benchmark" "MEDORA_PATIENT_TOKEN is not set; every request would be a 401"
fi

# --slots is required and this pipeline never passed it, so the step exited on its own
# usage message every time and `set -e` plus the old summary-free output hid that it had
# never once produced a measurement. It needs a JSON file of fresh slots grouped under
# concurrency 2, 10, and 50; without one there is nothing to measure.
MEDORA_SLOT_FIXTURE="${MEDORA_SLOT_FIXTURE:-tests/benchmarks/datasets/realtime_slots.json}"
if [[ -f "$MEDORA_SLOT_FIXTURE" ]]; then
  run_step "Realtime slot consistency benchmark" "$PYTHON" \
    tests/performance/realtime_slot_consistency_benchmark.py --slots "$MEDORA_SLOT_FIXTURE"
else
  skip_step "Realtime slot consistency benchmark" \
    "no slot fixture at $MEDORA_SLOT_FIXTURE; set MEDORA_SLOT_FIXTURE to one grouped under 2, 10, and 50"
fi

# The OCR accuracy claim is withdrawn for this release: there is no adjudicated gold
# standard, so the harness has nothing to score against. This is a stated skip rather
# than the `|| true` that used to hide its failure.
if [[ -f tests/benchmarks/datasets/ocr_gold_standard.jsonl ]]; then
  run_step "OCR accuracy benchmark" "$PYTHON" tests/benchmarks/ocr_accuracy_benchmark.py
else
  skip_step "OCR accuracy benchmark" "no adjudicated gold standard; the accuracy claim is withdrawn"
fi

run_step "Cost and performance analysis" "$PYTHON" tests/benchmarks/cost_performance_analysis.py

if [[ -n "${MEDORA_SKIP_LOAD:-}" ]]; then
  skip_step "k6 stress and spike scenarios" "MEDORA_SKIP_LOAD is set"
elif ! command -v k6 >/dev/null 2>&1; then
  skip_step "k6 stress and spike scenarios" "the k6 binary is not installed"
else
  run_step "k6 stress and spike scenarios" k6 run tests/k6/healthcare_workload.js
fi

run_step "Chaos recovery scenarios" "$PYTHON" tests/performance/chaos_recovery_test.py
run_step "Regression guard" "$PYTHON" tests/scripts/benchmark_regression_guard.py
run_step "Human summary" "$PYTHON" tests/scripts/build_human_report.py

echo
echo "=== Benchmark pipeline summary ==="
for index in "${!STEP_NAMES[@]}"; do
  printf '  %-38s %s\n' "${STEP_NAMES[$index]}" "${STEP_RESULTS[$index]}"
done

if [[ $failures -gt 0 ]]; then
  echo
  echo "$failures step(s) failed."
  exit 1
fi
echo
echo "No step failed. Steps marked skipped did not run and produced no evidence."
