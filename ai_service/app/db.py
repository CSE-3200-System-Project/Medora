from __future__ import annotations

import time

from supabase import Client, create_client

from app.config import settings


class MedicineVocabulary:
    def __init__(self) -> None:
        self._cache: list[str] = []
        self._cache_at = 0.0
        self._client: Client | None = None

    def get_names(self) -> list[str]:
        now = time.time()
        if self._cache and (now - self._cache_at) < settings.MEDICINE_DB_CACHE_SECONDS:
            return self._cache

        names = self._load_from_supabase()
        self._cache = names
        self._cache_at = now
        return self._cache

    def _get_client(self) -> Client | None:
        if self._client:
            return self._client

        if not settings.SUPABASE_URL:
            return None

        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        if not key:
            return None

        self._client = create_client(settings.SUPABASE_URL, key)
        return self._client

    def _load_from_supabase(self) -> list[str]:
        client = self._get_client()
        if not client:
            return []

        table = settings.MEDICINE_DB_TABLE
        column = settings.MEDICINE_DB_COLUMN
        max_rows = max(1, settings.MEDICINE_DB_MAX_ROWS)
        batch = min(1000, max_rows)

        seen: set[str] = set()
        all_names: list[str] = []
        fetched = 0

        while fetched < max_rows:
            end_idx = min(fetched + batch - 1, max_rows - 1)
            response = client.table(table).select(column).range(fetched, end_idx).execute()
            rows = response.data or []
            if not rows:
                break

            for row in rows:
                value = row.get(column)
                if not value:
                    continue
                text = str(value).strip()
                normalized = text.lower()
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                all_names.append(text)

            if len(rows) < batch:
                break
            fetched += batch

        return all_names


medicine_vocabulary = MedicineVocabulary()

