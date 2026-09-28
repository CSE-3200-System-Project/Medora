"""Descriptive storage coverage, deliberately independent of clinical thresholds."""
from datetime import datetime, timedelta, timezone
import math
from typing import Iterable, Any

GROUPS = (
    ("steps", ("steps",)),
    ("sleep", ("sleep_hours",)),
    ("heart_rate", ("heart_rate",)),
    ("blood_pressure", ("blood_pressure_systolic", "blood_pressure_diastolic")),
)


def build_record_coverage(metrics: Iterable[Any], *, as_of: datetime) -> dict:
    if as_of.tzinfo is None:
        raise ValueError("Coverage needs a timezone-aware snapshot")
    now = as_of.astimezone(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    recorded_types = set()
    for metric in metrics:
        stamp = metric.recorded_at
        if stamp is None or stamp.tzinfo is None or not start <= stamp.astimezone(timezone.utc) <= now:
            continue
        try:
            finite = math.isfinite(float(metric.value))
        except (TypeError, ValueError, OverflowError):
            finite = False
        if finite:
            recorded_types.add(getattr(metric.metric_type, "value", metric.metric_type))
    groups = [{"key": key, "recorded": all(t in recorded_types for t in types)} for key, types in GROUPS]
    count = sum(g["recorded"] for g in groups)
    return {"recorded_groups": count, "total_groups": len(groups),
            "coverage_percent": round(100 * count / len(groups)), "groups": groups,
            "window_start_utc": start.isoformat(), "window_end_utc": end.isoformat(),
            "as_of_utc": now.isoformat()}
