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


# ---------------------------------------------------------------------------
# Arohon instrumentation
# ---------------------------------------------------------------------------

def _stub_summary_call():
    async def _fake_call_llm_json(*, system_prompt: str, user_prompt: str, subject_token: str):
        return (
            {
                "summary": "Stable.",
                "key_findings": [],
                "risk_flags": [],
                "follow_up_questions": [],
                "recommended_actions": [],
            },
            "mock",
        )

    return _fake_call_llm_json


def test_execute_records_the_tier_decision_on_the_result(monkeypatch) -> None:
    from app.db.models.enums import RiskClass

    orchestrator = AIOrchestrator()
    monkeypatch.setattr(orchestrator, "_call_llm_json", _stub_summary_call())

    result = asyncio.run(
        orchestrator._execute(
            feature="generate_patient_summary",
            prompt_version="v1",
            payload={},
            output_model=PatientSummaryOutput,
            task_instruction="summarize",
            risk_class=RiskClass.ROUTINE,
        )
    )

    assert result.requested_tier == "L1_inform"
    assert result.autonomy_tier == "L1_inform"
    assert result.risk_class == "routine"
    assert result.tier_ceiling_applied is False
    # The correlation ID is the same random per-request token the provider saw, so the
    # tier log can be joined to the request without a stable subject identifier.
    assert result.correlation_id and result.correlation_id.startswith("req_")


def test_execute_refuses_before_contacting_the_provider_when_policy_abstains(monkeypatch) -> None:
    """L0 must short-circuit. Spending an inference on unusable output is the bug."""
    import pytest

    from app.db.models.enums import RiskClass
    from app.services.ai_orchestrator import AIAuthorityError

    orchestrator = AIOrchestrator()
    calls: list[str] = []

    async def _tripwire(*, system_prompt: str, user_prompt: str, subject_token: str):
        calls.append(subject_token)
        raise AssertionError("provider must not be contacted at L0")

    monkeypatch.setattr(orchestrator, "_call_llm_json", _tripwire)

    with pytest.raises(AIAuthorityError):
        asyncio.run(
            orchestrator._execute(
                feature="generate_patient_summary",
                prompt_version="v1",
                payload={},
                output_model=PatientSummaryOutput,
                task_instruction="summarize",
                risk_class=RiskClass.OUT_OF_SCOPE,
            )
        )
    assert calls == []


def test_denied_consent_also_short_circuits(monkeypatch) -> None:
    import pytest

    from app.services.ai_orchestrator import AIAuthorityError

    orchestrator = AIOrchestrator()

    async def _tripwire(*, system_prompt: str, user_prompt: str, subject_token: str):
        raise AssertionError("provider must not be contacted when consent is denied")

    monkeypatch.setattr(orchestrator, "_call_llm_json", _tripwire)

    with pytest.raises(AIAuthorityError):
        asyncio.run(
            orchestrator._execute(
                feature="generate_patient_summary",
                prompt_version="v1",
                payload={},
                output_model=PatientSummaryOutput,
                task_instruction="summarize",
                consent_ok=False,
            )
        )


def test_an_undeclared_feature_cannot_reach_the_provider(monkeypatch) -> None:
    """A feature with no registry row has no ceiling, so it must fail loudly."""
    import pytest

    from app.core.arohon import UndeclaredFeatureError

    orchestrator = AIOrchestrator()

    async def _tripwire(*, system_prompt: str, user_prompt: str, subject_token: str):
        raise AssertionError("undeclared feature must not be contacted")

    monkeypatch.setattr(orchestrator, "_call_llm_json", _tripwire)

    with pytest.raises(UndeclaredFeatureError):
        asyncio.run(
            orchestrator._execute(
                feature="feature_nobody_registered",
                prompt_version="v1",
                payload={},
                output_model=PatientSummaryOutput,
                task_instruction="summarize",
            )
        )


def test_every_orchestrator_feature_has_a_declared_tier() -> None:
    """The registry is read out of the source, so a new feature cannot skip it.

    Adding an `_execute(feature="...")` call without a FEATURE_TIERS row would otherwise
    only fail at runtime, on the request that needed the ceiling most.
    """
    import ast
    import inspect

    from app.core.arohon import FEATURE_TIERS
    from app.services import ai_orchestrator as module

    tree = ast.parse(inspect.getsource(module))
    called_features = {
        keyword.value.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "_execute"
        for keyword in node.keywords
        if keyword.arg == "feature" and isinstance(keyword.value, ast.Constant)
    }

    assert called_features, "no _execute call sites found; the check has gone blind"
    assert called_features <= set(FEATURE_TIERS), sorted(called_features - set(FEATURE_TIERS))


def test_no_deployed_feature_declares_more_than_suggest() -> None:
    """L3 and L4 are reached by the deterministic path and a prior grant, never by a draft."""
    from app.core.arohon import FEATURE_TIERS, tier_rank
    from app.db.models.enums import AutonomyTier

    for feature, tier in FEATURE_TIERS.items():
        assert tier_rank(tier) <= tier_rank(AutonomyTier.L2_SUGGEST), feature
