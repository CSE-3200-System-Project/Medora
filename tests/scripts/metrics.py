from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class LatencySummary:
    count: int
    min_ms: float
    max_ms: float
    avg_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float


def percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    if q <= 0:
        return min(values)
    if q >= 1:
        return max(values)
    ordered = sorted(values)
    idx = (len(ordered) - 1) * q
    low = int(idx)
    high = min(low + 1, len(ordered) - 1)
    frac = idx - low
    return ordered[low] * (1 - frac) + ordered[high] * frac


def summarize_latencies(values: Iterable[float]) -> LatencySummary:
    seq = [float(v) for v in values]
    if not seq:
        return LatencySummary(
            count=0,
            min_ms=0.0,
            max_ms=0.0,
            avg_ms=0.0,
            p50_ms=0.0,
            p95_ms=0.0,
            p99_ms=0.0,
        )
    return LatencySummary(
        count=len(seq),
        min_ms=min(seq),
        max_ms=max(seq),
        avg_ms=sum(seq) / len(seq),
        p50_ms=percentile(seq, 0.50),
        p95_ms=percentile(seq, 0.95),
        p99_ms=percentile(seq, 0.99),
    )
