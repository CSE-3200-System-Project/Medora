# Medora Performance Summary (Sample)

Generated at: 2026-04-03T15:00:00Z

## API Latency
- Total requests: 4,800
- Error rate: 1.29%
- Worst p95 latency: 1,180.4 ms

## OCR Pipeline
- Exact OCR extraction match: 79%
- Average confidence: 0.86
- OCR stage p95 latency: 2,080 ms

## Realtime Consistency
- Concurrent same-slot booking attempts: 120
- Unique successful bookings: 1
- Consistency rule passed: true

## Regression Gate
- Baseline p95: 1,100.0 ms
- Current p95: 1,180.4 ms
- Latency regression: +7.31%
- Build outcome: pass
