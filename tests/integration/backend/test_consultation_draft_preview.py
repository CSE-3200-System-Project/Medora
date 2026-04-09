from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models.consultation import Consultation
from app.db.models.enums import UserRole
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from tests.helpers.backend_factories import DoctorProfileFactory, PatientProfileFactory, ProfileFactory


pytestmark = [pytest.mark.backend, pytest.mark.integration]


@pytest.mark.asyncio
async def test_consultation_draft_persists_and_full_preview_uses_draft(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    patient_account: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Mina", last_name="Akter")
    doctor_account: Profile = ProfileFactory(role=UserRole.DOCTOR, first_name="Tariq", last_name="Hasan")

    patient_medical: PatientProfile = PatientProfileFactory(profile_id=patient_account.id)
    doctor_profile = DoctorProfileFactory(profile_id=doctor_account.id)

    db_session.add_all([patient_account, doctor_account, patient_medical, doctor_profile])
    await db_session.commit()

    auth_token_map["patient-token"] = {"sub": patient_account.id, "email": patient_account.email}
    auth_token_map["doctor-token"] = {"sub": doctor_account.id, "email": doctor_account.email}

    consultation_response = await backend_client.post(
        "/consultation/",
        headers={"Authorization": "Bearer doctor-token"},
        json={
            "patient_id": patient_account.id,
            "chief_complaint": "Initial note",
            "notes": "Initial doctor note",
        },
    )
    assert consultation_response.status_code == 200, consultation_response.text
    consultation_id = consultation_response.json()["id"]

    draft_payload = {
        "chief_complaint": "Persistent headache",
        "diagnosis": "Migraine",
        "notes": "Hydration and rest advised.",
        "prescription_type": "medication",
        "prescription_notes": "Follow up after 5 days.",
        "medications": [
            {
                "medicine_name": "Napa",
                "medicine_type": "tablet",
                "strength": "500mg",
                "dose_morning": True,
                "dose_afternoon": False,
                "dose_evening": True,
                "duration_value": 5,
                "duration_unit": "days",
                "meal_instruction": "after_meal",
                "quantity": 10,
            }
        ],
        "tests": [
            {
                "test_name": "CBC",
                "urgency": "normal",
            }
        ],
        "surgeries": [],
    }

    save_draft = await backend_client.patch(
        f"/consultation/{consultation_id}/draft",
        headers={"Authorization": "Bearer doctor-token"},
        json=draft_payload,
    )
    assert save_draft.status_code == 200, save_draft.text
    saved_draft_json = save_draft.json()
    draft_id = saved_draft_json.get("draft_id")
    assert draft_id

    get_draft = await backend_client.get(
        f"/consultation/{consultation_id}/draft",
        headers={"Authorization": "Bearer doctor-token"},
    )
    assert get_draft.status_code == 200, get_draft.text
    draft_json = get_draft.json()
    assert draft_json["chief_complaint"] == "Persistent headache"
    assert draft_json["diagnosis"] == "Migraine"
    assert draft_json["draft_id"] == draft_id
    assert draft_json["medications"][0]["medicine_name"] == "Napa"
    assert draft_json["medications"][0]["quantity"] == 10
    assert draft_json["patient_info"]["name"] == "Mina Akter"
    assert draft_json["doctor_info"]["name"].endswith("Tariq Hasan")

    get_draft_by_id = await backend_client.get(
        f"/consultation/drafts/{draft_id}",
        headers={"Authorization": "Bearer doctor-token"},
    )
    assert get_draft_by_id.status_code == 200, get_draft_by_id.text
    assert get_draft_by_id.json()["consultation_id"] == consultation_id

    patch_draft_by_id = await backend_client.patch(
        f"/consultation/drafts/{draft_id}",
        headers={"Authorization": "Bearer doctor-token"},
        json={"notes": "Hydration and rest advised. Return if symptoms worsen."},
    )
    assert patch_draft_by_id.status_code == 200, patch_draft_by_id.text
    assert patch_draft_by_id.json()["notes"] == "Hydration and rest advised. Return if symptoms worsen."

    # Simulate a legacy draft payload shape persisted before canonical key alignment.
    consultation_result = await db_session.execute(
        select(Consultation)
        .options(selectinload(Consultation.draft))
        .where(Consultation.id == consultation_id)
    )
    consultation_record = consultation_result.scalar_one()
    assert consultation_record.draft is not None

    consultation_record.draft.payload = {
        "chief_complaint": "Persistent headache",
        "diagnosis": "Migraine",
        "notes": "Hydration and rest advised. Return if symptoms worsen.",
        "prescription_type": "medication",
        "medications": [
            {
                "name": "Napa",
                "medicine_type": "tablet",
                "strength": "500mg",
                "dose_morning": True,
                "dose_afternoon": False,
                "dose_evening": True,
                "start_date": "",
                "end_date": "",
                "duration_value": 5,
                "duration_unit": "days",
                "meal_instruction": "after_meal",
            }
        ],
        "tests": [{"name": "CBC", "urgency": "normal", "expected_date": ""}],
        "surgeries": [{"name": "ENT evaluation", "urgency": "scheduled", "recommended_date": ""}],
        "doctor_info": {"name": "Dr. Tariq Hasan"},
        "patient_info": {"name": "Mina Akter"},
    }
    await db_session.commit()

    legacy_shape_draft = await backend_client.get(
        f"/consultation/{consultation_id}/draft",
        headers={"Authorization": "Bearer doctor-token"},
    )
    assert legacy_shape_draft.status_code == 200, legacy_shape_draft.text
    legacy_shape_json = legacy_shape_draft.json()
    assert legacy_shape_json["medications"][0]["medicine_name"] == "Napa"
    assert legacy_shape_json["tests"][0]["test_name"] == "CBC"
    assert legacy_shape_json["surgeries"][0]["procedure_name"] == "ENT evaluation"

    full_preview = await backend_client.get(
        f"/consultation/{consultation_id}/full",
        headers={"Authorization": "Bearer doctor-token"},
    )
    assert full_preview.status_code == 200, full_preview.text
    full_payload = full_preview.json()

    assert full_payload["consultation"]["chief_complaint"] == "Persistent headache"
    assert full_payload["consultation"]["diagnosis"] == "Migraine"
    assert full_payload["data_source"] == "draft"
    assert full_payload["medications"][0]["medicine_name"] == "Napa"
    assert full_payload["medications"][0]["dosage_pattern"] == "1-0-1"
    assert full_payload["medications"][0]["quantity"] == 10
    assert full_payload["medications"][0]["meal_instruction"] == "After meal"
    assert full_payload["tests"][0]["test_name"] == "CBC"

    legacy_full_preview = await backend_client.get(
        f"/consultation/prescriptions/{consultation_id}/full",
        headers={"Authorization": "Bearer doctor-token"},
    )
    assert legacy_full_preview.status_code == 200, legacy_full_preview.text
    assert legacy_full_preview.json()["medications"][0]["dosage_pattern"] == "1-0-1"
