from __future__ import annotations

import importlib.util
from collections import Counter
from pathlib import Path

import pytest


def load_freeze_module():
    path = Path(__file__).resolve().parents[2] / "benchmarks" / "freeze_ocr_manifest.py"
    spec = importlib.util.spec_from_file_location("freeze_ocr_manifest", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_grouped_split_is_exact_deterministic_and_stratified():
    module = load_freeze_module()
    records = []
    for index in range(103):
        difficulty = "easy" if index < 40 else ("medium" if index < 75 else "hard")
        records.append(
            {
                "writer_or_template_group": f"group-{index:03d}",
                "difficulty": difficulty,
                "language": ("bn", "en", "mixed", "other")[index % 4],
            }
        )

    first = module.choose_development_groups(records, "softwarex-test-seed")
    second = module.choose_development_groups(records, "softwarex-test-seed")
    selected = [record for record in records if record["writer_or_template_group"] in first]

    assert first == second
    assert len(selected) == 21
    assert Counter(record["difficulty"] for record in selected) == Counter(easy=8, medium=7, hard=6)


def test_grouped_split_fails_if_group_sizes_cannot_make_21():
    module = load_freeze_module()
    records = [
        {
            "writer_or_template_group": f"group-{index // 2:03d}",
            "difficulty": ("easy", "medium", "hard")[index % 3],
            "language": ("bn", "en")[index % 2],
        }
        for index in range(22)
    ]

    with pytest.raises(ValueError, match="cannot form exactly 21"):
        module.choose_development_groups(records, "softwarex-test-seed")
