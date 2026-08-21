#!/usr/bin/env python3
"""Grow Lokkhon axis D from four authored cases to a measurable set.

Axis D asks whether the redactor holds up when Bangla and English are mixed inside one
utterance, or when Bangla is typed in Latin script. The published result rests on four
cases, which the whitepaper labels a pilot precisely because four cases cannot support a
percentage.

The cheap way to fix that would be to write forty more cases by hand and report n=44.
This does something narrower and more defensible: it derives variants from the Bengali
fixtures that already exist, by transforms declared in `transliterate.py`, and reports
them **separately** from the four authored cases. A derived case is not independent
evidence - it shares its identifier, its clinical text, and its authoring judgement with
its source. Pooling the two into one headline n would overstate what the corpus knows.

Rules that keep this a measurement rather than a way to manufacture a number:

* Transforms are declared, closed, and reviewable. Bengali with no declared romanisation
  raises rather than passing through.
* The same transform is applied to the text and to its expected spans, so the annotation
  cannot drift away from what it annotates.
* A transform that leaves the text unchanged emits nothing, so a case is never counted
  twice under a different name.
* Nothing here is tuned against the redactor's output. Whatever it does with these cases
  is the result.

    python benchmark/lokkhon/generate_axis_d_cases.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from transliterate import (  # noqa: E402
    contains_bengali,
    englishise_labels,
    romanise,
    to_bengali_digits,
)

SOURCE = ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl"
OUTPUT = Path(__file__).resolve().parent / "datasets" / "axis_d_derived_cases.jsonl"

#: Only these carry an expected-span annotation worth transforming. The benign and
#: over-redaction groups are excluded: their whole content is `must_preserve`, so a
#: romanised copy tests the romanisation table, not the redactor.
ELIGIBLE_GROUPS = frozenset(
    {"phone", "national_id", "passport", "account_id", "name_labeled", "name_unlabeled",
     "clinician", "address", "date", "mixed_script", "injection"}
)


def _romanise_all(text: str) -> str:
    """Full Banglish: script and digits both go Latin."""
    return romanise(text, digits=True)


def _romanise_keep_bengali_digits(text: str) -> str:
    """Latin words, Bengali numerals - the shape a phone number often actually takes."""
    return romanise(text, digits=False)


def _english_label_bengali_value(text: str) -> str:
    """An English field label in front of a Bengali value."""
    return englishise_labels(text)


def _bengali_digits(text: str) -> str:
    """Arabic numerals rewritten as Bengali ones inside otherwise unchanged text."""
    return to_bengali_digits(text)


def _has_machine_identifier(case: dict) -> bool:
    """True when an expected span is an address a machine parses, not prose.

    Emails, URLs, and passport-style codes have fixed grammars. Rewriting a digit inside
    one produces `inject5@example.org` as `inject৫@example.org`, which nobody types and
    no redactor should be judged on. Excluding those cases keeps the derived set made of
    inputs a real user could actually produce.
    """
    return any("@" in span or "://" in span for span in case["must_not_contain"])


#: name -> (transform, applicability). A transform that does not apply emits nothing.
TRANSFORMS: dict[str, tuple[Callable[[str], str], Callable[[dict], bool]]] = {
    "romanised": (_romanise_all, lambda case: True),
    "romanised_bengali_digits": (_romanise_keep_bengali_digits, lambda case: True),
    "english_label_bengali_value": (_english_label_bengali_value, lambda case: True),
    "bengali_digits": (_bengali_digits, lambda case: not _has_machine_identifier(case)),
}


def derive(case: dict, name: str, transform: Callable[[str], str]) -> dict | None:
    """Apply one transform to a case and its annotations, or return None if it is a no-op."""
    text = transform(case["text"])
    if text == case["text"]:
        return None

    must_not_contain = [transform(span) for span in case["must_not_contain"]]
    must_preserve = [transform(span) for span in case["must_preserve"]]

    # A transform that dropped or merged an expected span would produce an annotation
    # that no longer describes its own text. Refuse rather than emit it.
    for span in must_not_contain + must_preserve:
        if span not in text:
            raise ValueError(
                f"{case['id']} under {name!r}: transformed span {span!r} is absent from "
                f"the transformed text {text!r}. The transform and the annotation disagree."
            )

    return {
        "id": f"{case['id']}-D-{name}",
        "category": f"axis_d_{name}",
        "report_group": "axis_d_derived",
        "text": text,
        "must_not_contain": must_not_contain,
        "must_preserve": must_preserve,
        "known_identifiers": [],
        "uses_known_identifier_api": False,
        # Derived cases carry no inherited limitation flag. A disclosure authored about
        # one string does not automatically hold for a transformed one, and inheriting it
        # would let a real new failure hide behind an old excuse.
        "expected_residual_risk": False,
        "expected_over_redaction": False,
        "limitation_class": None,
        "limitation_note": None,
        "derivation": {
            "source_case_id": case["id"],
            "source_category": case["category"],
            "transform": name,
            "independent_evidence": False,
            "note": (
                "Mechanically derived from an authored fixture. Shares its identifier, "
                "clinical text, and authoring judgement with the source, so it is reported "
                "separately from the authored axis D cases rather than pooled with them."
            ),
        },
    }


def build(cases: list[dict]) -> list[dict]:
    eligible = [
        case
        for case in cases
        if case["report_group"] in ELIGIBLE_GROUPS and contains_bengali(case["text"])
    ]
    derived: list[dict] = []
    seen_text: set[str] = {case["text"] for case in cases}

    for case in eligible:
        for name, (transform, applies) in TRANSFORMS.items():
            if not applies(case):
                continue
            candidate = derive(case, name, transform)
            if candidate is None:
                continue
            # Two transforms can converge on the same string. Counting it twice would
            # inflate n without adding a distinct probe.
            if candidate["text"] in seen_text:
                continue
            seen_text.add(candidate["text"])
            derived.append(candidate)

    return derived


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    cases = [
        json.loads(line)
        for line in SOURCE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    derived = build(cases)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "\n".join(json.dumps(case, ensure_ascii=False) for case in derived) + "\n",
        encoding="utf-8",
    )

    by_transform: dict[str, int] = {}
    for case in derived:
        key = case["derivation"]["transform"]
        by_transform[key] = by_transform.get(key, 0) + 1

    print(
        json.dumps(
            {
                "source_cases_with_bengali": sum(
                    1 for case in cases
                    if case["report_group"] in ELIGIBLE_GROUPS and contains_bengali(case["text"])
                ),
                "derived_cases": len(derived),
                "by_transform": by_transform,
                "output": str(args.output),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
