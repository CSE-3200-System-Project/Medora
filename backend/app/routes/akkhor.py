"""Akkhor: Bangladesh medicine identity as a public, versioned API.

The corpus was already in the database and already powering in-app search. What was
missing was a way for anyone else to use it. `/medicine/*` is an application surface: it
returns what the search screen needs, and it is free to change when that screen does.
This module is the opposite - a stable contract another system can build against, with a
pinned release identifier, published provenance, and counts regenerated from the database
rather than transcribed from a document.

Deliberately unauthenticated. Akkhor carries no patient data and is CC BY 4.0; putting a
token in front of an openly licensed reference would make it open in name only. Rate
limits in `core/rate_limit.py` bound the cost instead.

Three honesty constraints run through every response here:

* The corpus is a consolidation of community-published scrapes and one academic dataset.
  It has not been validated against the DGDA register, so nothing may present it as
  official or regulator-sourced.
* `common_uses` is search metadata. Part of it originates in Indian pharmacy data written
  for a different market, so the disclaimer travels on the record.
* `/resolve` returns `resolved=false` rather than a nearest neighbour when nothing clears
  the threshold. A caller reconciling an OCR row needs "no match" to be sayable.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import Integer, case, cast, func, or_, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.http_cache import build_etag, is_not_modified, not_modified_response, set_cache_headers
from app.core.pagination import Page, PaginationParams, pagination_params
from app.db.models.medicine import Brand, Drug, MedicineSearchIndex
from app.schemas.akkhor import (
    AKKHOR_RELEASE,
    AkkhorBrand,
    AkkhorCounts,
    AkkhorDrug,
    AkkhorDrugDetail,
    AkkhorFieldProvenance,
    AkkhorProvenanceResponse,
    AkkhorResolution,
    AkkhorSearchHit,
    AkkhorSource,
    AkkhorVersionResponse,
)

router = APIRouter()

#: Corpus data changes only when the corpus is reloaded, so a long public cache is right.
#: These are shared, not per-user, responses - hence `is_private=False`.
_CATALOGUE_MAX_AGE = 3600
_COUNTS_MAX_AGE = 21600


def _drug_payload(drug: Drug, brand_count: int | None = None) -> AkkhorDrug:
    return AkkhorDrug(
        drug_id=str(drug.id),
        drug_key=drug.drug_key,
        generic_name=drug.generic_name,
        strength=drug.strength,
        dosage_form=drug.dosage_form,
        common_uses=drug.common_uses,
        common_uses_disclaimer=drug.common_uses_disclaimer,
        brand_count=brand_count,
    )


def _brand_payload(brand: Brand) -> AkkhorBrand:
    return AkkhorBrand(
        brand_id=str(brand.id),
        brand_name=brand.brand_name,
        manufacturer=brand.manufacturer,
        medicine_type=brand.medicine_type,
        drug_id=str(brand.drug_id) if brand.drug_id else None,
    )


def _finalise(
    request: Request,
    response: Response,
    payload: Any,
    max_age: int,
    *,
    etag_source: Any = None,
):
    """Attach the ETag and cache headers, or return 304 when the client is current.

    `etag_source` exists for responses that carry a generated-at timestamp. Hashing the
    whole payload there would mint a new ETag on every request and turn revalidation into
    a full re-send, which is the opposite of what an ETag is for. The tag has to cover
    what the response says, not when it said it.
    """
    etag = build_etag(etag_source if etag_source is not None else payload)
    set_cache_headers(response, etag=etag, max_age_seconds=max_age, is_private=False)
    response.headers["X-Akkhor-Release"] = AKKHOR_RELEASE
    if is_not_modified(request, etag):
        return not_modified_response(response)
    return payload


# ---------------------------------------------------------------------------
# Release metadata
# ---------------------------------------------------------------------------

@router.get("/version", response_model=AkkhorVersionResponse)
async def get_version(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """The release identifier and the six corpus counts.

    Counts are computed from the loaded tables on every (uncached) request rather than
    read from a constant. A published number that cannot be regenerated is a number
    nobody can check, and every figure in the whitepaper is supposed to be regenerable.
    """
    canonical_drugs = await db.scalar(select(func.count()).select_from(Drug))
    brand_entries = await db.scalar(select(func.count()).select_from(Brand))
    search_terms = await db.scalar(select(func.count()).select_from(MedicineSearchIndex))
    # Names are compared case- and whitespace-insensitively. "Paracetamol" and
    # "paracetamol" are one generic, not two, and the raw distinct counts (5,254 and
    # 52,213 on the current corpus) overstate the catalogue by exactly that difference.
    distinct_generics = await db.scalar(
        select(func.count(func.distinct(func.lower(func.btrim(Drug.generic_name)))))
    )
    distinct_brands = await db.scalar(
        select(func.count(func.distinct(func.lower(func.btrim(Brand.brand_name)))))
    )

    # The staging table holds the consolidated source rows the canonical tables were
    # built from. A trimmed deployment may not carry it, in which case the count is
    # reported as zero rather than guessed at.
    source_rows = await _count_staging_rows(db)

    payload = AkkhorVersionResponse(
        counts=AkkhorCounts(
            source_rows=source_rows,
            canonical_drugs=canonical_drugs or 0,
            brand_entries=brand_entries or 0,
            search_terms=search_terms or 0,
            distinct_generics=distinct_generics or 0,
            distinct_brands=distinct_brands or 0,
        ),
        counts_generated_at=datetime.now(tz=timezone.utc).isoformat(),
        note=(
            "Counts are computed from the loaded tables at request time. Distinct generic "
            "and brand counts fold case and surrounding whitespace. The corpus is a "
            "consolidation of community-published datasets and one academic dataset; it is "
            "not validated against the DGDA register and must not be described as official "
            "or regulator-sourced."
        ),
    )
    return _finalise(
        request,
        response,
        payload,
        _COUNTS_MAX_AGE,
        etag_source=payload.counts.model_dump(),
    )


async def _count_staging_rows(db: AsyncSession) -> int:
    """Count the consolidated source rows, tolerating a deployment without staging."""
    exists = (await db.execute(text("SELECT to_regclass('public.medicine_staging')"))).scalar_one_or_none()
    if exists is None:
        return 0
    return int((await db.execute(text("SELECT count(*) FROM medicine_staging"))).scalar_one())


@router.get("/provenance", response_model=AkkhorProvenanceResponse)
async def get_provenance(request: Request, response: Response):
    """Where every field came from, and what has not been established about it.

    Provenance here is per source and per field, which is the granularity the build
    actually preserves. The loaded tables carry no row-level source column, so this
    endpoint does not invent one - claiming per-row provenance the corpus cannot support
    would be exactly the kind of unbacked precision the rest of this project avoids.
    """
    payload = AkkhorProvenanceResponse(
        sources=[
            AkkhorSource(
                index=1,
                title="Assorted Medicine Dataset of Bangladesh",
                publisher="ahmedshahriarsakib, Kaggle",
                licence="CC0 1.0",
                rows=21714,
                caveat="Community scrape of MedEx; the uploader did not author the material.",
            ),
            AkkhorSource(
                index=2,
                title="All medicine and drug price data (20k) Bangladesh",
                publisher="toriqulstu, Kaggle",
                licence="CC0 1.0",
                rows=19957,
                caveat="Pricing layer is computed by the build script but not emitted; no price data reaches the platform.",
            ),
            AkkhorSource(
                index=3,
                title="Medicines Dataset",
                publisher="drowsyng, Kaggle",
                licence="Apache 2.0",
                rows=23939,
                caveat=(
                    "Community scrape of Netmeds, an Indian pharmacy. Indication text was "
                    "written for a different market and regulatory context."
                ),
            ),
            AkkhorSource(
                index=4,
                title="Drug Pharma New Dataset",
                publisher="shuvokumarbasak2030, Kaggle",
                licence="MIT",
                rows=53584,
            ),
            AkkhorSource(
                index=5,
                title=(
                    "Medicinal Products in Bangladesh: A Dataset of Generic and Brand Names, "
                    "Dosage Strengths, and Manufacturers"
                ),
                publisher="M. M. Rahman and M. M. Khan, University of Dhaka; Mendeley Data",
                licence="CC BY 4.0",
                rows=21361,
                identifier="10.17632/zhtvkny53n.1",
            ),
        ],
        field_provenance=[
            AkkhorFieldProvenance(field="drug_key", derived_from=[5], layer="canonical drug identity"),
            AkkhorFieldProvenance(field="generic_name", derived_from=[5], layer="canonical drug identity"),
            AkkhorFieldProvenance(field="strength", derived_from=[5], layer="canonical drug identity"),
            AkkhorFieldProvenance(field="dosage_form", derived_from=[5], layer="canonical drug identity"),
            AkkhorFieldProvenance(field="brand_name", derived_from=[4, 5], layer="brand registry"),
            AkkhorFieldProvenance(field="manufacturer", derived_from=[4, 5], layer="brand registry"),
            AkkhorFieldProvenance(field="medicine_type", derived_from=[4, 5], layer="brand registry"),
            AkkhorFieldProvenance(field="common_uses", derived_from=[1, 3], layer="disease mapping (search metadata only)"),
        ],
        not_established=[
            "No source has been validated against the DGDA register or any other regulator.",
            "Indication text has had no clinical review. It is search metadata.",
            "Contradictions between sources for the same brand have not been reconciled.",
            "Duplicate brand entries are resolved by normalisation rules, not manual review.",
        ],
        note=(
            "Per-source and per-field provenance. The loaded tables carry no row-level source "
            "column, so this API does not report one."
        ),
    )
    return _finalise(request, response, payload, _COUNTS_MAX_AGE)


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------

@router.get("/drugs", response_model=Page[AkkhorDrug])
async def list_drugs(
    request: Request,
    response: Response,
    generic: Optional[str] = Query(None, description="Case-insensitive prefix match on generic name"),
    dosage_form: Optional[str] = Query(None, description="Exact dosage form, case-insensitive"),
    strength: Optional[str] = Query(None, description="Exact strength, case-insensitive"),
    params: PaginationParams = Depends(pagination_params(default_limit=20, max_limit=100)),
    db: AsyncSession = Depends(get_db),
):
    """Canonical drug identities, newest filters applied, in the shared page envelope."""
    filters = []
    if generic:
        filters.append(Drug.generic_name.ilike(f"{generic.strip()}%"))
    if dosage_form:
        filters.append(func.lower(Drug.dosage_form) == dosage_form.strip().lower())
    if strength:
        filters.append(func.lower(Drug.strength) == strength.strip().lower())

    total = await db.scalar(select(func.count()).select_from(Drug).where(*filters)) or 0

    rows = (
        await db.execute(
            select(Drug)
            .where(*filters)
            .order_by(Drug.generic_name, Drug.strength, Drug.dosage_form)
            .limit(params.limit)
            .offset(params.offset)
        )
    ).scalars().all()

    payload = Page[AkkhorDrug](
        items=[_drug_payload(drug) for drug in rows],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
    return _finalise(request, response, payload, _CATALOGUE_MAX_AGE)


@router.get("/drugs/{drug_id}", response_model=AkkhorDrugDetail)
async def get_drug(
    drug_id: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """One canonical identity with every brand that maps onto it."""
    try:
        drug = (await db.execute(select(Drug).where(Drug.id == drug_id))).scalars().first()
    except (ValueError, DBAPIError):
        # A malformed UUID is a bad request from a public caller, not a server fault.
        raise HTTPException(status_code=404, detail="Unknown drug id")
    if drug is None:
        raise HTTPException(status_code=404, detail="Unknown drug id")

    brands = (
        await db.execute(select(Brand).where(Brand.drug_id == drug.id).order_by(Brand.brand_name))
    ).scalars().all()

    payload = AkkhorDrugDetail(
        **_drug_payload(drug, brand_count=len(brands)).model_dump(),
        brands=[_brand_payload(brand) for brand in brands],
    )
    return _finalise(request, response, payload, _CATALOGUE_MAX_AGE)


@router.get("/brands", response_model=Page[AkkhorBrand])
async def list_brands(
    request: Request,
    response: Response,
    name: Optional[str] = Query(None, description="Case-insensitive prefix match on brand name"),
    manufacturer: Optional[str] = Query(None, description="Case-insensitive prefix match on manufacturer"),
    medicine_type: Optional[str] = Query(None, description="Exact medicine type, case-insensitive"),
    drug_id: Optional[str] = Query(None, description="Only brands mapping onto this canonical drug"),
    params: PaginationParams = Depends(pagination_params(default_limit=20, max_limit=100)),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if name:
        filters.append(Brand.brand_name.ilike(f"{name.strip()}%"))
    if manufacturer:
        filters.append(Brand.manufacturer.ilike(f"{manufacturer.strip()}%"))
    if medicine_type:
        filters.append(func.lower(Brand.medicine_type) == medicine_type.strip().lower())
    if drug_id:
        filters.append(Brand.drug_id == drug_id)

    total = await db.scalar(select(func.count()).select_from(Brand).where(*filters)) or 0

    rows = (
        await db.execute(
            select(Brand).where(*filters).order_by(Brand.brand_name).limit(params.limit).offset(params.offset)
        )
    ).scalars().all()

    payload = Page[AkkhorBrand](
        items=[_brand_payload(brand) for brand in rows],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
    return _finalise(request, response, payload, _CATALOGUE_MAX_AGE)


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

@router.get("/search", response_model=Page[AkkhorSearchHit])
async def search(
    request: Request,
    response: Response,
    q: str = Query(..., min_length=2, max_length=120, description="Brand or generic name"),
    params: PaginationParams = Depends(pagination_params(default_limit=20, max_limit=100)),
    db: AsyncSession = Depends(get_db),
):
    """Typo-tolerant lookup over the 74,390-term search index.

    Results are catalogue entries, not recommendations. Ordering is exact, then prefix,
    then trigram similarity, and `match_type` on each hit says which tier it came from.
    """
    lowered = q.strip().lower()
    if not lowered:
        raise HTTPException(status_code=422, detail="Search term cannot be empty")

    similarity = func.similarity(func.lower(MedicineSearchIndex.term), lowered)
    is_exact = func.lower(MedicineSearchIndex.term) == lowered
    is_prefix = func.lower(MedicineSearchIndex.term).like(f"{lowered}%")

    # Tier as an integer so the same expression can both order the rows and be read
    # back as a label. The three tiers mean different things to a caller: an exact hit is
    # a fact about the catalogue, a 0.34 trigram score is a suggestion.
    tier = case((is_exact, 0), (is_prefix, 1), else_=2)

    where = or_(is_prefix, similarity > 0.3)

    total = await db.scalar(
        select(func.count()).select_from(MedicineSearchIndex).where(where)
    ) or 0

    rows = (
        await db.execute(
            select(
                MedicineSearchIndex.term,
                MedicineSearchIndex.drug_id,
                MedicineSearchIndex.brand_id,
                cast(tier, Integer).label("tier"),
                similarity.label("score"),
                Drug.generic_name,
                Drug.strength,
                Drug.dosage_form,
                Brand.brand_name,
                Brand.manufacturer,
            )
            .outerjoin(Drug, Drug.id == MedicineSearchIndex.drug_id)
            .outerjoin(Brand, Brand.id == MedicineSearchIndex.brand_id)
            .where(where)
            .order_by(tier, similarity.desc(), MedicineSearchIndex.term)
            .limit(params.limit)
            .offset(params.offset)
        )
    ).all()

    tier_labels = {0: "exact", 1: "prefix", 2: "fuzzy"}
    items = [
        AkkhorSearchHit(
            term=row.term,
            match_type=tier_labels.get(row.tier, "fuzzy"),
            score=float(row.score or 0.0),
            drug_id=str(row.drug_id) if row.drug_id else None,
            brand_id=str(row.brand_id) if row.brand_id else None,
            generic_name=row.generic_name,
            strength=row.strength,
            dosage_form=row.dosage_form,
            brand_name=row.brand_name,
            manufacturer=row.manufacturer,
        )
        for row in rows
    ]

    payload = Page[AkkhorSearchHit](
        items=items,
        total=total,
        limit=params.limit,
        offset=params.offset,
    )
    return _finalise(request, response, payload, _CATALOGUE_MAX_AGE)


#: A strength written inline in a free-text medicine name: "Napa 500mg", "Seclo 20 mg".
#: Only the number and unit are captured; the unit set is the one the corpus actually
#: uses, so an unrecognised unit simply leaves the name unsplit rather than mangling it.
_INLINE_STRENGTH = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g|ml|iu|%)\b",
    re.IGNORECASE,
)


def _split_inline_strength(name: str) -> tuple[str, str | None]:
    """Separate a trailing strength from a medicine name.

    A caller writing "Seclo 20mg" has told us the strength. Matching the whole string
    against the term index scores it as a fuzzy hit on "Seclo" and then resolves to
    whichever omeprazole row sorts first, which may well be 10 mg. That is the confident
    wrong answer this endpoint exists to avoid, so the strength is pulled out and used as
    a constraint instead of being thrown into the similarity score.
    """
    match = _INLINE_STRENGTH.search(name)
    if not match:
        return name.strip(), None
    stripped = (name[: match.start()] + name[match.end():]).strip(" ,-\t")
    return (stripped or name.strip()), f"{match.group(1)}{match.group(2).lower()}"


#: Below this, `/resolve` reports no match instead of returning its best guess. Tuned so a
#: one- or two-character typo still resolves while an unrelated string does not.
_RESOLVE_THRESHOLD = 0.55


@router.get("/resolve", response_model=AkkhorResolution)
async def resolve(
    request: Request,
    response: Response,
    name: str = Query(..., min_length=2, max_length=120, description="Free-text medicine name"),
    strength: Optional[str] = Query(None, description="Narrow to this strength when known"),
    dosage_form: Optional[str] = Query(None, description="Narrow to this dosage form when known"),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a free-text name to one canonical identity, or say it could not.

    This is the endpoint an OCR pipeline or an external EMR would call. It returns
    `resolved=false` with alternatives rather than the nearest row when nothing clears
    the threshold, because a caller reconciling a prescription line needs "no match" to
    be an answer it can receive. Silently returning a neighbour turns an unmatched row
    into a confident wrong one.
    """
    # An explicit `strength` parameter always wins; an inline one is only inferred when
    # the caller did not supply the field.
    search_name, inline_strength = _split_inline_strength(name)
    effective_strength = strength.strip() if strength else inline_strength

    lowered = search_name.lower()
    similarity = func.similarity(func.lower(MedicineSearchIndex.term), lowered)
    is_exact = func.lower(MedicineSearchIndex.term) == lowered
    is_prefix = func.lower(MedicineSearchIndex.term).like(f"{lowered}%")
    tier = case((is_exact, 0), (is_prefix, 1), else_=2)

    filters = [or_(is_prefix, similarity > 0.3)]
    if effective_strength:
        # Strengths in the corpus are free text ("500 mg", "20mg", "1 gm/100 ml"), so an
        # equality test would miss most of them. Compare with spaces removed, and match on
        # containment so a compound strength still resolves.
        normalised = effective_strength.replace(" ", "").lower()
        filters.append(
            func.replace(func.lower(Drug.strength), " ", "").like(f"%{normalised}%")
        )
    if dosage_form:
        filters.append(func.lower(Drug.dosage_form) == dosage_form.strip().lower())

    rows = (
        await db.execute(
            select(
                MedicineSearchIndex.term,
                MedicineSearchIndex.drug_id,
                MedicineSearchIndex.brand_id,
                cast(tier, Integer).label("tier"),
                similarity.label("score"),
                Drug.generic_name,
                Drug.strength,
                Drug.dosage_form,
                Brand.brand_name,
                Brand.manufacturer,
            )
            .outerjoin(Drug, Drug.id == MedicineSearchIndex.drug_id)
            .outerjoin(Brand, Brand.id == MedicineSearchIndex.brand_id)
            .where(*filters)
            .order_by(tier, similarity.desc(), MedicineSearchIndex.term)
            .limit(10)
        )
    ).all()

    tier_labels = {0: "exact", 1: "prefix", 2: "fuzzy"}
    hits = [
        AkkhorSearchHit(
            term=row.term,
            match_type=tier_labels.get(row.tier, "fuzzy"),
            score=float(row.score or 0.0),
            drug_id=str(row.drug_id) if row.drug_id else None,
            brand_id=str(row.brand_id) if row.brand_id else None,
            generic_name=row.generic_name,
            strength=row.strength,
            dosage_form=row.dosage_form,
            brand_name=row.brand_name,
            manufacturer=row.manufacturer,
        )
        for row in rows
    ]

    best = hits[0] if hits else None
    # An exact or prefix hit is a catalogue fact and resolves regardless of trigram score;
    # a fuzzy hit has to clear the threshold on its own.
    confidence = 0.0
    if best is not None:
        confidence = 1.0 if best.match_type == "exact" else max(best.score, 0.75 if best.match_type == "prefix" else 0.0)

    if best is None or confidence < _RESOLVE_THRESHOLD or not best.drug_id:
        return AkkhorResolution(
            query=name,
            name_searched=search_name,
            strength_applied=effective_strength,
            resolved=False,
            confidence=round(confidence, 4),
            alternatives=hits[:5],
        )

    drug = (await db.execute(select(Drug).where(Drug.id == best.drug_id))).scalars().first()
    if drug is None:
        return AkkhorResolution(
            query=name,
            name_searched=search_name,
            strength_applied=effective_strength,
            resolved=False,
            confidence=0.0,
            alternatives=hits[:5],
        )

    matched_brand = None
    if best.brand_id:
        brand = (await db.execute(select(Brand).where(Brand.id == best.brand_id))).scalars().first()
        if brand is not None:
            matched_brand = _brand_payload(brand)

    return AkkhorResolution(
        query=name,
        name_searched=search_name,
        strength_applied=effective_strength,
        resolved=True,
        confidence=round(confidence, 4),
        drug=_drug_payload(drug),
        matched_on="brand" if matched_brand else "generic",
        matched_brand=matched_brand,
        alternatives=[hit for hit in hits[1:6]],
    )
