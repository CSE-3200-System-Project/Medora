"""Bootstrap intervals, reported rather than hidden.

Lokkhon's populations are small - thirty navigation fixtures, twelve summary fixtures,
one hundred and thirty-four privacy cases. At those sizes a point estimate carries far
more apparent precision than it has, and the honest response is a wide interval printed
next to every number rather than a rounded percentage printed alone.

Percentile bootstrap, fixed seed, resampling cases. The seed is recorded in the output so
a reader can reproduce the exact interval, not merely one like it.
"""

from __future__ import annotations

import random
from typing import Sequence

__all__ = ["BOOTSTRAP_ITERATIONS", "BOOTSTRAP_SEED", "proportion_ci", "mean_ci"]

BOOTSTRAP_ITERATIONS = 2000
BOOTSTRAP_SEED = 20260821


def mean_ci(
    values: Sequence[float],
    *,
    iterations: int = BOOTSTRAP_ITERATIONS,
    seed: int = BOOTSTRAP_SEED,
) -> dict[str, float | int | None]:
    """Point estimate and a 95% percentile interval over resampled cases."""
    n = len(values)
    if n == 0:
        return {"n": 0, "estimate": None, "ci_low": None, "ci_high": None}

    point = sum(values) / n
    if n == 1:
        # One case cannot bound itself. Say so instead of returning a zero-width interval
        # that reads like certainty.
        return {"n": 1, "estimate": point, "ci_low": None, "ci_high": None}

    rng = random.Random(seed)
    means: list[float] = []
    for _ in range(iterations):
        means.append(sum(values[rng.randrange(n)] for _ in range(n)) / n)
    means.sort()
    return {
        "n": n,
        "estimate": point,
        "ci_low": means[int(0.025 * iterations)],
        "ci_high": means[min(iterations - 1, int(0.975 * iterations))],
    }


def proportion_ci(
    successes: int,
    total: int,
    *,
    iterations: int = BOOTSTRAP_ITERATIONS,
    seed: int = BOOTSTRAP_SEED,
) -> dict[str, float | int | None]:
    """Interval for a rate expressed as a count over a denominator.

    Takes counts rather than a ratio so the denominator survives into the report. A rate
    with no n beside it is the thing Lokkhon exists to avoid publishing.
    """
    if total <= 0:
        return {"n": 0, "estimate": None, "ci_low": None, "ci_high": None}
    values = [1.0] * successes + [0.0] * (total - successes)
    return mean_ci(values, iterations=iterations, seed=seed)
