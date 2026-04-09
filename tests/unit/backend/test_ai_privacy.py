from __future__ import annotations

import re
import uuid

from app.core.ai_privacy import anonymize_identifier_text, pick_subject_token, stable_hash_token


def test_stable_hash_token_is_deterministic() -> None:
    token_1 = stable_hash_token("patient-42", namespace="subject", length=20)
    token_2 = stable_hash_token("patient-42", namespace="subject", length=20)
    token_3 = stable_hash_token("patient-43", namespace="subject", length=20)

    assert token_1 == token_2
    assert token_1 != token_3
    assert token_1.startswith("subject_")
    assert len(token_1.split("_", 1)[1]) == 20


def test_anonymize_identifier_text_masks_uuid_and_long_numeric_tokens() -> None:
    raw_uuid = str(uuid.uuid4())
    text = f"patient_id={raw_uuid} invoice=9876543210"
    masked = anonymize_identifier_text(text, token_namespace="subject")

    assert raw_uuid not in masked
    assert "9876543210" not in masked
    assert "subject_" in masked
    assert re.search(r"subjectnum_[a-f0-9]{14}", masked)


def test_pick_subject_token_prefers_payload_value() -> None:
    payload = {"subject_token": "subject_abc123", "query": "ignored"}
    picked = pick_subject_token(payload, fallback_parts=["fallback", "id"])
    assert picked == "subject_abc123"


def test_pick_subject_token_falls_back_to_stable_hash() -> None:
    picked = pick_subject_token(payload=None, fallback_parts=["feature-x", "v2"])
    assert picked.startswith("subject_")
