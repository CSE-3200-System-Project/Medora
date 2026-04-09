from app.db.models.enums import UserRole
from app.services.chorui_intent_normalizer import normalize_chorui_navigation_intent


def test_patient_find_doctor_phrase_maps_to_canonical_intent() -> None:
    result = normalize_chorui_navigation_intent(
        message="I need a doctor for my mother",
        raw_intent="service_information",
        role_context=UserRole.PATIENT,
        context_mode="patient-self",
    )

    assert result.canonical_intent == "find_doctor"
    assert result.intent_mode == "direct"
    assert result.confidence >= 0.8


def test_doctor_patient_report_without_id_requires_missing_param() -> None:
    result = normalize_chorui_navigation_intent(
        message="open patient report",
        raw_intent="general",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-self",
        has_target_patient=False,
    )

    assert result.canonical_intent == "doctor_patient_reports"
    assert "id" in result.missing_params


def test_correction_phrase_maps_to_navigation_correction_mode() -> None:
    result = normalize_chorui_navigation_intent(
        message="undo, not this page",
        raw_intent="general",
        role_context=UserRole.PATIENT,
        context_mode="patient-self",
    )

    assert result.canonical_intent == "navigation_correction"
    assert result.intent_mode == "correction"


def test_pending_follow_up_resolves_dynamic_intent_when_identifier_present() -> None:
    result = normalize_chorui_navigation_intent(
        message="for PT-ABCDEFGHJK",
        raw_intent="general",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-self",
        pending_intent="doctor_patient_reports",
        pending_missing_params=["id"],
        has_target_patient=False,
    )

    assert result.canonical_intent == "doctor_patient_reports"
    assert result.intent_mode == "follow_up"
    assert result.missing_params == []


def test_medication_ambiguity_prefers_suggestion_mode() -> None:
    result = normalize_chorui_navigation_intent(
        message="I forgot medicine and need medication orders",
        raw_intent="general",
        role_context=UserRole.PATIENT,
        context_mode="patient-self",
    )

    assert result.intent_mode == "suggestion"
    assert result.canonical_intent in {"prescriptions", "reminders"}
    assert "reminders" in set(result.ambiguity_candidates) | {result.canonical_intent}


def test_patient_emergency_contact_phrase_maps_to_profile_navigation() -> None:
    result = normalize_chorui_navigation_intent(
        message="Edit my emergency contac",
        raw_intent="general",
        role_context=UserRole.PATIENT,
        context_mode="patient-self",
    )

    assert result.canonical_intent == "patient_profile"
    assert result.intent_mode == "direct"
    assert result.confidence >= 0.85


def test_doctor_today_consultations_phrase_maps_to_appointments() -> None:
    result = normalize_chorui_navigation_intent(
        message="View today's consultations",
        raw_intent="doctor_self_schedule",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-general",
    )

    assert result.canonical_intent == "doctor_appointments"
    assert result.intent_mode == "direct"
    assert result.confidence >= 0.85


def test_doctor_show_my_analytics_phrase_maps_to_doctor_analytics() -> None:
    result = normalize_chorui_navigation_intent(
        message="show my analytics",
        raw_intent="general",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-general",
    )

    assert result.canonical_intent == "doctor_analytics"
    assert result.confidence >= 0.8


def test_doctor_my_patients_phrase_maps_to_doctor_patients() -> None:
    result = normalize_chorui_navigation_intent(
        message="my patients",
        raw_intent="general",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-general",
    )

    assert result.canonical_intent == "doctor_patients"
    assert result.confidence >= 0.8


def test_pending_follow_up_without_identifier_keeps_missing_param() -> None:
    result = normalize_chorui_navigation_intent(
        message="what about him",
        raw_intent="general",
        role_context=UserRole.DOCTOR,
        context_mode="doctor-self",
        pending_intent="doctor_patient_reports",
        pending_missing_params=["id"],
        has_target_patient=False,
    )

    assert result.canonical_intent == "doctor_patient_reports"
    assert result.intent_mode == "follow_up"
    assert result.missing_params == ["id"]
