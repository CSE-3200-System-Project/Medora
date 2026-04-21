# Testing & Quality Assurance Report

## Overview

Medora employs a **comprehensive, multi-layered testing strategy** designed to validate correctness, performance, security, and resilience in a production healthcare environment. The test suite covers **unit correctness**, **integration workflows**, **end-to-end user journeys**, **security boundaries**, and **performance benchmarks**.

---

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Pyramid                              │
│                                                              │
│                   ┌──────────┐                               │
│                  │  E2E     │  Playwright user journeys      │
│                 │  Tests   │  (appointment, OCR, auth)      │
│                └────────────┘                                │
│              ┌──────────────────┐                            │
│             │  Integration     │   API + DB lifecycle        │
│            │  Tests            │   Clinical workflows        │
│           └────────────────────┘                             │
│         ┌──────────────────────────┐                         │
│        │  Unit Tests               │  Service logic, parsers │
│       │  (Backend + AI OCR)        │  AI orchestrator, YOLO  │
│      └────────────────────────────┘                          │
│    ┌──────────────────────────────────────┐                  │
│   │  Security + Performance + Load Tests  │                  │
│  │  RBAC, JWT, Locust, k6, Chaos          │                  │
│ └──────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Unit Tests

### Backend Unit Tests (`tests/unit/backend/`)

| Test File | Coverage | Status |
|-----------|----------|--------|
| `test_ai_orchestrator.py` | AI provider abstraction, output validation, fallback behavior | ✅ Passing |
| `test_ai_privacy.py` | PII anonymization, tokenization, re-identification | ✅ Passing |
| `test_appointment_service.py` | Appointment lifecycle logic, status transitions, slot validation | ✅ Passing |
| `test_data_sharing_guard.py` | Consent enforcement, access control, audit logging | ✅ Passing |
| `test_rls_context.py` | Row Level Security context, multi-tenant isolation | ✅ Passing |
| `test_security_dependencies.py` | JWT verification, RBAC enforcement, token expiry | ✅ Passing |

**Key Metrics**:
- **Total Test Cases**: 50+
- **Code Coverage**: 80%+ (enforced in CI)
- **Execution Time**: < 30 seconds
- **Framework**: Pytest with async support

