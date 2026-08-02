from __future__ import annotations

import importlib.util
import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path


def load_server_module():
    path = Path(__file__).resolve().parents[3] / "tools" / "ocr_annotation" / "server.py"
    spec = importlib.util.spec_from_file_location("ocr_annotation_server", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_manifest_and_independent_prelabel_blinding():
    module = load_server_module()
    server = ThreadingHTTPServer(("127.0.0.1", 0), module.AnnotationHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with urllib.request.urlopen(f"{base_url}/api/manifest", timeout=5) as response:
            manifest = json.load(response)
        assert manifest["counts"] == {"files": 105, "unique": 103, "development": 21, "test": 82}

        with urllib.request.urlopen(
            f"{base_url}/api/prelabel?record_id=RX-0012&role=primary",
            timeout=5,
        ) as response:
            assisted = json.load(response)["prelabel"]
        assert assisted["candidate_outputs"]["gpt_vision"]["review_state"] == "ai_assisted_unreviewed"
        assert any(
            item.get("provider") == "gpt-5.6-codex-vision"
            for item in assisted["assisted_from"]
        )

        try:
            urllib.request.urlopen(
                f"{base_url}/api/prelabel?record_id=RX-0001&role=independent",
                timeout=5,
            )
        except urllib.error.HTTPError as error:
            assert error.code == 403
        else:
            raise AssertionError("independent reviewer received a model prelabel")
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()
