from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.appointment import Appointment
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import HealthMetricSource, HealthMetricType, UserRole
from app.db.models.health_metric import HealthMetric
from app.db.models.profile import Profile
from app.db.models.reminder import Reminder, ReminderDeliveryLog, ReminderType
from app.db.models.speciality import Speciality
from app.routes.auth import get_current_user_token
from app.schemas.patient_dashboard import (
    PatientDashboardAppointment,
    PatientDashboardDeviceStatus,
    PatientDashboardHealthStat,
    PatientDashboardInsight,
    PatientDashboardMedicationTrend,
    PatientDashboardResponse,
)

router = APIRouter()


def _weekday_labels(last_days: int) -> list[str]:
    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=index) for index in reversed(range(last_days))]
    return [item.strftime("%a").upper() for item in days]


def _day_expected_doses(reminders: list[Reminder], day: date) -> int:
    weekday = day.weekday()
    expected = 0
    for reminder in reminders:
        active_days = reminder.days_of_week or [0, 1, 2, 3, 4, 5, 6]
        if weekday in active_days:
            expected += len(reminder.reminder_times or [])
    return expected


def _health_score_from_metrics(today_values: dict[str, float], adherence_rate: int) -> int:
    score = 50
    steps = today_values.get(HealthMetricType.STEPS.value)
    heart_rate = today_values.get(HealthMetricType.HEART_RATE.value)
    sleep_hours = today_values.get(HealthMetricType.SLEEP_HOURS.value)
    systolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_SYSTOLIC.value)
    diastolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_DIASTOLIC.value)

    if steps is not None:
        score += 12 if steps >= 8000 else 8 if steps >= 5000 else 3
    if heart_rate is not None:
        score += 8 if 55 <= heart_rate <= 90 else 3
    if sleep_hours is not None:
        score += 8 if sleep_hours >= 7 else 4 if sleep_hours >= 6 else 2
    if systolic is not None and diastolic is not None:
        score += 10 if systolic <= 130 and diastolic <= 85 else 4

    score += int(round((adherence_rate / 100.0) * 12))
    return max(0, min(100, score))


async def _require_patient(db: AsyncSession, user_id: str) -> None:
    profile = (await db.execute(select(Profile).where(Profile.id == user_id))).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can access dashboard")


