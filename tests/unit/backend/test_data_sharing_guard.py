from __future__ import annotations

from app.core.data_sharing_guard import (
    SharingPermissions,
    build_ai_restriction_notice,
    filter_doctor_patient_response,
    filter_extended_context,
    filter_raw_summary,
)


def test_filter_doctor_patient_response_masks_unshared_fields() -> None:
    perms = SharingPermissions(
        can_view_profile=True,
        can_view_conditions=False,
        can_view_medications=False,
        can_view_allergies=False,
        can_view_medical_history=False,
        can_view_family_history=False,
        can_view_lifestyle=False,
        can_view_vaccinations=False,
        can_view_reports=False,
        can_view_health_metrics=False,
        can_view_prescriptions=False,
    )
    response = {
        "id": "patient-1",
        "first_name": "Rahim",
        "last_name": "Khan",
        "chronic_conditions": ["Diabetes"],
        "medications": [{"name": "Metformin"}],
        "drug_allergies": [{"drug_name": "Penicillin"}],
        "height": 175,
        "weight": 80,
    }

    filtered = filter_doctor_patient_response(response, perms)

    assert filtered["first_name"] == "Rahim"
    assert filtered["chronic_conditions"] == []
    assert filtered["medications"] == []
    assert filtered["drug_allergies"] == []
    assert filtered["height"] is None
    assert filtered["data_sharing_restrictions"]["any_restricted"] is True


def test_filter_raw_summary_strips_restricted_categories() -> None:
    perms = SharingPermissions(
        can_view_conditions=False,
        can_view_medications=False,
        can_view_allergies=False,
        can_view_medical_history=False,
    )
    raw_summary = {
        "patient_ref": "PT-ABCDEFGH12",
        "conditions": ["Hypertension"],
        "medications": ["Amlodipine"],
        "allergies": ["Penicillin"],
        "risk_flags": ["Cardiovascular Risk High"],
        "history": {
            "surgeries": [{"name": "Bypass"}],
            "hospitalizations": [{"reason": "Chest pain"}],
            "drug_allergies": [{"drug_name": "Penicillin"}],
            "family_history_notes": "Family has hypertension",
        },
        "family_history": ["Family history of hypertension"],
    }

    filtered = filter_raw_summary(raw_summary, perms)

    assert filtered["patient_ref"] == "PT-ABCDEFGH12"
    assert filtered["conditions"] == []
    assert filtered["risk_flags"] == []
    assert filtered["medications"] == []
    assert filtered["allergies"] == []
    assert filtered["history"]["surgeries"] == []
    assert filtered["history"]["hospitalizations"] == []
    assert filtered["history"]["drug_allergies"] == []


def test_filter_extended_context_respects_profile_and_prescription_permissions() -> None:
    perms = SharingPermissions(
        can_view_profile=False,
        can_view_health_metrics=False,
        can_view_medical_history=False,
        can_view_prescriptions=False,
        can_view_lifestyle=False,
    )
    context = {
        "demographics": {
            "display_name": "Rahim Khan",
            "age": 45,
            "gender": "male",
            "blood_group": "B+",
            "height_cm": 172,
            "weight_kg": 78,
        },
        "recent_consultations": [{"id": "c1"}],
        "recent_prescriptions": [{"id": "p1"}],
        "lifestyle": {"smoking": "never"},
    }

    filtered = filter_extended_context(context, perms)

    assert filtered["demographics"]["display_name"] == "[Restricted by patient]"
    assert filtered["demographics"]["age"] is None
    assert filtered["demographics"]["height_cm"] is None
    assert filtered["recent_consultations"] == []
    assert filtered["recent_prescriptions"] == []
    assert filtered["lifestyle"] == {}


def test_build_ai_restriction_notice_contains_unshared_categories() -> None:
    perms = SharingPermissions(
        can_view_profile=True,
        can_view_conditions=True,
        can_view_medications=False,
        can_view_allergies=False,
    )
    notice = build_ai_restriction_notice(perms)

    assert notice is not None
    assert "Medications" in notice
    assert "Allergies" in notice