**What's Tested**:
- AI orchestrator provider switching (Groq ↔ Gemini ↔ Cerebras)
- PII tokenization and detokenization with stable hashes
- Appointment state machine transitions (pending → confirmed → completed)
- Data sharing consent checks (patient grants/revokes access)
- RLS context isolation (user A cannot access user B's data)
- JWT token validation (expired, malformed, wrong role)

---

### AI OCR Service Unit Tests (`tests/unit/ai_service/`)

| Test File | Coverage | Status |
|-----------|----------|--------|
| `test_matcher.py` | RapidFuzz medicine matching, confidence thresholds | ✅ Passing |
| `test_parser.py` | Prescription parsing, dosage extraction, frequency normalization | ✅ Passing |
| `test_pipeline.py` | End-to-end OCR pipeline (input → YOLO → OCR → parse) | ✅ Passing |
| `test_yolo.py` | YOLO region detection, confidence thresholds, IoU filtering | ✅ Passing |

**Key Metrics**:
- **Total Test Cases**: 30+
- **Code Coverage**: 75%+
- **Execution Time**: < 20 seconds
- **Framework**: Pytest with mock Azure/YOLO backends

**What's Tested**:
- Medicine name fuzzy matching against database (RapidFuzz ≥ 0.75 confidence)
- Dosage extraction from unstructured text (frequency, quantity, duration)
- OCR pipeline orchestration (normalization → detection → extraction → parsing)
- YOLO bounding box detection with confidence and IoU thresholds
- Fallback behavior when Azure OCR is unavailable

---

## 2. Integration Tests (`tests/integration/backend/`)

| Test File | Coverage | Status |
|-----------|----------|--------|
| `test_ai_and_ocr_integration.py` | AI search + OCR delegation, end-to-end AI workflows | ✅ Passing |
| `test_api_contracts.py` | OpenAPI schema validation, response type safety | ✅ Passing |
| `test_clinical_lifecycle.py` | Full patient journey: signup → booking → consultation → prescription | ✅ Passing |
| `test_consultation_draft_preview.py` | Consultation draft generation, HTML rendering | ✅ Passing |

**Key Metrics**:
- **Total Test Cases**: 20+
- **Execution Time**: < 2 minutes
- **Database**: Testcontainers with PostgreSQL
- **Framework**: Pytest with async fixtures

**What's Tested**:
- **Clinical Lifecycle**:
  1. Patient signup → onboarding
  2. Doctor signup → verification → schedule setup
  3. Appointment booking → realtime slot update
  4. Doctor confirms appointment
  5. Consultation creation → prescription issuance
  6. Patient views prescription → accepts/rejects
- **API Contract Safety**:
  - All endpoints return Pydantic-validated schemas
  - No breaking changes to response types
  - Snapshot comparison against baseline schemas
- **AI + OCR Integration**:
  - AI doctor search returns ranked results
  - OCR service processes prescription images
  - Structured extraction matches expected format

---

## 3. End-to-End Tests (`tests/e2e/specs/`)

| Test Spec | User Journey | Status |
|-----------|--------------|--------|
| `appointment-booking-reschedule.spec.ts` | Patient books appointment → doctor reschedules → patient accepts | ✅ Passing |
| `doctor-verification.spec.ts` | Doctor registers → admin reviews → approval | ✅ Passing |
| `patient-onboarding.spec.ts` | Patient signs up → completes onboarding → accesses dashboard | ✅ Passing |
| `prescription-upload-ocr.spec.ts` | Upload prescription → OCR processing → structured display | ✅ Passing |

**Key Metrics**:
- **Total E2E Scenarios**: 4 critical user journeys
- **Execution Time**: < 5 minutes
- **Framework**: Playwright with TypeScript
- **Browsers**: Chromium (Firefox/Safari optional)

**What's Tested**:
- **Appointment Booking & Reschedule**:
  1. Patient navigates to find-doctor
  2. Searches by specialty and location
  3. Selects doctor and books appointment
  4. Doctor receives notification and proposes reschedule
  5. Patient receives notification and accepts
  6. Both parties see updated appointment time
- **Doctor Verification**:
  1. Doctor registers with qualifications
  2. Admin sees pending verification
  3. Admin reviews and approves
  4. Doctor gains access to clinical features
- **Patient Onboarding**:
  1. Patient signs up with email/password
  2. Email verification
  3. Multi-step onboarding (profile, medical history)
  4. Dashboard access granted
- **Prescription Upload & OCR**:
  1. Patient uploads prescription image
  2. Backend delegates to AI OCR service
  3. YOLO detects regions
  4. Azure OCR extracts text
  5. Parser structures output
  6. Frontend displays medications, tests, procedures

---

## 4. Security Tests (`tests/security/`)

| Test File | Coverage | Status |
|-----------|----------|--------|
| `test_rbac_and_jwt.py` | Role-based access control, JWT validation, cross-user isolation | ✅ Passing |

**What's Tested**:
- **RBAC Enforcement**:
  - Patient cannot access doctor-only endpoints
  - Doctor cannot access admin endpoints
  - Unauthenticated requests are rejected (401)
  - Wrong-role requests are forbidden (403)
- **JWT Validation**:
  - Expired tokens are rejected
  - Malformed tokens are rejected
  - Token tampering is detected
  - Service-role keys cannot be used as user tokens
- **Cross-User Data Isolation**:
  - Patient A cannot view Patient B's records
  - Doctor A cannot access Doctor B's patients
  - Consent revocation blocks access immediately
- **Input Sanitization**:
  - SQL injection attempts are neutralized
  - XSS payloads are sanitized
  - Oversized payloads are rejected

---

## 5. Performance Tests (`tests/performance/`)

| Test File | Purpose | Metrics Tracked |
|-----------|---------|-----------------|
| `api_latency_benchmark.py` | API endpoint latency under normal load | p50, p95, p99 latency |
| `db_concurrency_benchmark.py` | Database connection pool under concurrent access | Query latency, pool utilization |
| `ocr_pipeline_benchmark.py` | OCR processing time and throughput | Processing time, success rate |
| `realtime_slot_consistency_benchmark.py` | Realtime slot update consistency | Update latency, missed events |
| `frontend_perf_guard.mjs` | Frontend rendering performance | FPS, layout shifts, paint time |
| `chaos_recovery_test.py` | System recovery from injected faults | Recovery time, error rate |

**Baseline Metrics** (stored in `tests/benchmarks/baselines/`):

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API p50 Latency | < 200ms | ~150ms | ✅ Pass |
| API p95 Latency | < 500ms | ~380ms | ✅ Pass |
| API p99 Latency | < 1000ms | ~750ms | ✅ Pass |
| OCR Processing Time | < 5s | ~3.5s | ✅ Pass |
| Realtime Slot Update | < 1s | ~500ms | ✅ Pass |
| DB Query Latency (p95) | < 100ms | ~70ms | ✅ Pass |
| Frontend LCP | < 2.5s | ~1.8s | ✅ Pass |
| Frontend CLS | < 0.1 | ~0.05 | ✅ Pass |

**Regression Guard**: CI fails if median latency regresses by >20% or error rate increases above baseline threshold.

---

## 6. Load & Stress Tests

### Locust Load Testing (`tests/locust/locustfile.py`)

**Workload Simulation**:
- **Concurrent Users**: 50 - 200
- **Ramp-up Rate**: 20 users/second
- **Duration**: 15 minutes
- **User Types**: Patient (60%), Doctor (30%), Admin (10%)

**Tested Scenarios**:
- Doctor search with AI processing
- Appointment booking with realtime slots
- Consultation creation
- Prescription upload and OCR
- Notification dispatch

**Baseline Results** (stored in `tests/benchmarks/baselines/locust_baseline.json`):

| Metric | Value |
|--------|-------|
| Requests/sec | ~120 RPS |
| Median Response Time | ~250ms |
| 95th Percentile | ~600ms |
| Failure Rate | < 0.5% |

---

### k6 Stress Testing (`tests/k6/healthcare_workload.js`)

**Stress Patterns**:
- **Smoke Test**: 10 users for 1 minute (sanity check)
- **Load Test**: 100 users for 10 minutes (sustained load)
- **Stress Test**: 300 users for 5 minutes (breaking point)
- **Spike Test**: Ramp from 10 → 500 → 10 users (spike handling)

**Metrics Tracked**:
- HTTP request duration (p95, p99)
- Requests per second
- Failed request rate
- Active VUs (virtual users)
- Iteration duration

---

## 7. Frontend Performance

### Lighthouse CI

**Configuration**:
- **Mobile**: `lighthouserc.mobile.json`
- **Desktop**: `lighthouserc.desktop.json`

**Performance Budget** (enforced in CI):

| Metric | Mobile Threshold | Desktop Threshold |
|--------|-----------------|-------------------|
| Performance Score | ≥ 85 | ≥ 90 |
| First Contentful Paint | < 2.0s | < 1.5s |
| Largest Contentful Paint | < 3.0s | < 2.5s |
| Cumulative Layout Shift | < 0.1 | < 0.05 |
| Total Blocking Time | < 300ms | < 200ms |
| Bundle Size (initial) | < 500KB | < 500KB |

**Current Results**:

| Metric | Mobile | Desktop | Status |
|--------|--------|---------|--------|
| Performance Score | 88 | 94 | ✅ Pass |
| FCP | 1.6s | 1.1s | ✅ Pass |
| LCP | 2.4s | 1.8s | ✅ Pass |
| CLS | 0.07 | 0.03 | ✅ Pass |
| TBT | 250ms | 150ms | ✅ Pass |
| Bundle Size | 420KB | 420KB | ✅ Pass |

---

### Web Vitals Monitoring

**Implementation**:
- **Serwist RUM**: Real User Monitoring via service worker
- **Instrumentation**: `instrumentation-client.ts` collects web vitals
- **API Endpoint**: `/api/perf/vitals` aggregates metrics
- **Sampling Rate**: 10% of user sessions (configurable via `NEXT_PUBLIC_RUM_SAMPLE_RATE`)

**Metrics Collected**:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)
- Time to First Byte (TTFB)
- Interaction to Next Paint (INP)

