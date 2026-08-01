#!/usr/bin/env python3
"""Check archive-candidate OCR/evidence files for values loaded from local env files."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tests/benchmarks/reports/current/generated_secret_audit.json"
ENV_FILES = (ROOT / ".env", ROOT / "backend/.env", ROOT / "ai_service/.env", ROOT / "frontend/.env")
SCAN_ROOTS = (
    ROOT / "tests/benchmarks/provider_cache",
    ROOT / "tests/benchmarks/cache",
    ROOT / "tests/benchmarks/prelabels",
    ROOT / "docs/softwarex/generated",
)


def secret_values(path: Path) -> set[bytes]:
    values: set[bytes] = set()
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        value = line.split("=", 1)[1].strip().strip('"').strip("'")
        lowered = value.casefold()
        if len(value) >= 12 and not any(marker in lowered for marker in ("placeholder", "example", "localhost", "your-")):
            values.add(value.encode())
    return values


def main() -> int:
    secrets = set().union(*(secret_values(path) for path in ENV_FILES))
    candidates = [path for root in SCAN_ROOTS if root.exists() for path in root.rglob("*") if path.is_file()]
    hits = []
    for path in candidates:
        payload = path.read_bytes()
        if any(value in payload for value in secrets):
            hits.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    report = {
        "schema_version": "1.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "passed": not hits,
        "local_secret_values_checked": len(secrets),
        "archive_candidate_files_scanned": len(candidates),
        "files_with_local_env_values": hits,
        "limitations": "Exact local environment values only; this does not replace provider-side secret scanning or human review of archive contents.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
