from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.appointment import Appointment
from app.db.models.doctor import DoctorProfile
from app.db.models.enums import HealthMetricSource, HealthMetricType, UserRole
from app.db.models.health_metric import HealthMetric
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.db.models.reminder import Reminder, ReminderDeliveryLog, ReminderType
from app.db.models.speciality import Speciality
from app.routes.auth import get_current_user_token
from app.schemas.patient_dashboard import (
    PatientDashboardAppointment,
    PatientDashboardBMI,
    PatientDashboardDeviceStatus,
    PatientDashboardHealthStat,
    PatientDashboardInsight,
    PatientDashboardMedicationTrend,
    PatientDashboardResponse,
    PatientDashboardScoreBreakdown,
    PatientDashboardScoreFactor,
)

router = APIRouter()


CHRONIC_CONDITION_FIELDS: list[tuple[str, str]] = [
    ("has_diabetes", "Diabetes"),
    ("has_hypertension", "Hypertension"),
    ("has_heart_disease", "Heart Disease"),
    ("has_asthma", "Asthma"),
    ("has_kidney_disease", "Kidney Disease"),
    ("has_liver_disease", "Liver Disease"),
    ("has_thyroid", "Thyroid"),
    ("has_neurological", "Neurological"),
    ("has_cancer", "Cancer"),
    ("has_arthritis", "Arthritis"),
    ("has_stroke", "Stroke"),
    ("has_epilepsy", "Epilepsy"),
    ("has_mental_health", "Mental Health"),
]


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


def _bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Normal"
    if bmi < 30:
        return "Overweight"
    if bmi < 35:
        return "Obese (Class I)"
    if bmi < 40:
        return "Obese (Class II)"
    return "Obese (Class III)"


def _bp_category(systolic: float, diastolic: float) -> str:
    if systolic < 120 and diastolic < 80:
        return "Normal"
    if systolic < 130 and diastolic < 80:
        return "Elevated"
    if systolic < 140 or diastolic < 90:
        return "Stage 1 Hypertension"
    if systolic < 180 or diastolic < 120:
        return "Stage 2 Hypertension"
    return "Hypertensive Crisis"


def _score_activity(steps: float | None) -> tuple[int, int, str, str]:
    max_pts = 15
    if steps is None:
        return 0, max_pts, "missing", "Log your steps to score this factor."
    if steps >= 8000:
        return 15, max_pts, "good", f"{int(steps):,} steps — target achieved."
    if steps >= 5000:
        return 10, max_pts, "warning", f"{int(steps):,} steps — aim for 8,000."
    return 4, max_pts, "warning", f"{int(steps):,} steps — well below 8,000 target."


def _score_heart_rate(hr: float | None) -> tuple[int, int, str, str]:
    max_pts = 10
    if hr is None:
        return 0, max_pts, "missing", "Log resting heart rate to score this factor."
    if 55 <= hr <= 90:
        return 10, max_pts, "good", f"{int(hr)} bpm — within healthy resting range."
    if 45 <= hr < 55 or 90 < hr <= 100:
        return 5, max_pts, "warning", f"{int(hr)} bpm — outside ideal range."
    return 2, max_pts, "warning", f"{int(hr)} bpm — consider consulting a doctor."


def _score_sleep(sleep: float | None) -> tuple[int, int, str, str]:
    max_pts = 12
    if sleep is None:
        return 0, max_pts, "missing", "Log sleep duration to score this factor."
    if sleep >= 7:
        return 12, max_pts, "good", f"{sleep:.1f}h — meets the 7–9h recommendation."
    if sleep >= 6:
        return 7, max_pts, "warning", f"{sleep:.1f}h — slightly below target."
    return 3, max_pts, "warning", f"{sleep:.1f}h — too little rest."


def _score_bp(systolic: float | None, diastolic: float | None) -> tuple[int, int, str, str]:
    max_pts = 13
    if systolic is None or diastolic is None:
        return 0, max_pts, "missing", "Log blood pressure to score this factor."
    category = _bp_category(systolic, diastolic)
    if category == "Normal":
        return 13, max_pts, "good", f"{int(systolic)}/{int(diastolic)} — normal range."
    if category == "Elevated":
        return 8, max_pts, "warning", f"{int(systolic)}/{int(diastolic)} — elevated."
    return 3, max_pts, "warning", f"{int(systolic)}/{int(diastolic)} — {category}."


def _score_adherence(adherence_rate: int) -> tuple[int, int, str, str]:
    max_pts = 20
    points = int(round((adherence_rate / 100.0) * max_pts))
    if adherence_rate >= 80:
        return points, max_pts, "good", f"{adherence_rate}% 7-day adherence — strong consistency."
    if adherence_rate >= 50:
        return points, max_pts, "warning", f"{adherence_rate}% adherence — room to improve."
    return points, max_pts, "warning", f"{adherence_rate}% adherence — reminders may need attention."


