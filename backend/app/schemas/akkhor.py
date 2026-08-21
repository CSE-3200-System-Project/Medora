"""Wire contracts for the Akkhor public medicine-identity API.

Akkhor is the reusable half of Medora: a hospital, a research group, or a competing
health-software vendor can consume canonical Bangladesh drug identity without adopting
anything else in the platform. That is why these schemas are deliberately separate from
`app/schemas/medicine.py`, which serves the in-app search UI and is free to change with
it. A public contract that moves whenever a screen is redesigned is not a contract.

Every response is corpus data. None of it is patient data, none of it is clinical advice,
and `common_uses` in particular is search metadata written for a different market - the
disclaimer travels on the record rather than living only in a document nobody fetches.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

#: Bumped when the loaded corpus changes, not when this file changes. Consumers pin it.
AKKHOR_RELEASE = "akkhor-2026.08"
AKKHOR_DATA_LICENCE = "CC BY 4.0"
AKKHOR_CODE_LICENCE = "MIT"


class AkkhorBrand(BaseModel):
    """A commercial name. Many map onto one canonical drug."""

    brand_id: str
    brand_name: str
    manufacturer: Optional[str] = None
    medicine_type: Optional[str] = None
    drug_id: Optional[str] = None

    model_config = {"from_attributes": True}


class AkkhorDrug(BaseModel):
    """One canonical identity: generic name, strength, and dosage form."""

    drug_id: str
    drug_key: str
    generic_name: str
    strength: str
    dosage_form: str
    common_uses: Optional[str] = None
    common_uses_disclaimer: Optional[str] = None
    brand_count: Optional[int] = None

    model_config = {"from_attributes": True}


class AkkhorDrugDetail(AkkhorDrug):
    brands: List[AkkhorBrand] = Field(default_factory=list)


class AkkhorSearchHit(BaseModel):
    """One search-index term and what it resolves to.

    `match_type` says how the hit was found, and `score` is a lexical similarity, not a
    confidence that this is the right medicine for anyone. Ranking is trigram and prefix
    arithmetic over a catalogue.
    """

    term: str
    match_type: str  # "exact" | "prefix" | "fuzzy"
    score: float
    drug_id: Optional[str] = None
    brand_id: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    brand_name: Optional[str] = None
    manufacturer: Optional[str] = None


class AkkhorResolution(BaseModel):
    """The best canonical identity for a free-text medicine name, plus the runners-up.

    `resolved` is false when nothing cleared the threshold. It is never a guess: a caller
    matching an OCR row needs to know the difference between "this is Napa 500mg tablet"
    and "nothing in the catalogue looks like this", and a silently-returned nearest
    neighbour destroys that distinction.
    """

    query: str
    #: What was actually matched against the term index after any inline strength was
    #: split off, and the strength constraint that split produced. A caller seeing
    #: "Seclo 20mg" resolve to a different brand needs to know the strength was used as
    #: a filter rather than as part of the name.
    name_searched: str
    strength_applied: Optional[str] = None
    resolved: bool
    confidence: float
    drug: Optional[AkkhorDrug] = None
    matched_on: Optional[str] = None  # "brand" | "generic"
    matched_brand: Optional[AkkhorBrand] = None
    alternatives: List[AkkhorSearchHit] = Field(default_factory=list)
    note: str = (
        "Catalogue lookup only. Confidence is lexical similarity over the term index, not "
        "a clinical judgement, and it does not confirm that a medicine is appropriate for "
        "any patient. The corpus contains unreconciled contradictions between sources, so "
        "a brand whose name carries a strength may map onto a canonical row with a "
        "different one."
    )


class AkkhorCounts(BaseModel):
    """The six published corpus counts, regenerated from the database on request."""

    source_rows: int
    canonical_drugs: int
    brand_entries: int
    search_terms: int
    distinct_generics: int
    distinct_brands: int


class AkkhorVersionResponse(BaseModel):
    release: str = AKKHOR_RELEASE
    data_licence: str = AKKHOR_DATA_LICENCE
    code_licence: str = AKKHOR_CODE_LICENCE
    counts: AkkhorCounts
    counts_generated_at: str
    note: str


class AkkhorSource(BaseModel):
    index: int
    title: str
    publisher: str
    licence: str
    rows: Optional[int] = None
    identifier: Optional[str] = None
    caveat: Optional[str] = None


class AkkhorFieldProvenance(BaseModel):
    field: str
    derived_from: List[int]
    layer: str


class AkkhorProvenanceResponse(BaseModel):
    release: str = AKKHOR_RELEASE
    sources: List[AkkhorSource]
    field_provenance: List[AkkhorFieldProvenance]
    not_established: List[str]
    note: str
