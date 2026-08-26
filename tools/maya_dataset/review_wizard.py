from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, TextIO


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "maya_navigation_sft_v1"
DEFAULT_DRAFT = DATA_DIR / "draft_combined.jsonl"
DEFAULT_TEMPLATE = DATA_DIR / "clinical_review.csv"
DEFAULT_REVIEWS = DATA_DIR / "clinical_review_working.csv"
DECISIONS = {"a": "approve", "v": "revise", "r": "reject"}
ROLE_FIELDS = {
    "reviewer1": ("reviewer_1_id", "reviewer_1_decision", "reviewer_1_notes"),
    "reviewer2": ("reviewer_2_id", "reviewer_2_decision", "reviewer_2_notes"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Interactive, resumable clinical review for the Maya synthetic SFT corpus."
    )
    parser.add_argument("--draft", type=Path, default=DEFAULT_DRAFT)
    parser.add_argument("--reviews", type=Path, default=DEFAULT_REVIEWS)
    parser.add_argument(
        "--role",
        choices=("reviewer1", "reviewer2", "adjudicator", "progress"),
        help="Skip the role menu.",
    )
    parser.add_argument("--reviewer-id", help="Stable internal reviewer code; never a patient name.")
    parser.add_argument("--case-id", help="Review or edit one exact case ID.")
    parser.add_argument("--no-backup", action="store_true", help="Do not create a session-start backup.")
    return parser.parse_args()


def configure_utf8_console() -> None:
    if os.name == "nt":
        # PowerShell's legacy console can start on an OEM code page. This changes
        # only the attached console; it does not modify files or global settings.
        os.system("chcp 65001 > nul")
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (AttributeError, OSError):
                pass


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def load_review_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"Review CSV has no header: {path}")
        return list(reader.fieldnames), list(reader)


def atomic_write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


class ReviewStore:
    def __init__(
        self,
        draft_path: Path,
        reviews_path: Path,
        template_path: Path = DEFAULT_TEMPLATE,
    ) -> None:
        self.draft_path = draft_path.resolve()
        self.reviews_path = reviews_path.resolve()
        self.template_path = template_path.resolve()
        self.draft_rows = read_jsonl(self.draft_path)
        self.draft_by_id = {row["id"]: row for row in self.draft_rows}
        if len(self.draft_by_id) != len(self.draft_rows):
            raise ValueError("Draft IDs must be unique")
        if not self.reviews_path.exists():
            self.reviews_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.template_path, self.reviews_path)
        self.fieldnames, self.review_rows = load_review_rows(self.reviews_path)
        self.review_by_id = {row["id"].strip(): row for row in self.review_rows}
        if len(self.review_by_id) != len(self.review_rows):
            raise ValueError("Review CSV IDs must be non-empty and unique")
        if set(self.review_by_id) != set(self.draft_by_id):
            missing = sorted(set(self.draft_by_id) - set(self.review_by_id))
            extra = sorted(set(self.review_by_id) - set(self.draft_by_id))
            raise ValueError(f"Review CSV does not match draft; missing={missing}, extra={extra}")

    def save(self) -> None:
        atomic_write_csv(self.reviews_path, self.fieldnames, self.review_rows)

    def backup(self) -> Path | None:
        has_work = any(
            row.get("reviewer_1_decision", "").strip()
            or row.get("reviewer_2_decision", "").strip()
            or row.get("final_decision", "").strip()
            for row in self.review_rows
        )
        if not has_work:
            return None
        backup_dir = self.reviews_path.parent / "review_backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        destination = backup_dir / f"{self.reviews_path.stem}.{stamp}.csv"
        counter = 1
        while destination.exists():
            destination = backup_dir / f"{self.reviews_path.stem}.{stamp}.{counter}.csv"
            counter += 1
        shutil.copy2(self.reviews_path, destination)
        return destination

    def ordered_pairs(self) -> list[tuple[dict, dict[str, str]]]:
        return [(row, self.review_by_id[row["id"]]) for row in self.draft_rows]


def _line(output: TextIO, character: str = "-") -> None:
    width = min(max(shutil.get_terminal_size((88, 24)).columns, 60), 110)
    print(character * width, file=output)


