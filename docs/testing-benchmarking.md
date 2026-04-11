# Medora Production Testing and Benchmarking Guide

This guide describes how to execute Medora's enterprise testing and benchmarking framework locally and in production-like environments.

## 1) Scope Covered

- Functional correctness: backend + AI OCR unit suites
- Integration reliability: auth -> booking -> consultation -> prescription flow
- Contract safety: OpenAPI + schema snapshots
- Security: JWT, RBAC, cross-user data leakage checks
- Performance: API, OCR, database concurrency, realtime slot contention
- Load and stress: Locust + k6 healthcare workload scenarios
- Frontend performance: Lighthouse CI + Web Vitals regression guard
- Observability: Prometheus + Grafana dashboards for latency, throughput, error concentration

## 2) Local Execution

### Prerequisites

- Docker (for integration tests and testcontainers)
- Python 3.11+
- Node.js 20+ (for frontend perf + Playwright)
- Optional: `k6`, `locust`

### Install

```bash
pip install -r tests/requirements-test.txt
```

### Run all tests

```bash
bash ./run_tests.sh
```

### Run benchmark pipeline

```bash
export MEDORA_BASE_URL="http://localhost:8000"
export MEDORA_PATIENT_TOKEN="<token>"
export MEDORA_DOCTOR_TOKEN="<token>"
export MEDORA_DOCTOR_ID="<doctor-profile-id>"
bash ./run_benchmarks.sh
```

### Skip docker-backed tests

```bash
export MEDORA_SKIP_DOCKER=1
bash ./run_tests.sh
```

## 3) Production-like Benchmarking

Set these variables before running load suites against staging:

- `MEDORA_BASE_URL`
- `MEDORA_PATIENT_TOKEN`
- `MEDORA_DOCTOR_TOKEN`
- `MEDORA_DOCTOR_ID` (or `MEDORA_DOCTOR_IDS`)
- `MEDORA_DB_URL` for DB saturation benchmarks

Then run:

```bash
locust -f tests/locust/locustfile.py --host "$MEDORA_BASE_URL" --headless -u 200 -r 20 -t 15m
k6 run tests/k6/healthcare_workload.js
python tests/scripts/benchmark_regression_guard.py
```

## 4) Chaos Scenarios

`tests/performance/chaos_recovery_test.py` supports injectable fault commands:

- `CHAOS_AI_DOWN_CMD`, `CHAOS_AI_UP_CMD`
- `CHAOS_DB_SLOW_CMD`, `CHAOS_DB_NORMAL_CMD`

Example:

```bash
export CHAOS_AI_DOWN_CMD="kubectl scale deploy medora-ai-ocr --replicas=0 -n medora"
export CHAOS_AI_UP_CMD="kubectl scale deploy medora-ai-ocr --replicas=1 -n medora"
python tests/performance/chaos_recovery_test.py
```

## 5) Report Outputs

Generated reports are saved under:

- `tests/benchmarks/reports/current/*.json`
- `tests/benchmarks/reports/current/benchmark_summary.md`

Sample report templates:

- `tests/benchmarks/reports/sample/api_performance.json`
- `tests/benchmarks/reports/sample/ocr_accuracy_report.json`
- `tests/benchmarks/reports/sample/benchmark_summary.md`
