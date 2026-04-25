"""
Central AI orchestrator service — provider-agnostic blackbox.

- Centralizes all LLM calls behind a uniform interface
- Swap between Groq, Gemini, Cerebras (or any OpenAI-compatible) via env
- Sanitizes PII before prompts
- Enforces JSON-only outputs with Pydantic validation
"""

from __future__ import annotations

import json
import logging
import re
from time import perf_counter
from typing import Any, Mapping, Type

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.ai_privacy import anonymize_identifier_text, pick_subject_token
from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class AIOrchestratorError(RuntimeError):
    """Base orchestrator error."""


class AIStructuredInputError(AIOrchestratorError):
    """Raised when input is not structured."""


class AIProviderError(AIOrchestratorError):
    """Raised when provider call fails."""


class AIValidationError(AIOrchestratorError):
    """Raised when output validation fails."""


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------

class AIExecutionResult(BaseModel):
    feature: str
    prompt_version: str
    sanitized_input: dict[str, Any]
    raw_output: dict[str, Any]
    validated_output: dict[str, Any]
    validation_status: str
    latency_ms: int
    provider: str


class PatientSummaryOutput(BaseModel):
    summary: str
    key_findings: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class StructuredIntakeOutput(BaseModel):
    chief_complaint: str | None = None
    symptom_timeline: list[str] = Field(default_factory=list)
    relevant_history: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    triage_priority: str = "medium"


class SOAPNotesOutput(BaseModel):
    subjective: list[str] = Field(default_factory=list)
    objective: list[str] = Field(default_factory=list)
    assessment: list[str] = Field(default_factory=list)
    plan: list[str] = Field(default_factory=list)


class ClinicalReference(BaseModel):
    title: str
    source: str | None = None
    year: int | None = None


class SuggestedCondition(BaseModel):
    name: str
    confidence: float = Field(ge=0.0, le=1.0)


class ClinicalInfoOutput(BaseModel):
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_conditions: list[SuggestedCondition] = Field(default_factory=list)
    suggested_tests: list[dict[str, Any]] = Field(default_factory=list)
    suggested_medications: list[dict[str, Any]] = Field(default_factory=list)
    references: list[ClinicalReference] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)


class SuggestedMedication(BaseModel):
    medicine_name: str
    rationale: str | None = None
    dose_hint: str | None = None
    frequency_hint: str | None = None
    duration_hint: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class SuggestedTest(BaseModel):
    test_name: str
    rationale: str | None = None
    urgency: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class SuggestedProcedure(BaseModel):
    procedure_name: str
    rationale: str | None = None
    urgency: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class PrescriptionSuggestionsOutput(BaseModel):
    medications: list[SuggestedMedication] = Field(default_factory=list)
    tests: list[SuggestedTest] = Field(default_factory=list)
    procedures: list[SuggestedProcedure] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Provider registry — add new providers here
# ---------------------------------------------------------------------------

_PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    "groq": {
        "type": "openai_compatible",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "api_key_attr": "GROQ_API_KEY",
        "model_attr": "GROQ_MODEL",
    },
    "cerebras": {
        "type": "openai_compatible",
        "url": "https://api.cerebras.ai/v1/chat/completions",
        "api_key_attr": "CEREBRAS_CLOUD_API_KEY",
        "model_attr": "CEREBRAS_CLOUD_MODEL",
    },
    "gemini": {
        "type": "gemini",
        "api_key_attr": "GEMINI_API_KEY",
        "model_attr": "GEMINI_MODEL",
    },
}

