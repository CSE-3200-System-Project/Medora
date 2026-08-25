#!/usr/bin/env python3
"""Build the deep-research report from the validated JSON result files."""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml


HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
FIELDS = HERE / "fields.yaml"
OUTPUT = HERE / "report.md"

CATEGORY_MAPPING = {
    "Basic Info": ["basic_info", "Basic Info"],
    "Technical Features": ["technical_features", "technical_characteristics", "Technical Features"],
    "Performance Metrics": ["performance_metrics", "performance", "Performance Metrics"],
    "Milestone Significance": ["milestone_significance", "milestones", "Milestone Significance"],
    "Business Info": ["business_info", "commercial_info", "Business Info"],
    "Competition & Ecosystem": ["competition_ecosystem", "competition", "Competition & Ecosystem"],
    "History": ["history", "History"],
    "Market Positioning": ["market_positioning", "market", "Market Positioning"],
}

INTERNAL_FIELDS = {"_source_file", "uncertain"}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def load_field_spec() -> list[dict]:
    data = yaml.safe_load(FIELDS.read_text(encoding="utf-8"))
    return data.get("field_categories", [])


def nested_lookup(obj, field_name: str):
    if isinstance(obj, dict):
        if field_name in obj:
            return obj[field_name]
        for value in obj.values():
            found = nested_lookup(value, field_name)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = nested_lookup(value, field_name)
            if found is not None:
                return found
    return None


def lookup(data: dict, category: str, field_name: str):
    if field_name in data:
        return data[field_name]
    aliases = CATEGORY_MAPPING.get(category, []) + [category, slug(category).replace("-", "_")]
    for alias in aliases:
        block = data.get(alias)
        if isinstance(block, dict) and field_name in block:
            return block[field_name]
    return nested_lookup(data, field_name)


def has_uncertain_marker(value) -> bool:
    if isinstance(value, str):
        return "[uncertain]" in value
    if isinstance(value, dict):
        return any(has_uncertain_marker(item) for item in value.values())
    if isinstance(value, list):
        return any(has_uncertain_marker(item) for item in value)
    return False


def format_value(value, depth: int = 0) -> str:
    if isinstance(value, dict):
        parts = [f"{key}: {format_value(item, depth + 1)}" for key, item in value.items()]
        return "; ".join(parts) if len(parts) <= 3 else "<br>".join(parts)
    if isinstance(value, list):
        if all(isinstance(item, dict) for item in value):
            return "<br>".join(
                " | ".join(f"{key}: {format_value(item)}" for key, item in row.items())
                for row in value
            )
        rendered = [format_value(item, depth + 1) for item in value]
        return ", ".join(rendered) if len(rendered) <= 5 else "<br>".join(rendered)
    text = str(value)
    if len(text) > 100:
        text = re.sub(r"(?<=[.!?])\s+", "<br>", text)
    return text


def main() -> None:
    field_spec = load_field_spec()
    defined = {
        field["name"]
        for category in field_spec
        for field in category.get("fields", [])
    }
    category_keys = {
        alias
        for aliases in CATEGORY_MAPPING.values()
        for alias in aliases
    }
    documents = []
    for path in sorted(RESULTS.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        data["_source_file"] = path.name
        documents.append(data)

    lines = [
        "# Maya Bengali clinical-navigation safety experiment: deep research report",
        "",
        "## Contents",
        "",
    ]
    for index, data in enumerate(documents, 1):
        name = str(data.get("name") or data["_source_file"])
        lines.append(f"{index}. [{name}](#{slug(name)})")

    for index, data in enumerate(documents, 1):
        name = str(data.get("name") or data["_source_file"])
        uncertain = set(data.get("uncertain") or [])
        lines.extend(["", f"## {index}. {name}", ""])
        for category in field_spec:
            category_name = category.get("category", "Other Info")
            rendered = []
            for field in category.get("fields", []):
                field_name = field["name"]
                if field_name == "uncertain" or field_name in uncertain:
                    continue
                value = lookup(data, category_name, field_name)
                if value in (None, "", []) or has_uncertain_marker(value):
                    continue
                rendered.append((field_name, value))
            if not rendered:
                continue
            lines.extend([f"### {category_name}", ""])
            for field_name, value in rendered:
                title = field_name.replace("_", " ").capitalize()
                lines.extend([f"#### {title}", "", format_value(value), ""])

        extras = []
        for key, value in data.items():
            if key in defined or key in INTERNAL_FIELDS or key in category_keys:
                continue
            if value in (None, "", []) or key in uncertain or has_uncertain_marker(value):
                continue
            extras.append((key, value))
        if extras:
            lines.extend(["### Other Info", ""])
            for key, value in extras:
                lines.extend([f"#### {key.replace('_', ' ').capitalize()}", "", format_value(value), ""])

        if uncertain:
            lines.extend(["### Uncertain fields", ""])
            lines.extend(f"- `{field}`" for field in sorted(uncertain))

    OUTPUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"wrote {len(documents)} items to {OUTPUT}")


if __name__ == "__main__":
    main()
