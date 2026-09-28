from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))
from app.core.record_coverage import build_record_coverage


class CoverageTests(unittest.TestCase):
    now = datetime(2026, 9, 28, 12, tzinfo=timezone.utc)

    def reading(self, key, value=0, stamp=None):
        return SimpleNamespace(metric_type=key, value=value, recorded_at=stamp or self.now)

    def test_no_records_and_zero_are_different(self):
        self.assertEqual(build_record_coverage([], as_of=self.now)["coverage_percent"], 0)
        result = build_record_coverage([self.reading("steps", 0)], as_of=self.now)
        self.assertEqual(result["recorded_groups"], 1)
        self.assertEqual(result["coverage_percent"], 25)

    def test_four_groups_and_duplicate_readings(self):
        keys = ["steps", "sleep_hours", "heart_rate", "blood_pressure_systolic", "blood_pressure_diastolic", "steps"]
        result = build_record_coverage([self.reading(k) for k in keys], as_of=self.now)
        self.assertEqual(result["recorded_groups"], 4)
        self.assertEqual(result["coverage_percent"], 100)

    def test_bp_needs_both_components(self):
        self.assertEqual(build_record_coverage([self.reading("blood_pressure_systolic")], as_of=self.now)["recorded_groups"], 0)

    def test_old_future_and_other_types_do_not_count(self):
        rows = [self.reading("steps", stamp=self.now-timedelta(days=1)),
                self.reading("sleep_hours", stamp=self.now+timedelta(seconds=1)), self.reading("weight")]
        self.assertEqual(build_record_coverage(rows, as_of=self.now)["recorded_groups"], 0)

    def test_nonfinite_invalid_and_naive_readings_excluded(self):
        rows = [self.reading("steps", float("nan")), self.reading("sleep_hours", "bad"),
                self.reading("heart_rate", float("inf")), self.reading("steps", stamp=self.now.replace(tzinfo=None))]
        self.assertEqual(build_record_coverage(rows, as_of=self.now)["recorded_groups"], 0)

    def test_utc_boundary_and_timezone_conversion(self):
        start = self.now.replace(hour=0)
        dhaka = timezone(timedelta(hours=6))
        rows = [self.reading("steps", stamp=start.astimezone(dhaka)),
                self.reading("heart_rate", stamp=start-timedelta(microseconds=1))]
        result = build_record_coverage(rows, as_of=self.now.astimezone(dhaka))
        self.assertEqual(result["recorded_groups"], 1)
        self.assertEqual(result["window_start_utc"], start.isoformat())

    def test_no_clinical_threshold_or_plausibility_claim(self):
        result = build_record_coverage([self.reading("heart_rate", -1)], as_of=self.now)
        self.assertEqual(result["recorded_groups"], 1)
        self.assertNotIn("health_score", result)

    def test_naive_snapshot_rejected(self):
        with self.assertRaises(ValueError):
            build_record_coverage([], as_of=self.now.replace(tzinfo=None))


if __name__ == "__main__":
    unittest.main()
