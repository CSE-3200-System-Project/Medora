from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.db_concurrency import gather_reads
from app.core.dependencies import get_db
from app.core.record_coverage import build_record_coverage
from app.db.models.appointment import Appointment
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import HealthMetricSource, HealthMetricType, UserRole
from app.db.models.health_metric import HealthMetric
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.db.models.speciality import Speciality
from app.routes.auth import get_current_user_token
from app.schemas.patient_dashboard import (
    PatientDashboardAppointment,
    PatientDashboardDeviceStatus,
    PatientDashboardHealthStat,
    PatientDashboardResponse,
)

router = APIRouter()


async def _require_patient(db: AsyncSession, user: Any) -> Profile:
    """Validate caller role and reuse the authenticated user's profile where possible."""
    profile = getattr(user, "profile", None)
    if profile is None:
        profile = (
            await db.execute(select(Profile).where(Profile.id == user.id))
        ).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access dashboard",
        )
    return profile


@router.get("/dashboard", response_model=PatientDashboardResponse)
async def get_patient_dashboard(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    profile = await _require_patient(db, user)
    user_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() or "Patient"

    now = datetime.now(timezone.utc)
    day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    async def _load_patient_and_metrics(session: AsyncSession):
        latest_device_metric = aliased(HealthMetric)
        latest_device_sync = (
            select(func.max(latest_device_metric.recorded_at))
            .where(
                latest_device_metric.user_id == user.id,
                latest_device_metric.source == HealthMetricSource.DEVICE,
            )
            .scalar_subquery()
        )
        rows = (
            await session.execute(
                select(
                    PatientProfile,
                    HealthMetric,
                    latest_device_sync.label("latest_device_sync"),
                )
                .outerjoin(
                    HealthMetric,
                    and_(
                        HealthMetric.user_id == PatientProfile.profile_id,
                        HealthMetric.recorded_at >= day_start,
                        HealthMetric.recorded_at < day_end,
                    ),
                )
                .where(PatientProfile.profile_id == user.id)
                .order_by(HealthMetric.recorded_at.desc())
            )
        ).all()
        if not rows:
            return None, [], None
        return (
            rows[0][0],
            [row[1] for row in rows if row[1] is not None],
            rows[0][2],
        )

    async def _load_upcoming_appointments(session: AsyncSession):
        return (
            await session.execute(
                select(Appointment, Profile, DoctorProfile, Speciality)
                .outerjoin(Profile, Profile.id == Appointment.doctor_id)
                .outerjoin(DoctorProfile, DoctorProfile.profile_id == Appointment.doctor_id)
                .outerjoin(Speciality, Speciality.id == DoctorProfile.speciality_id)
                .where(Appointment.patient_id == user.id, Appointment.appointment_date >= now)
                .order_by(Appointment.appointment_date.asc())
                .limit(5)
            )
        ).all()

    (patient_and_metrics, upcoming_rows) = await gather_reads(
        _load_patient_and_metrics,
        _load_upcoming_appointments,
        max_concurrency=2,
    )
    _patient_profile, todays_metrics, latest_device_sync = patient_and_metrics

    upcoming_appointments = [
        PatientDashboardAppointment(
            id=item.id,
            doctor_name=(
                f"Dr. {doctor_name_profile.first_name or ''} {doctor_name_profile.last_name or ''}".strip()
                if doctor_name_profile
                else "Doctor"
            ),
            specialty=speciality.name if speciality else (doctor_profile.specialization if doctor_profile else None),
            appointment_date=item.appointment_date.isoformat(),
            status=str(getattr(item.status, "value", item.status)),
            reason=item.reason,
            doctor_photo_url=doctor_profile.profile_photo_url if doctor_profile else None,
        )
        for item, doctor_name_profile, doctor_profile, speciality in upcoming_rows
    ]

    latest_by_type: dict[str, HealthMetric] = {}
    for metric in todays_metrics:
        key = metric.metric_type.value
        if key not in latest_by_type:
            latest_by_type[key] = metric
    today_values = {key: float(metric.value) for key, metric in latest_by_type.items()}

    steps = today_values.get(HealthMetricType.STEPS.value)
    sleep = today_values.get(HealthMetricType.SLEEP_HOURS.value)
    heart_rate = today_values.get(HealthMetricType.HEART_RATE.value)
    systolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_SYSTOLIC.value)
    diastolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_DIASTOLIC.value)
    blood_pressure = f"{int(systolic)}/{int(diastolic)}" if systolic is not None and diastolic is not None else "N/A"

    today_health_stats = [
        PatientDashboardHealthStat(
            label="Steps Today",
            value=f"{int(steps):,}" if steps is not None else "N/A",
        ),
        PatientDashboardHealthStat(
            label="Sleep hours",
            value=f"{round(sleep, 1)}h" if sleep is not None else "N/A",
        ),
        PatientDashboardHealthStat(
            label="Heart rate",
            value=str(int(heart_rate)) if heart_rate is not None else "N/A",
        ),
        PatientDashboardHealthStat(label="Blood Pressure", value=blood_pressure),
    ]

    device_status = PatientDashboardDeviceStatus(
        title="Health Device Sync",
        last_synced=latest_device_sync.isoformat() if latest_device_sync else "No device sync yet",
        connected=latest_device_sync is not None,
    )

    return PatientDashboardResponse(
        user_name=user_name,
        record_coverage=build_record_coverage(todays_metrics, as_of=now),
        upcoming_appointments=upcoming_appointments,
        today_health_stats=today_health_stats,
        device_connection_status=device_status,
    )
