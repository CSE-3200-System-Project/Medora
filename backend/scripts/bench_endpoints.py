"""Lightweight in-process benchmark for backend endpoints.

Boots the FastAPI app in-process using httpx.ASGITransport so measurements
exclude network round-trip time — what we want here is the *backend's*
processing time (query planning, DB round-trips, serialization), not the
connectivity.

Usage
-----

    python scripts/bench_endpoints.py [--iterations 20] [--token <JWT>]

The script picks representative read endpoints for each role. If no token
is supplied, it benchmarks only the public ones (/health, /specialities).
With a doctor or patient token it exercises the dashboard / stats endpoints
that dominate the read workload.

For apples-to-apples comparison, run with the same iteration count before
and after a change and compare the p50 / p95 numbers in the output table.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

# Allow `python scripts/bench_endpoints.py` from the backend/ dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging  # noqa: E402

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

import httpx  # noqa: E402

from app.main import app  # noqa: E402


@dataclass
class Endpoint:
    label: str
    method: str
    path: str
    requires_auth: bool = True


@dataclass
class Result:
    label: str
    samples: list[float] = field(default_factory=list)
    errors: int = 0

    def summary(self) -> dict[str, float | int | str]:
        if not self.samples:
            return {
                "label": self.label,
                "n": 0,
                "errors": self.errors,
                "p50_ms": float("nan"),
                "p95_ms": float("nan"),
                "min_ms": float("nan"),
                "max_ms": float("nan"),
            }
        sorted_samples = sorted(self.samples)
        return {
            "label": self.label,
            "n": len(self.samples),
            "errors": self.errors,
            "p50_ms": round(statistics.median(sorted_samples) * 1000, 1),
            "p95_ms": round(
                sorted_samples[max(0, int(0.95 * len(sorted_samples)) - 1)] * 1000,
                1,
            ),
            "min_ms": round(min(sorted_samples) * 1000, 1),
            "max_ms": round(max(sorted_samples) * 1000, 1),
        }


ENDPOINTS: list[Endpoint] = [
    Endpoint("health", "GET", "/", requires_auth=False),
    Endpoint("specialities", "GET", "/specialities/", requires_auth=False),
    # Authenticated read endpoints — the hot ones we optimized.
    Endpoint("patient.dashboard", "GET", "/patient/dashboard"),
    Endpoint("doctor.actions.stats", "GET", "/doctor/actions/stats"),
    Endpoint("notifications.list", "GET", "/notifications/"),
    Endpoint("notifications.unread_count", "GET", "/notifications/unread-count"),
    Endpoint("health_metrics.today", "GET", "/health-metrics/today"),
    Endpoint("health_metrics.trends", "GET", "/health-metrics/trends?days=7"),
    Endpoint("profile.verification_status", "GET", "/profile/verification-status"),
]


async def bench_endpoint(
    client: httpx.AsyncClient,
    endpoint: Endpoint,
    iterations: int,
    token: str | None,
) -> Result:
    headers: dict[str, str] = {}
    if endpoint.requires_auth:
        if not token:
            return Result(label=endpoint.label + " (skipped: no token)")
        headers["Authorization"] = f"Bearer {token}"

    result = Result(label=endpoint.label)

    # One warm-up call (discarded) so JIT / import / cache effects don't skew
    # the first sample.
    try:
        await client.request(endpoint.method, endpoint.path, headers=headers)
    except Exception:
        pass

    for _ in range(iterations):
        start = time.perf_counter()
        try:
            response = await client.request(endpoint.method, endpoint.path, headers=headers)
            elapsed = time.perf_counter() - start
            if response.status_code >= 500:
                result.errors += 1
                # Still record the timing — 5xx often means the query ran.
            result.samples.append(elapsed)
        except Exception:
            result.errors += 1

    return result


def print_table(results: Iterable[Result]) -> None:
    rows = [r.summary() for r in results]
    if not rows:
        print("No results.")
        return
    headers = ["label", "n", "errors", "p50_ms", "p95_ms", "min_ms", "max_ms"]
    widths = {h: max(len(h), *(len(str(r[h])) for r in rows)) for h in headers}

    def fmt(row: dict) -> str:
        return "  ".join(str(row[h]).rjust(widths[h]) for h in headers)

    print(fmt({h: h for h in headers}))
    print("  ".join("-" * widths[h] for h in headers))
    for row in rows:
        print(fmt(row))


async def main_async(iterations: int, token: str | None) -> int:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
        timeout=30.0,
    ) as client:
        results: list[Result] = []
        for endpoint in ENDPOINTS:
            res = await bench_endpoint(client, endpoint, iterations, token)
            results.append(res)
    print_table(results)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=20)
    parser.add_argument(
        "--token",
        default=None,
        help="Supabase JWT for authenticated endpoints (otherwise they're skipped).",
    )
    args = parser.parse_args()
    return asyncio.run(main_async(args.iterations, args.token))


if __name__ == "__main__":
    sys.exit(main())
