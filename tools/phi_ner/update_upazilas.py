#!/usr/bin/env python3
"""Refresh the PHI corpus geography snapshot from Bangladesh's National Portal.

This is intentionally a reviewable importer, not a runtime dependency. The corpus
generator reads the committed JSON snapshot and therefore remains offline and
reproducible. Run this script only when updating administrative coverage.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SOURCE_URL = "https://bangladesh.gov.bd/views/upazila-list"
MAY_GAZETTE_URL = (
    "https://www.dpp.gov.bd/bgpress/index.php/document/"
    "extraordinary_gazettes_monthly/2026-05-18"
)
JULY_GAZETTE_URL = (
    "https://dpp.gov.bd/bgpress/index.php/document/"
    "extraordinary_gazettes_monthly/2026-07-01"
)
OUT = Path(__file__).with_name("data") / "bangladesh_upazilas.json"

EXTENSION_NAMES = {
    "মোকামতলা", "মাতামুহুরী", "রুহিয়া", "ভূল্লী", "চন্দ্রগঞ্জ",
    "ফটিকছড়ি উত্তর", "বাঙ্গরা", "দক্ষিণ গফরগাঁও",
}

MISSING_FROM_PORTAL = [
    {
        "name_bn": "মাতামুহুরী",
        "name_en": "Matamuhuri",
        "district_bn": "কক্সবাজার",
        "district_en": "Cox's Bazar",
        "division_bn": "চট্টগ্রাম",
        "division_en": "Chattogram",
        "official_url": MAY_GAZETTE_URL,
    },
    {
        "name_bn": "ফটিকছড়ি উত্তর",
        "name_en": "Fatikchhari Uttar",
        "district_bn": "চট্টগ্রাম",
        "district_en": "Chattogram",
        "division_bn": "চট্টগ্রাম",
        "division_en": "Chattogram",
        "official_url": JULY_GAZETTE_URL,
    },
    {
        "name_bn": "বাঙ্গরা",
        "name_en": "Bangra",
        "district_bn": "কুমিল্লা",
        "district_en": "Cumilla",
        "division_bn": "চট্টগ্রাম",
        "division_en": "Chattogram",
        "official_url": JULY_GAZETTE_URL,
    },
    {
        "name_bn": "দক্ষিণ গফরগাঁও",
        "name_en": "South Gafargaon",
        "district_bn": "ময়মনসিংহ",
        "district_en": "Mymensingh",
        "division_bn": "ময়মনসিংহ",
        "division_en": "Mymensingh",
        "official_url": JULY_GAZETTE_URL,
    },
]

DIVISION_EN = {
    "ঢাকা": "Dhaka",
    "খুলনা": "Khulna",
    "চট্টগ্রাম": "Chattogram",
    "রাজশাহী": "Rajshahi",
    "সিলেট": "Sylhet",
    "রংপুর": "Rangpur",
    "বরিশাল": "Barishal",
    "ময়মনসিংহ": "Mymensingh",
    "ময়মনসিংহ": "Mymensingh",
}

DISTRICT_EN_OVERRIDES = {
    "bogra": "Bogura",
    "comilla": "Cumilla",
    "coxsbazar": "Cox's Bazar",
    "jhalakathi": "Jhalokati",
}

UPAZILA_EN_OVERRIDES = {
    "comillasadar": "Cumilla Adarsha Sadar",
    "sadarsouth": "Cumilla Sadar Dakshin",
    "matlabsouth": "Matlab Dakshin",
    "matlabnorth": "Matlab Uttar",
    "sadar": "{district} Sadar",
}


def _plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def _english_slug(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


def _upazila_label(value: str) -> str:
    value = re.sub(r"^উপজেলা\s+", "", _plain(value)).strip()
    value = re.sub(r"\s+উপজেলা(?:,.*)?$", "", value).strip()
    return re.sub(r",.*$", "", value).strip()


def _extract(source: str) -> list[dict[str, str]]:
    divisions = re.findall(
        r"<h4>\s*(.*?)\s+বিভাগ\s*</h4>\s*<table[^>]*>(.*?)</table>",
        source,
        flags=re.DOTALL,
    )
    rows: list[dict[str, str]] = []
    for raw_division, table in divisions:
        division_bn = _plain(raw_division)
        division_en = DIVISION_EN.get(division_bn)
        if not division_en:
            raise ValueError(f"unknown division in source: {division_bn!r}")
        for district_cell, upazila_cell in re.findall(
            r'<td class="district-name">(.*?)</td>\s*'
            r'<td class="upazilas-list">(.*?)</td>',
            table,
            flags=re.DOTALL,
        ):
            district_match = re.search(r'<a href="([^"]+)"[^>]*>(.*?)</a>', district_cell, re.DOTALL)
            if not district_match:
                raise ValueError("district row has no link")
            district_url, district_label = district_match.groups()
            district_bn = re.sub(r"\s+জেলা$", "", _plain(district_label)).strip()
            district_slug = urlparse(district_url).hostname.split(".")[0]
            district_en = DISTRICT_EN_OVERRIDES.get(district_slug, _english_slug(district_slug))

            links = re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', upazila_cell, re.DOTALL)
            for upazila_url, upazila_label in links:
                name_bn = _upazila_label(upazila_label)
                host = urlparse(upazila_url).hostname
                slug = host.split(".")[0]
                override = UPAZILA_EN_OVERRIDES.get(slug)
                name_en = (override.format(district=district_en) if override else _english_slug(slug))
                rows.append({
                    "name_bn": name_bn,
                    "name_en": name_en,
                    "district_bn": district_bn,
                    "district_en": district_en,
                    "division_bn": division_bn,
                    "division_en": division_en,
                    "official_url": upazila_url,
                    "source_layer": (
                        "bd_admin_2026_extension"
                        if name_bn in EXTENSION_NAMES else "bd_admin_2022"
                    ),
                    "bbs_geocode_status": (
                        "pending" if name_bn in EXTENSION_NAMES else "baseline"
                    ),
                })

    if len(rows) < 495:
        raise ValueError(f"expected at least the build-plan target of 495, found {len(rows)}")
    if len({row["official_url"] for row in rows}) != len(rows):
        raise ValueError("duplicate official upazila links in source")
    return rows


def main() -> int:
    raw_sources: dict[str, bytes] = {}
    for url in (SOURCE_URL, MAY_GAZETTE_URL, JULY_GAZETTE_URL):
        request = Request(url, headers={"User-Agent": "Medora-PHI-corpus-source-refresh/1.0"})
        with urlopen(request, timeout=30) as response:
            raw_sources[url] = response.read()
    rows = _extract(raw_sources[SOURCE_URL].decode("utf-8"))
    portal_count = len(rows)

    gazette_text = "\n".join(
        raw_sources[url].decode("utf-8") for url in (MAY_GAZETTE_URL, JULY_GAZETTE_URL)
    )
    for name in EXTENSION_NAMES:
        if name not in gazette_text:
            raise ValueError(f"gazette source no longer contains extension name {name!r}")
    for row in MISSING_FROM_PORTAL:
        rows.append({
            **row,
            "source_layer": "bd_admin_2026_extension",
            "bbs_geocode_status": "pending",
        })

    baseline_count = sum(row["source_layer"] == "bd_admin_2022" for row in rows)
    extension_count = sum(row["source_layer"] == "bd_admin_2026_extension" for row in rows)
    if (baseline_count, extension_count, len(rows)) != (495, 8, 503):
        raise ValueError(
            "expected 495 BBS-baseline entries plus 8 gazetted extensions; "
            f"found {baseline_count} + {extension_count} = {len(rows)}"
        )

    payload = {
        "source": {
            "publisher": "Government of Bangladesh",
            "url": SOURCE_URL,
            "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sources": [
                {
                    "role": "portal_hierarchy",
                    "url": SOURCE_URL,
                    "sha256": hashlib.sha256(raw_sources[SOURCE_URL]).hexdigest(),
                },
                {
                    "role": "may_2026_gazettes",
                    "url": MAY_GAZETTE_URL,
                    "sha256": hashlib.sha256(raw_sources[MAY_GAZETTE_URL]).hexdigest(),
                },
                {
                    "role": "july_2026_gazettes",
                    "url": JULY_GAZETTE_URL,
                    "sha256": hashlib.sha256(raw_sources[JULY_GAZETTE_URL]).hexdigest(),
                },
            ],
            "build_plan_target": 495,
            "bd_admin_2022": baseline_count,
            "bd_admin_2026_extension": extension_count,
            "current_portal_count": portal_count,
            "current_gazetted_count": len(rows),
            "note": (
                "The build plan's 495-unit BBS/census baseline is preserved. Eight units "
                "gazetted in May and July 2026 form a separate extension. The National Portal "
                "listed only 499 on retrieval, so four gazetted entries are sourced directly "
                "from Government Press notices. English portal forms are deterministic readings "
                "of official .gov.bd hostnames; extension spellings are conservative translations."
            ),
        },
        "upazilas": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} upazilas to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