---

## 8. Observability

### Prometheus Metrics

**Scrape Targets**:
- Backend FastAPI `/metrics` endpoint
- AI OCR service `/metrics` endpoint
- PostgreSQL database metrics
- Frontend server metrics

**Key Metrics Exposed**:
- `http_request_duration_seconds` (histogram)
- `http_requests_total` (counter by status, method, path)
- `ai_orchestrator_request_duration_seconds`
- `ocr_processing_duration_seconds`
- `db_query_duration_seconds`
- `active_websocket_connections`
- `background_job_duration_seconds`
- `reminder_dispatch_total`

---

### Grafana Dashboards

Four pre-configured dashboards provisioned automatically:

#### 1. AI Performance Dashboard
- LLM provider latency by model (Groq, Gemini, Cerebras)
- AI OCR processing time distribution
- YOLO detection confidence histogram
- Medicine matching accuracy rate
- AI request throughput (requests/min)
- Error rates by AI provider

#### 2. Appointment Load Dashboard
- Appointment bookings per hour
- Slot availability refresh rate
- Realtime channel subscription count
- Appointment status distribution (pending/confirmed/completed/cancelled)
- Reschedule request rate
- Cancellation rate trend

#### 3. Error Heatmap Dashboard
- Error rate by endpoint (heatmap visualization)
- Error type breakdown (4xx, 5xx, validation, timeout)
- HTTP status code distribution
- Database connection pool utilization
- Memory and CPU utilization per service
- Alert history and acknowledgment

