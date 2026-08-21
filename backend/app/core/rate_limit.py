"""In-process rate limiting for cost-bearing and brute-force-prone endpoints.

No Redis or other shared store exists in this deployment (see
backend/requirements.txt), and adding one is a deployment change, not a bug
fix -- so this is a per-worker token bucket, not a cluster-wide limiter.
Behind multiple workers/replicas the effective limit multiplies by the
worker count. That's an acceptable trade for closing an unthrottled-endpoint
gap without introducing a new infrastructure dependency; a shared store is
the natural upgrade if this is ever run with more than a couple of workers.

Bucket keys are the client IP, refined by a hash of the bearer token when
present so that authenticated users behind a shared IP (NAT, corporate
proxy) don't share a bucket. The token is only hashed, never decoded, to
keep this middleware cheap on every request.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp


@dataclass(frozen=True)
class RateLimitRule:
    method: str
    path_prefix: str
    max_requests: int
    window_seconds: float

    def matches(self, method: str, path: str) -> bool:
        return method == self.method and path.startswith(self.path_prefix)


# Ordered most-specific-first; the first matching rule wins.
DEFAULT_RATE_LIMIT_RULES: tuple[RateLimitRule, ...] = (
    RateLimitRule("POST", "/auth/login", 10, 60.0),
    RateLimitRule("POST", "/auth/signup", 5, 60.0),
    RateLimitRule("POST", "/auth/forgot-password", 5, 60.0),
    RateLimitRule("POST", "/ai/vapi/tools/", 30, 60.0),
    RateLimitRule("POST", "/ai/normalize/voice", 10, 60.0),
    RateLimitRule("POST", "/ai/assistant-chat", 20, 60.0),
    RateLimitRule("POST", "/ai/clinical-info", 20, 60.0),
    RateLimitRule("POST", "/ai/voice-to-notes", 10, 60.0),
    RateLimitRule("POST", "/ai/search", 20, 60.0),
    # Akkhor is public and unauthenticated, so the limit is what bounds its cost.
    # Lookup is cheap and cached hard; the count endpoint aggregates 74k rows, so it
    # gets a tighter bucket.
    RateLimitRule("GET", "/v1/akkhor/version", 10, 60.0),
    RateLimitRule("GET", "/v1/akkhor/search", 120, 60.0),
    RateLimitRule("GET", "/v1/akkhor/resolve", 120, 60.0),
    RateLimitRule("GET", "/v1/akkhor/", 240, 60.0),
    RateLimitRule("GET", "/medicine/search", 60, 60.0),
    RateLimitRule("GET", "/medical-test/search", 60, 60.0),
    RateLimitRule("GET", "/doctor/search", 60, 60.0),
)

# Buckets not touched within this long are pruned so the dict doesn't grow
# unbounded over a long-lived process.
_STALE_AFTER_SECONDS = 3600.0
_PRUNE_EVERY_N_CHECKS = 500


class _TokenBucket:
    __slots__ = ("tokens", "last_refill")

    def __init__(self, tokens: float, last_refill: float) -> None:
        self.tokens = tokens
        self.last_refill = last_refill


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, rules: tuple[RateLimitRule, ...] = DEFAULT_RATE_LIMIT_RULES) -> None:
        super().__init__(app)
        self._rules = rules
        self._buckets: dict[tuple[str, str], _TokenBucket] = {}
        self._checks_since_prune = 0

    def _client_key(self, request: Request) -> str:
        client_host = request.client.host if request.client else "unknown"
        auth_header = request.headers.get("authorization")
        if auth_header:
            token_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()[:16]
            return f"{client_host}:{token_hash}"
        return client_host

    def _prune_if_due(self, now: float) -> None:
        self._checks_since_prune += 1
        if self._checks_since_prune < _PRUNE_EVERY_N_CHECKS:
            return
        self._checks_since_prune = 0
        stale_cutoff = now - _STALE_AFTER_SECONDS
        stale_keys = [key for key, bucket in self._buckets.items() if bucket.last_refill < stale_cutoff]
        for key in stale_keys:
            del self._buckets[key]

    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = request.url.path

        rule = next((r for r in self._rules if r.matches(method, path)), None)
        if rule is None:
            return await call_next(request)

        now = time.monotonic()
        self._prune_if_due(now)

        bucket_key = (f"{rule.method} {rule.path_prefix}", self._client_key(request))
        bucket = self._buckets.get(bucket_key)
        refill_rate = rule.max_requests / rule.window_seconds

        if bucket is None:
            bucket = _TokenBucket(tokens=rule.max_requests - 1, last_refill=now)
            self._buckets[bucket_key] = bucket
            return await call_next(request)

        elapsed = now - bucket.last_refill
        bucket.tokens = min(rule.max_requests, bucket.tokens + elapsed * refill_rate)
        bucket.last_refill = now

        if bucket.tokens < 1:
            retry_after = max(1, int((1 - bucket.tokens) / refill_rate))
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again shortly."},
                headers={"Retry-After": str(retry_after)},
            )

        bucket.tokens -= 1
        return await call_next(request)
