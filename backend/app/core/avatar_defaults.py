from __future__ import annotations

import hashlib
import re
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

AVATAR_STYLES = (
    "adventurer",
    "avataaars",
    "bottts",
    "fun-emoji",
    "identicon",
    "lorelei",
    "micah",
    "personas",
)


def _clean_seed(seed: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "", str(seed or ""))
    return cleaned[:64] or "medora-user"


def generate_default_avatar_url(seed: str) -> str:
    cleaned_seed = _clean_seed(seed)
    hashed = hashlib.sha256(cleaned_seed.encode("utf-8")).hexdigest()
    style = AVATAR_STYLES[int(hashed[:8], 16) % len(AVATAR_STYLES)]
    encoded_seed = quote(cleaned_seed, safe="")
    return f"https://api.dicebear.com/9.x/{style}/svg?seed={encoded_seed}"


async def backfill_missing_avatar_urls(db: AsyncSession) -> None:
    style_list = ", ".join([f"'{style}'" for style in AVATAR_STYLES])
    await db.execute(
        text(
            f"""
            UPDATE patient_profiles
            SET profile_photo_url =
                'https://api.dicebear.com/9.x/' ||
                (ARRAY[{style_list}])[(abs(('x' || substr(md5(profile_id), 1, 8))::bit(32)::int) % {len(AVATAR_STYLES)}) + 1] ||
                '/svg?seed=' || regexp_replace(profile_id, '[^A-Za-z0-9_-]', '', 'g')
            WHERE profile_photo_url IS NULL OR btrim(profile_photo_url) = ''
            """
        )
    )
    await db.execute(
        text(
            f"""
            UPDATE doctor_profiles
            SET profile_photo_url =
                'https://api.dicebear.com/9.x/' ||
                (ARRAY[{style_list}])[(abs(('x' || substr(md5(profile_id), 1, 8))::bit(32)::int) % {len(AVATAR_STYLES)}) + 1] ||
                '/svg?seed=' || regexp_replace(profile_id, '[^A-Za-z0-9_-]', '', 'g')
            WHERE profile_photo_url IS NULL OR btrim(profile_photo_url) = ''
            """
        )
    )
