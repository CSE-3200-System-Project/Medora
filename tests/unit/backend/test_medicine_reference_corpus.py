"""Pins the medicine reference corpus counts reported in the SoftwareX manuscript
(tab:corpus / abstract): 7,389 drugs, 67,001 brands, 74,390 search-index terms,
5,242 distinct generic names, 52,117 distinct brand names -- built from 71,795
consolidated rows. If data/medicine_reference/Final_Medicine_Dataset.csv or
backend/scripts/seed_medicine_reference.py's grouping logic ever changes, this
test catches the drift before the manuscript's numbers silently go stale.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[3] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from scripts.seed_medicine_reference import CSV_PATH, _build_records, _load_rows, _normalize_term

pytestmark = [pytest.mark.backend]


@pytest.fixture(scope="module")
def corpus_records():
    if not CSV_PATH.exists():
        pytest.skip(f"Medicine corpus CSV not found at {CSV_PATH}")
    rows = _load_rows()
    return rows, *_build_records(rows)


def test_source_row_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(rows) == 71795


def test_drug_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(drugs) == 7389


def test_brand_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(brands) == 67001


def test_search_index_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(search_index) == 74390
    # One term per drug (generic name) plus one term per brand (brand name).
    assert len(search_index) == len(drugs) + len(brands)


def test_distinct_generic_and_brand_name_counts(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    distinct_generics = {_normalize_term(d["generic_name"]) for d in drugs}
    distinct_brands = {_normalize_term(b["brand_name"]) for b in brands}
    assert len(distinct_generics) == 5242
    assert len(distinct_brands) == 52117


def test_every_brand_references_a_known_drug(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    drug_ids = {d["id"] for d in drugs}
    assert all(b["drug_id"] in drug_ids for b in brands)


def test_search_index_terms_reference_exactly_one_parent(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    for entry in search_index:
        assert (entry["drug_id"] is None) != (entry["brand_id"] is None)