#### 4. System Health Overview
- Service uptime percentage (SLA tracking)
- Response time trends (7-day, 30-day)
- Database query performance (slow queries)
- Container app replica count and auto-scaling events
- Deployment frequency and success rate
- Mean time to recovery (MTTR)

---

## 9. Benchmark Reports

### Report Generation

**Automated Pipeline** (`run_benchmarks.sh`):
1. Run API latency benchmark
2. Run DB concurrency test
3. Run OCR pipeline benchmark
4. Run realtime slot consistency test
5. Compare against baselines
6. Generate regression guard report
7. Output summary to `tests/benchmarks/reports/current/`

**Report Outputs**:
- `benchmark_summary.md`: Markdown summary with pass/fail status
- `cost_performance_report.json`: Detailed metrics with cost analysis
- `regression_guard_report.json`: Regression check results

**Sample Reports** (in `tests/benchmarks/reports/sample/`):
- `api_performance.json`: Example API metrics
- `ocr_accuracy_report.json`: Example OCR accuracy report
- `benchmark_summary.md`: Example summary

---

### OCR Accuracy Benchmark

**Ground Truth Dataset**: `tests/benchmarks/datasets/ocr_ground_truth.jsonl`
- 100+ annotated prescription images with known structured output
- Used to measure OCR extraction accuracy

**Metrics Tracked**:
- **Medicine Name Accuracy**: % of medications correctly extracted
- **Dosage Accuracy**: % of dosages correctly parsed (frequency, quantity, duration)
- **Overall Field Accuracy**: % of all fields correctly extracted
- **Processing Time**: Average OCR processing duration

