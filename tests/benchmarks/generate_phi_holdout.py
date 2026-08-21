#!/usr/bin/env python3
"""Held-out PHI generalisation probe for the rule-based redactor.

Why this exists. The 134-case `pii_safety_cases.jsonl` was used to *develop* the
extended redaction rules, so recall measured on it is a development figure, not a
generalisation estimate. This script builds a disjoint set of NOVEL identifiers
(names, areas, obfuscations the rules were never written against) and measures
recall on it, so the honest residual is visible. Result at authoring time:
structured/labelled/honorific-cued/obfuscated classes generalise near 100%;
unlabelled, previously-unseen names remain the residual the planned learned
recogniser targets. Reproducible: fixed content, deterministic.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
for k, v in {
    "SUPABASE_DATABASE_URL": "postgresql+asyncpg://p:p@localhost:5432/p",
    "SUPABASE_URL": "http://localhost:54321", "SUPABASE_KEY": "x",
    "SUPABASE_STORAGE_BUCKET": "x", "AI_PROVIDER": "mock", "AI_ID_HASH_SECRET": "holdout",
}.items():
    os.environ.setdefault(k, v)

from app.core.ai_privacy import redact_pii_text  # noqa: E402

# Novel content, disjoint from the gazetteers and the 134-case dev set.
NAMES_EN = ["Sabbir Talukder", "Tasnim Saha", "Rifat Ghosh", "Nabila Chakraborty",
            "Arif Mridha", "Sumaiya Podder"]
NAMES_BN = ["সাব্বির তালুকদার", "তাসনিম সাহা", "রিফাত ঘোষ"]
AREAS = ["Comilla", "Bogra", "Jessore", "Narayanganj", "Savar"]


# Categories whose misses are the documented, published residual — unlabelled names the
# gazetteer was never going to contain. Flagged rather than hidden, and deliberately left
# flagged: when the learned recogniser lands, `score_privacy_case` reports these as *stale*
# limitations, which is the signal that the residual closed.
EXPECTED_RESIDUAL = {
    "unlabeled_name_en": "unseen_name",
    "unlabeled_name_bn": "unseen_name",
}


def _case(category: str, text: str, identifier: str, benign: str) -> dict:
    """One probe case in the shape the deployed harness scores.

    Every case declares a benign clinical span as well as an identifier span, so the same
    population measures over-redaction and recall together. A recall probe with nothing to
    preserve cannot notice a system that redacts everything.
    """
    residual = category in EXPECTED_RESIDUAL
    return {
        "category": category,
        "report_group": category,
        "text": text,
        "must_not_contain": [identifier],
        "must_preserve": [benign],
        "known_identifiers": [],
        "uses_known_identifier_api": False,
        "expected_residual_risk": residual,
        "expected_over_redaction": False,
        "limitation_class": EXPECTED_RESIDUAL.get(category),
        "limitation_note": (
            "Previously-unseen personal name with no label or honorific to cue on. This is "
            "the residual the learned span recogniser targets."
        ) if residual else None,
    }


def build() -> list[dict]:
    cases = []
    for n in NAMES_EN:
        cases += [
            _case("unlabeled_name_en", f"{n} came in today with fever", n, "came in today with fever"),
            _case("clinician_details", f"Seen by Dr. {n}, advised rest", n, "advised rest"),
            _case("labeled_name", f"Patient name: {n}. Complains of cough", n, "Complains of cough"),
        ]
    for n in NAMES_BN:
        cases.append(_case("unlabeled_name_bn", f"{n} আজ এসেছেন, কাশি আছে", n, "কাশি আছে"))
    for a in AREAS:
        span = f"House 7, Road 3, {a}"
        cases.append(_case("address_unlabeled", f"{span}. Fever noted", span, "Fever noted"))
    for e in ["sabbir (at) mail.net", "tasnim [at] clinic [dot] org", "rifat AT web DOT com"]:
        cases.append(_case("email_adversarial", f"Contact {e} if needed. Cough persists", e, "Cough persists"))
    for d in ["7 March 2025", "Feb 3, 2024"]:
        cases.append(_case("date_textual_en", f"Visit on {d}. Review later", d, "Review later"))
    for i in ["XZ7654321", "QP012345"]:
        cases.append(_case("passport_bare", f"Travel document {i} on file. Rest advised", i, "Rest advised"))
    for v in ["5567002", "DX-44821", "BMDC-B-90011"]:
        cases.append(_case("account_id", f"MRN {v}. Follow up next week", v, "Follow up next week"))
    for index, case in enumerate(cases, start=1):
        case["id"] = f"PIIH-{index:03d}"
    return cases


def main() -> int:
    cases = build()
    (ROOT / "tests/benchmarks/datasets/pii_holdout_cases.jsonl").write_text(
        "\n".join(json.dumps(c, ensure_ascii=False) for c in cases) + "\n", encoding="utf-8")
    total = hit = 0
    bycat: dict[str, list[int]] = {}
    for c in cases:
        out = redact_pii_text(c["text"]).text
        for span in c["must_not_contain"]:
            total += 1
            ok = span.casefold() not in out.casefold()
            hit += ok
            bycat.setdefault(c["category"], [0, 0])
            bycat[c["category"]][0] += ok
            bycat[c["category"]][1] += 1
    print(f"held-out recall = {hit}/{total} = {hit/total:.3f}")
    for cat, (h, t) in sorted(bycat.items()):
        print(f"  {cat:22} {h}/{t}")

    kept = lost = 0
    for c in cases:
        out = redact_pii_text(c["text"]).text
        for span in c.get("must_preserve", []):
            kept += span in out
            lost += span not in out
    print(f"benign spans preserved = {kept}/{kept + lost}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
