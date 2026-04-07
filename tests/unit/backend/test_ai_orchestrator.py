from __future__ import annotations

import asyncio

from app.services.ai_orchestrator import AIOrchestrator, PatientSummaryOutput


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
