from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.db.models.enums import UserRole
from app.services.chorui_navigation_registry import resolve_chorui_navigation_route

EngineActionType = Literal["navigate", "clarify", "suggest", "undo", "none"]


@dataclass(frozen=True, slots=True)
class ChoruiNavigationEngineOption:
    label: str
    canonical_intent: str
    route: str


@dataclass(frozen=True, slots=True)
class ChoruiNavigationEngineSuggestion:
    label: str
    route: str
    canonical_intent: str


@dataclass(frozen=True, slots=True)
class ChoruiNavigationEngineMemory:
    pending_intent: str | None = None
    missing_params: list[str] = field(default_factory=list)
    last_resolved_intent: str | None = None


@dataclass(frozen=True, slots=True)
class ChoruiNavigationEngineFallback:
    route: str | None = None
    reason: str = "none"


@dataclass(frozen=True, slots=True)
class ChoruiNavigationEngineResult:
    action: EngineActionType = "none"
    route: str | None = None
    confidence: float = 0.0
    requires_confirmation: bool = False
    missing_params: list[str] = field(default_factory=list)
    options: list[ChoruiNavigationEngineOption] = field(default_factory=list)
    suggestions: list[ChoruiNavigationEngineSuggestion] = field(default_factory=list)
    reason: str = "none"
    delay_ms: int | None = None
    canonical_intent: str | None = None
    intent_mode: str = "direct"
    fallback: ChoruiNavigationEngineFallback = field(default_factory=ChoruiNavigationEngineFallback)
    memory: ChoruiNavigationEngineMemory = field(default_factory=ChoruiNavigationEngineMemory)


_ENGINE_PATIENT_RAW_INTENT_ROUTES: dict[str, str] = {
    "patient_self_upcoming_appointments": "/patient/appointments",
    "patient_self_history": "/patient/medical-history",
    "patient_self_medications": "/patient/prescriptions",
    "patient_self_conditions": "/patient/medical-history",
    "patient_self_allergies": "/patient/medical-history",
    "patient_self_family_history": "/patient/medical-history",
    "patient_self_doctors": "/patient/find-doctor",
}

_ENGINE_DOCTOR_RAW_INTENT_ROUTES: dict[str, str] = {
    "doctor_active_patients": "/doctor/patients",
    "doctor_today_appointments": "/doctor/appointments",
    "doctor_self_schedule": "/doctor/schedule",
}

_ENGINE_DOCTOR_RAW_DYNAMIC_INTENT_ROUTES: dict[str, str] = {
    "doctor_patient_summary": "/doctor/patient/{id}",
    "doctor_patient_medications": "/doctor/patient/{id}",
    "doctor_patient_conditions": "/doctor/patient/{id}",
    "doctor_patient_allergies": "/doctor/patient/{id}",
    "doctor_patient_risks": "/doctor/patient/{id}",
    "doctor_patient_history": "/doctor/patient/{id}",
    "doctor_patient_family_history": "/doctor/patient/{id}",
    "doctor_patient_upcoming_appointments": "/doctor/patient/{id}",
}

_ENGINE_FIND_DOCTOR_KEYS: tuple[str, ...] = (
    "need a doctor",
    "need doctor",
    "book doctor",
    "find doctor",
    "find specialist",
    "specialist doctor",
)

_ENGINE_ADMIN_MARKERS: tuple[str, ...] = (
    "admin",
    "admin dashboard",
    "admin panel",
)

_ENGINE_PATIENT_MEDICATION_MARKERS: tuple[str, ...] = (
    "medicine",
    "medication",
    "drug",
    "dose",
    "doses",
    "forgot my medicine",
    "forgot medicine",
    "missed dose",
)

_ENGINE_PATIENT_MEDICATION_SUGGESTIONS: tuple[tuple[str, str, str], ...] = (
    ("Reminders", "/patient/reminders", "reminders"),
    ("Prescriptions", "/patient/prescriptions", "prescriptions"),
    ("Find medicine", "/patient/find-medicine", "find_medicine"),
)

_ENGINE_PATIENT_MEDICATION_INTENTS: set[str] = {
    "general",
    "reminders",
    "prescriptions",
    "find_medicine",
}

