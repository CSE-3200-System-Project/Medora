"""Pins the medicine reference corpus counts reported in the SoftwareX manuscript
(tab:corpus / abstract): 7,389 drugs, 67,001 brands, 74,390 search-index terms,
5,242 distinct generic names, 52,117 distinct brand names -- built from 71,795
consolidated rows. If data/medicine_reference/Final_Medicine_Dataset.csv or
backend/scripts/seed_medicine_reference.py's grouping logic ever changes, this
test catches the drift before the manuscript's numbers silently go stale.
"""
from __future__ import annotations

import sys
import hashlib
import json
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[3] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from scripts.seed_medicine_reference import CSV_PATH, _build_records, _load_rows, _normalize_term

pytestmark = [pytest.mark.backend]
MANIFEST_PATH = CSV_PATH.parent / 'build_manifest.json'
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding='utf-8')) if MANIFEST_PATH.is_file() else None
EXPECTED = MANIFEST['counts'] if MANIFEST else dict(rows=71795, drugs=7389, brands=67001, search_terms=74390, generic_names=5242, brand_names=52117)


@pytest.fixture(scope="module")
def corpus_records():
    if not CSV_PATH.exists():
        pytest.skip(f"Medicine corpus CSV not found at {CSV_PATH}")
    rows = _load_rows()
    return rows, *_build_records(rows)


def test_source_row_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(rows) == EXPECTED['rows']
    if MANIFEST:
        assert hashlib.sha256(CSV_PATH.read_bytes()).hexdigest() == MANIFEST['outputs']['Final_Medicine_Dataset.csv']['sha256']


def test_drug_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(drugs) == EXPECTED['drugs']


def test_brand_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(brands) == EXPECTED['brands']


def test_search_index_count(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    assert len(search_index) == EXPECTED['search_terms']
    # One term per drug (generic name) plus one term per brand (brand name).
    assert len(search_index) == len(drugs) + len(brands)


def test_distinct_generic_and_brand_name_counts(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    distinct_generics = {_normalize_term(d["generic_name"]) for d in drugs}
    distinct_brands = {_normalize_term(b["brand_name"]) for b in brands}
    assert len(distinct_generics) == EXPECTED['generic_names']
    assert len(distinct_brands) == EXPECTED['brand_names']


def test_every_brand_references_a_known_drug(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    drug_ids = {d["id"] for d in drugs}
    assert all(b["drug_id"] in drug_ids for b in brands)


def test_search_index_terms_reference_exactly_one_parent(corpus_records):
    rows, drugs, brands, search_index = corpus_records
    for entry in search_index:
        assert (entry["drug_id"] is None) != (entry["brand_id"] is None)
