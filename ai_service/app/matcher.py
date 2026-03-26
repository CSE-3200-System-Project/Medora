from __future__ import annotations

import logging
from dataclasses import dataclass

from rapidfuzz import fuzz, process

from app.config import settings
from app.db import MedicineSearchRow, medicine_search_repository
from app.normalize import extract_dosage_tokens, extract_search_terms, normalize_medicine_text

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MedicineMatch:
    matched_term: str
    drug_id: str | None
    brand_id: str | None
    confidence: float
    trigram_score: float


class MedicineMatcher:
    def __init__(self) -> None:
        self._repository = medicine_search_repository

    def match(self, ocr_text: str, top_k: int | None = None) -> list[MedicineMatch]:
        if settings.DISABLE_MEDICINE_MATCHING:
            return []

        search_terms = extract_search_terms(ocr_text)
        if not search_terms:
            return []

        requested_top_k = max(1, top_k or settings.MEDICINE_MATCH_TOP_K)
        ranked_rows: list[tuple[MedicineSearchRow, str, str]] = []

        # Stage 1: exact matching.
        for term in search_terms:
            rows = self._repository.search_exact(term, limit=requested_top_k)
            ranked_rows.extend((row, term, "exact") for row in rows)

        # Stage 2: trigram similarity (primary stage).
        if not ranked_rows:
            for term in search_terms:
                rows = self._repository.search_trigram(term, limit=settings.MEDICINE_MATCH_TRIGRAM_LIMIT)
                ranked_rows.extend((row, term, "trigram") for row in rows)

        # Stage 3: optional fallback rerank from token-constrained DB results.
        if not ranked_rows and settings.MEDICINE_MATCH_ENABLE_FALLBACK:
            for term in search_terms:
                candidates = self._repository.search_contains(term, limit=settings.MEDICINE_MATCH_FALLBACK_LIMIT)
                ranked_rows.extend(self._rerank_fallback(term, candidates))

        if not ranked_rows:
            return []

        matches = self._score_and_deduplicate(ocr_text, ranked_rows)
        if matches:
            best = matches[0]
            logger.info(
                "medicine_match input=%r matched=%r confidence=%.3f",
                ocr_text[:120],
                best.matched_term,
                best.confidence,
            )
        else:
            logger.info("medicine_match input=%r matched=None", ocr_text[:120])

        return matches[:requested_top_k]

    def match_best(self, ocr_text: str) -> MedicineMatch | None:
        matches = self.match(ocr_text, top_k=1)
        if not matches:
            return None
        return matches[0]

    def _rerank_fallback(
        self,
        search_term: str,
        rows: list[MedicineSearchRow],
    ) -> list[tuple[MedicineSearchRow, str, str]]:
        if not rows:
            return []

        row_terms = [row.term for row in rows]
        reranked: list[tuple[MedicineSearchRow, str, str]] = []
        for result in process.extract(search_term, row_terms, scorer=fuzz.WRatio, limit=min(10, len(rows))):
            _, fuzzy_score, index = result
            row = rows[index]
            reranked.append(
                (
                    MedicineSearchRow(
                        term=row.term,
                        drug_id=row.drug_id,
                        brand_id=row.brand_id,
                        score=max(row.score, float(fuzzy_score) / 100.0),
                    ),
                    search_term,
                    "fallback",
                )
            )
        return reranked

    def _score_and_deduplicate(
        self,
        ocr_text: str,
        ranked_rows: list[tuple[MedicineSearchRow, str, str]],
    ) -> list[MedicineMatch]:
        normalized_input = normalize_medicine_text(ocr_text)
        input_dosages = extract_dosage_tokens(ocr_text)

        best_by_key: dict[tuple[str, str | None, str | None], MedicineMatch] = {}

        for row, search_term, stage in ranked_rows:
            base_score = 1.0 if stage == "exact" else max(0.0, min(1.0, row.score))
            confidence = _compute_confidence(
                base_score=base_score,
                matched_term=row.term,
                normalized_input=normalize_medicine_text(search_term or normalized_input),
                input_dosages=input_dosages,
            )
            if confidence < settings.MEDICINE_MATCH_MIN_CONFIDENCE:
                continue

            key = (row.term.lower(), row.drug_id, row.brand_id)
            candidate = MedicineMatch(
                matched_term=row.term,
                drug_id=row.drug_id,
                brand_id=row.brand_id,
                confidence=confidence,
                trigram_score=base_score,
            )
            previous = best_by_key.get(key)
            if previous is None or candidate.confidence > previous.confidence:
                best_by_key[key] = candidate

        return sorted(
            best_by_key.values(),
            key=lambda item: (item.confidence, item.trigram_score),
            reverse=True,
        )


def _compute_confidence(
    *,
    base_score: float,
    matched_term: str,
    normalized_input: str,
    input_dosages: set[str],
) -> float:
    normalized_term = normalize_medicine_text(matched_term)
    if not normalized_term:
        return 0.0

    term_len = len(normalized_term)
    input_len = max(len(normalized_input), 1)
    length_similarity = min(term_len, input_len) / max(term_len, input_len)

    dosage_overlap = 0.0
    if input_dosages:
        matched_dosages = extract_dosage_tokens(matched_term)
        dosage_overlap = 1.0 if input_dosages.intersection(matched_dosages) else 0.0

    score = (0.82 * base_score) + (0.13 * length_similarity) + (0.05 * dosage_overlap)
    return round(max(0.0, min(1.0, score)), 3)


def match_medicine(ocr_text: str) -> dict[str, list[dict[str, object]]]:
    """Takes OCR text and returns best matching medicine with confidence."""
    matches = medicine_matcher.match(ocr_text, top_k=settings.MEDICINE_MATCH_TOP_K)
    return {
        "matches": [
            {
                "matched_term": match.matched_term,
                "drug_id": match.drug_id,
                "brand_id": match.brand_id,
                "confidence": match.confidence,
            }
            for match in matches
        ]
    }


medicine_matcher = MedicineMatcher()