_ENGINE_DOCTOR_SUGGESTIBLE_INTENTS: set[str] = {
    "doctor_analytics",
    "doctor_patients",
    "doctor_appointments",
    "doctor_schedule",
    "doctor_profile",
}

_ENGINE_DOCTOR_IMPLICIT_SUGGESTION_PREFIXES: tuple[str, ...] = (
    "show my ",
    "my ",
)

_ENGINE_DOCTOR_EXPLICIT_NAVIGATION_PREFIXES: tuple[str, ...] = (
    "take me to ",
    "go to ",
    "open ",
    "navigate to ",
    "bring me to ",
)

_ENGINE_DOCTOR_SUGGESTION_LABELS: dict[str, str] = {
    "doctor_analytics": "Analytics",
    "doctor_patients": "Patients",
    "doctor_appointments": "Appointments",
    "doctor_schedule": "Schedule",
    "doctor_profile": "Profile",
}


def _normalize_role_context(role_context: str | UserRole) -> str:
    if isinstance(role_context, UserRole):
        return str(role_context.value).strip().lower()
    return str(role_context or "").strip().lower()


def _normalize_text(value: str) -> str:
    return " ".join(str(value or "").lower().strip().split())


def _contains_any(text: str, markers: tuple[str, ...]) -> bool:
    return any(marker in text for marker in markers)


def _starts_with_any(text: str, markers: tuple[str, ...]) -> bool:
    return any(text.startswith(marker) for marker in markers)


def _is_explicit_navigation_prompt(text: str) -> bool:
    return _starts_with_any(text, _ENGINE_DOCTOR_EXPLICIT_NAVIGATION_PREFIXES)


def _is_doctor_implicit_navigation_prompt(text: str) -> bool:
    return _starts_with_any(text, _ENGINE_DOCTOR_IMPLICIT_SUGGESTION_PREFIXES)


def _to_bounded_confidence(raw_confidence: object, fallback: float) -> float:
    try:
        parsed = float(raw_confidence or 0.0)
        bounded = max(0.0, min(1.0, parsed))
        if bounded > 0.0:
            return round(bounded, 2)
    except (TypeError, ValueError):
        pass
    return fallback


def _build_none_result(
    *,
    reason: str,
    canonical_intent: str | None = None,
    intent_mode: str = "direct",
    fallback_route: str | None = None,
) -> ChoruiNavigationEngineResult:
    return ChoruiNavigationEngineResult(
        action="none",
        route=None,
        confidence=0.0,
        reason=reason,
        canonical_intent=canonical_intent,
        intent_mode=intent_mode,
        fallback=ChoruiNavigationEngineFallback(route=fallback_route, reason=reason),
        memory=ChoruiNavigationEngineMemory(),
    )


def _build_clarify_result(
    *,
    canonical_intent: str,
    confidence: float,
    missing_params: list[str],
    reason: str,
    fallback_route: str | None = None,
) -> ChoruiNavigationEngineResult:
    options: list[ChoruiNavigationEngineOption] = []
    if fallback_route:
        options.append(
            ChoruiNavigationEngineOption(
                label="Open patient list",
                canonical_intent="doctor_patients",
                route=fallback_route,
            )
        )

    return ChoruiNavigationEngineResult(
        action="clarify",
        route=None,
        confidence=confidence,
        requires_confirmation=False,
        missing_params=list(missing_params),
        options=options,
        reason=reason,
        delay_ms=None,
        canonical_intent=canonical_intent,
        intent_mode="follow_up",
        fallback=ChoruiNavigationEngineFallback(route=fallback_route, reason=reason),
        memory=ChoruiNavigationEngineMemory(
            pending_intent=canonical_intent,
            missing_params=list(missing_params),
            last_resolved_intent=None,
        ),
    )


def _build_navigate_result(
    *,
    canonical_intent: str,
    route: str,
    confidence: float,
    reason: str,
    intent_mode: str,
) -> ChoruiNavigationEngineResult:
    return ChoruiNavigationEngineResult(
        action="navigate",
        route=route,
        confidence=confidence,
        requires_confirmation=False,
        missing_params=[],
        reason=reason,
        delay_ms=450,
        canonical_intent=canonical_intent,
        intent_mode=intent_mode,
        fallback=ChoruiNavigationEngineFallback(route=None, reason=reason),
        memory=ChoruiNavigationEngineMemory(
            pending_intent=None,
            missing_params=[],
            last_resolved_intent=canonical_intent,
        ),
    )


