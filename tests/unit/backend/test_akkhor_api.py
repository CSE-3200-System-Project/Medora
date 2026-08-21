"""Akkhor's public contract.

Two kinds of check here. The first is that the contract holds its shape: the pagination
envelope is the canonical one, the release identifier is pinned, and the schema refuses
things it should refuse. The second is that the honesty constraints in the module
docstring are actually enforced in code rather than only described - that `/resolve` can
say "no match", that the disclaimer travels on the record, and that the API never claims
per-row provenance the corpus cannot support.

Database-backed counts are exercised in the integration suite; these are contract tests
and use a stub session so they run without Postgres.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.pagination import Page, PaginationParams
from app.routes.akkhor import (
    _RESOLVE_THRESHOLD,
    _split_inline_strength,
    get_provenance,
)
from app.schemas.akkhor import (
    AKKHOR_DATA_LICENCE,
    AKKHOR_RELEASE,
    AkkhorDrug,
    AkkhorResolution,
    AkkhorSearchHit,
)


class _Request:
    """Minimal stand-in: the route only reads the If-None-Match header."""

    headers: dict[str, str] = {}


class _Response:
    def __init__(self) -> None:
        self.headers: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Inline strength splitting
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "query,expected_name,expected_strength",
    [
        ("Seclo 20mg", "Seclo", "20mg"),
        ("Seclo 20 mg", "Seclo", "20mg"),
        ("Napa 500 mg", "Napa", "500mg"),
        ("Ace 1 gm", "Ace", "1gm"),
        ("Paracetamol 2.5ml", "Paracetamol", "2.5ml"),
        # No strength present, so the name is returned untouched.
        ("Seclo", "Seclo", None),
        ("Vitamin B12", "Vitamin B12", None),
        # Not a strength: the unit has to stand on its own.
        ("Maxpro 20mgx", "Maxpro 20mgx", None),
    ],
)
def test_a_strength_written_into_the_name_is_split_out(query, expected_name, expected_strength):
    """A caller writing "Seclo 20mg" told us the strength; it must constrain, not blur.

    Left in the string, "20mg" drags the term-index similarity down and lets the endpoint
    resolve to whichever omeprazole row happens to sort first - which in this corpus is a
    10 mg one. That is the confident wrong answer /resolve exists to prevent.
    """
    assert _split_inline_strength(query) == (expected_name, expected_strength)


def test_splitting_never_returns_an_empty_search_name():
    """A query that is nothing but a strength still has to search for something."""
    name, strength = _split_inline_strength("500mg")
    assert name
    assert strength == "500mg"


# ---------------------------------------------------------------------------
# Resolution contract
# ---------------------------------------------------------------------------

def test_no_match_is_a_representable_answer():
    resolution = AkkhorResolution(
        query="zzzqqqxx",
        name_searched="zzzqqqxx",
        resolved=False,
        confidence=0.0,
    )
    assert resolution.resolved is False
    assert resolution.drug is None


def test_the_resolution_note_disclaims_clinical_judgement():
    resolution = AkkhorResolution(query="x", name_searched="x", resolved=False, confidence=0.0)
    lowered = resolution.note.lower()
    assert "not a clinical judgement" in lowered
    assert "catalogue" in lowered


def test_the_resolution_note_warns_about_unreconciled_corpus_contradictions():
    """The corpus really does map "Seclo 20" onto a 10 mg row. Consumers must be told."""
    resolution = AkkhorResolution(query="x", name_searched="x", resolved=False, confidence=0.0)
    assert "contradiction" in resolution.note.lower()


def test_the_threshold_is_high_enough_to_reject_an_unrelated_string():
    assert 0.4 < _RESOLVE_THRESHOLD < 0.9


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_provenance_lists_all_five_sources_with_licences():
    payload = await get_provenance(_Request(), _Response())
    assert len(payload.sources) == 5
    assert all(source.licence for source in payload.sources)
    assert {source.index for source in payload.sources} == {1, 2, 3, 4, 5}


@pytest.mark.asyncio
async def test_provenance_declares_the_scrape_and_wrong_market_caveats():
    """Two sources are community scrapes and one is Indian pharmacy data.

    Those facts bound what the corpus may be claimed to be, so they ship with the API
    rather than living only in a repository file nobody fetches.
    """
    payload = await get_provenance(_Request(), _Response())
    caveats = " ".join(source.caveat or "" for source in payload.sources).lower()
    assert "scrape" in caveats
    assert "different market" in caveats


@pytest.mark.asyncio
async def test_provenance_states_what_has_not_been_established():
    payload = await get_provenance(_Request(), _Response())
    joined = " ".join(payload.not_established).lower()
    assert "dgda" in joined
    assert "no clinical review" in joined


@pytest.mark.asyncio
async def test_provenance_does_not_claim_row_level_sourcing():
    """The loaded tables have no source column. Reporting one would be inventing data."""
    payload = await get_provenance(_Request(), _Response())
    assert "no row-level source column" in payload.note.lower()
    assert payload.field_provenance
    for entry in payload.field_provenance:
        assert entry.derived_from


@pytest.mark.asyncio
async def test_indication_text_is_labelled_as_search_metadata_only():
    payload = await get_provenance(_Request(), _Response())
    common_uses = next(entry for entry in payload.field_provenance if entry.field == "common_uses")
    assert "search metadata only" in common_uses.layer.lower()
    # It comes from the two scraped sources, not from the academic backbone.
    assert set(common_uses.derived_from) == {1, 3}


@pytest.mark.asyncio
async def test_every_response_carries_the_pinned_release_header():
    response = _Response()
    await get_provenance(_Request(), response)
    assert response.headers["X-Akkhor-Release"] == AKKHOR_RELEASE


@pytest.mark.asyncio
async def test_catalogue_responses_are_publicly_cacheable():
    """No patient data is involved, so a shared cache is correct and a private one wastes it."""
    response = _Response()
    await get_provenance(_Request(), response)
    assert response.headers["Cache-Control"].startswith("public,")
    assert response.headers["ETag"]


# ---------------------------------------------------------------------------
# Envelope and licence
# ---------------------------------------------------------------------------

def test_list_responses_use_the_canonical_pagination_envelope():
    """New list endpoints must not hand-roll skip/take. This is that contract, checked."""
    params = PaginationParams(limit=20, offset=40)
    page = Page[AkkhorDrug](items=[], total=100, limit=params.limit, offset=params.offset)
    dumped = page.model_dump()
    assert set(dumped) == {
        "items", "total", "limit", "offset", "has_more", "page", "page_size", "total_pages",
    }
    assert dumped["page"] == 3
    assert dumped["has_more"] is True


def test_the_data_licence_is_the_open_one_the_project_committed_to():
    """Akkhor is never a paid line, and the licence is the mechanism, not the intention."""
    assert AKKHOR_DATA_LICENCE == "CC BY 4.0"


def test_the_release_identifier_is_pinnable():
    assert AKKHOR_RELEASE.startswith("akkhor-")


def test_search_hits_report_which_tier_matched_them():
    """An exact hit is a fact about the catalogue; a 0.34 trigram score is a suggestion."""
    hit = AkkhorSearchHit(term="Napa", match_type="exact", score=1.0)
    assert hit.match_type in {"exact", "prefix", "fuzzy"}


@pytest.mark.asyncio
async def test_a_generated_at_timestamp_does_not_invalidate_the_etag_every_request() -> None:
    """`/version` reports when it computed its counts, and that must not defeat caching.

    Hashing the whole payload would mint a fresh tag every second and turn revalidation
    into a full re-send. The tag covers what the response says, not when it said it.
    """
    from app.routes.akkhor import get_version

    db = AsyncMock()
    db.scalar.return_value = 7389
    db.execute.return_value = MagicMock(
        scalar_one_or_none=MagicMock(return_value="medicine_staging"),
        scalar_one=MagicMock(return_value=71795),
    )

    first, second = _Response(), _Response()
    payload_one = await get_version(_Request(), first, db)
    payload_two = await get_version(_Request(), second, db)

    # Same corpus, so the same tag, even though each response reports its own timestamp.
    assert payload_one.counts == payload_two.counts
    assert first.headers["ETag"] == second.headers["ETag"]
