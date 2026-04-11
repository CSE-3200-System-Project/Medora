# Medora Test and Benchmark Framework

This directory contains production-oriented validation for Medora's distributed healthcare platform:

- `unit/`: deterministic service and parser correctness
- `integration/`: async API + database lifecycle validation with dockerized PostgreSQL
- `e2e/`: Playwright user journeys (patient, doctor, bilingual UX)
- `security/`: RBAC, JWT, and data isolation checks
- `performance/`: API/DB/OCR/realtime benchmark runners
- `locust/` and `k6/`: load, stress, spike, and mixed workload scripts
- `benchmarks/`: baselines, datasets, sample reports, regression gates
- `scripts/`: reporting, baseline comparison, synthetic data generation

## Quick Start

### 1) Install test dependencies

```bash
pip install -r tests/requirements-test.txt
```

### 2) Backend tests

```bash
MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini
```

### 3) AI OCR tests

```bash
MEDORA_TEST_TARGET=ai_service pytest -c tests/pytest.ai.ini
```

### 4) Full orchestrated run

```bash
bash ./run_tests.sh
```

### 5) Benchmarks and regression checks

```bash
bash ./run_benchmarks.sh
```

## Notes

- Integration tests use `testcontainers` and require Docker.
- Performance checks compare against `tests/benchmarks/baselines/*.json`.
- CI fails if median latency regresses by >20% or error-rate increases above baseline threshold.
