from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db.models.consultation import Consultation, Prescription
from app.db.models.admin_governance import AdminRole, AdminScope
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import (
    AdminTier,
    ConsultationStatus,
    Permission,
    PrescriptionStatus,
    PrescriptionType,
    UserRole,
)
from app.db.models.patient import PatientProfile
from app.db.models.patient_access import AccessType, PatientAccessLog
from app.db.models.profile import Profile
from app.routes.patient_access import log_patient_access
from scripts.provision_admin import provision_admin
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
async def test_admin_boundary_requires_account_role(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    patient = ProfileFactory(role=UserRole.PATIENT)
    doctor = ProfileFactory(role=UserRole.DOCTOR)
    admin = ProfileFactory(role=UserRole.ADMIN)
    db_session.add_all([patient, doctor, admin])
    await db_session.commit()
    auth_token_map.update(
        {
            "patient-token": {"sub": patient.id, "email": patient.email},
            "doctor-token": {"sub": doctor.id, "email": doctor.email},
            "admin-token": {"sub": admin.id, "email": admin.email},
        }
    )

    for token in ("patient-token", "doctor-token"):
        denied = await backend_client.get(
            "/admin/test",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert denied.status_code == 403

    password_only = await backend_client.get(
        "/admin/test",
        headers={"x-admin-password": "test-admin-password-123"},
    )
    assert password_only.status_code in {401, 422}

    unprovisioned = await backend_client.get(
        "/admin/test",
        headers={"Authorization": "Bearer admin-token"},
    )
    assert unprovisioned.status_code == 403
    assert unprovisioned.json()["detail"] == "Administrator role is not provisioned"

    db_session.add(
        AdminRole(
            profile_id=admin.id,
            tier=AdminTier.SUPER_ADMIN.value,
            permission_set=[permission.value for permission in Permission],
        )
    )
    await db_session.commit()

    allowed = await backend_client.get(
        "/admin/test",
        headers={"Authorization": "Bearer admin-token"},
    )
    assert allowed.status_code == 200


@pytest.mark.asyncio
async def test_patient_replace_cannot_bypass_destructive_workflow(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    patient = ProfileFactory(role=UserRole.PATIENT)
    admin = ProfileFactory(role=UserRole.ADMIN)
    db_session.add_all([patient, admin, PatientProfileFactory(profile_id=patient.id)])
    await db_session.flush()
    db_session.add(
        AdminRole(
            profile_id=admin.id,
            tier=AdminTier.SUPER_ADMIN.value,
            permission_set=[permission.value for permission in Permission],
        )
    )
    await db_session.commit()
    auth_token_map["admin-token"] = {"sub": admin.id, "email": admin.email}

    response = await backend_client.put(
        f"/admin/patients/{patient.id}",
        headers={"Authorization": "Bearer admin-token"},
        json={"status": "banned", "ban_reason": "bypass"},
    )

    assert response.status_code == 400
    assert "dedicated workflow" in response.json()["detail"]
    await db_session.refresh(patient)
    assert patient.status.value == "active"


@pytest.mark.asyncio
async def test_function_admin_doctor_scope_filters_lists_and_mutations(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    admin = ProfileFactory(role=UserRole.ADMIN)
    doctor_a = ProfileFactory(role=UserRole.DOCTOR)
    doctor_b = ProfileFactory(role=UserRole.DOCTOR)
    db_session.add_all(
        [
            admin,
            doctor_a,
            doctor_b,
            DoctorProfileFactory(profile_id=doctor_a.id),
            DoctorProfileFactory(profile_id=doctor_b.id),
        ]
    )
    await db_session.flush()
    role = AdminRole(
        profile_id=admin.id,
        tier=AdminTier.FUNCTION_ADMIN.value,
        permission_set=[Permission.MANAGE_DOCTORS.value, Permission.PLATFORM_ADMIN.value],
    )
    db_session.add(role)
    await db_session.flush()
    db_session.add(
        AdminScope(
            admin_role_id=role.id,
            scope_type="doctor",
            scope_id=doctor_a.id,
        )
    )
    await db_session.commit()
    auth_token_map["scoped-admin-token"] = {"sub": admin.id, "email": admin.email}
    headers = {"Authorization": "Bearer scoped-admin-token"}

    listed = await backend_client.get("/admin/doctors", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["doctors"]] == [doctor_a.id]

    denied = await backend_client.post(
        f"/admin/verify-doctor/{doctor_b.id}",
        headers=headers,
        json={"approved": True, "verification_method": "manual", "notes": "reviewed"},
    )
    assert denied.status_code == 403

    platform_denied = await backend_client.get("/admin/test", headers=headers)
    assert platform_denied.status_code == 403


@pytest.mark.asyncio
async def test_admin_provisioning_updates_profile_role_and_scope_atomically(db_session) -> None:
    profile = ProfileFactory(role=UserRole.PATIENT)
    db_session.add(profile)
    await db_session.commit()

    role = await provision_admin(
        db_session,
        email=profile.email,
        tier=AdminTier.FUNCTION_ADMIN,
        permissions=[Permission.MANAGE_PATIENTS],
        scopes=[("patient", profile.id)],
    )
    await db_session.commit()

    await db_session.refresh(profile)
    assert profile.role == UserRole.ADMIN
    assert role.active is True
    assert role.permission_set == [Permission.MANAGE_PATIENTS.value]
    scope_rows = (
        await db_session.execute(
            AdminScope.__table__.select().where(AdminScope.admin_role_id == role.id)
        )
    ).mappings().all()
    assert [(row["scope_type"], row["scope_id"]) for row in scope_rows] == [
        ("patient", profile.id)
    ]


@pytest.mark.asyncio
async def test_role_resource_matrix_denies_every_cross_role_combination(
    backend_client,
    db_session,
    auth_token_map,
) -> None:
    """Exercise the 3x3 patient/doctor/admin resource boundary through the API."""
    patient = ProfileFactory(role=UserRole.PATIENT)
    doctor = ProfileFactory(role=UserRole.DOCTOR)
    admin = ProfileFactory(role=UserRole.ADMIN)
    db_session.add_all(
        [
            patient,
            doctor,
            admin,
            PatientProfileFactory(profile_id=patient.id),
            DoctorProfileFactory(profile_id=doctor.id),
        ]
    )
    await db_session.flush()
    db_session.add(
        AdminRole(
            profile_id=admin.id,
            tier=AdminTier.SUPER_ADMIN.value,
            permission_set=[permission.value for permission in Permission],
        )
    )
    await db_session.commit()

    profiles = {"patient": patient, "doctor": doctor, "admin": admin}
    for role, profile in profiles.items():
        auth_token_map[f"{role}-matrix-token"] = {
            "sub": profile.id,
            "email": profile.email,
        }

    resources = {
        "patient": "/consultation/patient/prescriptions",
        "doctor": "/appointment/doctor/patients",
        "admin": "/admin/test",
    }
    for caller_role in profiles:
        headers = {"Authorization": f"Bearer {caller_role}-matrix-token"}
        for resource_role, path in resources.items():
            response = await backend_client.get(path, headers=headers)
            if caller_role == resource_role:
                assert response.status_code == 200, (caller_role, resource_role, response.text)
            else:
                assert response.status_code == 403, (caller_role, resource_role, response.text)


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
        status=PrescriptionStatus.PENDING_ACKNOWLEDGMENT,
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
