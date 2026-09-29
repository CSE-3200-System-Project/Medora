#!/usr/bin/env python3
"""Render the SoftwareX safety and frozen booking reports without release metadata."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from build_release_artifacts import render_booking, render_safety


def read_report(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--safety", required=True, type=Path)
    parser.add_argument("--booking", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--privacy-extension", type=Path)
    parser.add_argument("--consent-scope", type=Path)
    args = parser.parse_args()

    safety = read_report(args.safety)
    booking = read_report(args.booking)
    if not safety.get("passed"):
        raise SystemExit("safety fixture run did not pass its release-audit assertions")
    if not booking.get("passed"):
        raise SystemExit("frozen booking report is not marked as passed")

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "safety_results.tex").write_text(render_safety(safety), encoding="utf-8")
    (args.output / "booking_results.tex").write_text(render_booking(booking), encoding="utf-8")
    if bool(args.privacy_extension) != bool(args.consent_scope):
        raise SystemExit("provide both extended component reports")
    if args.privacy_extension:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "softwarex"))
        from build_revision_evidence import render_consent, render_privacy
        (args.output / "extended_results.tex").write_text(
            render_privacy(read_report(args.privacy_extension)) + render_consent(read_report(args.consent_scope)),
            encoding="utf-8",
        )
    print(f"Rendered SoftwareX tables into {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