def _ask_choice(
    prompt: str,
    allowed: set[str],
    input_fn: Callable[[str], str],
    output: TextIO,
) -> str:
    while True:
        value = input_fn(prompt).strip().casefold()
        if value in allowed:
            return value
        print(f"Please enter one of: {', '.join(sorted(allowed))}", file=output)


def _ask_required(prompt: str, input_fn: Callable[[str], str], output: TextIO) -> str:
    while True:
        value = input_fn(prompt).strip()
        if value:
            return value
        print("This value is required.", file=output)


def _ask_reviewer_id(input_fn: Callable[[str], str], output: TextIO) -> str:
    while True:
        reviewer_id = _ask_required(
            "Enter your stable reviewer code (not a patient name): ", input_fn, output
        )
        try:
            return _validate_reviewer_id(reviewer_id)
        except ValueError as exc:
            print(f"Invalid reviewer code: {exc}", file=output)


def _validate_reviewer_id(reviewer_id: str) -> str:
    reviewer_id = reviewer_id.strip()
    if not reviewer_id or any(character in reviewer_id for character in "|\r\n"):
        raise ValueError("Reviewer ID must be non-empty and cannot contain | or a newline")
    if len(reviewer_id) < 2 or not any(character.isalpha() for character in reviewer_id):
        raise ValueError("Reviewer ID must include letters (for example clinician-a), not only a number")
    return reviewer_id


def revision_matches_script(language: str, response: str) -> bool:
    has_bengali = re.search(r"[\u0980-\u09ff]", response) is not None
    has_latin = re.search(r"[A-Za-z]", response) is not None
    if language == "bn":
        return has_bengali
    if language in {"banglish", "en"}:
        return has_latin and not has_bengali
    return bool(response.strip())


def _ask_revision(
    language: str,
    input_fn: Callable[[str], str],
    output: TextIO,
) -> str:
    while True:
        response = _ask_required(f"Final revised response ({language}): ", input_fn, output)
        if revision_matches_script(language, response):
            return response
        print(f"The revised response does not match the required {language} script.", file=output)


def _protect_role_identity(store: ReviewStore, role: str, reviewer_id: str) -> None:
    id_field, _, _ = ROLE_FIELDS[role]
    existing = {row.get(id_field, "").strip() for row in store.review_rows if row.get(id_field, "").strip()}
    if existing and existing != {reviewer_id}:
        raise ValueError(
            f"{role} already belongs to {sorted(existing)}. Use that reviewer ID or a separate CSV copy."
        )


def _display_case(
    draft: dict,
    review: dict[str, str],
    index: int,
    total: int,
    output: TextIO,
    *,
    show_final: bool = False,
) -> None:
    _line(output, "=")
    print(
        f"Case {index}/{total}  |  {draft['id']}  |  {draft['split']}  |  "
        f"{draft['language']}  |  {draft['topic']}",
        file=output,
    )
    _line(output)
    print("USER PROMPT", file=output)
    print(draft["messages"][0]["content"], file=output)
    print("\nPROPOSED ASSISTANT RESPONSE", file=output)
    print(draft["messages"][1]["content"], file=output)
    if show_final and review.get("final_decision", "").strip():
        print(f"\nCurrent final decision: {review['final_decision']}", file=output)


def primary_pending(store: ReviewStore, role: str, case_id: str | None = None) -> list[tuple[dict, dict[str, str]]]:
    _, decision_field, _ = ROLE_FIELDS[role]
    pairs = store.ordered_pairs()
    if case_id:
        pairs = [pair for pair in pairs if pair[0]["id"] == case_id]
        if not pairs:
            raise ValueError(f"Unknown case ID: {case_id}")
        return pairs
    return [pair for pair in pairs if not pair[1].get(decision_field, "").strip()]


