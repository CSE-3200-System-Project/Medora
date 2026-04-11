from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


DOSAGE_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|ml|g|mcg|iu)\b", re.IGNORECASE)
FREQ_PATTERN = re.compile(r"\b(?:od|bd|tds|qid|hs|\d\+\d\+\d(?:\+\d)?)\b", re.IGNORECASE)
QTY_PATTERN = re.compile(r"\b(?:\d+\s*(?:day|days|week|weeks|month|months)|continue)\b", re.IGNORECASE)


@dataclass
class AccuracyCounters:
    total: int = 0
    exact_match: int = 0
    name_match: int = 0
    dosage_match: int = 0
    frequency_match: int = 0
    quantity_match: int = 0


def _norm(value: str | None) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _naive_prediction(text: str) -> dict[str, str]:
    dosage = (DOSAGE_PATTERN.search(text) or [None])[0]
    frequency = (FREQ_PATTERN.search(text) or [None])[0]
    quantity = (QTY_PATTERN.search(text) or [None])[0]

    cleaned_name = text
    for token in [dosage, frequency, quantity]:
        if token:
            cleaned_name = cleaned_name.replace(token, " ")
    cleaned_name = re.sub(r"[^a-zA-Z0-9]+", " ", cleaned_name).strip().split(" ")
    name = " ".join(cleaned_name[:2]).strip()
    return {
        "name": name,
        "dosage": dosage or "",
        "frequency": frequency or "",
        "quantity": quantity or "",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run OCR correctness scoring on synthetic/annotated datasets.")
    parser.add_argument(
        "--dataset",
        type=str,
        default="tests/benchmarks/datasets/ocr_ground_truth.jsonl",
    )
    parser.add_argument(
        "--report",
        type=str,
        default="tests/benchmarks/reports/current/ocr_accuracy_report.json",
    )
    parser.add_argument("--min-exact", type=float, default=0.70)
    args = parser.parse_args()

    counters = AccuracyCounters()
    rows = 0

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

    with dataset_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows += 1
            payload = json.loads(line)
            truth = payload.get("ground_truth", {})
            prediction = payload.get("prediction") or _naive_prediction(payload.get("text", ""))

            counters.total += 1
            name_ok = _norm(prediction.get("name")) == _norm(truth.get("name"))
            dosage_ok = _norm(prediction.get("dosage")) == _norm(truth.get("dosage"))
            freq_ok = _norm(prediction.get("frequency")) == _norm(truth.get("frequency"))
            qty_ok = _norm(prediction.get("quantity")) == _norm(truth.get("quantity"))

            counters.name_match += int(name_ok)
            counters.dosage_match += int(dosage_ok)
            counters.frequency_match += int(freq_ok)
            counters.quantity_match += int(qty_ok)

            if name_ok and dosage_ok and freq_ok and qty_ok:
                counters.exact_match += 1

    if counters.total == 0:
        raise RuntimeError("No rows available for OCR accuracy benchmark.")

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
        "exact_match_rate": counters.exact_match / counters.total,
        "field_accuracy": {
            "name": counters.name_match / counters.total,
            "dosage": counters.dosage_match / counters.total,
            "frequency": counters.frequency_match / counters.total,
            "quantity": counters.quantity_match / counters.total,
        },
        "thresholds": {"min_exact_match_rate": args.min_exact},
        "passed": (counters.exact_match / counters.total) >= args.min_exact,
    }

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))

    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
