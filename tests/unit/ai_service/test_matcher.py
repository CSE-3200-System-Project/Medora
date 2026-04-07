from __future__ import annotations

import pytest

pytest.importorskip("rapidfuzz")
pytest.importorskip("psycopg")

from app.db import MedicineSearchRow
from app.matcher import MedicineMatcher


def test_matcher_prefers_exact_matches(monkeypatch) -> None:
    matcher = MedicineMatcher()

    monkeypatch.setattr(
        matcher._repository,
        "search_exact",
        lambda term, limit=3: [MedicineSearchRow(term="napa", drug_id="drug-1", brand_id="brand-1", score=1.0)],
    )
    monkeypatch.setattr(matcher._repository, "search_trigram", lambda term, limit=5: [])
    monkeypatch.setattr(matcher._repository, "search_contains", lambda term, limit=20: [])

    matches = matcher.match("Tab Napa 500mg", top_k=1)

    assert len(matches) == 1
    assert matches[0].matched_term.lower() == "napa"
    assert matches[0].confidence >= 0.9


def test_matcher_returns_empty_when_no_search_terms(monkeypatch) -> None:
    matcher = MedicineMatcher()
    monkeypatch.setattr(matcher._repository, "search_exact", lambda term, limit=3: [])
    monkeypatch.setattr(matcher._repository, "search_trigram", lambda term, limit=5: [])
    monkeypatch.setattr(matcher._repository, "search_contains", lambda term, limit=20: [])

    matches = matcher.match("", top_k=3)
    assert matches == []
