from __future__ import annotations

import asyncio

from app.services.ai_orchestrator import AIOrchestrator, PatientSummaryOutput, _FALLBACK_CHAINS


def test_sanitize_structured_input_removes_pii_keys_and_masks_values() -> None:
    orchestrator = AIOrchestrator()
    payload = {
        "name": "Rahim Khan",
        "phone": "+8801712345678",
        "query": "Email me at rahim@example.com, patient id 1234567890",
        "record_context": {"symptoms": ["headache"]},
    }

    sanitized = orchestrator._sanitize_structured_input(payload)

    assert "name" not in sanitized
    assert "phone" not in sanitized
    assert "[redacted-email]" in sanitized["query"]
    assert "1234567890" not in sanitized["query"]


def test_extract_json_object_handles_wrapped_json_payload() -> None:
    orchestrator = AIOrchestrator()
    response = "Result:\n```json\n{\"summary\":\"ok\",\"key_findings\":[]}\n```"
    parsed = orchestrator._extract_json_object(response)

    assert parsed["summary"] == "ok"
    assert parsed["key_findings"] == []


def test_execute_validates_provider_output(monkeypatch) -> None:
    orchestrator = AIOrchestrator()

    async def _fake_call_llm_json(*, system_prompt: str, user_prompt: str, subject_token: str):
        return (
            {
                "summary": "Patient shows stable symptoms.",
                "key_findings": ["No acute red flags"],
                "risk_flags": [],
                "follow_up_questions": [],
                "recommended_actions": ["Continue monitoring"],
            },
            "groq",
        )

    monkeypatch.setattr(orchestrator, "_call_llm_json", _fake_call_llm_json)

    result = asyncio.run(
        orchestrator._execute(
            feature="generate_patient_summary",
            prompt_version="v1",
            payload={"record_context": {"symptoms": ["cough"]}},
            output_model=PatientSummaryOutput,
            task_instruction="summarize",
        )
    )

    assert result.validation_status == "valid"
    assert result.provider == "groq"
    assert result.validated_output["summary"].startswith("Patient")


def test_summary_sources_are_backend_linked_and_never_write_back(monkeypatch) -> None:
    orchestrator = AIOrchestrator()

    async def _fake_call_llm_json(*, system_prompt: str, user_prompt: str, subject_token: str):
        assert "record-42" not in user_prompt
        return (
            {
                "summary": "One sourced finding.",
                "key_findings": ["Dose differs between records"],
                "items": [
                    {
                        "text": "Dose differs between records",
                        "sources": [{"source_type": "invented", "source_id": "invented"}],
                        "status": "conflict",
                    }
                ],
                "clinician_verification_required": False,
                "writeback_allowed": True,
            },
            "mock",
        )

    monkeypatch.setattr(orchestrator, "_call_llm_json", _fake_call_llm_json)
    output = asyncio.run(
        orchestrator.generate_patient_summary(
            {
                "medications": [
                    {
                        "record_id": "record-42",
                        "source_type": "prescription",
                        "source_timestamp": "2026-01-02T03:04:05Z",
                        "medicine": "ExampleMed",
                    }
                ]
            }
        )
    )

    assert output["clinician_verification_required"] is True
    assert output["writeback_allowed"] is False
    assert output["items"][0]["sources"] == [
        {
            "source_type": "prescription",
            "source_id": "record-42",
            "source_timestamp": "2026-01-02T03:04:05Z",
        }
    ]


def test_provider_routing_never_falls_back_to_an_unconsented_vendor() -> None:
    assert _FALLBACK_CHAINS == {
        "mock": ["mock"],
        "groq": ["groq"],
        "cerebras": ["cerebras"],
        "gemini": ["gemini"],
    }


def test_navigation_intent_uses_structured_provider_boundary(monkeypatch) -> None:
    orchestrator = AIOrchestrator()

    async def _fake_call_llm_json(*, system_prompt: str, user_prompt: str, subject_token: str):
        assert "rahim@example.com" not in user_prompt
        return (
            {
                "language_detected": "en",
                "symptoms": [{"name": "rash", "confidence": 0.9}],
                "duration_days": 2,
                "specialties": [{"name": "Dermatologist", "confidence": 0.8}],
                "ambiguity": "low",
                "error": None,
            },
            "mock",
        )

    monkeypatch.setattr(orchestrator, "_call_llm_json", _fake_call_llm_json)
    result = asyncio.run(
        orchestrator.extract_navigation_intent(
            user_text="rash; email rahim@example.com",
            available_specialties=["Dermatologist"],
        )
    )
    assert result["specialties"][0]["name"] == "Dermatologist"
    assert result["ambiguity"] == "low"
