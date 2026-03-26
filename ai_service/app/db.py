from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass

from psycopg import sql
from psycopg_pool import ConnectionPool

from app.config import settings
from app.normalize import normalize_medicine_text

logger = logging.getLogger(__name__)

_SAFE_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")


@dataclass(frozen=True)
class MedicineSearchRow:
    term: str
    drug_id: str | None
    brand_id: str | None
    score: float


class MedicineSearchRepository:
    def __init__(self) -> None:
        self._pool: ConnectionPool | None = None
        self._pool_lock = threading.Lock()

    def search_exact(self, raw_input: str, limit: int = 3) -> list[MedicineSearchRow]:
        normalized = normalize_medicine_text(raw_input)
        if not normalized:
            return []

        query = sql.SQL(
            """
            SELECT term, drug_id::text, brand_id::text, 1.0 AS score
            FROM {table}
            WHERE lower(term) = {normalized}
            LIMIT {limit}
            """
        ).format(
            table=self._table_identifier(),
            normalized=sql.Literal(normalized),
            limit=sql.Literal(max(1, int(limit))),
        )
        return self._execute_query(query)

    def search_trigram(self, raw_input: str, limit: int = 5) -> list[MedicineSearchRow]:
        normalized = normalize_medicine_text(raw_input)
        if not normalized:
            return []

        query = sql.SQL(
            """
            SELECT term, drug_id::text, brand_id::text, similarity(term, {normalized}) AS score
            FROM {table}
            WHERE term % {normalized}
            ORDER BY score DESC
            LIMIT {limit}
            """
        ).format(
            table=self._table_identifier(),
            normalized=sql.Literal(normalized),
            limit=sql.Literal(max(1, int(limit))),
        )
        return self._execute_query(query)

    def search_contains(self, raw_input: str, limit: int = 20) -> list[MedicineSearchRow]:
        normalized = normalize_medicine_text(raw_input)
        if not normalized:
            return []

        tokens = [token for token in normalized.split(" ") if len(token) > 1]
        if not tokens:
            return []

        pattern = f"%{tokens[0]}%"
        query = sql.SQL(
            """
            SELECT term, drug_id::text, brand_id::text, similarity(term, {normalized}) AS score
            FROM {table}
            WHERE term ILIKE {pattern}
            ORDER BY score DESC
            LIMIT {limit}
            """
        ).format(
            table=self._table_identifier(),
            normalized=sql.Literal(normalized),
            pattern=sql.Literal(pattern),
            limit=sql.Literal(max(1, int(limit))),
        )
        return self._execute_query(query)

    def _table_identifier(self) -> sql.Identifier:
        table_name = settings.MEDICINE_DB_TABLE.strip()
        if not _SAFE_IDENTIFIER.match(table_name):
            raise ValueError("MEDICINE_DB_TABLE contains unsafe characters.")
        return sql.Identifier(table_name)

    def _execute_query(self, query: sql.Composable) -> list[MedicineSearchRow]:
        pool = self._get_pool()
        if pool is None:
            return []

        try:
            with pool.connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query)
                    rows = cursor.fetchall()
        except Exception:
            logger.exception("medicine_search_query_failed")
            return []

        results: list[MedicineSearchRow] = []
        for term, drug_id, brand_id, score in rows:
            if not term:
                continue
            results.append(
                MedicineSearchRow(
                    term=str(term),
                    drug_id=str(drug_id) if drug_id else None,
                    brand_id=str(brand_id) if brand_id else None,
                    score=float(score or 0.0),
                )
            )
        return results

    def _get_pool(self) -> ConnectionPool | None:
        if self._pool and not self._pool.closed:
            return self._pool

        with self._pool_lock:
            if self._pool and not self._pool.closed:
                return self._pool

            database_url = _normalize_database_url(settings.SUPABASE_DATABASE_URL)
            if not database_url:
                return None

            self._pool = ConnectionPool(
                conninfo=database_url,
                min_size=max(1, int(settings.MEDICINE_DB_POOL_MIN_SIZE)),
                max_size=max(1, int(settings.MEDICINE_DB_POOL_MAX_SIZE)),
                timeout=max(1.0, float(settings.MEDICINE_DB_POOL_TIMEOUT_SECONDS)),
                kwargs={"autocommit": True},
                open=True,
            )

        return self._pool


def _normalize_database_url(raw_url: str | None) -> str | None:
    if not raw_url:
        return None

    # Supabase often provides SQLAlchemy style URLs like postgresql+asyncpg://...
    normalized = raw_url.strip().replace("postgresql+asyncpg://", "postgresql://")
    normalized = normalized.replace("postgres+asyncpg://", "postgres://")
    return normalized

medicine_search_repository = MedicineSearchRepository()

