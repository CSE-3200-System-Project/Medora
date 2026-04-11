# Performance and Reliability Benchmarks

Scripts in this directory provide production-style benchmarking for Medora:

- `api_latency_benchmark.py`: p50/p95/p99, throughput, and error-rate for critical APIs
- `db_concurrency_benchmark.py`: query latency and pool saturation under high concurrency
- `ocr_pipeline_benchmark.py`: OCR latency, confidence, and retry profile
- `realtime_slot_consistency_benchmark.py`: 100+ concurrent bookings on a single slot
- `chaos_recovery_test.py`: outage/latency fault injection and recovery checks
- `frontend_perf_guard.mjs`: Lighthouse/Web Vitals regression gate
