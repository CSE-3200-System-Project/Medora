from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Literal

from app.db.models.enums import UserRole

IntentMode = Literal["direct", "follow_up", "correction", "suggestion"]


@dataclass(frozen=True, slots=True)
class ChoruiIntentNormalizationResult:
    canonical_intent: str = "general"
    confidence: float = 0.0
    ambiguity_candidates: list[str] = field(default_factory=list)
    missing_params: list[str] = field(default_factory=list)
    intent_mode: IntentMode = "direct"

    def to_dict(self) -> dict[str, object]:
        return {
            "canonical_intent": self.canonical_intent,
            "confidence": self.confidence,
            "ambiguity_candidates": list(self.ambiguity_candidates),
            "missing_params": list(self.missing_params),
            "intent_mode": self.intent_mode,
        }


_UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    flags=re.IGNORECASE,
)
_PATIENT_REF_PATTERN = re.compile(r"\bPT[-_]?[A-Z2-7]{10}\b", flags=re.IGNORECASE)

_CORRECTION_MARKERS: tuple[str, ...] = (
    "go back",
    "undo",
    "not this",
    "cancel",
    "wrong page",
    "take me back",
)

_FOLLOWUP_MARKERS: tuple[str, ...] = (
    "what about",
    "and",
    "also",
    "same",
    "that patient",
    "for him",
    "for her",
)

_DYNAMIC_CANONICAL_INTENTS = {
    "doctor_patient_detail",
    "doctor_patient_reports",
    "doctor_patient_consultation",
    "doctor_patient_consultation_ai",
}

_RAW_INTENT_TO_CANONICAL: dict[str, str] = {
    "general": "general",
    "service_information": "general",
    "patient_health_query": "general",
    "patient_self_summary": "medical_history",
    "patient_self_history": "medical_history",
    "patient_self_conditions": "medical_history",
    "patient_self_allergies": "medical_history",
    "patient_self_family_history": "medical_history",
    "patient_self_risks": "patient_analytics",
    "patient_self_medications": "prescriptions",
    "patient_self_upcoming_appointments": "appointments",
    "patient_self_doctors": "find_doctor",
    "doctor_active_patients": "doctor_patients",
    "doctor_today_appointments": "doctor_appointments",
    "doctor_self_schedule": "doctor_schedule",
    "doctor_search_patient_by_condition": "doctor_patients",
    "doctor_patient_summary": "doctor_patient_detail",
    "doctor_patient_medications": "doctor_patient_detail",
    "doctor_patient_conditions": "doctor_patient_detail",
    "doctor_patient_allergies": "doctor_patient_detail",
    "doctor_patient_risks": "doctor_patient_detail",
    "doctor_patient_history": "doctor_patient_detail",
    "doctor_patient_family_history": "doctor_patient_detail",
    "doctor_patient_upcoming_appointments": "doctor_patient_detail",
}

_SHARED_PHRASE_CLUSTERS: dict[str, tuple[str, ...]] = {
    "settings": ("open settings", "app settings", "settings"),
    "notifications": ("notifications", "alerts", "show notifications"),
    "go_home": ("go home", "dashboard", "home screen"),
}

_PATIENT_PHRASE_CLUSTERS: dict[str, tuple[str, ...]] = {
    "find_doctor": (
        "need a doctor",
        "need doctor",
        "book doctor",
        "find doctor",
        "find specialist",
        "specialist",
    ),
    "appointments": (
        "my appointments",
        "show my appointments",
        "upcoming visits",
        "next visit",
    ),
    "medical_history": (
        "medical history",
        "health timeline",
        "my health history",
    ),
    "medical_reports": (
        "medical reports",
        "lab reports",
        "show reports",
    ),
    "prescriptions": (
        "my prescriptions",
        "prescriptions",
        "medication orders",
    ),
    "reminders": (
        "forgot my medicine",
        "forgot medicine",
        "missed dose",
        "medicine reminder",
        "reminders",
    ),
    "find_medicine": (
        "find medicine",
        "search drug",
        "medicine search",
    ),
    "patient_profile": (
        "my profile",
        "open profile",
        "account details",
        "edit profile",
        "edit my profile",
        "update profile",
        "update my profile",
        "emergency contac",
        "edit my emergency contac",
        "update emergency contact",
    ),
    "patient_privacy": (
        "privacy settings",
        "data sharing",
        "privacy",
    ),
    "patient_analytics": (
        "my analytics",
        "health trends",
        "analytics",
    ),
}

_DOCTOR_PHRASE_CLUSTERS: dict[str, tuple[str, ...]] = {
    "doctor_patients": (
        "my patients",
        "patient list",
        "show my patients",
        "my patient list",
        "patients",
        "open patients",
    ),
    "doctor_appointments": (
        "my appointments",
        "show appointments",
        "today appointments",
        "show my appointments",
        "open appointments",
        "appointment page",
        "appointments",
        "today's appointments",
        "today consultations",
        "today's consultations",
        "todays consultations",
        "view today's consultations",
        "consultations today",
    ),
    "doctor_analytics": (
        "my analytics",
        "show my analytics",
        "doctor analytics",
        "analytics dashboard",
        "open analytics",
        "analytics",
    ),
    "doctor_schedule": (
        "open schedule",
        "my schedule",
        "availability",
        "schedule",
        "take me to schedule",
    ),
    "doctor_profile": (
        "doctor profile",
        "open my profile",
        "my profile",
    ),
    "doctor_find_medicine": (
        "medicine lookup",
        "drug reference",
        "find medicine",
    ),
    "doctor_patient_detail": (
        "open patient",
        "patient profile",
        "patient details",
    ),
    "doctor_patient_reports": (
        "open patient report",
        "open patient reports",
        "patient report",
        "patient reports",
        "reports for patient",
    ),
    "doctor_patient_consultation": (
        "consult patient",
        "open consultation",
        "patient consultation",
    ),
    "doctor_patient_consultation_ai": (
        "ai pre consultation",
        "ai pre-consultation",
        "consultation ai",
        "pre consultation ai",
    ),
}


