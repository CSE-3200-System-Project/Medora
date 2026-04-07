#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

mkdir -p tests/benchmarks/reports/current

MEDORA_BASE_URL="${MEDORA_BASE_URL:-http://localhost:8000}"
LOCUST_USERS="${LOCUST_USERS:-120}"
LOCUST_SPAWN_RATE="${LOCUST_SPAWN_RATE:-12}"
LOCUST_RUNTIME="${LOCUST_RUNTIME:-6m}"

echo "=== Locust Load Test (API, AI, OCR, Mixed Workload) ==="
locust -f tests/locust/locustfile.py \
  --host "$MEDORA_BASE_URL" \
  --headless \
  -u "$LOCUST_USERS" \
  -r "$LOCUST_SPAWN_RATE" \
  -t "$LOCUST_RUNTIME"

echo "=== API Latency Benchmark ==="
python tests/performance/api_latency_benchmark.py

if [[ -n "${MEDORA_DB_URL:-${SUPABASE_DATABASE_URL:-}}" ]]; then
  echo "=== Database Concurrency Benchmark ==="
  python tests/performance/db_concurrency_benchmark.py
else
  echo "Skipping DB benchmark (MEDORA_DB_URL/SUPABASE_DATABASE_URL not set)."
fi

echo "=== OCR Pipeline Benchmark ==="
python tests/performance/ocr_pipeline_benchmark.py

echo "=== Realtime Slot Consistency Benchmark ==="
python tests/performance/realtime_slot_consistency_benchmark.py

echo "=== OCR Accuracy Benchmark ==="
python tests/benchmarks/ocr_accuracy_benchmark.py || true

echo "=== Cost/Performance Analysis ==="
python tests/benchmarks/cost_performance_analysis.py

if command -v k6 >/dev/null 2>&1; then
  echo "=== k6 Stress and Spike Scenarios ==="
  k6 run tests/k6/healthcare_workload.js
else
  echo "Skipping k6 (binary not installed)."
fi

echo "=== Chaos Recovery Scenarios ==="
python tests/performance/chaos_recovery_test.py || true

echo "=== Regression Guard ==="
python tests/scripts/benchmark_regression_guard.py

echo "=== Human Summary ==="
python tests/scripts/build_human_report.py

echo "Benchmark pipeline finished."
