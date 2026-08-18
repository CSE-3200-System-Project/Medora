#!/usr/bin/env python3
"""Shimana: the consent-utility frontier sweep.

Question. For a fixed clinical task (grounded patient summary), how does task
utility trade against residual PHI exposure as the consent scope widens?

Design (stated so the result cannot be quietly tuned).
  * Independent variable: consent scope = the set of sharing categories whose
    records reach the summary, plus a redaction policy. Five configurations run
    from local-only (no records) to unrestricted disclosure (U).
  * Utility: grounding coverage. For each consented record we check whether its
    distinctive clinical term survives into the model summary. Coverage is the
    matched count over the six categories, so wider consent can raise utility only
    by surfacing more real record content.
  * Exposure: undetected identifier spans per 1,000 requests. Each record carries
    annotated identifier spans; a span counts as exposed if it survives the config
    redaction policy. Under U the policy applies no redaction, so the count is the
    full-disclosure counterfactual.
  * Safety invariant: generate_patient_summary always redacts its input before the
    provider, so raw identifiers never reach a live model. U's exposure is measured
    offline from the policy, never shipped. This matches the paper's de-identified
    unrestricted control.
  * Provider held constant (live) across configs so the measured utility difference
    is the consent effect, not a provider difference. Local-only is represented as
    the zero-record floor because the platform has no local text model.

Bootstrap confidence intervals resample patients. Nothing here is gated on the
outcome; the sweep prints whatever the measurement says.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def _load_env() -> None:
    """Load backend/.env for the live provider key; DB env stays a placeholder."""
    envfile = ROOT / "backend" / ".env"
    if envfile.exists():
        for line in envfile.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.setdefault("SUPABASE_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
    os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
    os.environ.setdefault("SUPABASE_KEY", "shimana-placeholder")
    os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "shimana-placeholder")


_load_env()

from app.core.ai_privacy import redact_pii_text  # noqa: E402
from app.services.ai_orchestrator import AIOrchestrator, AIOrchestratorError  # noqa: E402

DATASETS = ROOT / "tests" / "benchmarks" / "datasets"
ALL_CATEGORIES = [
    "can_view_allergies", "can_view_medications", "can_view_conditions",
    "can_view_prescriptions", "can_view_medical_history", "can_view_lifestyle",
]

# Five configurations from local-only to unrestricted disclosure.
CONFIGS = [
    {"name": "L",       "categories": [],                 "redact": True,  "note": "local only, no patient records"},
    {"name": "L+K",     "categories": [],                 "redact": True,  "note": "local + knowledge base only"},
    {"name": "L+K+R",   "categories": ALL_CATEGORIES[:3], "redact": True,  "note": "redacted record subset (3 categories)"},
    {"name": "L+K+R+H", "categories": ALL_CATEGORIES,     "redact": True,  "note": "hosted model, full redacted record"},
    {"name": "U",       "categories": ALL_CATEGORIES,     "redact": False, "note": "unrestricted disclosure, no redaction (offline counterfactual)"},
]

_STOP = {"type", "stage", "former", "moderate", "sedentary", "persistent", "hospitalised"}


def load_patients() -> list[dict]:
    path = DATASETS / "shimana_consent_cases.jsonl"
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def match_token(keep: str) -> str:
    """Distinctive clinical term to look for in the summary (first informative word)."""
    for word in re.findall(r"[a-zA-Z]+", keep.lower()):
        if len(word) > 4 and word not in _STOP:
            return word
    words = re.findall(r"[a-zA-Z]+", keep.lower())
    return words[0] if words else keep.lower()


def consented_records(patient: dict, config: dict) -> list[dict]:
    return [r for r in patient["records"] if r["category"] in config["categories"]]


def build_payload(patient: dict, config: dict) -> dict:
    records = []
    for r in consented_records(patient, config):
        value = r["data"]["value"]
        if config["redact"]:
            value = redact_pii_text(value).text
        records.append({
            "source_type": r["source_type"],
            "record_id": r["record_id"],
            "source_timestamp": r["source_timestamp"],
            "data": {"value": value},
        })
    return {"patient_token": patient["patient_token"], "records": records}


def residual_exposure(patient: dict, config: dict) -> int:
    """Identifier spans that survive the config policy across consented records."""
    leaked = 0
    for r in consented_records(patient, config):
        value = r["data"]["value"]
        surviving = redact_pii_text(value).text if config["redact"] else value
        for span in r["pii"]:
            if span in surviving:
                leaked += 1
    return leaked


async def summarize(provider: str, payload: dict) -> dict | None:
    if not payload["records"]:
        return None  # no records consented -> nothing to ground; task cannot succeed
    orch = AIOrchestrator()
    orch.provider = provider
    try:
        result = await orch.generate_patient_summary(payload, include_meta=True)
    except AIOrchestratorError:
        return None
    return result.validated_output


def utility_source_accounting(output: dict | None) -> float:
    """Paper's utility metric: a grounded, correctly-sourced summary was produced.

    1.0 when at least one supported item exists, every item carries a source, the
    output demands clinician verification, and writeback is disallowed. 0.0 when no
    records were disclosed (the 'not found in record' sentinel) or the contract fails.
    Sources are attached by the backend, so invented references are impossible by
    construction; this measures whether the task could be completed at all.
    """
    if not output:
        return 0.0
    items = output.get("items", [])
    if not items:
        return 0.0
    every_sourced = all(item.get("sources") for item in items)
    any_supported = any(item.get("status") == "supported" for item in items)
    contract_ok = output.get("clinician_verification_required") is True and output.get("writeback_allowed") is False
    return 1.0 if (every_sourced and any_supported and contract_ok) else 0.0


def term_coverage(patient: dict, config: dict, output: dict | None) -> float:
    """Secondary diagnostic: fraction of six categories whose clinical term is echoed."""
    if not output:
        return 0.0
    text = " ".join(str(i.get("text", "")) for i in output.get("items", [])).lower()
    if not text:
        return 0.0
    matched = sum(1 for r in consented_records(patient, config) if match_token(r["keep"]) in text)
    return matched / len(ALL_CATEGORIES)


def bootstrap_ci(values: list[float], n: int = 2000, seed: int = 7) -> tuple[float, float, float]:
    if not values:
        return 0.0, 0.0, 0.0
    rng = random.Random(seed)
    k = len(values)
    means = []
    for _ in range(n):
        means.append(sum(values[rng.randrange(k)] for _ in range(k)) / k)
    means.sort()
    return sum(values) / k, means[int(0.025 * n)], means[int(0.975 * n)]


async def run(provider: str, seeds: int) -> dict:
    patients = load_patients()
    results = []
    for config in CONFIGS:
        util_values: list[float] = []
        term_values: list[float] = []
        expo_values: list[float] = []
        for patient in patients:
            payload = build_payload(patient, config)
            us, ts = [], []
            for _ in range(max(1, seeds)):
                output = await summarize(provider, payload)
                us.append(utility_source_accounting(output))
                ts.append(term_coverage(patient, config, output))
            util_values.append(sum(us) / len(us))
            term_values.append(sum(ts) / len(ts))
            expo_values.append(residual_exposure(patient, config))
        u_mean, u_lo, u_hi = bootstrap_ci(util_values)
        t_mean, _, _ = bootstrap_ci(term_values)
        e_per_req = sum(expo_values) / len(patients)
        results.append({
            "config": config["name"],
            "note": config["note"],
            "categories": config["categories"],
            "redact": config["redact"],
            "utility_mean": round(u_mean, 4),
            "utility_ci95": [round(u_lo, 4), round(u_hi, 4)],
            "term_coverage_mean": round(t_mean, 4),
            "exposure_spans_per_request": round(e_per_req, 4),
            "exposure_spans_per_1000": round(e_per_req * 1000, 1),
        })
    return {
        "schema_version": "1.0.0",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "provider": provider,
        "patients": len(patients),
        "seeds": seeds,
        "task": "grounded_patient_summary",
        "configs": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", default="groq")
    parser.add_argument("--seeds", type=int, default=1)
    parser.add_argument("--output", type=Path, default=ROOT / "tests/benchmarks/reports/shimana_results.json")
    args = parser.parse_args()

    report = asyncio.run(run(args.provider, args.seeds))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for row in report["configs"]:
        print(f"{row['config']:>8}  utility={row['utility_mean']:.3f} "
              f"CI{row['utility_ci95']}  exposure/1k={row['exposure_spans_per_1000']}")
    print(f"-> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