# Fallback chains: primary → fallback1 → fallback2
_FALLBACK_CHAINS: dict[str, list[str]] = {
    "groq": ["groq", "cerebras", "gemini"],
    "cerebras": ["cerebras", "groq", "gemini"],
    "gemini": ["gemini", "cerebras", "groq"],
}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AIOrchestrator:
    PII_FIELD_KEYWORDS = {
        "name", "full_name", "first_name", "last_name",
        "phone", "mobile", "telephone",
        "address", "street", "email", "contact",
        "nid", "passport",
    }

    EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
    PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\-\s().]{6,}\d)")
    NAME_PATTERN = re.compile(r"(?i)\b(name)\s*[:=]\s*([A-Za-z][A-Za-z .'-]{1,50})")
    ADDRESS_PATTERN = re.compile(r"(?i)\b(address)\s*[:=]\s*([A-Za-z0-9 ,.#/\-]{4,120})")
    UUID_PATTERN = re.compile(
        r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
        re.IGNORECASE,
    )
    LONG_ID_PATTERN = re.compile(r"\b\d{7,}\b")

    def __init__(self) -> None:
        self.provider = (settings.AI_PROVIDER or "gemini").strip().lower()
        self.timeout_seconds = max(1.0, float(settings.AI_PROVIDER_TIMEOUT_SECONDS))
        self.max_retries = max(0, int(settings.AI_PROVIDER_MAX_RETRIES))

        if self.provider not in _PROVIDER_REGISTRY:
            raise AIProviderError(
                f"Unsupported AI provider: {self.provider}. "
                f"Available: {', '.join(_PROVIDER_REGISTRY.keys())}"
            )

    # ------------------------------------------------------------------
    # Public feature methods
    # ------------------------------------------------------------------

    async def generate_patient_summary(
        self,
        data: Mapping[str, Any],
        include_meta: bool = False,
        prompt_version: str = "v1",
    ) -> dict[str, Any] | AIExecutionResult:
        result = await self._execute(
            feature="generate_patient_summary",
            prompt_version=prompt_version,
            payload=self._sanitize_structured_input(data),
            output_model=PatientSummaryOutput,
            task_instruction=(
                "Summarize the patient context for a doctor in concise clinical bullets. "
                "Avoid diagnosis certainty. Mention missing critical context."
            ),
        )
        return result if include_meta else result.validated_output

    async def structure_intake(
        self,
        data: Mapping[str, Any],
        include_meta: bool = False,
        prompt_version: str = "v1",
    ) -> dict[str, Any] | AIExecutionResult:
        result = await self._execute(
            feature="structure_intake",
            prompt_version=prompt_version,
            payload=self._sanitize_structured_input(data),
            output_model=StructuredIntakeOutput,
            task_instruction=(
                "Convert the intake payload into structured clinical intake fields and triage priority."
            ),
        )
        return result if include_meta else result.validated_output

    async def generate_soap_notes(
        self,
        transcript: str,
        include_meta: bool = False,
        prompt_version: str = "v1",
    ) -> dict[str, Any] | AIExecutionResult:
        cleaned = self._sanitize_text(transcript)
        if not cleaned:
            raise AIStructuredInputError("Transcript cannot be empty.")

        result = await self._execute(
            feature="generate_soap_notes",
            prompt_version=prompt_version,
            payload={"transcript": cleaned},
            output_model=SOAPNotesOutput,
            task_instruction=(
                "Convert the clinical transcript into SOAP notes. "
                "Use short bullet strings under subjective/objective/assessment/plan."
            ),
        )
        return result if include_meta else result.validated_output

    async def clinical_info_query(
        self,
        query: str,
        include_meta: bool = False,
        prompt_version: str = "v1",
    ) -> dict[str, Any] | AIExecutionResult:
        cleaned = self._sanitize_text(query)
        if not cleaned:
            raise AIStructuredInputError("Clinical query cannot be empty.")

        result = await self._execute(
            feature="clinical_info_query",
            prompt_version=prompt_version,
            payload={"query": cleaned},
            output_model=ClinicalInfoOutput,
            task_instruction=(
                "Answer the clinical information query in concise evidence-aware format. "
                "Include uncertainty and cautionary notes where applicable, and include structured suggestions "
                "for conditions/tests/medications with confidence scores. "
                "When patient health context (conditions, medications, allergies, history) is provided "
                "in the verified_context, always acknowledge and integrate it into your answer."
            ),
        )
        return result if include_meta else result.validated_output

    async def prescription_suggestions(
        self,
        data: Mapping[str, Any],
        include_meta: bool = False,
        prompt_version: str = "v1",
    ) -> dict[str, Any] | AIExecutionResult:
        result = await self._execute(
            feature="prescription_suggestions",
            prompt_version=prompt_version,
            payload=self._sanitize_structured_input(data),
            output_model=PrescriptionSuggestionsOutput,
            task_instruction=(
                "Suggest medications/tests/procedures as advisory options only. "
                "Do not include controlled substances by default; include cautions."
            ),
        )
        return result if include_meta else result.validated_output

    # ------------------------------------------------------------------
    # PII sanitization
    # ------------------------------------------------------------------

    def _sanitize_structured_input(self, data: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(data, Mapping):
            raise AIStructuredInputError("Input must be a structured object.")
        sanitized = self._sanitize_payload(data)
        if not isinstance(sanitized, dict):
            raise AIStructuredInputError("Sanitized payload is invalid.")
        return sanitized

    def _sanitize_payload(self, payload: Any) -> Any:
        if isinstance(payload, Mapping):
            sanitized: dict[str, Any] = {}
            for raw_key, value in payload.items():
                key = str(raw_key)
                if self._is_pii_key(key):
                    continue
                sanitized[key] = self._sanitize_payload(value)
            return sanitized

        if isinstance(payload, list):
            return [self._sanitize_payload(item) for item in payload]

        if isinstance(payload, str):
            return self._sanitize_text(payload)

        return payload

    def _is_pii_key(self, key: str) -> bool:
        normalized = key.strip().lower().replace("-", "_")
        return any(token in normalized for token in self.PII_FIELD_KEYWORDS)

    def _sanitize_text(self, text: str) -> str:
        sanitized = text.strip()
        sanitized = self.EMAIL_PATTERN.sub("[redacted-email]", sanitized)
        sanitized = self.PHONE_PATTERN.sub("[redacted-phone]", sanitized)
        sanitized = anonymize_identifier_text(sanitized, token_namespace="subject")
        sanitized = self.NAME_PATTERN.sub(r"\1: [redacted-name]", sanitized)
        sanitized = self.ADDRESS_PATTERN.sub(r"\1: [redacted-address]", sanitized)
        return sanitized

    def _normalize_api_key(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().strip("\"'")
        return normalized or None

    def _provider_error_from_http(self, provider: str, exc: httpx.HTTPStatusError) -> AIProviderError:
        status = exc.response.status_code
        body = (exc.response.text or "").strip()
        if len(body) > 400:
            body = f"{body[:400]}..."
        body = self._sanitize_text(body) if body else "<empty>"
        return AIProviderError(f"{provider} HTTP {status}: {body}")

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------

    async def _execute(
        self,
        *,
        feature: str,
        prompt_version: str,
        payload: dict[str, Any],
        output_model: Type[BaseModel],
        task_instruction: str,
    ) -> AIExecutionResult:
        subject_token = pick_subject_token(payload, fallback_parts=[feature, prompt_version, self.provider])
        schema_hint = output_model.model_json_schema()
        system_prompt = (
            "You are Chorui, a clinical-grade healthcare assistant for the Medora platform, serving doctors and patients. "
            "Always provide helpful, grounded, and role-aware support using only the structured context provided in the request. "
            "Never fabricate facts, records, or citations. If data is missing, state uncertainty explicitly and ask for clarification. "
            "Never provide autonomous diagnosis, prescribing, or dosage instructions as final medical decisions. "
            "Use cautious medical reasoning: summarize findings, highlight uncertainty, and list practical next-step checks. "
            "When authorized record context is present, treat it as verified source-of-truth and synthesize naturally from it. "
            "When patient conditions, medications, allergies, or history are included in the input, always acknowledge and reference them in your response. "
            "Never include personal identifiers that are not already anonymized in the input. "
            "Output must be valid JSON only, matching the provided schema exactly. No markdown and no prose outside JSON. "
            f"Task: {task_instruction}"
        )
        user_prompt = json.dumps(
            {
                "feature": feature,
                "prompt_version": prompt_version,
                "input": payload,
                "required_output_schema": schema_hint,
            },
            ensure_ascii=False,
        )

        last_error: Exception | None = None
        max_attempts = self.max_retries + 1

        for attempt in range(max_attempts):
            started = perf_counter()
            try:
                raw_output, provider_used = await self._call_llm_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    subject_token=subject_token,
                )
                validated = output_model.model_validate(raw_output).model_dump()
                latency_ms = int((perf_counter() - started) * 1000)
                return AIExecutionResult(
                    feature=feature,
                    prompt_version=prompt_version,
                    sanitized_input=payload,
                    raw_output=raw_output,
                    validated_output=validated,
                    validation_status="valid",
                    latency_ms=latency_ms,
                    provider=provider_used,
                )
            except (ValidationError, ValueError, httpx.HTTPError, httpx.TimeoutException, AIProviderError) as exc:
                last_error = exc
                if attempt >= max_attempts - 1:
                    break

        if isinstance(last_error, ValidationError):
            raise AIValidationError(f"Invalid AI output for {feature}") from last_error
        if isinstance(last_error, AIProviderError):
            raise AIProviderError(f"AI provider failure for {feature}") from last_error
        raise AIProviderError(f"AI call failed for {feature}") from last_error

    # ------------------------------------------------------------------
    # Provider routing (blackbox dispatcher)
    # ------------------------------------------------------------------

    async def _call_llm_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        subject_token: str,
    ) -> tuple[dict[str, Any], str]:
        candidates = _FALLBACK_CHAINS.get(self.provider, [self.provider])
        last_error: Exception | None = None

        for candidate in candidates:
            spec = _PROVIDER_REGISTRY.get(candidate)
            if not spec:
                continue

            raw_api_key = getattr(settings, spec["api_key_attr"], None)
            api_key = self._normalize_api_key(raw_api_key)
            if not api_key:
                last_error = AIProviderError(f"{spec['api_key_attr']} is not configured.")
                continue

            model = getattr(settings, spec["model_attr"], "")

            try:
                if spec["type"] == "openai_compatible":
                    content = await self._call_openai_compatible_provider(
                        url=spec["url"],
                        api_key=api_key,
                        model=model,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        subject_token=subject_token,
                    )
                elif spec["type"] == "gemini":
                    content = await self._call_gemini_provider(
                        api_key=api_key,
                        model=model,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        subject_token=subject_token,
                    )
                else:
                    raise AIProviderError(f"Unknown provider type: {spec['type']}")

                logger.debug("LLM call succeeded via %s", candidate)
                return self._extract_json_object(content), candidate

            except (httpx.HTTPError, httpx.TimeoutException, AIProviderError, ValueError) as exc:
                logger.warning("Provider %s failed: %s", candidate, exc)
                last_error = exc
                continue

        raise AIProviderError("No available AI provider succeeded.") from last_error

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _call_openai_compatible_provider(
        self,
        *,
        url: str,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        subject_token: str,
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Medora-Subject-Token": subject_token[:80],
        }

        timeout = httpx.Timeout(self.timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise self._provider_error_from_http("openai_compatible", exc) from exc
            response_json = response.json()

        content = (
            response_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
        )
        if not isinstance(content, str) or not content.strip():
            raise ValueError("LLM response content is empty.")
        return content

    async def _call_gemini_provider(
        self,
        *,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        subject_token: str,
    ) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "X-Medora-Subject-Token": subject_token[:80],
        }

        timeout = httpx.Timeout(self.timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise self._provider_error_from_http("gemini", exc) from exc
            response_json = response.json()

        content = (
            response_json.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text")
        )
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Gemini response content is empty.")
        return content

    # ------------------------------------------------------------------
    # JSON extraction
    # ------------------------------------------------------------------

    def _extract_json_object(self, content: str) -> dict[str, Any]:
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
            raise ValueError("Expected JSON object response.")
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, flags=re.DOTALL)
            if not match:
                raise ValueError("Response is not valid JSON.")
            parsed = json.loads(match.group(0))
            if not isinstance(parsed, dict):
                raise ValueError("Expected JSON object response.")
            return parsed


ai_orchestrator = AIOrchestrator()