def _score_bmi(bmi: float | None) -> tuple[int, int, str, str]:
    max_pts = 15
    if bmi is None:
        return 0, max_pts, "missing", "Add height and weight in your profile to score this."
    category = _bmi_category(bmi)
    if 18.5 <= bmi < 25:
        return 15, max_pts, "good", f"BMI {bmi:.1f} — {category}."
    if bmi < 18.5 or 25 <= bmi < 30:
        return 9, max_pts, "warning", f"BMI {bmi:.1f} — {category}."
    return 3, max_pts, "warning", f"BMI {bmi:.1f} — {category}."


def _score_chronic(conditions_count: int) -> tuple[int, int, str, str]:
    max_pts = 15
    if conditions_count == 0:
        return 15, max_pts, "good", "No chronic conditions recorded."
    if conditions_count == 1:
        return 10, max_pts, "warning", "1 chronic condition — stay on top of your care plan."
    if conditions_count == 2:
        return 6, max_pts, "warning", "2 chronic conditions — coordinate with your care team."
    return 3, max_pts, "warning", f"{conditions_count} chronic conditions — prioritize regular follow-ups."


async def _require_patient(db: AsyncSession, user) -> Profile:
    """Validate the caller is a patient and return the (cached) profile.

    Reuses ``user.profile`` loaded by get_current_user_token to avoid a
    redundant Profile lookup on every dashboard request.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        profile = (
            await db.execute(select(Profile).where(Profile.id == user.id))
        ).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can access dashboard")
    return profile


@router.get("/dashboard", response_model=PatientDashboardResponse)
async def get_patient_dashboard(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    profile = await _require_patient(db, user)
    user_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip() if profile else "Patient"

    patient_profile = (
        await db.execute(select(PatientProfile).where(PatientProfile.profile_id == user.id))
    ).scalar_one_or_none()

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
    doctor_profiles: dict[str, DoctorProfile] = {}
    doctor_name_profiles: dict[str, Profile] = {}
    speciality_map: dict[str, Speciality] = {}
    if doctor_ids:
        # Single LEFT JOIN fetches Profile + DoctorProfile + Speciality in one
        # round-trip instead of three sequential IN queries.
        doctor_rows = (
            await db.execute(
                select(Profile, DoctorProfile, Speciality)
                .outerjoin(DoctorProfile, DoctorProfile.profile_id == Profile.id)
                .outerjoin(Speciality, Speciality.id == DoctorProfile.speciality_id)
                .where(Profile.id.in_(doctor_ids))
            )
        ).all()
        for name_profile, doctor_profile, speciality in doctor_rows:
            if name_profile is not None:
                doctor_name_profiles[name_profile.id] = name_profile
            if doctor_profile is not None:
                doctor_profiles[doctor_profile.profile_id] = doctor_profile
            if speciality is not None:
                speciality_map[speciality.id] = speciality

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
                doctor_photo_url=doctor_profile.profile_photo_url if doctor_profile else None,
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
            select(Reminder)
            .where(
                Reminder.user_id == user.id,
                Reminder.type == ReminderType.MEDICATION,
                Reminder.is_active == True,
            )
            # Defensive cap: a single user is never expected to have hundreds
            # of active medication reminders; this bounds the dashboard cost.
            .limit(200)
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

    # BMI and chronic conditions from patient profile
    bmi_value: float | None = None
    height_cm = patient_profile.height if patient_profile else None
    weight_kg = patient_profile.weight if patient_profile else None
    if height_cm and weight_kg and height_cm > 0:
        height_m = float(height_cm) / 100.0
        if height_m > 0:
            bmi_value = round(float(weight_kg) / (height_m * height_m), 1)

    chronic_list: list[str] = []
    if patient_profile:
        for field, label in CHRONIC_CONDITION_FIELDS:
            if getattr(patient_profile, field, False):
                chronic_list.append(label)
    chronic_count = len(chronic_list)

    active_meds_count = 0
    if patient_profile and patient_profile.medications:
        active_meds_count = len(patient_profile.medications)

    # Score breakdown (max = 100)
    steps_val = today_values.get(HealthMetricType.STEPS.value)
    hr_val = today_values.get(HealthMetricType.HEART_RATE.value)
    sleep_val = today_values.get(HealthMetricType.SLEEP_HOURS.value)

    activity_pts, activity_max, activity_status, activity_detail = _score_activity(steps_val)
    hr_pts, hr_max, hr_status, hr_detail = _score_heart_rate(hr_val)
    sleep_pts, sleep_max, sleep_status, sleep_detail = _score_sleep(sleep_val)
    bp_pts, bp_max, bp_status, bp_detail = _score_bp(systolic, diastolic)
    adh_pts, adh_max, adh_status, adh_detail = _score_adherence(adherence_rate)
    bmi_pts, bmi_max, bmi_status, bmi_detail = _score_bmi(bmi_value)
    chronic_pts, chronic_max, chronic_status, chronic_detail = _score_chronic(chronic_count)

    factors = [
        PatientDashboardScoreFactor(label="Activity", points=activity_pts, max_points=activity_max, status=activity_status, detail=activity_detail),
        PatientDashboardScoreFactor(label="Heart Rate", points=hr_pts, max_points=hr_max, status=hr_status, detail=hr_detail),
        PatientDashboardScoreFactor(label="Sleep", points=sleep_pts, max_points=sleep_max, status=sleep_status, detail=sleep_detail),
        PatientDashboardScoreFactor(label="Blood Pressure", points=bp_pts, max_points=bp_max, status=bp_status, detail=bp_detail),
        PatientDashboardScoreFactor(label="Medication Adherence", points=adh_pts, max_points=adh_max, status=adh_status, detail=adh_detail),
        PatientDashboardScoreFactor(label="BMI", points=bmi_pts, max_points=bmi_max, status=bmi_status, detail=bmi_detail),
        PatientDashboardScoreFactor(label="Chronic Load", points=chronic_pts, max_points=chronic_max, status=chronic_status, detail=chronic_detail),
    ]

    total_points = sum(f.points for f in factors)
    max_total = sum(f.max_points for f in factors)
    health_score = int(round((total_points / max(1, max_total)) * 100))
    health_score = max(0, min(100, health_score))

    missing_factors = [f for f in factors if f.status == "missing"]
    if health_score >= 80:
        summary = "Your overall health signals look strong. Keep the consistent tracking."
    elif health_score >= 60:
        summary = "You're doing well — a few factors could use attention."
    else:
        summary = "Several factors need attention. Review the breakdown below to prioritize."
    if missing_factors:
        summary += f" Log {', '.join(f.label.lower() for f in missing_factors[:3])} for a more accurate score."

    score_breakdown = PatientDashboardScoreBreakdown(
        total=total_points,
        max_total=max_total,
        factors=factors,
        summary=summary,
    )

    bmi_payload = PatientDashboardBMI(
        value=bmi_value,
        category=_bmi_category(bmi_value) if bmi_value is not None else None,
        height_cm=float(height_cm) if height_cm else None,
        weight_kg=float(weight_kg) if weight_kg else None,
    )

    # === Rich AI-style insights ===
    insights: list[PatientDashboardInsight] = []

    # Medication adherence
    insights.append(
        PatientDashboardInsight(
            title="Medication Adherence",
            description=(
                f"Your 7-day adherence is {adherence_rate}%. Great consistency — keep it up!"
                if adherence_rate >= 80
                else f"Your 7-day adherence is {adherence_rate}%. Check your reminders to stay on track."
            ),
            tone="success" if adherence_rate >= 80 else "warning",
            icon="Pill",
        )
    )

    # Sleep
    if sleep_val is not None:
        if sleep_val >= 7:
            insights.append(PatientDashboardInsight(
                title="Sleep Monitoring",
                description=f"You slept {sleep_val:.1f} hours — within your recovery target.",
                tone="success",
                icon="MoonStar",
            ))
        else:
            insights.append(PatientDashboardInsight(
                title="Sleep Monitoring",
                description=f"Only {sleep_val:.1f} hours of sleep logged. Aim for 7–9 hours for better recovery.",
                tone="warning",
                icon="MoonStar",
            ))
    else:
        insights.append(PatientDashboardInsight(
            title="Sleep Tracking",
            description="No sleep data logged today. Logging sleep improves score accuracy and trend detection.",
            tone="info",
            icon="MoonStar",
        ))

    # Blood pressure
    if systolic is not None and diastolic is not None:
        category = _bp_category(systolic, diastolic)
        tone = "success" if category == "Normal" else ("warning" if category in {"Elevated", "Stage 1 Hypertension"} else "danger")
        insights.append(PatientDashboardInsight(
            title="Blood Pressure",
            description=f"Latest reading {int(systolic)}/{int(diastolic)} — {category}.",
            tone=tone,
            icon="Activity",
        ))

    # Steps / activity
    if steps_val is not None:
        if steps_val >= 8000:
            insights.append(PatientDashboardInsight(
                title="Daily Movement",
                description=f"{int(steps_val):,} steps — you've met today's activity goal.",
                tone="success",
                icon="Footprints",
            ))
        else:
            insights.append(PatientDashboardInsight(
                title="Daily Movement",
                description=f"{int(steps_val):,} steps so far. A brisk 20-minute walk can close the gap.",
                tone="warning",
                icon="Footprints",
            ))

    # Heart rate
    if hr_val is not None:
        if 55 <= hr_val <= 90:
            insights.append(PatientDashboardInsight(
                title="Resting Heart Rate",
                description=f"{int(hr_val)} bpm — in the healthy resting range.",
                tone="success",
                icon="Heart",
            ))
        else:
            insights.append(PatientDashboardInsight(
                title="Resting Heart Rate",
                description=f"{int(hr_val)} bpm is outside the 55–90 range. Discuss with your doctor if it persists.",
                tone="warning",
                icon="Heart",
            ))

    # BMI
    if bmi_value is not None:
        category = _bmi_category(bmi_value)
        tone = "success" if 18.5 <= bmi_value < 25 else "warning"
        insights.append(PatientDashboardInsight(
            title="Body Mass Index",
            description=f"BMI {bmi_value:.1f} — {category}. Based on {int(height_cm)}cm and {int(weight_kg)}kg.",
            tone=tone,
            icon="Scale",
        ))
    else:
        insights.append(PatientDashboardInsight(
            title="Body Mass Index",
            description="Add your height and weight in Profile to unlock BMI tracking.",
            tone="info",
            icon="Scale",
        ))

    # Chronic conditions
    if chronic_count > 0:
        insights.append(PatientDashboardInsight(
            title="Chronic Care",
            description=(
                f"You're managing {chronic_count} chronic condition"
                f"{'s' if chronic_count != 1 else ''}: {', '.join(chronic_list[:4])}"
                f"{'…' if len(chronic_list) > 4 else ''}. Regular follow-ups help keep these stable."
            ),
            tone="info",
            icon="HeartPulse",
        ))

    # Medications count
    if active_meds_count > 0:
        insights.append(PatientDashboardInsight(
            title="Active Medications",
            description=(
                f"{active_meds_count} medication{'s' if active_meds_count != 1 else ''} on record. "
                f"Review interactions with your pharmacist at each refill."
                if active_meds_count >= 3
                else f"{active_meds_count} medication{'s' if active_meds_count != 1 else ''} on record. Set reminders for each dose."
            ),
            tone="info",
            icon="Pill",
        ))

    # Hydration
    water = patient_profile.water_intake if patient_profile else None
    if water:
        insights.append(PatientDashboardInsight(
            title="Hydration",
            description=f"Logged water intake: {water} glasses/day. Aim for 8 glasses to stay well hydrated.",
            tone="info",
            icon="Droplets",
        ))

    # Activity level from profile
    if patient_profile and patient_profile.activity_level:
        level = str(patient_profile.activity_level).lower()
        if level in {"sedentary"}:
            insights.append(PatientDashboardInsight(
                title="Lifestyle",
                description="Your activity level is sedentary. Adding 30 minutes of light activity most days has large health returns.",
                tone="warning",
                icon="Activity",
            ))
        elif level in {"active", "very_active"}:
            insights.append(PatientDashboardInsight(
                title="Lifestyle",
                description=f"Activity level: {level.replace('_', ' ')}. Keep it up — regular movement protects long-term health.",
                tone="success",
                icon="Activity",
            ))

    # Smoking / alcohol
    if patient_profile and patient_profile.smoking and str(patient_profile.smoking).lower() == "current":
        insights.append(PatientDashboardInsight(
            title="Smoking",
            description="Current smoker — quitting is the single highest-impact change for long-term health.",
            tone="warning",
            icon="AlertTriangle",
        ))

    # Vaccinations gap
    if patient_profile and patient_profile.vaccination_status:
        status_val = str(patient_profile.vaccination_status).lower()
        if status_val in {"partial", "unknown"}:
            insights.append(PatientDashboardInsight(
                title="Vaccinations",
                description=f"Vaccination status: {status_val}. Review your records with your doctor to close any gaps.",
                tone="warning",
                icon="Syringe",
            ))

    # Upcoming appointment reminder
    if upcoming_appointments:
        next_appt = upcoming_appointments[0]
        insights.append(PatientDashboardInsight(
            title="Next Appointment",
            description=f"{next_appt.doctor_name} on {next_appt.appointment_date[:10]}. Prepare questions in advance.",
            tone="info",
            icon="CalendarClock",
        ))

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
        score_breakdown=score_breakdown,
        bmi=bmi_payload,
        chronic_conditions_count=chronic_count,
        chronic_conditions=chronic_list,
        active_medications_count=active_meds_count,
        upcoming_appointments=upcoming_appointments,
        medication_adherence_trend=medication_trend,
        today_health_stats=today_health_stats,
        ai_insights=insights,
        device_connection_status=device_status,
    )