def _build_suggest_result(
    *,
    canonical_intent: str,
    confidence: float,
    reason: str,
    suggestions: list[ChoruiNavigationEngineSuggestion],
    intent_mode: str,
) -> ChoruiNavigationEngineResult:
    return ChoruiNavigationEngineResult(
        action="suggest",
        route=None,
        confidence=confidence,
        requires_confirmation=False,
        missing_params=[],
        suggestions=suggestions,
        reason=reason,
        delay_ms=None,
        canonical_intent=canonical_intent,
        intent_mode=intent_mode or "suggestion",
        fallback=ChoruiNavigationEngineFallback(route=None, reason=reason),
        memory=ChoruiNavigationEngineMemory(),
    )


def _patient_medication_suggestions() -> list[ChoruiNavigationEngineSuggestion]:
    return [
        ChoruiNavigationEngineSuggestion(
            label=label,
            route=route,
            canonical_intent=canonical_intent,
        )
        for label, route, canonical_intent in _ENGINE_PATIENT_MEDICATION_SUGGESTIONS
    ]


def _doctor_single_route_suggestion(
    *,
    canonical_intent: str,
    route: str,
) -> list[ChoruiNavigationEngineSuggestion]:
    label = _ENGINE_DOCTOR_SUGGESTION_LABELS.get(canonical_intent)
    if not label:
        tail = route.rstrip("/").split("/")[-1] if route else "page"
        label = tail.replace("-", " ").replace("_", " ").title() or "Page"

    return [
        ChoruiNavigationEngineSuggestion(
            label=label,
            route=route,
            canonical_intent=canonical_intent,
        )
    ]


