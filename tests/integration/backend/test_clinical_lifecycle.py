from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.db.models.enums import UserRole
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from tests.helpers.backend_factories import DoctorProfileFactory, PatientProfileFactory, ProfileFactory


pytestmark = [pytest.mark.backend, pytest.mark.integration]


@pytest.mark.asyncio
async def test_auth_booking_consultation_prescription_lifecycle(backend_client, db_session, auth_token_map) -> None:
    patient_account: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Rahim", last_name="Uddin")
    doctor_account: Profile = ProfileFactory(role=UserRole.DOCTOR, first_name="Farhana", last_name="Islam")

    patient_medical: PatientProfile = PatientProfileFactory(profile_id=patient_account.id)
    doctor_profile = DoctorProfileFactory(profile_id=doctor_account.id, day_time_slots={"Friday": ["8:00 PM - 10:00 PM"]})

    db_session.add_all([patient_account, doctor_account, patient_medical, doctor_profile])
    await db_session.commit()

    auth_token_map["patient-token"] = {"sub": patient_account.id, "email": patient_account.email}
    auth_token_map["doctor-token"] = {"sub": doctor_account.id, "email": doctor_account.email}

    auth_me = await backend_client.get("/auth/me", headers={"Authorization": "Bearer patient-token"})
    assert auth_me.status_code == 200
    assert auth_me.json()["id"] == patient_account.id

    booking_date = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0)
    booking_payload = {
        "doctor_id": doctor_account.id,
        "appointment_date": booking_date.isoformat(),
        "reason": "Chest pain follow-up",
        "notes": "Slot: 8:00 PM",
    }

    create_appointment = await backend_client.post(
        "/appointment/",
        headers={"Authorization": "Bearer patient-token"},
        json=booking_payload,
    )
    assert create_appointment.status_code == 201, create_appointment.text
    appointment_id = create_appointment.json()["id"]
    assert create_appointment.json()["status"] == "PENDING"

    confirm_appointment = await backend_client.patch(
        f"/appointment/{appointment_id}",
        headers={"Authorization": "Bearer doctor-token"},
        json={"status": "CONFIRMED"},
    )
    assert confirm_appointment.status_code == 200, confirm_appointment.text
    assert confirm_appointment.json()["status"] == "CONFIRMED"

    consultation_response = await backend_client.post(
        "/consultation/",
        headers={"Authorization": "Bearer doctor-token"},
        json={
            "patient_id": patient_account.id,
            "appointment_id": appointment_id,
            "chief_complaint": "Persistent chest pressure",
            "notes": "Patient speaks Bangla and English.",
        },
    )
    assert consultation_response.status_code == 200, consultation_response.text
    consultation_id = consultation_response.json()["id"]

    prescription_response = await backend_client.post(
        f"/consultation/{consultation_id}/prescription",
        headers={"Authorization": "Bearer doctor-token"},
        json={
            "type": "medication",
            "notes": "Take after meal",
            "medications": [
                {
                    "medicine_name": "Napa",
                    "generic_name": "Paracetamol",
                    "strength": "500mg",
                    "dose_morning": True,
                    "dose_evening": True,
                    "duration_value": 5,
                    "duration_unit": "days",
                    "meal_instruction": "after_meal",
                }
            ],
        },
    )
    assert prescription_response.status_code == 200, prescription_response.text
    prescription_payload = prescription_response.json()
    prescription_id = prescription_payload["id"]
    assert prescription_payload["status"] == "pending"

    accept_response = await backend_client.post(
        f"/consultation/patient/prescription/{prescription_id}/accept",
        headers={"Authorization": "Bearer patient-token"},
    )
    assert accept_response.status_code == 200, accept_response.text
    assert accept_response.json()["status"] == "accepted"

    fetch_prescription = await backend_client.get(
        f"/consultation/patient/prescription/{prescription_id}",
        headers={"Authorization": "Bearer patient-token"},
    )
    assert fetch_prescription.status_code == 200, fetch_prescription.text
    assert fetch_prescription.json()["status"] == "accepted"