@router.get("/dashboard", response_model=PatientDashboardResponse)
async def get_patient_dashboard(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user.id)

    profile = (await db.execute(select(Profile).where(Profile.id == user.id))).scalar_one_or_none()
    user_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() if profile else "Patient"

    now = datetime.now(timezone.utc)

    upcoming_appts = (
        await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == user.id, Appointment.appointment_date >= now)
            .order_by(Appointment.appointment_date.asc())
            .limit(5)
        )
    ).scalars().all()

    doctor_ids = list({item.doctor_id for item in upcoming_appts})
    doctor_profiles = {}
    doctor_name_profiles = {}
    speciality_map = {}
    if doctor_ids:
        doctor_profiles = {
            item.profile_id: item
            for item in (await db.execute(select(DoctorProfile).where(DoctorProfile.profile_id.in_(doctor_ids)))).scalars().all()
        }
        doctor_name_profiles = {
            item.id: item for item in (await db.execute(select(Profile).where(Profile.id.in_(doctor_ids)))).scalars().all()
        }
        speciality_ids = [item.speciality_id for item in doctor_profiles.values() if item.speciality_id]
        if speciality_ids:
            speciality_map = {
                item.id: item
                for item in (await db.execute(select(Speciality).where(Speciality.id.in_(speciality_ids)))).scalars().all()
            }

    upcoming_appointments = []
    for item in upcoming_appts:
        doctor_name_profile = doctor_name_profiles.get(item.doctor_id)
        doctor_profile = doctor_profiles.get(item.doctor_id)
        speciality = speciality_map.get(doctor_profile.speciality_id) if doctor_profile and doctor_profile.speciality_id else None
        upcoming_appointments.append(
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
            )
        )

    day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    todays_metrics = (
        await db.execute(
            select(HealthMetric)
            .where(
                HealthMetric.user_id == user.id,
                HealthMetric.recorded_at >= day_start,
                HealthMetric.recorded_at < day_end,
            )
            .order_by(HealthMetric.recorded_at.desc())
        )
    ).scalars().all()

    latest_by_type: dict[str, HealthMetric] = {}
    for metric in todays_metrics:
        key = metric.metric_type.value
        if key not in latest_by_type:
            latest_by_type[key] = metric

    today_values = {key: float(item.value) for key, item in latest_by_type.items()}

    reminders = (
        await db.execute(
            select(Reminder).where(
                Reminder.user_id == user.id,
                Reminder.type == ReminderType.MEDICATION,
                Reminder.is_active == True,
            )
        )
    ).scalars().all()

    trend_days = [day_start.date() - timedelta(days=index) for index in reversed(range(7))]
    delivery_logs = (
        await db.execute(
            select(
                func.date(ReminderDeliveryLog.scheduled_for_utc).label("day"),
                func.count(ReminderDeliveryLog.id).label("count"),
            )
            .where(
                ReminderDeliveryLog.user_id == user.id,
                ReminderDeliveryLog.scheduled_for_utc >= datetime.combine(trend_days[0], time.min, tzinfo=timezone.utc),
                ReminderDeliveryLog.scheduled_for_utc < datetime.combine(day_end.date(), time.min, tzinfo=timezone.utc) + timedelta(days=1),
            )
            .group_by(func.date(ReminderDeliveryLog.scheduled_for_utc))
        )
    ).all()
    delivered_by_day = {str(row.day): int(row.count or 0) for row in delivery_logs}

    adherence_values: list[int] = []
    for day in trend_days:
        expected = _day_expected_doses(reminders, day)
        delivered = delivered_by_day.get(str(day), 0)
        if expected <= 0:
            adherence_values.append(0)
        else:
            adherence_values.append(int(max(0, min(100, round((delivered / expected) * 100.0)))))

    adherence_rate = int(round(sum(adherence_values) / max(1, len(adherence_values))))
    baseline = sum(adherence_values[:3]) / max(1, min(3, len(adherence_values)))
    recent = sum(adherence_values[-3:]) / max(1, min(3, len(adherence_values)))
    delta_percent = round(recent - baseline, 1)

    medication_trend = PatientDashboardMedicationTrend(
        labels=_weekday_labels(7),
        values=adherence_values,
        adherence_rate=adherence_rate,
        delta_percent=delta_percent,
    )

    systolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_SYSTOLIC.value)
    diastolic = today_values.get(HealthMetricType.BLOOD_PRESSURE_DIASTOLIC.value)
    blood_pressure_value = (
        f"{int(systolic)}/{int(diastolic)}" if systolic is not None and diastolic is not None else "N/A"
    )

    today_health_stats = [
        PatientDashboardHealthStat(
            label="Steps Today",
            value=f"{int(today_values.get(HealthMetricType.STEPS.value, 0)):,}" if today_values.get(HealthMetricType.STEPS.value) is not None else "N/A",
            trend=f"{delta_percent:+.1f}%",
            trend_type="up" if delta_percent >= 0 else "down",
        ),
        PatientDashboardHealthStat(
            label="Avg Sleep",
            value=(
                f"{round(today_values.get(HealthMetricType.SLEEP_HOURS.value, 0), 1)}h"
                if today_values.get(HealthMetricType.SLEEP_HOURS.value) is not None
                else "N/A"
            ),
            trend="Stable",
            trend_type="neutral",
        ),
        PatientDashboardHealthStat(
            label="BPM (Resting)",
            value=(
                str(int(today_values.get(HealthMetricType.HEART_RATE.value, 0)))
                if today_values.get(HealthMetricType.HEART_RATE.value) is not None
                else "N/A"
            ),
            trend="Tracked",
            trend_type="neutral",
        ),
        PatientDashboardHealthStat(
            label="Blood Pressure",
            value=blood_pressure_value,
            trend="Monitored",
            trend_type="neutral",
        ),
    ]

    health_score = _health_score_from_metrics(today_values, adherence_rate)

    insights: list[PatientDashboardInsight] = []
    insights.append(
        PatientDashboardInsight(
            title="Medication Adherence",
            description=f"Your 7-day adherence average is {adherence_rate}%. Keep reminders active for stronger trend accuracy.",
            tone="success" if adherence_rate >= 80 else "warning",
        )
    )
    if today_values.get(HealthMetricType.SLEEP_HOURS.value) is not None:
        sleep = float(today_values.get(HealthMetricType.SLEEP_HOURS.value, 0))
        insights.append(
            PatientDashboardInsight(
                title="Sleep Monitoring",
                description=(
                    "Sleep duration is within your target range today."
                    if sleep >= 7
                    else "Sleep duration is below target. Consider an earlier bedtime for recovery."
                ),
                tone="success" if sleep >= 7 else "warning",
            )
        )
    if blood_pressure_value != "N/A":
        insights.append(
            PatientDashboardInsight(
                title="Blood Pressure Tracking",
                description=f"Latest reading is {blood_pressure_value}. Continue regular tracking for better trend detection.",
                tone="info",
            )
        )

    latest_device_metric = (
        await db.execute(
            select(HealthMetric)
            .where(HealthMetric.user_id == user.id, HealthMetric.source == HealthMetricSource.DEVICE)
            .order_by(HealthMetric.recorded_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    device_status = PatientDashboardDeviceStatus(
        title="Health Device Sync",
        last_synced=(latest_device_metric.recorded_at.isoformat() if latest_device_metric else "No device sync yet"),
        connected=latest_device_metric is not None,
    )

    return PatientDashboardResponse(
        user_name=user_name,
        health_score=health_score,
        upcoming_appointments=upcoming_appointments,
        medication_adherence_trend=medication_trend,
        today_health_stats=today_health_stats,
        ai_insights=insights,
        device_connection_status=device_status,
    )
