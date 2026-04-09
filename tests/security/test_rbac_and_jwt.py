from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db.models.consultation import Consultation, Prescription
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import ConsultationStatus, PrescriptionStatus, PrescriptionType, UserRole
from app.db.models.patient import PatientProfile
from app.db.models.patient_access import AccessType, PatientAccessLog
from app.db.models.profile import Profile
from app.routes.patient_access import log_patient_access
from tests.helpers.backend_factories import DoctorProfileFactory, PatientProfileFactory, ProfileFactory


pytestmark = [pytest.mark.backend, pytest.mark.integration, pytest.mark.security]


@pytest.mark.asyncio
async def test_missing_authorization_header_is_rejected(backend_client) -> None:
    response = await backend_client.get("/appointment/my-appointments")
    assert response.status_code in {401, 422}


@pytest.mark.asyncio
async def test_invalid_jwt_token_is_rejected(backend_client) -> None:
    response = await backend_client.get("/auth/me", headers={"Authorization": "Bearer expired-token"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_boundary_blocks_non_admin_password_access(backend_client) -> None:
    denied = await backend_client.get("/admin/test")
    assert denied.status_code == 403

    allowed = await backend_client.get("/admin/test", headers={"x-admin-password": "admin123"})
    assert allowed.status_code == 200


@pytest.mark.asyncio
async def test_cross_user_prescription_access_is_blocked(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    doctor: Profile = ProfileFactory(role=UserRole.DOCTOR)
    patient_a: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Patient", last_name="A")
    patient_b: Profile = ProfileFactory(role=UserRole.PATIENT, first_name="Patient", last_name="B")

    doctor_profile: DoctorProfile = DoctorProfileFactory(profile_id=doctor.id)
    patient_a_profile: PatientProfile = PatientProfileFactory(profile_id=patient_a.id)
    patient_b_profile: PatientProfile = PatientProfileFactory(profile_id=patient_b.id)

    consultation = Consultation(
        id="consult-1",
        doctor_id=doctor.id,
        patient_id=patient_a.id,
        status=ConsultationStatus.OPEN,
        consultation_date=datetime.now(timezone.utc),
    )
    prescription = Prescription(
        id="rx-1",
        consultation_id=consultation.id,
        doctor_id=doctor.id,
        patient_id=patient_a.id,
        type=PrescriptionType.MEDICATION,
        status=PrescriptionStatus.PENDING,
    )

    db_session.add_all(
        [
            doctor,
            patient_a,
            patient_b,
            doctor_profile,
            patient_a_profile,
            patient_b_profile,
            consultation,
            prescription,
        ]
    )
    await db_session.commit()

    auth_token_map["patient-a-token"] = {"sub": patient_a.id, "email": patient_a.email}
    auth_token_map["patient-b-token"] = {"sub": patient_b.id, "email": patient_b.email}

    allowed = await backend_client.get(
        "/consultation/patient/prescription/rx-1",
        headers={"Authorization": "Bearer patient-a-token"},
    )
    assert allowed.status_code == 200

    blocked = await backend_client.get(
        "/consultation/patient/prescription/rx-1",
        headers={"Authorization": "Bearer patient-b-token"},
    )
    assert blocked.status_code == 403
    assert "don't have access" in blocked.text.lower()


@pytest.mark.asyncio
async def test_ai_query_access_is_audit_logged(db_session) -> None:
    doctor: Profile = ProfileFactory(role=UserRole.DOCTOR)
    patient: Profile = ProfileFactory(role=UserRole.PATIENT)

    db_session.add_all(
        [
            doctor,
            patient,
            DoctorProfileFactory(profile_id=doctor.id),
            PatientProfileFactory(profile_id=patient.id),
        ]
    )
    await db_session.commit()

    await log_patient_access(
        db_session,
        patient_id=patient.id,
        doctor_id=doctor.id,
        access_type=AccessType.VIEW_AI_QUERY,
        request=None,
    )

    rows = await db_session.execute(
        PatientAccessLog.__table__.select().where(
            PatientAccessLog.patient_id == patient.id,
            PatientAccessLog.doctor_id == doctor.id,
        )
    )
    record = rows.first()
    assert record is not None
    assert "VIEW_AI_QUERY".lower() in str(record.access_type).lower()