def run_primary_review(
    store: ReviewStore,
    role: str,
    reviewer_id: str,
    case_id: str | None = None,
    input_fn: Callable[[str], str] = input,
    output: TextIO = sys.stdout,
) -> int:
    reviewer_id = _validate_reviewer_id(reviewer_id)
    _protect_role_identity(store, role, reviewer_id)
    id_field, decision_field, notes_field = ROLE_FIELDS[role]
    targets = primary_pending(store, role, case_id)
    if not targets:
        print(f"No pending cases for {role}.", file=output)
        return 0

    print(
        "Notes may be in English or Bangla. Review independently: the other reviewer's decision "
        "is intentionally hidden.",
        file=output,
    )
    saved = 0
    for index, (draft, review) in enumerate(targets, start=1):
        _display_case(draft, review, index, len(targets), output)
        current = review.get(decision_field, "").strip()
        if current:
            print(f"Current {role} decision: {current}", file=output)
        choice = _ask_choice(
            "\n[a]pprove  re[v]ise  [r]eject  [s]kip  [q]uit: ",
            {"a", "v", "r", "s", "q"},
            input_fn,
            output,
        )
        if choice == "q":
            break
        if choice == "s":
            continue
        notes_prompt = "Optional review note (English or Bangla; Enter to leave blank): "
        if choice in {"v", "r"}:
            notes = _ask_required(
                "Required reason or requested change (English or Bangla): ", input_fn, output
            )
        else:
            notes = input_fn(notes_prompt).strip()
        review[id_field] = reviewer_id
        review[decision_field] = DECISIONS[choice]
        review[notes_field] = notes
        store.save()
        saved += 1
        print(f"Saved {draft['id']} immediately to {store.reviews_path}", file=output)
    return saved


def adjudication_pending(
    store: ReviewStore, case_id: str | None = None
) -> list[tuple[dict, dict[str, str]]]:
    eligible = []
    for draft, review in store.ordered_pairs():
        decision_1 = review.get("reviewer_1_decision", "").strip().casefold()
        decision_2 = review.get("reviewer_2_decision", "").strip().casefold()
        needs_adjudication = (
            decision_1 in {"approve", "revise", "reject"}
            and decision_2 in {"approve", "revise", "reject"}
            and (decision_1 != "approve" or decision_2 != "approve")
        )
        if needs_adjudication and (case_id or not review.get("final_decision", "").strip()):
            eligible.append((draft, review))
    if case_id:
        eligible = [pair for pair in eligible if pair[0]["id"] == case_id]
        if not eligible:
            raise ValueError(f"Case {case_id} is unknown, incomplete, or does not need adjudication")
    return eligible


def run_adjudication(
    store: ReviewStore,
    adjudicator_id: str,
    case_id: str | None = None,
    input_fn: Callable[[str], str] = input,
    output: TextIO = sys.stdout,
) -> int:
    adjudicator_id = _validate_reviewer_id(adjudicator_id)
    targets = adjudication_pending(store, case_id)
    if not targets:
        print("No cases are ready for adjudication.", file=output)
        return 0
    saved = 0
    for index, (draft, review) in enumerate(targets, start=1):
        reviewers = {review["reviewer_1_id"].strip(), review["reviewer_2_id"].strip()}
        if adjudicator_id in reviewers:
            raise ValueError(f"{draft['id']}: adjudicator must be independent of both reviewers")
        _display_case(draft, review, index, len(targets), output, show_final=True)
        print("\nBLINDED REVIEW RESULTS ARE NOW UNMASKED FOR ADJUDICATION", file=output)
        print(
            f"Reviewer 1: {review['reviewer_1_decision']} | {review['reviewer_1_notes'] or '(no note)'}",
            file=output,
        )
        print(
            f"Reviewer 2: {review['reviewer_2_decision']} | {review['reviewer_2_notes'] or '(no note)'}",
            file=output,
        )
        print(
            f"A revised response must be written in the prompt language: {draft['language']}. "
            "Adjudicator notes may be English or Bangla.",
            file=output,
        )
        choice = _ask_choice(
            "[v] approve a revised response  [r]eject/not ready  [s]kip  [q]uit: ",
            {"v", "r", "s", "q"},
            input_fn,
            output,
        )
        if choice == "q":
            break
        if choice == "s":
            continue
        if choice == "v":
            review["revised_response"] = _ask_revision(draft["language"], input_fn, output)
            review["final_decision"] = "approve"
            review["final_notes"] = input_fn(
                "Optional adjudicator note (English or Bangla): "
            ).strip()
        else:
            review["final_decision"] = "reject"
            review["revised_response"] = ""
            review["final_notes"] = _ask_required(
                "Required reason the case is not training-ready: ", input_fn, output
            )
        review["adjudicator_id"] = adjudicator_id
        store.save()
        saved += 1
        print(f"Saved {draft['id']} immediately to {store.reviews_path}", file=output)
    return saved


