#!/usr/bin/env python3
"""Record per-record provenance for the prescription corpus.

The corpus is mixed: part was collected directly from the authors, their families,
and consenting neighbours; part came from a publicly released research dataset. Those
two halves carry different consent bases and different redistribution rules, so the
manifest has to say which is which before it can be frozen.

Nothing here guesses. A record stays `unclassified` until a human assigns it.

Examples:
    # See what is still unclassified
    python tests/benchmarks/classify_corpus_provenance.py --status

    # Assign a range or an explicit list
    python tests/benchmarks/classify_corpus_provenance.py \\
        --set public_dataset --source-dataset "roboflow:<workspace>/<project> v<n>" \\
        --ids RX-0042..RX-0070

    python tests/benchmarks/classify_corpus_provenance.py \\
        --set directly_collected --ids RX-0001,RX-0002,RX-0003
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
CHOICES = ("directly_collected", "public_dataset")


def expand_ids(raw: str, known: set[str]) -> list[str]:
    """Accept `RX-0001,RX-0002` and `RX-0042..RX-0070` forms."""
    selected: list[str] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        if ".." in token:
            start, end = (part.strip() for part in token.split("..", 1))
            lo, hi = int(start.removeprefix("RX-")), int(end.removeprefix("RX-"))
            if lo > hi:
                raise SystemExit(f"range {token} is inverted")
            selected.extend(f"RX-{n:04d}" for n in range(lo, hi + 1))
        else:
            selected.append(token)
    unknown = [item for item in selected if item not in known]
    if unknown:
        raise SystemExit(f"unknown record ids: {', '.join(unknown[:10])}")
    return selected


def status(manifest: dict) -> int:
    counts = Counter(record["provenance"] for record in manifest["records"])
    datasets = Counter(
        record["source_dataset"] for record in manifest["records"] if record.get("source_dataset")
    )
    print(f"Corpus records: {len(manifest['records'])}")
    for name, count in sorted(counts.items()):
        print(f"  {name:20} {count}")
    if datasets:
        print("Source datasets:")
        for name, count in sorted(datasets.items()):
            print(f"  {name:40} {count}")
    unclassified = [r["id"] for r in manifest["records"] if not r.get("provenance_reviewed")]
    if unclassified:
        preview = ", ".join(unclassified[:10])
        print(f"\nStill unclassified ({len(unclassified)}): {preview}{'…' if len(unclassified) > 10 else ''}")
        print("The corpus cannot be frozen until every record is classified.")
        return 1
    print("\nEvery record is classified.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true", help="Report classification progress")
    parser.add_argument("--set", dest="value", choices=CHOICES, help="Provenance to assign")
    parser.add_argument("--ids", help="Record ids: comma list and/or RX-aaaa..RX-bbbb ranges")
    parser.add_argument(
        "--source-dataset",
        help="Required for public_dataset: the originating dataset and version, so its licence can be honoured",
    )
    parser.add_argument(
        "--consent-basis",
        choices=("verbal", "written"),
        help=(
            "Required for directly_collected. How consent was actually obtained. This is "
            "written into redistribution_basis verbatim; do not upgrade verbal to written."
        ),
    )
    parser.add_argument(
        "--dataset-licence",
        help="Required for public_dataset: the licence the originating dataset is released under",
    )
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("frozen"):
        raise SystemExit("manifest is frozen; provenance can no longer be edited")

    if args.status or not args.value:
        return status(manifest)

    if not args.ids:
        raise SystemExit("--ids is required with --set")
    if args.value == "public_dataset" and not args.source_dataset:
        raise SystemExit("--source-dataset is required for public_dataset so its licence can be recorded")
    if args.value == "public_dataset" and not args.dataset_licence:
        raise SystemExit("--dataset-licence is required for public_dataset")
    if args.value == "directly_collected" and not args.consent_basis:
        raise SystemExit(
            "--consent-basis is required for directly_collected. The manifest previously "
            "asserted 'written approval confirmed by authors' for every record, which was "
            "not accurate; the basis must now be stated explicitly."
        )

    if args.value == "directly_collected":
        basis = (
            f"{args.consent_basis} consent from the depicted individual for research use; "
            "patient direct identifiers destroyed by irreversible redaction before "
            "redistribution (scope: patient-identifiers-only-v1)"
        )
    else:
        basis = f"{args.source_dataset} redistributed under {args.dataset_licence}"

    by_id = {record["id"]: record for record in manifest["records"]}
    targets = expand_ids(args.ids, set(by_id))
    for record_id in targets:
        record = by_id[record_id]
        record["provenance"] = args.value
        record["provenance_reviewed"] = True
        record["source_dataset"] = args.source_dataset if args.value == "public_dataset" else None
        record["consent_basis"] = args.consent_basis if args.value == "directly_collected" else None
        record["redistribution_basis"] = basis

    if all(record.get("provenance_reviewed") for record in manifest["records"]):
        marker = "per-record provenance must be classified (directly_collected vs public_dataset)"
        manifest["freeze_blockers"] = [b for b in manifest.get("freeze_blockers", []) if b != marker]

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Classified {len(targets)} record(s) as {args.value}")
    return status(manifest)


if __name__ == "__main__":
    raise SystemExit(main())