def resolve_chorui_navigation_engine(
    *,
    message: str,
    role_context: str | UserRole,
    raw_intent: str,
    intent_normalization: dict[str, object] | None = None,
    patient_id: str | None = None,
    patient_route_id: str | None = None,
) -> ChoruiNavigationEngineResult:
    normalized_message = _normalize_text(message)
    role = _normalize_role_context(role_context)

    normalized_payload = intent_normalization if isinstance(intent_normalization, dict) else {}
    canonical_intent = str(normalized_payload.get("canonical_intent") or "").strip()
    intent_mode = str(normalized_payload.get("intent_mode") or "direct").strip().lower() or "direct"
    normalized_missing_params = [
        str(item).strip()
        for item in (normalized_payload.get("missing_params") or [])
        if str(item).strip()
    ]
    normalized_confidence = _to_bounded_confidence(
        normalized_payload.get("confidence"),
        fallback=0.86,
    )

    if role not in {"patient", "doctor"}:
        return _build_none_result(
            reason="navigation_scope_excludes_role",
            canonical_intent=canonical_intent or None,
            intent_mode=intent_mode,
        )

    if _contains_any(normalized_message, _ENGINE_ADMIN_MARKERS):
        return _build_none_result(
            reason="admin_navigation_not_allowed",
            canonical_intent=canonical_intent or None,
            intent_mode=intent_mode,
        )

    if intent_mode == "correction" or canonical_intent == "navigation_correction":
        return _build_none_result(
            reason="navigation_correction_detected",
            canonical_intent="navigation_correction",
            intent_mode="correction",
        )

    if (
        role == "patient"
        and _contains_any(normalized_message, _ENGINE_PATIENT_MEDICATION_MARKERS)
        and (intent_mode == "suggestion" or canonical_intent in _ENGINE_PATIENT_MEDICATION_INTENTS)
    ):
        return _build_suggest_result(
            canonical_intent=canonical_intent or "reminders",
            confidence=_to_bounded_confidence(
                normalized_payload.get("confidence"),
                fallback=0.72,
            ),
            reason="patient_medicine_support_suggestions",
            suggestions=_patient_medication_suggestions(),
            intent_mode=intent_mode,
        )

    if canonical_intent:
        route_params: dict[str, str] = {}
        route_id = str(patient_route_id or patient_id or "").strip()
        if route_id:
            route_params["id"] = route_id

        route_resolution = resolve_chorui_navigation_route(
            canonical_intent=canonical_intent,
            role_context=role,
            params=route_params,
        )
        if route_resolution.route:
            if (
                role == "doctor"
                and canonical_intent in _ENGINE_DOCTOR_SUGGESTIBLE_INTENTS
                and _is_doctor_implicit_navigation_prompt(normalized_message)
                and not _is_explicit_navigation_prompt(normalized_message)
            ):
                return _build_suggest_result(
                    canonical_intent=canonical_intent,
                    confidence=max(normalized_confidence, 0.82),
                    reason="doctor_implicit_navigation_suggestion",
                    suggestions=_doctor_single_route_suggestion(
                        canonical_intent=canonical_intent,
                        route=route_resolution.route,
                    ),
                    intent_mode="suggestion",
                )

            return _build_navigate_result(
                canonical_intent=canonical_intent,
                route=route_resolution.route,
                confidence=normalized_confidence,
                reason="registry_route_resolved",
                intent_mode=intent_mode,
            )

        if route_resolution.missing_params:
            return _build_clarify_result(
                canonical_intent=canonical_intent,
                confidence=_to_bounded_confidence(
                    normalized_payload.get("confidence"),
                    fallback=0.7,
                ),
                missing_params=normalized_missing_params or route_resolution.missing_params,
                reason=f"registry_{route_resolution.reason}",
                fallback_route=route_resolution.fallback_route,
            )

        if route_resolution.reason == "role_out_of_scope":
            return _build_none_result(
                reason="navigation_scope_excludes_role",
                canonical_intent=canonical_intent,
                intent_mode=intent_mode,
            )

        if route_resolution.reason not in {"intent_not_registered", "empty_intent"}:
            return _build_none_result(
                reason=f"registry_{route_resolution.reason}",
                canonical_intent=canonical_intent,
                intent_mode=intent_mode,
                fallback_route=route_resolution.fallback_route,
            )

    if role == "patient" and _contains_any(normalized_message, _ENGINE_FIND_DOCTOR_KEYS):
        return _build_navigate_result(
            canonical_intent="find_doctor",
            route="/patient/find-doctor",
            confidence=0.9,
            reason="direct_find_doctor_phrase",
            intent_mode="direct",
        )

    if role == "patient":
        route = _ENGINE_PATIENT_RAW_INTENT_ROUTES.get(raw_intent)
        if not route:
            return _build_none_result(
                reason="no_patient_route_match",
                canonical_intent=canonical_intent or None,
                intent_mode=intent_mode,
            )
        return _build_navigate_result(
            canonical_intent=canonical_intent or raw_intent,
            route=route,
            confidence=0.86,
            reason="patient_intent_route_match",
            intent_mode=intent_mode,
        )

    route = _ENGINE_DOCTOR_RAW_INTENT_ROUTES.get(raw_intent)
    if route:
        return _build_navigate_result(
            canonical_intent=canonical_intent or raw_intent,
            route=route,
            confidence=0.86,
            reason="doctor_intent_route_match",
            intent_mode=intent_mode,
        )

    dynamic_route_template = _ENGINE_DOCTOR_RAW_DYNAMIC_INTENT_ROUTES.get(raw_intent)
    if dynamic_route_template:
        route_id = str(patient_route_id or patient_id or "").strip()
        if not route_id:
            return _build_clarify_result(
                canonical_intent=canonical_intent or raw_intent,
                confidence=0.7,
                missing_params=["id"],
                reason="doctor_patient_navigation_needs_id",
                fallback_route="/doctor/patients",
            )

        return _build_navigate_result(
            canonical_intent=canonical_intent or raw_intent,
            route=dynamic_route_template.format(id=route_id),
            confidence=0.84,
            reason="doctor_dynamic_intent_route_match",
            intent_mode=intent_mode,
        )

    return _build_none_result(
        reason="no_doctor_route_match",
        canonical_intent=canonical_intent or None,
        intent_mode=intent_mode,
    )


__all__ = [
    "ChoruiNavigationEngineMemory",
    "ChoruiNavigationEngineOption",
    "ChoruiNavigationEngineResult",
    "ChoruiNavigationEngineSuggestion",
    "resolve_chorui_navigation_engine",
]
