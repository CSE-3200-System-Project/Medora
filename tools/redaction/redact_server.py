#!/usr/bin/env python3
"""Loopback tool for marking direct identifiers on the prescription corpus.

Why this is manual. The cached OCR responses stored text but discarded every
bounding box (`bbox: null` on all 4,462 lines), so there is no geometry to derive
redaction regions from without re-running a provider. More importantly, a redactor
that misses one name publishes a real person's identity permanently and
irrevocably. A human confirming every image is the appropriate cost.

Why identifier fields only. Redacting everything outside the Rx region would be
faster, but it would flatten the very contrast the A-H ablation exists to measure:
full-image OCR baselines would face a nearly blank page and region detection would
show almost no benefit. Layout clutter is preserved on purpose.

Completeness is enforced rather than trusted: an image cannot be marked done until
every in-scope identifier category is either boxed or explicitly declared absent.

Scope. The authors' decision is to redact the patient's direct identifiers and any
photograph of the patient, and to publish prescriber and clinic fields. Those retained
fields are listed explicitly in every marks file rather than omitted, so the record
says "deliberately published" instead of implying "not present".
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import tempfile
import webbrowser
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
TOOL = Path(__file__).resolve().parent
WEB = TOOL / "web"
MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
MARKS = ROOT / "tests" / "benchmarks" / "redaction_marks"
RECORD_PATTERN = re.compile(r"^RX-\d{4}$")
MAX_BODY = 2 * 1024 * 1024

# Redaction scope, set by the authors on 2026-08-03: cover the patient's direct
# identifiers and any photograph of the patient; leave prescriber and clinic fields
# legible.
#
# Only REDACT_CATEGORIES must be resolved per image, either with a box or an explicit
# "not present" declaration. Silence is not treated as absence.
#
# OUT_OF_SCOPE_CATEGORIES are recorded rather than omitted. They are identifier fields
# that are frequently *present* in these images and are deliberately being published.
# Declaring them "absent" would put a false statement in a committed marks file, so the
# scope decision is written into every record instead.
REDACT_CATEGORIES = [
    "patient_name",
    "patient_id",
    "patient_contact",
    "patient_address",
    "patient_photo",
    "other_patient_identifier",
]

OUT_OF_SCOPE_CATEGORIES = [
    "doctor_name",
    "doctor_registration",
    "doctor_contact",
    "clinic_letterhead",
    "signature",
    "date",
]

SCOPE_POLICY = {
    "policy_id": "patient-identifiers-only-v1",
    "decided_on": "2026-08-03",
    "decided_by": "authors",
    "redacted": REDACT_CATEGORIES,
    "published_deliberately": OUT_OF_SCOPE_CATEGORIES,
    "rationale": (
        "The consent obtained covers the depicted patients, so their direct identifiers "
        "are destroyed before redistribution. Prescriber and clinic fields are retained "
        "because the A-H ablation measures OCR over a realistically cluttered page and "
        "because prescriber registration details are matters of public professional "
        "record. This is a scope decision, not an assertion that those fields are absent."
    ),
}

# Retained for payload validation: a box may only be drawn in a category being redacted.
CATEGORIES = REDACT_CATEGORIES


def load_records() -> list[dict]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return [
        {"id": item["id"], "file": item["file"], "source_sha256": item["sha256"]}
        for item in manifest["records"]
    ]


def atomic_write(destination: Path, payload: object) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent, delete=False, suffix=".tmp") as stream:
        stream.write(rendered)
        stream.flush()
        os.fsync(stream.fileno())
        temporary = Path(stream.name)
    os.replace(temporary, destination)


class RedactHandler(BaseHTTPRequestHandler):
    server_version = "MedoraRedact/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def _send(self, body: bytes, content_type: str, status: int = 200, *, cache: str = "no-store") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'",
        )
        self.end_headers()
        self.wfile.write(body)

    def _json(self, payload: object, status: int = 200) -> None:
        self._send(json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", status)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/api/records":
            self._json(
                {
                    "categories": REDACT_CATEGORIES,
                    "out_of_scope": OUT_OF_SCOPE_CATEGORIES,
                    "scope_policy": SCOPE_POLICY,
                    "records": load_records(),
                }
            )
            return
        if parsed.path == "/api/progress":
            done = sorted(p.stem for p in MARKS.glob("RX-*.json")) if MARKS.exists() else []
            self._json({"completed": done})
            return
        if parsed.path == "/api/marks":
            record_id = query.get("record_id", [""])[0]
            if not RECORD_PATTERN.fullmatch(record_id):
                self._json({"error": "invalid record"}, 422)
                return
            path = MARKS / f"{record_id}.json"
            self._json({"marks": json.loads(path.read_text(encoding="utf-8")) if path.exists() else None})
            return
        if parsed.path.startswith("/image/"):
            record_id = Path(parsed.path.removeprefix("/image/")).name
            records = {item["id"]: item for item in load_records()}
            if record_id not in records:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            source = ROOT / records[record_id]["file"]
            if not source.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            mime = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
            self._send(source.read_bytes(), mime, cache="public, max-age=3600")
            return
        if parsed.path in {"/", "/index.html"}:
            self._send((WEB / "index.html").read_bytes(), "text/html; charset=utf-8")
            return
        if parsed.path in {"/app.js", "/styles.css"}:
            mime = "text/javascript" if parsed.path.endswith(".js") else "text/css"
            self._send((WEB / parsed.path.lstrip("/")).read_bytes(), f"{mime}; charset=utf-8")
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/marks":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            self._json({"error": "body missing or too large"}, 413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
            record_id = str(payload.get("record_id", ""))
            records = {item["id"]: item for item in load_records()}
            if record_id not in records:
                raise ValueError("unknown record")

            boxes = payload.get("boxes") or []
            for box in boxes:
                for key in ("x", "y", "w", "h"):
                    value = float(box.get(key, -1))
                    if not 0.0 <= value <= 1.0:
                        raise ValueError(f"box {key} must be a normalized 0-1 value")
                if box.get("category") not in CATEGORIES:
                    raise ValueError(f"unknown category {box.get('category')!r}")

            absent = payload.get("categories_absent") or []
            unknown = [item for item in absent if item not in REDACT_CATEGORIES]
            if unknown:
                raise ValueError(f"unknown absent categories: {unknown}")

            covered = {box["category"] for box in boxes} | set(absent)
            missing = [item for item in REDACT_CATEGORIES if item not in covered]
            if missing:
                raise ValueError(
                    "every in-scope patient identifier category must be boxed or marked absent; missing: "
                    + ", ".join(missing)
                )

            payload["scope_policy"] = SCOPE_POLICY
            payload["source_sha256"] = records[record_id]["source_sha256"]
            payload["marked_at"] = datetime.now(timezone.utc).isoformat()
            payload["schema_version"] = "1.0.0"
            atomic_write(MARKS / f"{record_id}.json", payload)
            self._json({"saved": True, "completed": len(list(MARKS.glob("RX-*.json")))})
        except (ValueError, json.JSONDecodeError, TypeError) as exc:
            self._json({"error": str(exc)}, 422)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    records = load_records()
    MARKS.mkdir(parents=True, exist_ok=True)
    url = f"http://127.0.0.1:{args.port}"
    print("=" * 66)
    print("  Medora identifier redaction")
    print("=" * 66)
    print(f"  Images        : {len(records)}")
    print(f"  Already marked: {len(list(MARKS.glob('RX-*.json')))}")
    print(f"  Open          : {url}")
    print("  Mark identifier fields only. Leave the layout and the Rx section intact.")
    print("=" * 66)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), RedactHandler)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:  # pragma: no cover
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped. Marks are saved.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