def progress(store: ReviewStore) -> dict[str, int | bool]:
    total = len(store.review_rows)
    reviewer_1 = sum(bool(row.get("reviewer_1_decision", "").strip()) for row in store.review_rows)
    reviewer_2 = sum(bool(row.get("reviewer_2_decision", "").strip()) for row in store.review_rows)
    direct = 0
    needs_adjudication = 0
    adjudicated_approved = 0
    rejected = 0
    for row in store.review_rows:
        d1 = row.get("reviewer_1_decision", "").strip().casefold()
        d2 = row.get("reviewer_2_decision", "").strip().casefold()
        final = row.get("final_decision", "").strip().casefold()
        if d1 == d2 == "approve":
            direct += 1
        elif d1 and d2:
            needs_adjudication += 1
            if final == "approve" and row.get("revised_response", "").strip():
                adjudicated_approved += 1
            elif final == "reject":
                rejected += 1
    ready = reviewer_1 == total and reviewer_2 == total and direct + adjudicated_approved == total
    return {
        "total": total,
        "reviewer_1_complete": reviewer_1,
        "reviewer_2_complete": reviewer_2,
        "direct_approvals": direct,
        "needs_adjudication": needs_adjudication,
        "adjudicated_approved": adjudicated_approved,
        "final_rejections": rejected,
        "promotion_ready": ready,
    }


def print_progress(store: ReviewStore, output: TextIO = sys.stdout) -> dict[str, int | bool]:
    status = progress(store)
    _line(output, "=")
    print("Maya clinical-review progress", file=output)
    _line(output)
    print(
        f"Reviewer 1: {status['reviewer_1_complete']}/{status['total']} | "
        f"Reviewer 2: {status['reviewer_2_complete']}/{status['total']}",
        file=output,
    )
    print(
        f"Direct approvals: {status['direct_approvals']} | "
        f"Needs adjudication: {status['needs_adjudication']} | "
        f"Adjudicated approvals: {status['adjudicated_approved']} | "
        f"Final rejections: {status['final_rejections']}",
        file=output,
    )
    print(f"Promotion ready: {'YES' if status['promotion_ready'] else 'NO'}", file=output)
    print(f"Working CSV: {store.reviews_path}", file=output)
    return status


def choose_role(input_fn: Callable[[str], str], output: TextIO) -> str:
    _line(output, "=")
    print("Maya clinical-review wizard", file=output)
    print("Choose your role. The role number is not your reviewer code.", file=output)
    _line(output)
    print("1. Reviewer 1 (independent review)", file=output)
    print("2. Reviewer 2 (independent review)", file=output)
    print("3. Adjudicator", file=output)
    print("4. Show progress only", file=output)
    choice = _ask_choice("Choose 1, 2, 3, or 4: ", {"1", "2", "3", "4"}, input_fn, output)
    return {"1": "reviewer1", "2": "reviewer2", "3": "adjudicator", "4": "progress"}[choice]


def main() -> None:
    configure_utf8_console()
    args = parse_args()
    store = ReviewStore(args.draft, args.reviews)
    if not args.no_backup:
        backup = store.backup()
        if backup:
            print(f"Session backup: {backup}")
    role = args.role or choose_role(input, sys.stdout)
    if role != "progress" and not args.reviewer_id:
        print(
            f"You chose {role}. Your reviewer code is a stable code such as clinician-a; "
            "do not enter the role number.",
        )
    print_progress(store)
    if role == "progress":
        return
    reviewer_id = args.reviewer_id or _ask_reviewer_id(input, sys.stdout)
    if role in ROLE_FIELDS:
        saved = run_primary_review(store, role, reviewer_id, args.case_id)
    else:
        saved = run_adjudication(store, reviewer_id, args.case_id)
    print(f"\nSaved {saved} decision(s) this session.")
    status = print_progress(store)
    if status["promotion_ready"]:
        print("\nAll rows are ready. Run:")
        print(
            "backend/venv/Scripts/python.exe tools/maya_dataset/promote_clinical_review.py "
            f"--draft {args.draft} --reviews {args.reviews} "
            "--out data/maya_navigation_sft_v1/approved_combined.jsonl"
        )
    else:
        print("Re-run this wizard later; completed decisions will be skipped automatically.")


if __name__ == "__main__":
    main()
