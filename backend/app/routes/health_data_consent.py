from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.enums import HealthMetricType, UserRole
from app.db.models.health_data_consent import HealthDataConsent
from app.db.models.health_metric import HealthMetric
from app.db.models.profile import Profile
from app.db.models.doctor import DoctorProfile
from app.db.models.patient import PatientProfile
from app.routes.auth import get_current_user_token
from app.schemas.health_data_consent import (
    HealthDataConsentCreate,
    HealthDataConsentListResponse,
    HealthDataConsentResponse,
    HealthDataConsentUpdate,
    PatientHealthOverview,
)

router = APIRouter()


# ---------- Patient endpoints: manage consents ----------


@router.post("/consents", response_model=HealthDataConsentResponse, status_code=status.HTTP_201_CREATED)
async def grant_consent(
    data: HealthDataConsentCreate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient grants a doctor access to their health metrics."""
    profile = (await db.execute(select(Profile).where(Profile.id == user.id))).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can grant health data consent")

    # Verify doctor exists
    doctor = (await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id == data.doctor_id))).scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    # Check if consent already exists
    existing = (
        await db.execute(
            select(HealthDataConsent).where(
                HealthDataConsent.patient_id == user.id,
                HealthDataConsent.doctor_id == data.doctor_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        if existing.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Consent already granted to this doctor")
        # Re-activate revoked consent
        existing.is_active = True
        existing.revoked_at = None
        existing.granted_at = datetime.now(timezone.utc)
        existing.share_medical_tests = data.share_medical_tests
        await db.commit()
        await db.refresh(existing)

        doctor_profile = (await db.execute(select(Profile).where(Profile.id == data.doctor_id))).scalar_one_or_none()
        return HealthDataConsentResponse(
            id=existing.id,
            patient_id=existing.patient_id,
            doctor_id=existing.doctor_id,
            doctor_name=f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else None,
            is_active=existing.is_active,
            share_medical_tests=existing.share_medical_tests,
            granted_at=existing.granted_at,
            revoked_at=existing.revoked_at,
        )

    consent = HealthDataConsent(
        patient_id=user.id,
        doctor_id=data.doctor_id,
        share_medical_tests=data.share_medical_tests,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(consent)

    doctor_profile = (await db.execute(select(Profile).where(Profile.id == data.doctor_id))).scalar_one_or_none()
    return HealthDataConsentResponse(
        id=consent.id,
        patient_id=consent.patient_id,
        doctor_id=consent.doctor_id,
        doctor_name=f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else None,
        is_active=consent.is_active,
        share_medical_tests=consent.share_medical_tests,
        granted_at=consent.granted_at,
        revoked_at=consent.revoked_at,
    )


@router.patch("/consents/{consent_id}", response_model=HealthDataConsentResponse)
async def update_consent(
    consent_id: str,
    data: HealthDataConsentUpdate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient toggles whether their medical tests are shared with the doctor."""
    consent = (
        await db.execute(
            select(HealthDataConsent).where(
                HealthDataConsent.id == consent_id,
                HealthDataConsent.patient_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consent not found")
    if not consent.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update a revoked consent")

    consent.share_medical_tests = data.share_medical_tests
    await db.commit()
    await db.refresh(consent)

    doctor_profile = (await db.execute(select(Profile).where(Profile.id == consent.doctor_id))).scalar_one_or_none()
    return HealthDataConsentResponse(
        id=consent.id,
        patient_id=consent.patient_id,
        doctor_id=consent.doctor_id,
        doctor_name=f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else None,
        is_active=consent.is_active,
        share_medical_tests=consent.share_medical_tests,
        granted_at=consent.granted_at,
        revoked_at=consent.revoked_at,
    )


@router.delete("/consents/{consent_id}", status_code=status.HTTP_200_OK)
async def revoke_consent(
    consent_id: str,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient revokes a doctor's access to their health metrics."""
    consent = (
        await db.execute(
            select(HealthDataConsent).where(
                HealthDataConsent.id == consent_id,
                HealthDataConsent.patient_id == user.id,
            )
        )
    ).scalar_one_or_none()

    if not consent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consent not found")

    consent.is_active = False
    consent.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Consent revoked successfully"}


@router.get("/consents", response_model=HealthDataConsentListResponse)
async def list_my_consents(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Patient lists all their active health data consents."""
    profile = (await db.execute(select(Profile).where(Profile.id == user.id))).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can view their consents")

    rows = (
        await db.execute(
            select(HealthDataConsent)
            .where(HealthDataConsent.patient_id == user.id)
            .order_by(HealthDataConsent.granted_at.desc())
        )
    ).scalars().all()

    results = []
    for consent in rows:
        doctor_profile = (await db.execute(select(Profile).where(Profile.id == consent.doctor_id))).scalar_one_or_none()
        results.append(
            HealthDataConsentResponse(
                id=consent.id,
                patient_id=consent.patient_id,
                doctor_id=consent.doctor_id,
                doctor_name=f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}" if doctor_profile else None,
                is_active=consent.is_active,
                share_medical_tests=consent.share_medical_tests,
                granted_at=consent.granted_at,
                revoked_at=consent.revoked_at,
            )
        )

    return HealthDataConsentListResponse(consents=results, total=len(results))


# ---------- Doctor endpoint: view patient health data ----------


@router.get("/doctor/patient/{patient_id}/health", response_model=PatientHealthOverview)
async def get_patient_health_for_doctor(
    patient_id: str,
    days: int = Query(default=7, ge=1, le=730),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Doctor views a patient's health metrics (requires active consent)."""
    doctor_profile = (await db.execute(select(Profile).where(Profile.id == user.id))).scalar_one_or_none()
    if not doctor_profile or doctor_profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access this endpoint")

    # Check consent
    consent = (
        await db.execute(
            select(HealthDataConsent).where(
                HealthDataConsent.patient_id == patient_id,
                HealthDataConsent.doctor_id == user.id,
                HealthDataConsent.is_active == True,
            )
        )
    ).scalar_one_or_none()

    if not consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient has not granted you access to their health data",
        )

    # Get patient name
    patient_profile = (await db.execute(select(Profile).where(Profile.id == patient_id))).scalar_one_or_none()
    if not patient_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    patient_name = f"{patient_profile.first_name} {patient_profile.last_name}"

    # Get today's metrics
    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    today_rows = (
        await db.execute(
            select(HealthMetric)
            .where(
                HealthMetric.user_id == patient_id,
                HealthMetric.recorded_at >= start_of_day,
                HealthMetric.recorded_at < end_of_day,
            )
            .order_by(HealthMetric.recorded_at.desc())
        )
    ).scalars().all()

    latest_by_type: dict[str, dict] = {}
    for metric in today_rows:
        key = metric.metric_type.value
        if key not in latest_by_type:
            latest_by_type[key] = {
                "metric_type": key,
                "value": metric.value,
                "unit": metric.unit,
                "recorded_at": metric.recorded_at.isoformat(),
            }

    # Get trends
    since = now - timedelta(days=days)
    trend_rows = (
        await db.execute(
            select(HealthMetric)
            .where(HealthMetric.user_id == patient_id, HealthMetric.recorded_at >= since)
            .order_by(HealthMetric.metric_type.asc(), HealthMetric.recorded_at.asc())
        )
    ).scalars().all()

    grouped: dict[str, dict[str, list]] = {}
    for item in trend_rows:
        metric_key = item.metric_type.value
        day_key = item.recorded_at.date().isoformat()
        grouped.setdefault(metric_key, {})
        grouped[metric_key].setdefault(day_key, [])
        grouped[metric_key][day_key].append(item)

    trends = []
    for metric_key, by_day in grouped.items():
        points = []
        unit = ""
        for day, entries in sorted(by_day.items()):
            values = [float(e.value) for e in entries]
            unit = entries[-1].unit
            points.append({
                "date": day,
                "average_value": round(sum(values) / len(values), 2),
                "min_value": min(values),
                "max_value": max(values),
                "entries": len(values),
            })
        trends.append({
            "metric_type": metric_key,
            "unit": unit,
            "points": points,
        })

    medical_tests: list[dict[str, Any]] | None = None
    if consent.share_medical_tests:
        patient_profile_row = (
            await db.execute(
                select(PatientProfile).where(PatientProfile.profile_id == patient_id)
            )
        ).scalar_one_or_none()
        if patient_profile_row and patient_profile_row.medical_tests:
            tests = patient_profile_row.medical_tests
            medical_tests = tests if isinstance(tests, list) else []

    return PatientHealthOverview(
        patient_id=patient_id,
        patient_name=patient_name,
        today_metrics=list(latest_by_type.values()),
        trends=trends,
        consent_granted_at=consent.granted_at,
        share_medical_tests=consent.share_medical_tests,
        medical_tests=medical_tests,
    )


@router.get("/doctor/patients-with-consent")
async def list_patients_with_consent(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Doctor lists all patients who have granted them health data access."""
    doctor_profile = (await db.execute(select(Profile).where(Profile.id == user.id))).scalar_one_or_none()
    if not doctor_profile or doctor_profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access this endpoint")

    consents = (
        await db.execute(
            select(HealthDataConsent)
            .where(
                HealthDataConsent.doctor_id == user.id,
                HealthDataConsent.is_active == True,
            )
            .order_by(HealthDataConsent.granted_at.desc())
        )
    ).scalars().all()

    results = []
    for consent in consents:
        patient_profile = (await db.execute(select(Profile).where(Profile.id == consent.patient_id))).scalar_one_or_none()
        if patient_profile:
            results.append({
                "patient_id": consent.patient_id,
                "patient_name": f"{patient_profile.first_name} {patient_profile.last_name}",
                "consent_granted_at": consent.granted_at.isoformat(),
                "share_medical_tests": consent.share_medical_tests,
            })

    return {"patients": results, "total": len(results)}