**Target Accuracy**:
- Medicine Name Accuracy: ≥ 85%
- Dosage Accuracy: ≥ 80%
- Overall Field Accuracy: ≥ 75%

---

## 10. Chaos Engineering

### Chaos Recovery Test (`tests/performance/chaos_recovery_test.py`)

**Fault Injection Scenarios**:

| Scenario | Fault Injected | Expected Recovery |
|----------|---------------|-------------------|
| AI Service Down | Scale AI OCR replicas to 0 | Backend handles gracefully, returns fallback |
| Database Slow | Add latency to DB queries | Timeout handling, circuit breaker activation |
| Network Partition | Block backend → AI OCR traffic | Error returned to user, no hanging requests |
| High Memory | Simulate memory pressure | Graceful degradation, request rejection |

**Recovery Metrics**:
- **Mean Time to Detection**: < 5 seconds
- **Mean Time to Recovery**: < 30 seconds
- **Error Rate During Fault**: < 5%
- **User Impact**: Degraded but functional

---

## 11. Test Execution Summary

### Local Execution

```bash
# Run all tests
bash ./run_tests.sh

# Run benchmarks
bash ./run_benchmarks.sh

# Run backend tests only
MEDORA_TEST_TARGET=backend pytest -c tests/pytest.backend.ini

# Run AI OCR tests only
MEDORA_TEST_TARGET=ai_service pytest -c tests/pytest.ai.ini

# Run E2E tests
cd tests/e2e && npx playwright test

# Run load tests
locust -f tests/locust/locustfile.py --host http://localhost:8000 --headless -u 100 -r 10 -t 5m

# Run k6 stress tests
k6 run tests/k6/healthcare_workload.js
```

### CI/CD Execution

**GitHub Actions Workflow** (`testing-benchmarking.yml`):

| Stage | Tests | Duration | Fail Condition |
|-------|-------|----------|----------------|
| Backend Unit | AI orchestrator, privacy, services | < 1 min | Coverage < 80% |
| AI OCR Unit | Matcher, parser, pipeline, YOLO | < 1 min | Any test failure |
| Integration | API contracts, clinical lifecycle | < 2 min | Contract violation |
| E2E | Playwright user journeys | < 5 min | Any journey fails |
| Security | RBAC, JWT, data isolation | < 1 min | Security breach detected |
| Performance | API latency, DB concurrency, OCR | < 3 min | Regression > 20% |
| Frontend Perf | Lighthouse CI | < 2 min | Score below threshold |

---

## 12. Quality Gates

### Pre-Commit Checks (Developer Local)
- [ ] Linting passes (ESLint, Pylint)
- [ ] Type checks pass (TypeScript strict, Pydantic validation)
- [ ] Unit tests pass for modified services
- [ ] No hardcoded secrets or credentials

### Pre-Merge Checks (Pull Request)
- [ ] All CI/CD stages passing
- [ ] Code review approved by teammate
- [ ] Performance budget met
- [ ] No breaking changes to API contracts
- [ ] Documentation updated (if applicable)

### Pre-Release Checks (Production Deployment)
- [ ] E2E tests passing against staging
- [ ] Load test results reviewed
- [ ] Security audit passed
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring dashboards verified

---

## 13. Test Coverage Summary

| Layer | Test Count | Coverage Target | Current Coverage | Status |
|-------|-----------|-----------------|------------------|--------|
| Backend Unit | 50+ | 80% | ~82% | ✅ Pass |
| AI OCR Unit | 30+ | 75% | ~78% | ✅ Pass |
| Integration | 20+ | N/A | N/A (workflow coverage) | ✅ Pass |
| E2E | 4 journeys | Critical paths | 100% of critical paths | ✅ Pass |
| Security | 15+ | N/A | All RBAC/JWT checks | ✅ Pass |
| Performance | 6 benchmarks | Baseline comparison | Within 20% of baseline | ✅ Pass |
| Load | 2 tools (Locust, k6) | Sustained load | 120 RPS stable | ✅ Pass |
| Frontend Perf | Lighthouse CI | Score ≥ 85 | 88 mobile, 94 desktop | ✅ Pass |

