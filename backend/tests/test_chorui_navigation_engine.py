from app.db.models.enums import UserRole
from app.services.chorui_navigation_engine import resolve_chorui_navigation_engine


def test_engine_resolves_patient_canonical_navigation_route() -> None:
    result = resolve_chorui_navigation_engine(
        message="show my appointments",
        role_context=UserRole.PATIENT,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "appointments",
            "confidence": 0.88,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "navigate"
    assert result.route == "/patient/appointments"
    assert result.memory.last_resolved_intent == "appointments"


def test_engine_returns_clarify_for_missing_dynamic_param() -> None:
    result = resolve_chorui_navigation_engine(
        message="open patient reports",
        role_context=UserRole.DOCTOR,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_patient_reports",
            "confidence": 0.81,
            "intent_mode": "direct",
            "missing_params": ["id"],
        },
        patient_id=None,
    )

    assert result.action == "clarify"
    assert "id" in result.missing_params
    assert result.memory.pending_intent == "doctor_patient_reports"
    assert any(option.route == "/doctor/patients" for option in result.options)


def test_engine_blocks_correction_navigation() -> None:
    result = resolve_chorui_navigation_engine(
        message="undo, not this",
        role_context=UserRole.PATIENT,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "navigation_correction",
            "confidence": 0.94,
            "intent_mode": "correction",
        },
    )

    assert result.action == "none"
    assert result.reason == "navigation_correction_detected"


def test_engine_keeps_raw_intent_fallback_path() -> None:
    result = resolve_chorui_navigation_engine(
        message="open my history",
        role_context="patient",
        raw_intent="patient_self_history",
        intent_normalization=None,
    )

    assert result.action == "navigate"
    assert result.route == "/patient/medical-history"


def test_engine_blocks_admin_scope() -> None:
    result = resolve_chorui_navigation_engine(
        message="open appointments",
        role_context=UserRole.ADMIN,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_appointments",
            "confidence": 0.8,
            "intent_mode": "direct",
        },
    )

    assert result.action == "none"
    assert result.reason == "navigation_scope_excludes_role"


def test_engine_returns_patient_medicine_suggestions_for_broad_query() -> None:
    result = resolve_chorui_navigation_engine(
        message="I forgot my medicine today",
        role_context=UserRole.PATIENT,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "reminders",
            "confidence": 0.72,
            "intent_mode": "suggestion",
        },
    )

    assert result.action == "suggest"
    assert result.route is None
    assert result.reason == "patient_medicine_support_suggestions"
    assert any(suggestion.route == "/patient/reminders" for suggestion in result.suggestions)
    assert any(suggestion.route == "/patient/prescriptions" for suggestion in result.suggestions)


def test_engine_resolves_follow_up_dynamic_route_when_id_present() -> None:
    result = resolve_chorui_navigation_engine(
        message="for patient PT-ABCDEFGHJK",
        role_context=UserRole.DOCTOR,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_patient_reports",
            "confidence": 0.89,
            "intent_mode": "follow_up",
            "missing_params": [],
        },
        patient_route_id="PT-ABCDEFGHJK",
    )

    assert result.action == "navigate"
    assert result.route == "/doctor/patient/PT-ABCDEFGHJK/reports"
    assert result.memory.last_resolved_intent == "doctor_patient_reports"


def test_engine_resolves_doctor_today_consultations_to_appointments_route() -> None:
    result = resolve_chorui_navigation_engine(
        message="View today's consultations",
        role_context=UserRole.DOCTOR,
        raw_intent="doctor_self_schedule",
        intent_normalization={
            "canonical_intent": "doctor_appointments",
            "confidence": 0.94,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "navigate"
    assert result.route == "/doctor/appointments"
    assert result.memory.last_resolved_intent == "doctor_appointments"


def test_engine_suggests_doctor_analytics_for_implicit_prompt() -> None:
    result = resolve_chorui_navigation_engine(
        message="show my analytics",
        role_context=UserRole.DOCTOR,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_analytics",
            "confidence": 0.88,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "suggest"
    assert any(suggestion.route == "/doctor/analytics" for suggestion in result.suggestions)


def test_engine_suggests_doctor_patients_for_implicit_prompt() -> None:
    result = resolve_chorui_navigation_engine(
        message="my patients",
        role_context=UserRole.DOCTOR,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_patients",
            "confidence": 0.9,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "suggest"
    assert any(suggestion.route == "/doctor/patients" for suggestion in result.suggestions)


def test_engine_navigates_to_doctor_schedule_for_explicit_prompt() -> None:
    result = resolve_chorui_navigation_engine(
        message="take me to schedule",
        role_context=UserRole.DOCTOR,
        raw_intent="doctor_self_schedule",
        intent_normalization={
            "canonical_intent": "doctor_schedule",
            "confidence": 0.9,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "navigate"
    assert result.route == "/doctor/schedule"


def test_engine_navigates_to_doctor_appointments_for_explicit_prompt() -> None:
    result = resolve_chorui_navigation_engine(
        message="open appointments",
        role_context=UserRole.DOCTOR,
        raw_intent="general",
        intent_normalization={
            "canonical_intent": "doctor_appointments",
            "confidence": 0.9,
            "intent_mode": "direct",
            "missing_params": [],
        },
    )

    assert result.action == "navigate"
    assert result.route == "/doctor/appointments"
