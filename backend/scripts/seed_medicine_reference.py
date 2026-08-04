"""
Medicine reference seed script.

Loads data/medicine_reference/Final_Medicine_Dataset.csv (71,795 consolidated rows) into
the drugs, brands, and medicine_search_index tables created by the med_001 migration.
This reproduces the counts reported in the SoftwareX manuscript (tab:corpus):

    7,389 drugs, 67,001 brands, 74,390 search-index terms
    (5,242 distinct generic names, 52,117 distinct brand names)

Usage (from backend/, after `alembic upgrade head`):
    venv\\Scripts\\python.exe scripts\\seed_medicine_reference.py

Safe to re-run: it truncates the three tables before reloading, so it never
duplicates rows.
"""
import asyncio
import csv
import sys
import uuid
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import delete

from app.db.models.medicine import Brand, Drug, MedicineSearchIndex
from app.db.session import AsyncSessionLocal

CSV_PATH = backend_dir.parent / "data" / "medicine_reference" / "Final_Medicine_Dataset.csv"
BATCH_SIZE = 2000


def _normalize_term(value: str | None) -> str:
    return (value or "").strip().lower()


def _load_rows() -> list[dict]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _build_records(rows: list[dict]):
    drugs_by_key: dict[str, dict] = {}
    for row in rows:
        drugs_by_key.setdefault(
            row["drug_key"],
            {
                "id": uuid.uuid4(),
                "drug_key": row["drug_key"],
                "generic_name": row["generic_name"],
                "strength": row["strength"],
                "dosage_form": row["dosage_form"],
                "common_uses": row.get("common_uses") or None,
                "common_uses_disclaimer": row.get("common_uses_disclaimer") or None,
            },
        )

    brands_by_key: dict[tuple, dict] = {}
    for row in rows:
        drug_id = drugs_by_key[row["drug_key"]]["id"]
        brand_key = (row["drug_key"], row["brand_name"], row["manufacturer"])
        brands_by_key.setdefault(
            brand_key,
            {
                "id": uuid.uuid4(),
                "brand_name": row["brand_name"],
                "manufacturer": row.get("manufacturer") or None,
                "medicine_type": row.get("medicine_type") or None,
                "drug_id": drug_id,
            },
        )

    search_index: list[dict] = []
    for drug in drugs_by_key.values():
        search_index.append(
            {
                "id": uuid.uuid4(),
                "term": _normalize_term(drug["generic_name"]),
                "drug_id": drug["id"],
                "brand_id": None,
            }
        )
    for brand in brands_by_key.values():
        search_index.append(
            {
                "id": uuid.uuid4(),
                "term": _normalize_term(brand["brand_name"]),
                "drug_id": None,
                "brand_id": brand["id"],
            }
        )

    return list(drugs_by_key.values()), list(brands_by_key.values()), search_index


async def _bulk_insert(session, model, records: list[dict]) -> None:
    for offset in range(0, len(records), BATCH_SIZE):
        batch = records[offset : offset + BATCH_SIZE]
        await session.execute(model.__table__.insert(), batch)


async def seed_medicine_reference() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"Medicine corpus CSV not found at {CSV_PATH}")

    rows = _load_rows()
    drugs, brands, search_index = _build_records(rows)

    async with AsyncSessionLocal() as session:
        try:
            await session.execute(delete(MedicineSearchIndex))
            await session.execute(delete(Brand))
            await session.execute(delete(Drug))

            await _bulk_insert(session, Drug, drugs)
            await _bulk_insert(session, Brand, brands)
            await _bulk_insert(session, MedicineSearchIndex, search_index)

            await session.commit()
            print(
                f"Seeded {len(drugs)} drugs, {len(brands)} brands, "
                f"{len(search_index)} search-index terms from {len(rows)} source rows."
            )
        except Exception as exc:
            await session.rollback()
            raise SystemExit(f"Error seeding medicine reference: {exc}") from exc


if __name__ == "__main__":
    asyncio.run(seed_medicine_reference())
