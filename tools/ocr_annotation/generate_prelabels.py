#!/usr/bin/env python3
"""Generate assisted drafts while preserving immutable provider responses."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AI_ROOT = ROOT / "ai_service"
sys.path.insert(0, str(AI_ROOT))

from dotenv import load_dotenv

load_dotenv(AI_ROOT / ".env", override=False)

MANIFEST = ROOT / "tests" / "benchmarks" / "datasets" / "ocr_corpus_manifest.json"
CACHE_ROOT = ROOT / "tests" / "benchmarks" / "provider_cache"
EVALUATION_CACHE_ROOT = ROOT / "tests" / "benchmarks" / "cache" / "ocr"
PRELABEL_ROOT = ROOT / "tests" / "benchmarks" / "prelabels"


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp") as stream:
        stream.write(rendered)
        temporary = Path(stream.name)
    os.replace(temporary, path)


def cache_key(provider: str, configuration: dict) -> str:
    payload = json.dumps({"provider": provider, "configuration": configuration}, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def serialize_lines(lines) -> list[dict]:
    return [line.model_dump(mode="json") for line in lines]


def annotation_medications(items: list[dict]) -> list[dict]:
    """Map runtime output into the annotation schema without calling it truth."""
    return [
        {
            "medicine": item.get("medicine") or item.get("name") or "",
            "strength": item.get("strength") or item.get("dosage") or "",
            "dose": item.get("dose") or "",
            "frequency": item.get("frequency") or "",
            "duration": item.get("duration") or "",
            "route": item.get("route") or "",
            "quantity": item.get("quantity") or "",
            "instructions": item.get("instructions") or "",
        }
        for item in items
    ]


@lru_cache(maxsize=1)
def current_pipeline():
    from app.pipeline import OCRPipeline

    return OCRPipeline()


def provider_configuration(provider: str) -> dict:
    from app.config import settings

    if provider == "paddle":
        return {
            "engine": "paddleocr",
            "package_version": "3.5.0",
            "detector": "PP-OCRv4_mobile_det",
            "recognizer": "en_PP-OCRv4_mobile_rec",
            "inference_engine": "paddle_static",
            "device": "cpu",
            "mkldnn": False,
            "mode": "full_image",
        }
    if provider == "azure":
        return {
            "engine": "azure_document_intelligence",
            "model": settings.AZURE_OCR_MODEL_ID,
            "api_version": settings.AZURE_OCR_API_VERSION,
            "mode": "full_image",
        }
    if provider == "pipeline":
        return {
            "engine": "medora_pipeline",
            "model_type": settings.MODEL_TYPE,
            "azure_model": settings.AZURE_OCR_MODEL_ID,
            "detector_weights_sha256": file_hash_if_present(Path(settings.YOLO_MODEL_PATH)),
        }
    raise ValueError(f"Unknown provider: {provider}")


def write_evaluation_cache(*, provider_key: str, record: dict, output: dict, configuration: dict, runtime_ms: float) -> None:
    response = {
        "raw_text": output.get("raw_text", ""),
        "lines": output.get("lines") or (output.get("debug") or {}).get("ocr_lines", []),
    }
    response_hash = hashlib.sha256(
        json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    payload = {
        "schema_version": "1.0.0",
        "provider_key": provider_key,
        "source_sha256": record["sha256"],
        "record_id": record["id"],
        "configuration": configuration,
        "runtime_ms": runtime_ms,
        "failure": None,
        "response_sha256": response_hash,
        "response": response,
    }
    destination = EVALUATION_CACHE_ROOT / provider_key / f"{record['sha256']}.json"
    if destination.exists():
        existing = json.loads(destination.read_text(encoding="utf-8"))
        if existing.get("response_sha256") != response_hash:
            raise RuntimeError(f"immutable evaluation response differs: {destination}")
        return
    atomic_json(destination, payload)


def run_provider(provider: str, image_bytes: bytes) -> tuple[dict, dict]:
    from app.config import settings
    from app.parser import parse_prescription

    if provider == "paddle":
        from app.local_ocr import paddleocr_extract_lines
        lines = paddleocr_extract_lines(image_bytes)
        medications = parse_prescription(lines, [])
        configuration = provider_configuration(provider)
        output = {
            "raw_text": "\n".join(line.text for line in lines),
            "lines": serialize_lines(lines),
            "medications": [item.model_dump(mode="json") for item in medications],
        }
        return configuration, output

    if provider == "azure":
        from app.azure_ocr import AzureReadClient
        client = AzureReadClient()
        lines = client.read_lines(image_bytes)
        medications = parse_prescription(lines, [])
        configuration = provider_configuration(provider)
        output = {
            "raw_text": "\n".join(line.text for line in lines),
            "lines": serialize_lines(lines),
            "medications": [item.model_dump(mode="json") for item in medications],
        }
        return configuration, output

    if provider == "pipeline":
        response = current_pipeline().run(image_bytes, debug=True, processing_mode="cloud")
        configuration = provider_configuration(provider)
        output = response.model_dump(mode="json")
        return configuration, output

    raise ValueError(f"Unknown provider: {provider}")


def file_hash_if_present(path: Path) -> str | None:
    if not path.is_absolute():
        path = AI_ROOT / path
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--providers", default="paddle,azure,pipeline")
    parser.add_argument("--record", action="append", help="Opaque record ID; repeat to select multiple")
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--cache-only",
        action="store_true",
        help="Populate immutable provider/evaluation caches without writing draft labels",
    )
    args = parser.parse_args()
    providers = [item.strip() for item in args.providers.split(",") if item.strip()]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    records = [item for item in manifest["records"] if item["included_in_metrics"]]
    if args.record:
        selected = set(args.record)
        records = [item for item in records if item["id"] in selected]
    if args.limit:
        records = records[: args.limit]

    for record in records:
        image_bytes = (ROOT / record["file"]).read_bytes()
        if hashlib.sha256(image_bytes).hexdigest() != record["sha256"]:
            raise RuntimeError(f"Hash mismatch for {record['id']}")
        candidates: dict[str, dict] = {}
        for provider in providers:
            configuration = provider_configuration(provider)
            key = cache_key(provider, configuration)
            cache_path = CACHE_ROOT / record["sha256"] / f"{provider}-{key}.json"
            if cache_path.exists():
                cache_payload = json.loads(cache_path.read_text(encoding="utf-8"))
                if cache_payload["source_sha256"] != record["sha256"] or cache_payload["configuration"] != configuration:
                    raise RuntimeError(f"Immutable cache collision at {cache_path}")
                output = cache_payload["output"]
                runtime_ms = float(
                    cache_payload.get("runtime_ms")
                    or (output.get("meta") or {}).get("processing_time_ms")
                    or 0.0
                )
            else:
                started = time.perf_counter()
                actual_configuration, output = run_provider(provider, image_bytes)
                runtime_ms = (time.perf_counter() - started) * 1000
                if actual_configuration != configuration:
                    raise RuntimeError(f"Configuration drift for {provider}")
                cache_payload = {
                    "schema_version": "1.0.0",
                    "record_id": record["id"],
                    "source_sha256": record["sha256"],
                    "provider": provider,
                    "configuration": configuration,
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "runtime_ms": runtime_ms,
                    "output": output,
                }
                atomic_json(cache_path, cache_payload)
            candidates[provider] = cache_payload
            provider_key = {"paddle": "paddle_full", "azure": "azure_full", "pipeline": "azure_yolo"}[provider]
            write_evaluation_cache(
                provider_key=provider_key,
                record=record,
                output=output,
                configuration=configuration,
                runtime_ms=runtime_ms,
            )

        if args.cache_only:
            print(f"Cached {record['id']}: {', '.join(candidates)}")
            continue

        prelabel_path = PRELABEL_ROOT / f"{record['id']}.json"
        previous = json.loads(prelabel_path.read_text(encoding="utf-8")) if prelabel_path.exists() else {}
        candidate_outputs = dict(previous.get("candidate_outputs") or {})
        candidate_outputs.update({name: value["output"] for name, value in candidates.items()})
        preferred_output = candidate_outputs.get("pipeline") or candidate_outputs.get("azure") or candidate_outputs.get("paddle")
        if preferred_output is None:
            raise RuntimeError(f"No candidate output for {record['id']}")
        assisted_by_provider = {
            item["provider"]: item for item in previous.get("assisted_from", []) if item.get("provider")
        }
        assisted_by_provider.update(
            {
                name: {
                    "provider": name,
                    "cache_sha256": hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest(),
                }
                for name, value in candidates.items()
            }
        )
        prelabel = {
            "schema_version": "1.0.0",
            "record_id": record["id"],
            "source_sha256": record["sha256"],
            "raw_transcription": preferred_output.get("raw_text", ""),
            "boxes": [],
            "medications": annotation_medications(preferred_output.get("medications", [])),
            "language": "unreviewed",
            "script": "unreviewed",
            "writer_or_template_group": record["writer_or_template_group"],
            "image_quality": record["image_quality"],
            "flags": {"uncertain": True, "illegible": False},
            "omissions": "",
            "reviewer_notes": "Assisted draft; every value requires human verification.",
            "assisted_from": [assisted_by_provider[name] for name in sorted(assisted_by_provider)],
            "candidate_outputs": candidate_outputs,
            "adjudication": {"state": "not_started", "disagreement": "", "unresolved_fields": []},
        }
        atomic_json(prelabel_path, prelabel)
        print(f"Generated {record['id']}: {', '.join(candidates)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
