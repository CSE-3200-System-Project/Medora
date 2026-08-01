#!/usr/bin/env python3
"""Run one release check and append tamper-evident evidence to verification.json."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "docs" / "softwarex" / "generated"
OUTPUT = GENERATED / "verification.json"
LOG_ROOT = GENERATED / "verification-logs"
CHECKS = {
    "backend", "ai_service", "integration", "security", "benchmarks",
    "playwright", "frontend_lint", "frontend_build", "clean_docker",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True, choices=sorted(CHECKS))
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command after --")
    args = parser.parse_args()
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise SystemExit("a command is required after --")

    GENERATED.mkdir(parents=True, exist_ok=True)
    LOG_ROOT.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    result = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    finished = datetime.now(timezone.utc)
    log_path = LOG_ROOT / f"{args.name}.log"
    log_path.write_text(result.stdout or "", encoding="utf-8")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()

    payload = {"schema_version": "1.0.0", "git_commit": commit, "checks": {}}
    if OUTPUT.exists():
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if payload.get("git_commit") != commit:
            payload = {"schema_version": "1.0.0", "git_commit": commit, "checks": {}}
    payload["checks"][args.name] = {
        "status": "passed" if result.returncode == 0 else "failed",
        "command": command,
        "exit_code": result.returncode,
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "duration_seconds": round((finished - started).total_seconds(), 3),
        "log": str(log_path.relative_to(ROOT)).replace("\\", "/"),
        "log_sha256": sha256(log_path),
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["checks"][args.name], indent=2))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
