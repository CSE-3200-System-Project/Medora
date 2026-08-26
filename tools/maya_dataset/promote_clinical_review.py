from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path


ALLOWED_DECISIONS = {"approve", "revise", "reject"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Promote the Maya synthetic draft only after two independent clinical reviews."
    )
    parser.add_argument("--draft", type=Path, required=True)
    parser.add_argument("--reviews", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_reviews(path: Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    review_ids = [row.get("id", "").strip() for row in rows]
    if not review_ids or any(not review_id for review_id in review_ids):
        raise ValueError("Every clinical-review row needs an id")
    if len(set(review_ids)) != len(review_ids):
        raise ValueError("Clinical-review IDs must be unique")
    return dict(zip(review_ids, rows, strict=True))


def promote(draft_rows: list[dict], reviews: dict[str, dict[str, str]]) -> list[dict]:
    draft_ids = {row["id"] for row in draft_rows}
    if draft_ids != set(reviews):
        missing = sorted(draft_ids - set(reviews))
        extra = sorted(set(reviews) - draft_ids)
        raise ValueError(f"Review sheet must exactly match draft IDs; missing={missing}, extra={extra}")

    approved = []
    errors = []
    for row in draft_rows:
        review = reviews[row["id"]]
        reviewer_1 = review.get("reviewer_1_id", "").strip()
        reviewer_2 = review.get("reviewer_2_id", "").strip()
        decision_1 = review.get("reviewer_1_decision", "").strip().casefold()
        decision_2 = review.get("reviewer_2_decision", "").strip().casefold()
        if not reviewer_1 or not reviewer_2 or reviewer_1 == reviewer_2:
            errors.append(f"{row['id']}: two distinct reviewer IDs are required")
            continue
        if decision_1 not in ALLOWED_DECISIONS or decision_2 not in ALLOWED_DECISIONS:
            errors.append(f"{row['id']}: both decisions must be approve, revise, or reject")
            continue

        reviewer_ids = [reviewer_1, reviewer_2]
        answer = row["messages"][1]["content"].strip()
        if decision_1 != "approve" or decision_2 != "approve":
            adjudicator = review.get("adjudicator_id", "").strip()
            final_decision = review.get("final_decision", "").strip().casefold()
            revised = review.get("revised_response", "").strip()
            if not adjudicator or adjudicator in {reviewer_1, reviewer_2}:
                errors.append(f"{row['id']}: disagreement/revision needs an independent adjudicator")
                continue
            if final_decision != "approve" or not revised:
                errors.append(f"{row['id']}: adjudication must approve a non-empty revised response")
                continue
            reviewer_ids.append(adjudicator)
            answer = revised

        promoted = dict(row)
        promoted["messages"] = [dict(row["messages"][0]), {"role": "assistant", "content": answer}]
        promoted["review_status"] = "clinician_approved"
        promoted["reviewer_id"] = "|".join(reviewer_ids)
        promoted["clinical_review"] = {
            "reviewer_1_decision": decision_1,
            "reviewer_2_decision": decision_2,
            "adjudicated": len(reviewer_ids) == 3,
            "final_notes": review.get("final_notes", "").strip(),
        }
        approved.append(promoted)

    if errors:
        raise ValueError("Clinical promotion refused:\n" + "\n".join(errors[:100]))
    if len(approved) != len(draft_rows):
        raise ValueError("Every fixed draft row must pass review; partial promotion is forbidden")
    if sum(row["split"] == "train" for row in approved) < 100:
        raise ValueError("Approved training split has fewer than 100 rows")
    if sum(row["split"] == "validation" for row in approved) < 20:
        raise ValueError("Approved validation split has fewer than 20 rows")
    return approved


def main() -> None:
    args = parse_args()
    draft_rows = read_jsonl(args.draft)
    approved = promote(draft_rows, load_reviews(args.reviews))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.out.with_suffix(args.out.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        for row in approved:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(args.out)
    print(
        json.dumps(
            {
                "output": str(args.out),
                "rows": len(approved),
                "train": sum(row["split"] == "train" for row in approved),
                "validation": sum(row["split"] == "validation" for row in approved),
                "sha256": sha256(args.out),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
