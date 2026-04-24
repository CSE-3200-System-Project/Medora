from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import AccountStatus, UserRole, VerificationStatus
from app.db.models.notification import Notification, NotificationType
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile


def _profile(*, role: UserRole, first_name: str, last_name: str) -> Profile:
    identifier = str(uuid.uuid4())
    return Profile(
        id=identifier,
        role=role,
        status=AccountStatus.active,
        verification_status=VerificationStatus.verified,
        first_name=first_name,
        last_name=last_name,
        email=f"{first_name.lower()}.{last_name.lower()}@medora.test",
        phone="+8801700000000",
        onboarding_completed=True,
    )


@pytest.mark.backend
@pytest.mark.integration
@pytest.mark.asyncio
async def test_review_requires_completed_appointment(db_session, backend_client, auth_token_map):
    patient_profile = _profile(role=UserRole.PATIENT, first_name="Amina", last_name="Rahman")
    doctor_profile = _profile(role=UserRole.DOCTOR, first_name="Kabir", last_name="Hasan")
    patient = PatientProfile(profile_id=patient_profile.id, profile_photo_url="https://example.com/patient.png")
    doctor = DoctorProfile(
        profile_id=doctor_profile.id,
        bmdc_number="BMDC-123456",
        bmdc_verified=True,
        specialization="Cardiology",
    )

    db_session.add_all([patient_profile, doctor_profile, patient, doctor])
    await db_session.commit()

    auth_token_map["patient-token"] = {"sub": patient_profile.id, "email": patient_profile.email}

    response = await backend_client.post(
        "/reviews",
        headers={"Authorization": "Bearer patient-token"},
        json={"doctor_id": doctor.profile_id, "rating": 5, "note": "Too early"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only review a doctor after a completed appointment."


@pytest.mark.backend
@pytest.mark.integration
@pytest.mark.asyncio
async def test_review_moderation_flow(db_session, backend_client, auth_token_map):
    patient_profile = _profile(role=UserRole.PATIENT, first_name="Nila", last_name="Akter")
    doctor_profile = _profile(role=UserRole.DOCTOR, first_name="Farhan", last_name="Siddique")
    patient = PatientProfile(profile_id=patient_profile.id, profile_photo_url="https://example.com/patient.png")
    doctor = DoctorProfile(
        profile_id=doctor_profile.id,
        bmdc_number="BMDC-654321",
        bmdc_verified=True,
        specialization="Neurology",
        rating_avg=0,
        rating_count=0,
    )
    appointment = Appointment(
        id=str(uuid.uuid4()),
        doctor_id=doctor.profile_id,
        patient_id=patient.profile_id,
        status=AppointmentStatus.COMPLETED,
        appointment_date=datetime.now(timezone.utc) - timedelta(days=1),
        reason="Completed consultation",
    )

    db_session.add_all([patient_profile, doctor_profile, patient, doctor, appointment])
    await db_session.commit()

    auth_token_map["patient-token"] = {"sub": patient_profile.id, "email": patient_profile.email}

    create_response = await backend_client.post(
        "/reviews",
        headers={"Authorization": "Bearer patient-token"},
        json={
            "doctor_id": doctor.profile_id,
            "appointment_id": appointment.id,
            "rating": 5,
            "note": "Excellent care",
        },
    )
    assert create_response.status_code == 201, create_response.text
    created_review = create_response.json()
    assert created_review["status"] == "PENDING"

    public_before_approval = await backend_client.get(f"/doctor/{doctor.profile_id}/reviews?page=1&limit=5")
    assert public_before_approval.status_code == 200
    assert public_before_approval.json()["reviews"] == []
    assert public_before_approval.json()["rating_count"] == 0

    eligibility = await backend_client.get(
        f"/reviews/doctor/{doctor.profile_id}/eligibility",
        headers={"Authorization": "Bearer patient-token"},
    )
    assert eligibility.status_code == 200
    assert eligibility.json()["existing_review"]["status"] == "PENDING"

    approve_response = await backend_client.post(
        f"/admin/reviews/{created_review['id']}/approve",
        headers={"X-Admin-Password": "admin123"},
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["status"] == "APPROVED"

    public_after_approval = await backend_client.get(f"/doctor/{doctor.profile_id}/reviews?page=1&limit=5")
    assert public_after_approval.status_code == 200
    approved_payload = public_after_approval.json()
    assert len(approved_payload["reviews"]) == 1
    assert approved_payload["reviews"][0]["status"] == "APPROVED"
    assert approved_payload["rating_count"] == 1
    assert approved_payload["rating_avg"] == 5.0

    approval_notification = (
        await db_session.execute(
            select(Notification).where(
                Notification.user_id == patient_profile.id,
                Notification.type == NotificationType.REVIEW_APPROVED,
            )
        )
    ).scalar_one_or_none()
    assert approval_notification is not None
    assert approval_notification.message == "Your review has been approved and published."

    edit_response = await backend_client.post(
        "/reviews",
        headers={"Authorization": "Bearer patient-token"},
        json={
            "doctor_id": doctor.profile_id,
            "appointment_id": appointment.id,
            "rating": 2,
            "note": "Updating after follow-up",
        },
    )
    assert edit_response.status_code == 201, edit_response.text
    edited_review = edit_response.json()
    assert edited_review["id"] == created_review["id"]
    assert edited_review["status"] == "PENDING"

    public_after_edit = await backend_client.get(f"/doctor/{doctor.profile_id}/reviews?page=1&limit=5")
    assert public_after_edit.status_code == 200
    edited_public_payload = public_after_edit.json()
    assert edited_public_payload["reviews"] == []
    assert edited_public_payload["rating_count"] == 0
    assert edited_public_payload["rating_avg"] == 0.0

    reject_response = await backend_client.post(
        f"/admin/reviews/{created_review['id']}/reject",
        headers={"X-Admin-Password": "admin123"},
        json={"admin_feedback": "Please avoid personal attacks."},
    )
    assert reject_response.status_code == 200, reject_response.text
    assert reject_response.json()["status"] == "REJECTED"
    assert reject_response.json()["admin_feedback"] == "Please avoid personal attacks."

    eligibility_after_reject = await backend_client.get(
        f"/reviews/doctor/{doctor.profile_id}/eligibility",
        headers={"Authorization": "Bearer patient-token"},
    )
    assert eligibility_after_reject.status_code == 200
    assert eligibility_after_reject.json()["existing_review"]["status"] == "REJECTED"
    assert eligibility_after_reject.json()["existing_review"]["admin_feedback"] == "Please avoid personal attacks."

    rejection_notification = (
        await db_session.execute(
            select(Notification).where(
                Notification.user_id == patient_profile.id,
                Notification.type == NotificationType.REVIEW_REJECTED,
            )
        )
    ).scalar_one_or_none()
    assert rejection_notification is not None
    assert rejection_notification.message == "Your review was rejected: Please avoid personal attacks."