---

## 14. Known Gaps & Future Improvements

### Current Gaps
| Gap | Impact | Mitigation |
|-----|--------|------------|
| Limited E2E coverage (4 journeys) | Some user paths untested | Critical paths covered, expand as needed |
| No contract tests for server actions | Schema drift risk | Manual review + Pydantic validation |
| OCR accuracy on handwritten prescriptions | Extraction quality varies | Fallback to manual entry, AI improvement planned |
| No SMS notification tests | SMS not yet implemented | Feature not live, tests added when implemented |

### Planned Improvements
| Improvement | Priority | Estimated Effort |
|-------------|----------|------------------|
| Contract tests for server actions | High | 1-2 weeks |
| Accessibility tests (a11y) | Medium | 1 week |
| Visual regression tests | Low | 2 weeks |
| Mutation testing | Low | 1 week |
| Expanded E2E scenarios (8-10 journeys) | High | 2-3 weeks |
| Automated security scanning (SAST/DAST) | Medium | 1-2 weeks |
| Load test automation in CI | Medium | 1 week |
| Chaos engineering integration | Low | 2 weeks |

---

## 15. Testing Philosophy

Medora's testing strategy follows these principles:

1. **Production-First Mindset**: Tests validate real-world behavior, not just theoretical correctness
2. **Layered Defense**: Unit → Integration → E2E → Security → Performance, each layer catches different bugs
3. **Regression Prevention**: Baselines and regression gates prevent performance degradation
4. **Chaos Readiness**: Fault injection validates resilience before production incidents
5. **Observability-Driven**: Metrics and dashboards are tested, not just assumed to work
6. **Cost-Aware**: Benchmarks include cost analysis to balance performance and cloud spend
7. **Incremental Improvement**: Test coverage grows with the codebase, not all at once

---

## 16. Benchmarking Scripts Inventory

| Script | Location | Purpose |
|--------|----------|---------|
| `run_tests.sh` | Root | Orchestrates all test suites |
| `run_benchmarks.sh` | Root | Runs performance benchmarks |
| `benchmark_regression_guard.py` | `tests/scripts/` | Compares current metrics to baselines |
| `generate_synthetic_dataset.py` | `tests/scripts/` | Generates test data for benchmarks |
| `metrics.py` | `tests/scripts/` | Metric calculation utilities |
| `build_human_report.py` | `tests/scripts/` | Formats benchmark results |
| `api_latency_benchmark.py` | `tests/performance/` | API endpoint latency measurement |
| `db_concurrency_benchmark.py` | `tests/performance/` | Database connection pool testing |
| `ocr_pipeline_benchmark.py` | `tests/performance/` | OCR throughput measurement |
| `realtime_slot_consistency_benchmark.py` | `tests/performance/` | Realtime subscription reliability |
| `frontend_perf_guard.mjs` | `tests/performance/` | Frontend rendering performance |
| `chaos_recovery_test.py` | `tests/performance/` | Fault injection and recovery testing |
| `locustfile.py` | `tests/locust/` | Locust load testing scenarios |
| `healthcare_workload.js` | `tests/k6/` | k6 stress testing patterns |
| `accuracy_benchmark.py` | `tests/benchmarks/` | OCR accuracy measurement |
| `cost_performance_analysis.py` | `tests/benchmarks/` | Cost-performance tradeoff analysis |

---

## 17. Continuous Improvement

The test suite evolves with the codebase:
- **New features** → New unit + integration tests required
- **Production incidents** → New chaos scenario tests added
- **Performance regressions** → New baseline benchmarks created
- **User-reported bugs** → New E2E regression tests added
- **Architecture changes** → Contract tests updated

This living document reflects the current state of testing. Refer to `tests/` directory for the latest test implementations.
