from __future__ import annotations

import argparse
import json
import random
import uuid
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path


BANGLA_FIRST_NAMES = ["রহিম", "করিম", "নুসরাত", "ফারহানা", "তানভীর", "সাব্বির", "মেহজাবিন"]
BANGLA_LAST_NAMES = ["ইসলাম", "হোসেন", "আক্তার", "চৌধুরী", "খান", "রহমান"]
EN_FIRST_NAMES = ["Rahim", "Karim", "Nusrat", "Farhana", "Tanvir", "Mehjabin", "Sabbir"]
EN_LAST_NAMES = ["Islam", "Hossain", "Akter", "Chowdhury", "Khan", "Rahman"]
SPECIALTIES = ["Cardiology", "Dermatology", "Neurology", "Medicine", "Pediatrics", "Orthopedics"]
MEDICATIONS = ["Napa", "Metformin", "Amlodipine", "Omeprazole", "Montelukast", "Losartan"]
SYMPTOMS = [
    "জ্বর এবং কাশি",
    "chest pain",
    "মাথা ব্যথা",
    "abdominal discomfort",
    "joint pain",
    "শ্বাসকষ্ট",
]


@dataclass
class Patient:
    id: str
    name_bn: str
    name_en: str
    gender: str
    age: int
    city: str
    conditions: list[str]
    medications: list[str]


@dataclass
class Doctor:
    id: str
    name_bn: str
    name_en: str
    specialization: str
    city: str
    years_of_experience: int
    consultation_fee_bdt: int


@dataclass
class PrescriptionRecord:
    id: str
    patient_id: str
    doctor_id: str
    language_mix: str
    symptom_text: str
    medication_name: str
    dosage: str
    frequency: str
    quantity: str


def _pick_name() -> tuple[str, str]:
    first_idx = random.randrange(len(BANGLA_FIRST_NAMES))
    last_idx = random.randrange(len(BANGLA_LAST_NAMES))
    bn = f"{BANGLA_FIRST_NAMES[first_idx]} {BANGLA_LAST_NAMES[last_idx]}"
    en = f"{EN_FIRST_NAMES[first_idx]} {EN_LAST_NAMES[last_idx]}"
    return bn, en


def generate_patients(count: int) -> list[Patient]:
    cities = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi"]
    condition_pool = ["Diabetes", "Hypertension", "Asthma", "Kidney Disease", "Thyroid Disorder"]
    out: list[Patient] = []
    for _ in range(count):
        name_bn, name_en = _pick_name()
        out.append(
            Patient(
                id=str(uuid.uuid4()),
                name_bn=name_bn,
                name_en=name_en,
                gender=random.choice(["male", "female"]),
                age=random.randint(18, 80),
                city=random.choice(cities),
                conditions=random.sample(condition_pool, k=random.randint(0, 2)),
                medications=random.sample(MEDICATIONS, k=random.randint(0, 2)),
            )
        )
    return out


def generate_doctors(count: int) -> list[Doctor]:
    cities = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi"]
    out: list[Doctor] = []
    for _ in range(count):
        name_bn, name_en = _pick_name()
        out.append(
            Doctor(
                id=str(uuid.uuid4()),
                name_bn=name_bn,
                name_en=f"Dr. {name_en}",
                specialization=random.choice(SPECIALTIES),
                city=random.choice(cities),
                years_of_experience=random.randint(2, 28),
                consultation_fee_bdt=random.choice([500, 700, 900, 1200, 1500]),
            )
        )
    return out


def generate_prescriptions(count: int, patients: list[Patient], doctors: list[Doctor]) -> list[PrescriptionRecord]:
    quantities = ["5 days", "7 days", "১০ দিন", "continue"]
    frequencies = ["1+0+1", "1+1+1", "OD", "BD"]
    dosages = ["500mg", "250mg", "5mg", "10ml"]
    out: list[PrescriptionRecord] = []
    for _ in range(count):
        patient = random.choice(patients)
        doctor = random.choice(doctors)
        out.append(
            PrescriptionRecord(
                id=str(uuid.uuid4()),
                patient_id=patient.id,
                doctor_id=doctor.id,
                language_mix=random.choice(["bn", "en", "mixed"]),
                symptom_text=random.choice(SYMPTOMS),
                medication_name=random.choice(MEDICATIONS),
                dosage=random.choice(dosages),
                frequency=random.choice(frequencies),
                quantity=random.choice(quantities),
            )
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate synthetic Medora healthcare datasets.")
    parser.add_argument("--patients", type=int, default=250)
    parser.add_argument("--doctors", type=int, default=120)
    parser.add_argument("--prescriptions", type=int, default=600)
    parser.add_argument(
        "--output",
        type=str,
        default="tests/benchmarks/datasets/synthetic_healthcare_dataset.json",
    )
    args = parser.parse_args()

    random.seed(42)
    patients = generate_patients(args.patients)
    doctors = generate_doctors(args.doctors)
    prescriptions = generate_prescriptions(args.prescriptions, patients, doctors)

    payload = {
        "generated_on": date.today().isoformat(),
        "patients": [asdict(item) for item in patients],
        "doctors": [asdict(item) for item in doctors],
        "prescriptions": [asdict(item) for item in prescriptions],
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Also emit a compact JSONL file for OCR/AI benchmark suites.
    jsonl_path = out_path.with_suffix(".jsonl")
    with jsonl_path.open("w", encoding="utf-8") as f:
        for item in payload["prescriptions"]:
            row = {
                "id": item["id"],
                "patient_id": item["patient_id"],
                "doctor_id": item["doctor_id"],
                "text": f"{item['medication_name']} {item['dosage']} {item['frequency']} {item['quantity']}",
                "ground_truth": {
                    "name": item["medication_name"],
                    "dosage": item["dosage"],
                    "frequency": item["frequency"],
                    "quantity": item["quantity"],
                },
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Synthetic dataset written to {out_path}")
    print(f"JSONL benchmark rows written to {jsonl_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
