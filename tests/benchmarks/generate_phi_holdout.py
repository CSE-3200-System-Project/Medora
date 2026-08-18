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


def build() -> list[dict]:
    cases = []
    for n in NAMES_EN:
        cases += [
            {"category": "unlabeled_name_en", "text": f"{n} came in today with fever", "must_not_contain": [n]},
            {"category": "clinician_details", "text": f"Seen by Dr. {n}, advised rest", "must_not_contain": [n]},
            {"category": "labeled_name", "text": f"Patient name: {n}. Complains of cough", "must_not_contain": [n]},
        ]
    for n in NAMES_BN:
        cases.append({"category": "unlabeled_name_bn", "text": f"{n} আজ এসেছেন", "must_not_contain": [n]})
    for a in AREAS:
        span = f"House 7, Road 3, {a}"
        cases.append({"category": "address_unlabeled", "text": f"{span}. Fever noted", "must_not_contain": [span]})
    for e in ["sabbir (at) mail.net", "tasnim [at] clinic [dot] org", "rifat AT web DOT com"]:
        cases.append({"category": "email_adversarial", "text": f"Contact {e} if needed. Cough persists", "must_not_contain": [e]})
    for d in ["7 March 2025", "Feb 3, 2024"]:
        cases.append({"category": "date_textual_en", "text": f"Visit on {d}. Review later", "must_not_contain": [d]})
    for i in ["XZ7654321", "QP012345"]:
        cases.append({"category": "passport_bare", "text": f"Travel document {i} on file. Rest advised", "must_not_contain": [i]})
    for v in ["5567002", "DX-44821", "BMDC-B-90011"]:
        cases.append({"category": "account_id", "text": f"MRN {v}. Follow up next week", "must_not_contain": [v]})
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
