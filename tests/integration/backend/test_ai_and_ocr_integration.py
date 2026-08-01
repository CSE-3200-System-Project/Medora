from __future__ import annotations

import pytest

from app.db.models.doctor import DoctorProfile
from app.db.models.enums import UserRole
from app.db.models.patient import PatientProfile
from app.db.models.processing_consent import ProcessingConsentGrant
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.services.ai_orchestrator import ai_orchestrator
from tests.helpers.backend_factories import DoctorProfileFactory, PatientProfileFactory, ProfileFactory


pytestmark = [pytest.mark.backend, pytest.mark.integration]


_ONE_PIXEL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02"
    b"\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.mark.asyncio
async def test_prescription_ocr_endpoint_returns_structured_payload(
    backend_client,
    db_session,
    auth_token_map,
    monkeypatch,
) -> None:
    patient_account: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Nusrat", last_name="Jahan")
    patient_medical: PatientProfile = PatientProfileFactory(
        profile_id=patient_account.id,
        consent_ai=True,
        ai_personal_context_enabled=True,
    )
    db_session.add_all([patient_account, patient_medical])
    await db_session.commit()

    auth_token_map["patient-token"] = {"sub": patient_account.id, "email": patient_account.email}

    async def _fake_extract(
        *,
        file_name: str,
        content: bytes,
        content_type: str,
        subject_token: str | None = None,
        processing_mode: str,
    ):
        assert content_type == "image/png"
        assert processing_mode == "local"
        return {
            "medications": [
                {
                    "name": "Napa",
                    "dosage": "500mg",
                    "frequency": "1+0+1",
                    "quantity": "5 days",
                    "confidence": 0.93,
                }
            ],
            "raw_text": "Napa 500mg 1+0+1 5 days",
            "meta": {
                "model": "azure_prebuilt-read",
                "model_type": "read",
                "processing_time_ms": 420,
                "detected_regions": 1,
                "ocr_line_count": 1,
            },
        }

    monkeypatch.setattr("app.routes.upload._extract_prescription_with_ai_service", _fake_extract)

    response = await backend_client.post(
        "/upload/prescription/extract",
        headers={"Authorization": "Bearer patient-token"},
        data={"save_file": "false"},
        files={"file": ("rx.png", _ONE_PIXEL_PNG, "image/png")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["raw_text"] == "Napa 500mg 1+0+1 5 days"
    assert body["confidence"] >= 0.9
    assert body["medications"][0]["name"] == "Napa"
    assert body["meta"]["model"] == "azure_prebuilt-read"


@pytest.mark.asyncio
async def test_ai_doctor_search_pipeline_returns_ranked_doctor_results(
    backend_client,
    db_session,
    auth_token_map,
    monkeypatch,
) -> None:
    cardiology = Speciality(name="Cardiology")
    db_session.add(cardiology)
    await db_session.flush()

    doctor_account: Profile = ProfileFactory(role=UserRole.DOCTOR, first_name="Arefin", last_name="Sayeed")
    doctor_profile: DoctorProfile = DoctorProfileFactory(
        profile_id=doctor_account.id,
        speciality_id=cardiology.id,
        bmdc_verified=True,
        years_of_experience=15,
        hospital_city="Dhaka",
        consultation_mode="offline",
    )
    patient_account: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Nusrat", last_name="Jahan")
    patient_profile: PatientProfile = PatientProfileFactory(profile_id=patient_account.id)
    consent = ProcessingConsentGrant(
        subject_id=patient_account.id,
        purpose="external_text_ai",
        version=1,
        scopes=["external_text_ai"],
        provider=ai_orchestrator.provider,
        policy_version="softwarex-v1",
        granted_by_id=patient_account.id,
        audit_note="Integration-test fixture",
    )
    db_session.add_all([doctor_account, doctor_profile, patient_account, patient_profile])
    await db_session.flush()
    db_session.add(consent)
    await db_session.commit()
    auth_token_map["patient-token"] = {"sub": patient_account.id, "email": patient_account.email}

    async def _fake_verify_jwt(token: str):
        return auth_token_map[token]

    monkeypatch.setattr("app.routes.ai_doctor.verify_jwt", _fake_verify_jwt)

    llm_payload = {
        "language_detected": "mixed",
        "symptoms": [{"name": "chest pain", "confidence": 0.94}],
        "duration_days": 3,
        "specialties": [{"name": "Cardiology", "confidence": 0.95}],
        "ambiguity": "low",
    }

    async def _fake_navigation_intent(**kwargs):
        assert "available_specialties" in kwargs
        return llm_payload

    monkeypatch.setattr(ai_orchestrator, "extract_navigation_intent", _fake_navigation_intent)

    response = await backend_client.post(
        "/ai/search",
        headers={"Authorization": "Bearer patient-token"},
        json={
            "user_text": "আমার বুক অস্বস্তি হচ্ছে তিন দিন ধরে",
            "consultation_mode": "offline",
            "location": "Dhaka",
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["ambiguity"] == "low"
    assert payload["doctors"], payload
    assert payload["doctors"][0]["profile_id"] == doctor_account.id
    assert "Cardiology" in payload["medical_intent"]["primary_specialties"]
