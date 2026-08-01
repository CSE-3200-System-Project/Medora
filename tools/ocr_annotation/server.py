#!/usr/bin/env python3
"""Loopback-only HTTP server for the Medora OCR annotation workspace."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
ANNOTATION_ROOT = ROOT / "tests" / "benchmarks" / "annotations"
PRELABEL_ROOT = ROOT / "tests" / "benchmarks" / "prelabels"
RECORD_PATTERN = re.compile(r"^RX-\d{4}$")
ROLES = {"primary", "independent", "adjudication"}
MAX_BODY = 2 * 1024 * 1024


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        raise RuntimeError("Run tests/benchmarks/generate_ocr_manifest.py first")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def record_map() -> dict[str, dict]:
    return {item["id"]: item for item in load_manifest()["records"]}


def annotation_path(record_id: str, role: str) -> Path:
    if not RECORD_PATTERN.fullmatch(record_id) or role not in ROLES:
        raise ValueError("Invalid record or reviewer role")
    return ANNOTATION_ROOT / record_id / f"{role}.json"


class AnnotationHandler(BaseHTTPRequestHandler):
    server_version = "MedoraAnnotation/1.0"

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def send_bytes(self, body: bytes, content_type: str, status: int = 200, *, cache: str = "no-store") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload: object, status: int = 200) -> None:
        self.send_bytes(json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", status)

    def send_file(self, path: Path, *, cache: str = "no-store") -> None:
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_bytes(path.read_bytes(), mime, cache=cache)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/api/manifest":
            self.send_json(load_manifest())
            return
        if parsed.path == "/api/annotation":
            self._get_annotation(query)
            return
        if parsed.path == "/api/prelabel":
            self._get_prelabel(query)
            return
        if parsed.path.startswith("/samples/"):
            self._get_sample(parsed.path)
            return
        if parsed.path in {"/", "/index.html"}:
            self.send_file(TOOL_DIR / "index.html")
            return
        if parsed.path in {"/app.js", "/styles.css"}:
            self.send_file(TOOL_DIR / parsed.path.lstrip("/"))
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/annotation":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY:
            self.send_json({"error": "Annotation body is missing or too large"}, 413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
            record_id = str(payload.get("record_id", ""))
            role = str(payload.get("reviewer", {}).get("role", ""))
            reviewer_id = str(payload.get("reviewer", {}).get("id", "")).strip()
            if record_id not in record_map() or role not in ROLES or not reviewer_id:
                raise ValueError("record_id, reviewer.id, and reviewer.role are required")
            if role == "independent" and payload.get("assisted_from"):
                raise ValueError("Independent annotations cannot reference assisted labels")
            destination = annotation_path(record_id, role)
            destination.parent.mkdir(parents=True, exist_ok=True)
            rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
            with tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", dir=destination.parent, delete=False, suffix=".tmp"
            ) as stream:
                stream.write(rendered)
                temporary = Path(stream.name)
            os.replace(temporary, destination)
            self.send_json({"saved": True, "path": str(destination.relative_to(ROOT))})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": str(exc)}, 422)

    def _get_annotation(self, query: dict[str, list[str]]) -> None:
        try:
            record_id = query.get("record_id", [""])[0]
            role = query.get("role", [""])[0]
            destination = annotation_path(record_id, role)
            payload = json.loads(destination.read_text(encoding="utf-8")) if destination.exists() else None
            response: dict[str, object] = {"annotation": payload}
            if role == "adjudication":
                response["primary"] = self._read_optional(annotation_path(record_id, "primary"))
                response["independent"] = self._read_optional(annotation_path(record_id, "independent"))
            self.send_json(response)
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": str(exc)}, 422)

    def _get_prelabel(self, query: dict[str, list[str]]) -> None:
        record_id = query.get("record_id", [""])[0]
        role = query.get("role", [""])[0]
        if role == "independent":
            self.send_json({"error": "Independent review is blinded to model output"}, 403)
            return
        if not RECORD_PATTERN.fullmatch(record_id):
            self.send_json({"error": "Invalid record"}, 422)
            return
        payload = self._read_optional(PRELABEL_ROOT / f"{record_id}.json")
        self.send_json({"prelabel": payload})

    def _get_sample(self, request_path: str) -> None:
        filename = Path(unquote(request_path.removeprefix("/samples/"))).name
        allowed = {Path(item["file"]).name for item in load_manifest()["records"]}
        if filename not in allowed:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_file(ROOT / "samples" / filename, cache="public, max-age=31536000, immutable")

    @staticmethod
    def _read_optional(path: Path) -> object | None:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    load_manifest()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), AnnotationHandler)
    print(f"Medora annotation workspace: http://127.0.0.1:{args.port}")
    print("Bound to loopback only. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
