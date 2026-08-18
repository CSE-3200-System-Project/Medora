#!/usr/bin/env python3
"""Generate the Shimana consent-sweep dataset: seeded synthetic composite patients.

Why this file exists. The consent-utility frontier needs patient payloads that span
several sharing categories at once, so that broadening consent adds records and
narrowing it removes them. The existing summary fixtures carry one record each, which
cannot produce a gradient. These composites are fully synthetic: every name, phone,
NID, date, and clinical value is invented here. Each record is tagged with the sharing
category that governs it and carries annotated identifier spans (``pii``) and benign
clinical spans (``keep``) so the sweep can measure residual leakage and grounding on
the same payload.

Reproducible: fixed seed, deterministic output. Re-running overwrites identically.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent / "datasets" / "shimana_consent_cases.jsonl"

# Sharing category -> record source_type it governs (aligns with data_sharing_guard).
CATEGORY_SOURCE = {
    "can_view_allergies": "allergy",
    "can_view_medications": "medication",
    "can_view_conditions": "condition",
    "can_view_prescriptions": "prescription",
    "can_view_medical_history": "history",
    "can_view_lifestyle": "lifestyle",
}

# Clinical value templates per category. {pii} is an identifier the redactor should
# remove; the clinical remainder is what a grounded summary should surface.
TEMPLATES = {
    "allergy": [
        ("penicillin allergy, rash noted by Dr. {doc}", "penicillin allergy"),
        ("sulfa drug allergy recorded on {date}", "sulfa drug allergy"),
        ("peanut allergy, anaphylaxis history per {name}", "peanut allergy"),
    ],
    "medication": [
        ("metformin 500 mg twice daily, refilled at {phone}", "metformin 500 mg twice daily"),
        ("losartan 50 mg once daily since {date}", "losartan 50 mg once daily"),
        ("salbutamol inhaler as needed, patient NID {nid}", "salbutamol inhaler as needed"),
    ],
    "condition": [
        ("type 2 diabetes mellitus, followed by Dr. {doc}", "type 2 diabetes mellitus"),
        ("stage 1 hypertension, diagnosed {date}", "stage 1 hypertension"),
        ("persistent asthma, contact {phone}", "persistent asthma"),
    ],
    "prescription": [
        ("amoxicillin 500 mg three times daily for 7 days, issued to {name}", "amoxicillin 500 mg three times daily for 7 days"),
        ("omeprazole 20 mg before breakfast, {date}", "omeprazole 20 mg before breakfast"),
        ("atorvastatin 10 mg at night, NID {nid}", "atorvastatin 10 mg at night"),
    ],
    "history": [
        ("appendectomy in 2019, operated by Dr. {doc}", "appendectomy in 2019"),
        ("hospitalised for pneumonia on {date}", "hospitalised for pneumonia"),
        ("cholecystectomy, discharge summary faxed to {phone}", "cholecystectomy"),
    ],
    "lifestyle": [
        ("former smoker, quit 2020, counselled by {name}", "former smoker, quit 2020"),
        ("sedentary activity level noted {date}", "sedentary activity level"),
        ("moderate alcohol use, follow-up {phone}", "moderate alcohol use"),
    ],
}

NAMES = ["Rahim Uddin", "Ayesha Akter", "Kamal Hossain", "Nusrat Jahan", "Tariq Islam", "Farzana Begum"]
DOCS = ["Karim", "Sultana", "Rahman", "Haque"]
PHONES = ["01711-234567", "01822-345678", "01933-456789"]
NIDS = ["1990123456789", "1985987654321", "2001456789123"]
DATES = ["2026-01-12", "2025-11-03", "2026-02-20"]


def make_record(rng: random.Random, category: str, idx: int) -> dict:
    source_type = CATEGORY_SOURCE[category]
    template, clinical = rng.choice(TEMPLATES[source_type])
    subs = {
        "doc": rng.choice(DOCS),
        "name": rng.choice(NAMES),
        "phone": rng.choice(PHONES),
        "nid": rng.choice(NIDS),
        "date": rng.choice(DATES),
    }
    text = template.format(**subs)
    # Identifier spans present in this record (what redaction must remove).
    pii = [v for k, v in subs.items() if k in template]
    return {
        "source_type": source_type,
        "category": category,
        "record_id": f"{source_type}-{idx}",
        "source_timestamp": subs["date"] + "T00:00:00Z",
        "data": {"value": text},
        "pii": pii,          # identifier spans -> leakage axis
        "keep": clinical,    # benign clinical span -> grounding/utility axis
    }


def main() -> int:
    rng = random.Random(20260816)
    categories = list(CATEGORY_SOURCE)
    patients = []
    for i in range(24):
        # Each patient has records across all six categories; consent later gates them.
        records = [make_record(rng, cat, i) for cat in categories]
        patients.append({
            "id": f"SHIMANA-{i:03d}",
            "patient_token": f"subject_shimana_{i:03d}",
            "records": records,
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as fh:
        for p in patients:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"wrote {len(patients)} composite patients x {len(categories)} categories -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
