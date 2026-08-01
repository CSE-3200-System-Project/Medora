#!/usr/bin/env python3
"""Interactive, auditable licensed review for symptom-navigation fixtures."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "tests/benchmarks/datasets/symptom_navigation_cases.jsonl"
ALLOWED_EXPECTED = ("emergency", "specialty_candidates", "uncertain", "manual_browse")
ALLOWED_ROLES = ("licensed_clinician", "licensed_pharmacist")


def load_cases() -> list[dict]:
    return [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]


def complete(case: dict) -> bool:
    review = case.get("clinician_review")
    return isinstance(review, dict) and review.get("credential_role") in ALLOWED_ROLES and bool(review.get("reviewed_at"))


def atomic_write(cases: list[dict]) -> None:
    rendered = "".join(json.dumps(case, ensure_ascii=False) + "\n" for case in cases)
    descriptor, temporary = tempfile.mkstemp(prefix="navigation-review-", suffix=".jsonl", dir=DATASET.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(rendered)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, DATASET)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reviewer-id")
    parser.add_argument("--credential-role", choices=ALLOWED_ROLES)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    cases = load_cases()
    if args.check:
        reviewed = sum(complete(case) for case in cases)
        print(f"Licensed navigation reviews: {reviewed}/{len(cases)}")
        return 0 if reviewed == len(cases) else 1
    if not args.reviewer_id or not args.credential_role:
        raise SystemExit("interactive review requires --reviewer-id and --credential-role")

    print("Review each expected behavior against the bilingual text. No model output is shown.")
    print("Commands: [a]pprove, [c]orrect expected class, [s]kip, [q]uit")
    for index, case in enumerate(cases):
        if complete(case):
            continue
        print(f"\n{case['id']} ({case['locale']}): {case['text']}")
        print(f"Expected behavior: {case['expected']}")
        command = input("Decision [a/c/s/q]: ").strip().casefold()
        if command == "q":
            break
        if command == "s":
            continue
        if command == "c":
            print("Allowed: " + ", ".join(ALLOWED_EXPECTED))
            corrected = input("Correct expected behavior: ").strip()
            if corrected not in ALLOWED_EXPECTED:
                print("Invalid class; case left unreviewed.")
                continue
            case["expected"] = corrected
            decision = "corrected"
        elif command == "a":
            decision = "approved"
        else:
            print("Unknown command; case left unreviewed.")
            continue
        notes = input("Optional review note: ").strip()
        case["clinician_review"] = {
            "reviewer_id": args.reviewer_id,
            "credential_role": args.credential_role,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "decision": decision,
            "notes": notes,
        }
        atomic_write(cases)
        print(f"Saved {case['id']} ({index + 1}/{len(cases)}).")

    reviewed = sum(complete(case) for case in cases)
    print(f"Licensed navigation reviews: {reviewed}/{len(cases)}")
    return 0 if reviewed == len(cases) else 1


if __name__ == "__main__":
    raise SystemExit(main())
