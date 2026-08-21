#!/usr/bin/env python3
"""Build the synthetic Bangla/English/romanised clinical PHI corpus.

    python tools/phi_ner/generate_corpus.py                 # 12,000 sentences, default seed
    python tools/phi_ner/generate_corpus.py --size 8000
    python tools/phi_ner/generate_corpus.py --emit-conll    # additionally write a CoNLL view

Why the generator is the deliverable
------------------------------------
No Bangla clinical de-identification corpus exists, and one cannot be built from real
records without exposing the very identifiers the task is about. So the corpus is
synthesised, and the generator is published with it: anyone can rebuild the data from
this file plus the shipped medicine reference, with no access to patient text. The
generator is the reproducible artifact; the JSONL is just its output.

Three properties this script enforces rather than assumes
---------------------------------------------------------
**Train and dev use disjoint filler pools.** Names, facilities and districts are split
before generation, so a dev sentence is built from people and places the training split
never saw. A dev score measured over shared fillers would report memorisation as
generalisation, and the residual this whole component targets is precisely *unseen*
names.

**Both holdout populations are excluded by construction.** Every generated sentence is
checked against the identifier strings in `pii_safety_cases.jsonl` *and*
`pii_holdout_cases.jsonl`, and rejected if it contains one. A test set is honest only if
the training data provably cannot contain its answers, and "we were careful" is not a
proof. The second set matters more than the first: it holds the novel unlabelled names
that are the entire remaining residual, so its answers are the ones worth not leaking
into training.

**Hard negatives are first-class.** Drug names from the Akkhor reference, ages below 90,
clinical eponyms that look like surnames, and departments are substituted into the same
frames as the PHI. Roughly a fifth of the corpus contains no PHI at all. Without this the
model learns "unfamiliar capitalised token = redact" and destroys the clinical content
the summary exists to carry.

Character offsets are the gold standard in the output; the BIO view is derived, never the
other way round, so span scoring stays exact regardless of a tokeniser's choices.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import fillers as F  # noqa: E402
import templates as T  # noqa: E402

GENERATOR_VERSION = "phi-corpus-1.0"
DEFAULT_SEED = 20260822
DEFAULT_SIZE = 12000
DEV_FRACTION = 0.12

OUT_DIR = HERE / "corpus"
# Both scored populations, not just the headline one. `pii_holdout_cases.jsonl` is the
# novel-identifier probe, and it is where the residual actually lives — its names are the
# ones the model has to get right, so training on them would be the most misleading thing
# this generator could do.
HOLDOUT_SETS = (
    ROOT / "tests" / "benchmarks" / "datasets" / "pii_safety_cases.jsonl",
    ROOT / "tests" / "benchmarks" / "datasets" / "pii_holdout_cases.jsonl",
)

SLOT_RE = re.compile(r"\{(\w+)\}")


# ---------------------------------------------------------------------------
# Filler pools, split before anything is generated
# ---------------------------------------------------------------------------


class Pools:
    """One split's worth of slot material.

    Held as an object rather than module globals so train and dev cannot accidentally
    read from each other — the disjointness claim in the manifest is then structural.
    """

    def __init__(
        self,
        given: list[tuple[str, str, str | None]],
        surnames: list[tuple[str, str, str | None]],
        hospitals: list[tuple[str, str]],
        districts: list[tuple[str, str]],
        upazilas: list[tuple[str, str]],
        areas: list[tuple[str, str]],
        drugs: list[str],
    ) -> None:
        self.given = given
        self.surnames = surnames
        self.hospitals = hospitals
        self.districts = districts
        self.upazilas = upazilas
        self.areas = areas
        self.drugs = drugs

    def describe(self) -> dict[str, int]:
        return {
            "given_names": len(self.given),
            "surnames": len(self.surnames),
            "distinct_full_names": len(self.given) * len(self.surnames),
            "facilities": len(self.hospitals),
            "districts": len(self.districts),
            "upazilas": len(self.upazilas),
            "city_areas": len(self.areas),
            "drug_hard_negatives": len(self.drugs),
        }


def _split(items: list, fraction: float, rng: random.Random) -> tuple[list, list]:
    shuffled = list(items)
    rng.shuffle(shuffled)
    cut = max(1, int(len(shuffled) * (1.0 - fraction)))
    return shuffled[:cut], shuffled[cut:]


def build_pools(seed: int) -> tuple[Pools, Pools]:
    rng = random.Random(seed ^ 0x5F5F)
    drugs = F.hard_negative_drugs()
    given_a, given_b = _split(F.GIVEN_NAMES, DEV_FRACTION * 2, rng)
    sur_a, sur_b = _split(F.SURNAMES, DEV_FRACTION * 2, rng)
    hosp_a, hosp_b = _split(F.hospital_pairs(), DEV_FRACTION, rng)
    dist_a, dist_b = _split(F.DISTRICTS, DEV_FRACTION, rng)
    upa_a, upa_b = _split(F.UPAZILAS, DEV_FRACTION, rng)
    area_a, area_b = _split(F.CITY_AREAS, DEV_FRACTION, rng)
    drug_a, drug_b = _split(drugs, DEV_FRACTION, rng)
    train = Pools(given_a, sur_a, hosp_a, dist_a, upa_a, area_a, drug_a)
    dev = Pools(given_b, sur_b, hosp_b, dist_b, upa_b, area_b, drug_b)
    return train, dev


# ---------------------------------------------------------------------------
# Slot realisation
# ---------------------------------------------------------------------------
# Each filler returns (surface, tagged_subranges). Subranges are offsets *within* the
# surface, which lets a slot emit text that is only partly identifying — the DOCTOR slot
# is the reason this exists.

Filled = tuple[str, list[tuple[int, int]]]


def _person(rng: random.Random, pool: Pools, script: str) -> str:
    given = rng.choice(pool.given)
    if not pool.surnames or rng.randrange(8) == 0:
        parts = [given]
    else:
        parts = [given, rng.choice(pool.surnames)]
    out = []
    for bengali, latin, variant in parts:
        if script == "bn":
            out.append(bengali)
        elif script == "rom" and variant and rng.randrange(2):
            out.append(variant)
        else:
            out.append(latin)
    return " ".join(out)


def fill_name(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = _person(rng, pool, script)
    return surface, [(0, len(surface))]


def fill_doctor(rng: random.Random, pool: Pools, script: str) -> Filled:
    """Honorific plus name, with only the name tagged.

    The title is not identifying and carries clinical meaning — a note that reads
    "[redacted] advised surgery" has lost who was speaking in the role sense. Tagging the
    name alone matches what the deployed redactor already does with its honorific rule,
    so the two systems agree on span boundaries and the union does not double-redact.
    """
    honorific = rng.choice(F.HONORIFICS_BN if script == "bn" else F.HONORIFICS_EN)
    name = _person(rng, pool, script)
    surface = f"{honorific} {name}"
    start = len(honorific) + 1
    return surface, [(start, start + len(name))]


def fill_address(rng: random.Random, pool: Pools, script: str) -> Filled:
    bengali = script == "bn"
    pieces: list[str] = []
    shape = rng.randrange(5)
    if shape in (0, 1):
        house_bn, house_en = rng.choice(F.HOUSE_WORD)
        road_bn, road_en = rng.choice(F.ROAD_WORD)
        house_no = str(rng.randrange(1, 120))
        road_no = str(rng.randrange(1, 30))
        if bengali:
            house_no, road_no = F.to_bengali_digits(house_no), F.to_bengali_digits(road_no)
            pieces += [f"{house_bn} {house_no}", f"{road_bn} {road_no}"]
        else:
            pieces += [f"{house_en} {house_no}", f"{road_en} {road_no}"]
        area = rng.choice(pool.areas)
        pieces.append(area[0] if bengali else area[1])
    elif shape == 2:
        village = rng.choice(pool.upazilas)
        pieces.append(
            f"{F.VILLAGE_WORD[0]} {village[0]}" if bengali else f"{F.VILLAGE_WORD[1]} {village[1]}"
        )
    else:
        upazila = rng.choice(pool.upazilas)
        pieces.append(upazila[0] if bengali else upazila[1])
    district = rng.choice(pool.districts)
    pieces.append(district[0] if bengali else district[1])
    surface = ", ".join(pieces)
    return surface, [(0, len(surface))]


def fill_hospital(rng: random.Random, pool: Pools, script: str) -> Filled:
    bengali, latin = rng.choice(pool.hospitals)
    surface = bengali if script == "bn" else latin
    return surface, [(0, len(surface))]


def fill_phone(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = F.phone(rng)
    return surface, [(0, len(surface))]


def fill_nid(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = F.national_id(rng)
    return surface, [(0, len(surface))]


def fill_mrn(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = F.mrn(rng)
    return surface, [(0, len(surface))]


def fill_email(rng: random.Random, pool: Pools, script: str) -> Filled:
    # The handle is derived from a Latin name even in Bengali sentences, because that is
    # what real addresses look like — nobody registers a Bengali-script mailbox local part.
    given = rng.choice(pool.given)
    surname = rng.choice(pool.surnames) if pool.surnames else given
    surface = F.email(rng, f"{given[1]} {surname[1]}")
    return surface, [(0, len(surface))]


def fill_date(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = F.date(rng, bengali=script == "bn")
    return surface, [(0, len(surface))]


def fill_age(rng: random.Random, pool: Pools, script: str) -> Filled:
    surface = F.identifying_age(rng, bengali=script == "bn")
    return surface, [(0, len(surface))]


TAGGED_FILLERS = {
    "NAME": fill_name,
    "DOCTOR": fill_doctor,
    "ADDRESS": fill_address,
    "HOSPITAL": fill_hospital,
    "PHONE": fill_phone,
    "NID": fill_nid,
    "MRN": fill_mrn,
    "EMAIL": fill_email,
    "DATE": fill_date,
    "AGE": fill_age,
}


def fill_untagged(slot: str, rng: random.Random, pool: Pools, script: str) -> str:
    if slot == "drug":
        return rng.choice(pool.drugs)
    if slot == "age_ordinary":
        return F.ordinary_age(rng, bengali=script == "bn")
    if slot == "dept":
        return rng.choice(T_DEPTS[script])
    if slot == "symptom":
        return rng.choice(T_SYMPTOMS[script])
    if slot == "advice":
        return rng.choice(T_ADVICE[script])
    if slot == "lookalike":
        return rng.choice(T_LOOKALIKES[script])
    raise KeyError(f"unknown slot {{{slot}}} in a frame — add a filler or fix the template")


T_SYMPTOMS = {"bn": T.SYMPTOMS_BN, "en": T.SYMPTOMS_EN, "rom": T.SYMPTOMS_ROM}
T_ADVICE = {"bn": T.ADVICE_BN, "en": T.ADVICE_EN, "rom": T.ADVICE_ROM}
T_DEPTS = {"bn": F.DEPARTMENTS_BN, "en": F.DEPARTMENTS_EN, "rom": F.DEPARTMENTS_EN}
T_LOOKALIKES = {
    "bn": F.CLINICAL_LOOKALIKES_BN,
    "en": F.CLINICAL_LOOKALIKES_EN,
    "rom": F.CLINICAL_LOOKALIKES_EN,
}


# ---------------------------------------------------------------------------
# Sentence assembly
# ---------------------------------------------------------------------------


def render(frame: str, script: str, rng: random.Random, pool: Pools) -> tuple[str, list[dict]]:
    out: list[str] = []
    spans: list[dict] = []
    cursor = 0
    position = 0
    for match in SLOT_RE.finditer(frame):
        literal = frame[position:match.start()]
        out.append(literal)
        cursor += len(literal)
        slot = match.group(1)
        if slot in TAGGED_FILLERS:
            surface, subranges = TAGGED_FILLERS[slot](rng, pool, script)
            for sub_start, sub_end in subranges:
                spans.append({
                    "start": cursor + sub_start,
                    "end": cursor + sub_end,
                    "label": slot,
                    "text": surface[sub_start:sub_end],
                })
        else:
            surface = fill_untagged(slot, rng, pool, script)
        out.append(surface)
        cursor += len(surface)
        position = match.end()
    tail = frame[position:]
    out.append(tail)
    text = "".join(out)
    for span in spans:
        # The offsets are the gold standard; if assembly ever drifts the corpus is wrong
        # in a way no downstream metric would reveal, so it is checked here every time.
        assert text[span["start"]:span["end"]] == span["text"], (
            f"offset drift in frame {frame!r}: {span}"
        )
    return text, spans


def bio_view(text: str, spans: list[dict]) -> tuple[list[str], list[str]]:
    """Whitespace-token BIO, derived from the char offsets for human review only.

    Training does not read this: a subword tokeniser realigns from the offsets directly.
    A token that merely overlaps a span is labelled, so a span that splits a token is
    visible as an over-wide tag rather than silently dropped.
    """
    tokens: list[str] = []
    tags: list[str] = []
    for match in re.finditer(r"\S+", text):
        start, end = match.start(), match.end()
        tokens.append(match.group(0))
        hit = next((s for s in spans if s["start"] < end and start < s["end"]), None)
        if hit is None:
            tags.append("O")
        else:
            tags.append(("B-" if start <= hit["start"] else "I-") + hit["label"])
    return tokens, tags


def load_holdout_strings() -> set[str]:
    values: set[str] = set()
    for path in HOLDOUT_SETS:
        if not path.exists():
            raise FileNotFoundError(
                f"Holdout set not found at {path}. Generating without the exclusion check "
                "would produce a corpus that cannot be shown disjoint from the test sets. "
                "Rebuild it with tests/benchmarks/generate_phi_holdout.py."
            )
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            case = json.loads(line)
            for value in case.get("must_not_contain", []) + case.get("known_identifiers", []):
                cleaned = str(value).strip()
                if len(cleaned) >= 4:
                    values.add(cleaned.casefold())
            values.add(str(case.get("text", "")).strip().casefold())
    values.discard("")
    return values


def generate(
    size: int, seed: int, pool: Pools, holdout: set[str], split: str
) -> tuple[list[dict], dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    rejected = 0
    clean_target = int(size * 0.2)
    index = 0
    while len(rows) < size:
        index += 1
        want_clean = len(rows) < clean_target
        frames = T.CLEAN_FRAMES if want_clean else T.PHI_FRAMES
        frame_index = rng.randrange(len(frames))
        script = rng.choice(("bn", "en", "rom"))
        text, spans = render(frames[frame_index][script], script, rng, pool)
        folded = text.casefold()
        if any(value in folded for value in holdout):
            # A sentence that happens to contain a holdout identifier would train the
            # model on a test answer. Drop it rather than keep it and caveat later.
            rejected += 1
            continue
        tokens, tags = bio_view(text, spans)
        rows.append({
            "id": f"PHI-{split.upper()}-{len(rows) + 1:06d}",
            "split": split,
            "script": script,
            "frame": "clean" if want_clean else "phi",
            "frame_index": frame_index,
            "text": text,
            "spans": spans,
            "phi_count": len(spans),
            "tokens": tokens,
            "bio": tags,
        })
    stats = {
        "rows": len(rows),
        "rejected_for_holdout_overlap": rejected,
        "by_script": _count(rows, lambda r: r["script"]),
        "by_frame_kind": _count(rows, lambda r: r["frame"]),
        "by_tag": _tag_counts(rows),
        "phi_density": _count(rows, lambda r: str(min(r["phi_count"], 5))),
        "zero_phi_rows": sum(1 for r in rows if not r["spans"]),
    }
    return rows, stats


def _count(rows: list[dict], key) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        counts[key(row)] = counts.get(key(row), 0) + 1
    return dict(sorted(counts.items()))


def _tag_counts(rows: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        for span in row["spans"]:
            counts[span["label"]] = counts.get(span["label"], 0) + 1
    return dict(sorted(counts.items()))


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )


def write_conll(path: Path, rows: list[dict]) -> None:
    blocks = []
    for row in rows:
        lines = [f"# id = {row['id']}\tscript = {row['script']}"]
        lines += [f"{token}\t{tag}" for token, tag in zip(row["tokens"], row["bio"])]
        blocks.append("\n".join(lines))
    path.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE,
                        help=f"total sentences across train+dev (default {DEFAULT_SIZE})")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    parser.add_argument("--emit-conll", action="store_true",
                        help="also write a whitespace-token CoNLL view for human review")
    parser.add_argument("--sample", type=int, default=300,
                        help="rows written to the committed review sample (default 300)")
    args = parser.parse_args(argv)

    if not 2000 <= args.size <= 40000:
        parser.error("--size outside the range this generator is calibrated for (2000-40000)")

    holdout = load_holdout_strings()
    train_pool, dev_pool = build_pools(args.seed)
    dev_size = max(200, int(args.size * DEV_FRACTION))
    train_size = args.size - dev_size

    train_rows, train_stats = generate(train_size, args.seed, train_pool, holdout, "train")
    dev_rows, dev_stats = generate(dev_size, args.seed + 1, dev_pool, holdout, "dev")

    write_jsonl(args.out / "phi_corpus_train.jsonl", train_rows)
    write_jsonl(args.out / "phi_corpus_dev.jsonl", dev_rows)
    # The full corpus is a multi-megabyte build artifact and is not committed; the seed
    # plus this script reproduce it byte-for-byte. A deterministic head of it *is*
    # committed, so a reviewer can read what the generator actually emits without
    # running anything, and so a silent change in output shape shows up in a diff.
    write_jsonl(args.out / "phi_corpus_sample.jsonl", train_rows[:max(0, args.sample)])
    if args.emit_conll:
        write_conll(args.out / "phi_corpus_train.conll", train_rows)
        write_conll(args.out / "phi_corpus_dev.conll", dev_rows)

    manifest = {
        "generator": GENERATOR_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": args.seed,
        "labels": list(T.TAGGED_SLOTS),
        "scripts": ["bn", "en", "rom"],
        "frames": {"phi": len(T.PHI_FRAMES), "clean": len(T.CLEAN_FRAMES),
                   "realised_total": (len(T.PHI_FRAMES) + len(T.CLEAN_FRAMES)) * 3},
        "splits": {"train": train_stats, "dev": dev_stats},
        "pools": {
            "train": train_pool.describe(),
            "dev": dev_pool.describe(),
            "disjoint": True,
            "note": "Train and dev draw from split filler pools; a dev sentence never "
                    "reuses a training name, facility, district or drug.",
        },
        "geography_coverage": {
            "divisions": len(F.DIVISIONS),
            "districts": len(F.DISTRICTS),
            "upazilas": len(F.UPAZILAS),
            "upazila_note": F.UPAZILA_COVERAGE,
        },
        "holdout_exclusion": {
            "sources": [str(p.relative_to(ROOT)).replace("\\", "/") for p in HOLDOUT_SETS],
            "identifier_strings": len(holdout),
            "rejected_train": train_stats["rejected_for_holdout_overlap"],
            "rejected_dev": dev_stats["rejected_for_holdout_overlap"],
            "note": "Any sentence containing a holdout identifier is discarded at "
                    "generation time, so the 134-case test set cannot be trained on.",
        },
        "synthetic": True,
        "contains_real_patient_data": False,
    }
    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"train {train_stats['rows']}  dev {dev_stats['rows']}  "
          f"(rejected for holdout overlap: "
          f"{train_stats['rejected_for_holdout_overlap'] + dev_stats['rejected_for_holdout_overlap']})")
    print("tags:", json.dumps(train_stats["by_tag"], ensure_ascii=False))
    print("zero-PHI rows:", train_stats["zero_phi_rows"], "/", train_stats["rows"])
    print("written to", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