def _normalize_text(value: str) -> str:
    return " ".join(str(value or "").lower().strip().split())


def _role_value(role_context: str | UserRole) -> str:
    if isinstance(role_context, UserRole):
        return str(role_context.value).strip().lower()
    return str(role_context or "").strip().lower()


def _raw_to_canonical(intent: str | None) -> str:
    normalized_intent = str(intent or "general").strip()
    if not normalized_intent:
        return "general"
    return _RAW_INTENT_TO_CANONICAL.get(normalized_intent, normalized_intent)


def _contains_any_marker(text: str, markers: tuple[str, ...]) -> bool:
    return any(marker in text for marker in markers)


def _contains_patient_identifier(text: str) -> bool:
    return bool(_UUID_PATTERN.search(text) or _PATIENT_REF_PATTERN.search(text))


def _looks_like_followup(text: str) -> bool:
    if len(text) <= 24:
        return True
    return _contains_any_marker(text, _FOLLOWUP_MARKERS)


def _phrase_clusters_for_role(role_context: str) -> dict[str, tuple[str, ...]]:
    role = _role_value(role_context)
    clusters = dict(_SHARED_PHRASE_CLUSTERS)
    if role == "patient":
        clusters.update(_PATIENT_PHRASE_CLUSTERS)
    elif role == "doctor":
        clusters.update(_DOCTOR_PHRASE_CLUSTERS)
    return clusters


def _collect_phrase_scores(normalized_message: str, role_context: str) -> dict[str, float]:
    scores: dict[str, float] = {}
    for canonical_intent, phrases in _phrase_clusters_for_role(role_context).items():
        hit_count = sum(1 for phrase in phrases if phrase in normalized_message)
        if hit_count <= 0:
            continue
        score = min(0.95, 0.70 + (0.12 * hit_count))
        previous = scores.get(canonical_intent)
        if previous is None or score > previous:
            scores[canonical_intent] = score
    return scores


def normalize_chorui_navigation_intent(
    *,
    message: str,
    raw_intent: str,
    role_context: str | UserRole,
    context_mode: str,
    pending_intent: str | None = None,
    pending_missing_params: list[str] | None = None,
    has_target_patient: bool = False,
) -> ChoruiIntentNormalizationResult:
    normalized_message = _normalize_text(message)

    if _contains_any_marker(normalized_message, _CORRECTION_MARKERS):
        return ChoruiIntentNormalizationResult(
            canonical_intent="navigation_correction",
            confidence=0.94,
            ambiguity_candidates=[],
            missing_params=[],
            intent_mode="correction",
        )

    candidate_scores: dict[str, float] = {}
    raw_canonical_intent = _raw_to_canonical(raw_intent)
    if raw_canonical_intent == "general":
        candidate_scores[raw_canonical_intent] = 0.45
    else:
        candidate_scores[raw_canonical_intent] = 0.74

    phrase_scores = _collect_phrase_scores(normalized_message, _role_value(role_context))
    if raw_canonical_intent in phrase_scores:
        phrase_scores[raw_canonical_intent] = min(0.97, phrase_scores[raw_canonical_intent] + 0.04)

    for canonical_intent, score in phrase_scores.items():
        previous = candidate_scores.get(canonical_intent)
        if previous is None or score > previous:
            candidate_scores[canonical_intent] = score

    pending_canonical_intent = _raw_to_canonical(pending_intent)
    pending_required_params = [str(item).strip() for item in (pending_missing_params or []) if str(item).strip()]
    used_pending_signal = False
    if pending_canonical_intent != "general" and pending_required_params:
        if _looks_like_followup(normalized_message) or _contains_patient_identifier(normalized_message):
            used_pending_signal = True
            previous = candidate_scores.get(pending_canonical_intent)
            pending_score = 0.88
            if previous is None or pending_score > previous:
                candidate_scores[pending_canonical_intent] = pending_score

    sorted_candidates = sorted(candidate_scores.items(), key=lambda item: (-item[1], item[0]))
    top_canonical_intent, top_score = sorted_candidates[0]

    ambiguity_candidates = [
        canonical_intent
        for canonical_intent, score in sorted_candidates[1:4]
        if (top_score - score) <= 0.08 and canonical_intent != "general"
    ]

    has_identifier = has_target_patient or _contains_patient_identifier(normalized_message)
    missing_params: list[str] = []
    if top_canonical_intent in _DYNAMIC_CANONICAL_INTENTS and not has_identifier:
        missing_params = ["id"]
        top_score = min(top_score, 0.78)

    intent_mode: IntentMode = "direct"
    if used_pending_signal:
        intent_mode = "follow_up"
    elif ambiguity_candidates or top_score < 0.72:
        intent_mode = "suggestion"

    # context_mode is accepted to satisfy pipeline compatibility and future tuning hooks.
    _ = context_mode

    return ChoruiIntentNormalizationResult(
        canonical_intent=top_canonical_intent,
        confidence=round(float(top_score), 2),
        ambiguity_candidates=ambiguity_candidates,
        missing_params=missing_params,
        intent_mode=intent_mode,
    )


__all__ = [
    "ChoruiIntentNormalizationResult",
    "normalize_chorui_navigation_intent",
]
