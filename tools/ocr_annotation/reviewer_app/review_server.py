#!/usr/bin/env python3
"""Standalone loopback annotation server for the blinded independent reviewer.

Ships inside the reviewer package. Standard library only, so it runs on any
Python 3.9+ without installing anything.

Design constraints that matter:

* Loopback only. Prescription images are identifiable medical material and never
  leave the reviewer's machine.
* The package contains no model output, no primary-author labels, and no
  difficulty or split metadata, so blinding cannot be broken by reading files.
* Images are named by record identifier, so a filename cannot reveal a stratum.
* Saves are atomic and resumable. Closing the browser loses nothing.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import tempfile
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE = Path(__file__).resolve().parent
IMAGES = BASE / "images"
WEB = BASE / "web"
OUTPUT = BASE / "output"
MANIFEST_PATH = BASE / "manifest.json"
RECORD_PATTERN = re.compile(r"^RX-\d{4}$")
MAX_BODY = 4 * 1024 * 1024


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        raise SystemExit("manifest.json is missing; the package is incomplete.")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


class ReviewHandler(BaseHTTPRequestHandler):
    server_version = "MedoraRxReview/1.0"

    def log_message(self, format: str, *args: object) -> None:
        if "/api/" in str(args[0] if args else ""):
            print(f"[{self.log_date_time_string()}] {format % args}")

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

    def _file(self, path: Path, *, cache: str = "no-store") -> None:
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self._send(path.read_bytes(), mime, cache=cache)

    # ---------------- GET ----------------

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/api/manifest":
            self._json(load_manifest())
            return
        if parsed.path == "/api/progress":
            self._json({"completed": sorted(p.stem for p in OUTPUT.glob("RX-*.json"))})
            return
        if parsed.path == "/api/annotation":
            record_id = query.get("record_id", [""])[0]
            if not RECORD_PATTERN.fullmatch(record_id):
                self._json({"error": "invalid record"}, 422)
                return
            path = OUTPUT / f"{record_id}.json"
            self._json({"annotation": json.loads(path.read_text(encoding="utf-8")) if path.exists() else None})
            return
        if parsed.path == "/api/reviewer":
            path = OUTPUT / "reviewer.json"
            self._json({"reviewer": json.loads(path.read_text(encoding="utf-8")) if path.exists() else None})
            return
        if parsed.path == "/api/export":
            self._export()
            return
        if parsed.path.startswith("/images/"):
            name = Path(parsed.path.removeprefix("/images/")).name
            allowed = {item["image"] for item in load_manifest()["records"]}
            if name not in allowed:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self._file(IMAGES / name, cache="public, max-age=31536000, immutable")
            return
        if parsed.path in {"/", "/index.html"}:
            self._file(WEB / "index.html")
            return
        if parsed.path in {"/app.js", "/styles.css"}:
            self._file(WEB / parsed.path.lstrip("/"))
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    # ---------------- PUT ----------------

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            self._json({"error": "body missing or too large"}, 413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as exc:
            self._json({"error": str(exc)}, 422)
            return

        try:
            if parsed.path == "/api/reviewer":
                self._save_reviewer(payload)
                return
            if parsed.path == "/api/annotation":
                self._save_annotation(payload)
                return
        except ValueError as exc:
            self._json({"error": str(exc)}, 422)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _save_reviewer(self, payload: dict) -> None:
        for field in ("id", "full_name", "credential_role", "registration_number"):
            if not str(payload.get(field, "")).strip():
                raise ValueError(f"{field} is required")
        if payload["credential_role"] not in {"licensed_clinician", "licensed_pharmacist"}:
            raise ValueError("credential_role must be licensed_clinician or licensed_pharmacist")
        if not payload.get("attestation_accepted"):
            raise ValueError("the attestation must be accepted")
        payload["role"] = "independent"
        atomic_write(OUTPUT / "reviewer.json", payload)
        self._json({"saved": True})

    def _save_annotation(self, payload: dict) -> None:
        record_id = str(payload.get("record_id", ""))
        records = {item["id"]: item for item in load_manifest()["records"]}
        if record_id not in records:
            raise ValueError("unknown record")
        reviewer_path = OUTPUT / "reviewer.json"
        if not reviewer_path.exists():
            raise ValueError("reviewer details must be saved first")
        reviewer = json.loads(reviewer_path.read_text(encoding="utf-8"))

        # Stamped server-side so a saved label always carries the verified hash and
        # reviewer identity rather than whatever the page happened to post.
        payload["source_sha256"] = records[record_id]["source_sha256"]
        payload["reviewer"] = reviewer
        payload["schema_version"] = "1.0.0"
        payload.pop("assisted_from", None)
        atomic_write(OUTPUT / f"{record_id}.json", payload)
        self._json({"saved": True, "completed": len(list(OUTPUT.glob("RX-*.json")))})

    def _export(self) -> None:
        reviewer_path = OUTPUT / "reviewer.json"
        if not reviewer_path.exists():
            self._json({"error": "reviewer details are not saved"}, 422)
            return
        records = load_manifest()["records"]
        annotations = []
        for item in records:
            path = OUTPUT / f"{item['id']}.json"
            if path.exists():
                annotations.append(json.loads(path.read_text(encoding="utf-8")))
        bundle = {
            "schema_version": "1.0.0",
            "package_id": load_manifest().get("package_id"),
            "reviewer": json.loads(reviewer_path.read_text(encoding="utf-8")),
            "expected_records": len(records),
            "submitted_records": len(annotations),
            "complete": len(annotations) == len(records),
            "annotations": annotations,
        }
        body = json.dumps(bundle, ensure_ascii=False, indent=2).encode("utf-8")
        filename = f"medora-independent-review-{bundle['reviewer']['id']}.json"
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def atomic_write(destination: Path, payload: object) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent, delete=False, suffix=".tmp") as stream:
        stream.write(rendered)
        stream.flush()
        os.fsync(stream.fileno())
        temporary = Path(stream.name)
    os.replace(temporary, destination)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8777)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    manifest = load_manifest()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    url = f"http://127.0.0.1:{args.port}"

    print("=" * 66)
    print("  Medora prescription Rx review")
    print("=" * 66)
    print(f"  Records to review : {len(manifest['records'])}")
    print(f"  Saved so far      : {len(list(OUTPUT.glob('RX-*.json')))}")
    print(f"  Open in a browser : {url}")
    print("  Images stay on this computer. Nothing is uploaded.")
    print("  Leave this window open while you work. Press Ctrl+C when finished.")
    print("=" * 66)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ReviewHandler)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:  # pragma: no cover - best effort only
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped. Your work is saved in the output folder.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
