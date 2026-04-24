from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.doctor_action import DoctorAction
from app.db.models.enums import (
    DoctorActionPriority,
    DoctorActionStatus,
    DoctorActionType,
    UserRole,
)
from app.db.models.patient import PatientProfile
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.doctor_action import (
    DoctorActionCreate,
    DoctorActionDemographicPoint,
    DoctorActionListResponse,
    DoctorActionResponse,
    DoctorActionRevenuePoint,
    DoctorActionStatsPendingItem,
    DoctorActionStatsResponse,
    DoctorActionUpdate,
    DoctorActionWeeklyWsiPoint,
)
from app.services.doctor_action_service import create_doctor_action

router = APIRouter()


async def _require_doctor(db: AsyncSession, user) -> Profile:
    """Validate doctor role using the profile cached on user (from auth dep)."""
    profile = getattr(user, "profile", None)
    if profile is None:
        profile = (
            await db.execute(select(Profile).where(Profile.id == user.id))
        ).scalar_one_or_none()
    if not profile or profile.role != UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only doctors can access doctor actions")
    return profile


def _age_bucket(age: int | None) -> str:
    if age is None:
        return "Unknown"
    if age <= 18:
        return "0-18 Years"
    if age <= 45:
        return "19-45 Years"
    if age <= 64:
        return "46-64 Years"
    return "65+ Years"


def _compute_age(date_of_birth: Any) -> int | None:
    if not date_of_birth:
        return None
    today = datetime.now(timezone.utc).date()
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))


def _wsi_score(*, appointments: int, no_shows: int, pending_tasks: int, overdue_tasks: int) -> int:
    raw_score = (appointments * 1.1) + (pending_tasks * 2.4) + (overdue_tasks * 3.2) + (no_shows * 2.0)
    return int(max(0, min(100, round(raw_score))))


@router.post("/", response_model=DoctorActionResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_doctor_action(
    data: DoctorActionCreate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    action = await create_doctor_action(
        db,
        doctor_id=user.id,
        action_type=data.action_type,
        title=data.title,
        description=data.description,
        priority=data.priority,
        status=data.status,
        related_patient_id=data.related_patient_id,
        related_appointment_id=data.related_appointment_id,
        revenue_amount=data.revenue_amount,
        due_date=data.due_date,
        completed_at=datetime.now(timezone.utc) if data.status == DoctorActionStatus.COMPLETED else None,
    )
    await db.commit()
    await db.refresh(action)
    return action


@router.get("/", response_model=DoctorActionListResponse)
async def list_doctor_actions(
    status_filter: DoctorActionStatus | None = Query(default=None),
    type_filter: DoctorActionType | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)

    filters = [DoctorAction.doctor_id == user.id]
    if status_filter:
        filters.append(DoctorAction.status == status_filter)
    if type_filter:
        filters.append(DoctorAction.action_type == type_filter)
    if start_date:
        filters.append(DoctorAction.created_at >= start_date)
    if end_date:
        filters.append(DoctorAction.created_at <= end_date)

    actions = (
        await db.execute(
            select(DoctorAction)
            .where(and_(*filters))
            .order_by(DoctorAction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    total = (
        await db.execute(select(func.count(DoctorAction.id)).where(and_(*filters)))
    ).scalar() or 0

    return DoctorActionListResponse(actions=actions, total=int(total))


@router.get("/pending", response_model=DoctorActionListResponse)
async def get_pending_doctor_actions(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    actions = (
        await db.execute(
            select(DoctorAction)
            .where(
                DoctorAction.doctor_id == user.id,
                DoctorAction.status.in_([DoctorActionStatus.PENDING, DoctorActionStatus.IN_PROGRESS]),
            )
            .order_by(DoctorAction.priority.desc(), DoctorAction.created_at.desc())
            .limit(50)
        )
    ).scalars().all()

    return DoctorActionListResponse(actions=actions, total=len(actions))


@router.get("/stats", response_model=DoctorActionStatsResponse)
async def get_doctor_action_stats(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    month_end = (month_start + timedelta(days=35)).replace(day=1)

    # Reference day for weekly rollup (UTC midnight today).
    today_utc = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    weeks_start = today_utc - timedelta(days=28)  # 4 weeks back

    # ─── Single aggregate query: monthly revenue + totals + completed + pending ──
    # Collapses 4 separate count/sum queries into one round-trip via FILTER.
    action_stats_row = (
        await db.execute(
            select(
                func.coalesce(
                    func.sum(DoctorAction.revenue_amount).filter(
                        DoctorAction.created_at >= month_start,
                        DoctorAction.created_at < month_end,
                    ),
                    0.0,
                ).label("monthly_revenue"),
                func.count(DoctorAction.id).label("total_actions"),
                func.count(DoctorAction.id)
                .filter(DoctorAction.status == DoctorActionStatus.COMPLETED)
                .label("completed_actions"),
                func.count(DoctorAction.id)
                .filter(
                    DoctorAction.status.in_(
                        [DoctorActionStatus.PENDING, DoctorActionStatus.IN_PROGRESS]
                    )
                )
                .label("pending_total"),
            ).where(DoctorAction.doctor_id == user.id)
        )
    ).one()

    monthly_revenue = float(action_stats_row.monthly_revenue or 0.0)
    total_actions = int(action_stats_row.total_actions or 0)
    completed_actions = int(action_stats_row.completed_actions or 0)
    pending_actions_total = int(action_stats_row.pending_total or 0)
    completion_rate = round((completed_actions / total_actions) * 100.0, 1) if total_actions else 0.0

    # Top-N pending items (unchanged — single query already).
    pending_rows = (
        await db.execute(
            select(DoctorAction)
            .where(
                DoctorAction.doctor_id == user.id,
                DoctorAction.status.in_([DoctorActionStatus.PENDING, DoctorActionStatus.IN_PROGRESS]),
            )
            .order_by(DoctorAction.priority.desc(), DoctorAction.created_at.desc())
            .limit(6)
        )
    ).scalars().all()
    pending_actions = [
        DoctorActionStatsPendingItem(
            id=item.id,
            title=item.title,
            priority=item.priority,
            status=item.status,
            due_date=item.due_date.isoformat() if item.due_date else None,
            related_patient_id=item.related_patient_id,
        )
        for item in pending_rows
    ]

    # ─── Weekly appointment metrics: 8 queries → 1 ─────────────────────────────
    # For each of the 4 weeks, emit a FILTER-aggregated count. No GROUP BY, one
    # row. Weeks are indexed newest-first: index 0 = (today-7, today].
    appt_cols = []
    for i in range(4):
        we = today_utc - timedelta(days=i * 7)
        ws = we - timedelta(days=7)
        appt_cols.append(
            func.count(Appointment.id)
            .filter(Appointment.appointment_date >= ws, Appointment.appointment_date < we)
            .label(f"appts_{i}")
        )
        appt_cols.append(
            func.count(Appointment.id)
            .filter(
                Appointment.appointment_date >= ws,
                Appointment.appointment_date < we,
                Appointment.status == AppointmentStatus.NO_SHOW,
            )
            .label(f"noshow_{i}")
        )
    appt_row = (
        await db.execute(
            select(*appt_cols).where(Appointment.doctor_id == user.id)
        )
    ).one()

    # ─── Weekly action metrics: 12 queries → 1 ────────────────────────────────
    action_cols = []
    for i in range(4):
        we = today_utc - timedelta(days=i * 7)
        ws = we - timedelta(days=7)
        action_cols.append(
            func.count(DoctorAction.id)
            .filter(
                DoctorAction.created_at >= ws,
                DoctorAction.created_at < we,
                DoctorAction.status.in_(
                    [DoctorActionStatus.PENDING, DoctorActionStatus.IN_PROGRESS]
                ),
            )
            .label(f"pending_{i}")
        )
        action_cols.append(
            func.count(DoctorAction.id)
            .filter(
                DoctorAction.status.in_(
                    [DoctorActionStatus.PENDING, DoctorActionStatus.IN_PROGRESS]
                ),
                DoctorAction.due_date.is_not(None),
                DoctorAction.due_date < we,
            )
            .label(f"overdue_{i}")
        )
        action_cols.append(
            func.coalesce(
                func.sum(DoctorAction.revenue_amount).filter(
                    DoctorAction.created_at >= ws,
                    DoctorAction.created_at < we,
                ),
                0.0,
            ).label(f"revenue_{i}")
        )
    action_row = (
        await db.execute(
            select(*action_cols).where(DoctorAction.doctor_id == user.id)
        )
    ).one()

    weekly_wsi: list[DoctorActionWeeklyWsiPoint] = []
    revenue_trend: list[DoctorActionRevenuePoint] = []
    for index in range(4):
        appts = int(getattr(appt_row, f"appts_{index}", 0) or 0)
        no_shows = int(getattr(appt_row, f"noshow_{index}", 0) or 0)
        pending_tasks = int(getattr(action_row, f"pending_{index}", 0) or 0)
        overdue_tasks = int(getattr(action_row, f"overdue_{index}", 0) or 0)
        revenue = float(getattr(action_row, f"revenue_{index}", 0.0) or 0.0)
        weekly_wsi.append(
            DoctorActionWeeklyWsiPoint(
                week=f"Week {4 - index:02d}",
                appointments=appts,
                no_shows=no_shows,
                pending_tasks=pending_tasks,
                overdue_tasks=overdue_tasks,
                wsi=_wsi_score(
                    appointments=appts,
                    no_shows=no_shows,
                    pending_tasks=pending_tasks,
                    overdue_tasks=overdue_tasks,
                ),
            )
        )
        revenue_trend.append(
            DoctorActionRevenuePoint(week=f"Week {4 - index:02d}", revenue=float(round(revenue, 2)))
        )
    weekly_wsi.reverse()
    revenue_trend.reverse()

    # ─── Demographics: 2 queries → 1 JOIN ──────────────────────────────────────
    patient_profile_rows = (
        await db.execute(
            select(PatientProfile.date_of_birth)
            .join(Appointment, Appointment.patient_id == PatientProfile.profile_id)
            .where(Appointment.doctor_id == user.id)
            .group_by(PatientProfile.profile_id, PatientProfile.date_of_birth)
        )
    ).all()

    demographics: list[DoctorActionDemographicPoint] = []
    if patient_profile_rows:
        buckets = {
            "0-18 Years": 0,
            "19-45 Years": 0,
            "46-64 Years": 0,
            "65+ Years": 0,
            "Unknown": 0,
        }
        for row in patient_profile_rows:
            age = _compute_age(row[0])
            buckets[_age_bucket(age)] += 1

        total_profiles = max(1, sum(buckets.values()))
        for key in ["0-18 Years", "19-45 Years", "46-64 Years", "65+ Years"]:
            demographics.append(
                DoctorActionDemographicPoint(
                    range=key,
                    value=round((buckets.get(key, 0) / total_profiles) * 100.0, 2),
                )
            )
    else:
        demographics = [
            DoctorActionDemographicPoint(range="0-18 Years", value=0.0),
            DoctorActionDemographicPoint(range="19-45 Years", value=0.0),
            DoctorActionDemographicPoint(range="46-64 Years", value=0.0),
            DoctorActionDemographicPoint(range="65+ Years", value=0.0),
        ]

    return DoctorActionStatsResponse(
        monthly_revenue=float(round(monthly_revenue, 2)),
        weekly_wsi=weekly_wsi,
        pending_actions_count=int(pending_actions_total),
        pending_actions=pending_actions,
        completion_rate=completion_rate,
        revenue_trend=revenue_trend,
        demographic_breakdown=demographics,
    )


@router.patch("/{action_id}", response_model=DoctorActionResponse)
async def update_doctor_action(
    action_id: str,
    data: DoctorActionUpdate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)

    action = (
        await db.execute(select(DoctorAction).where(DoctorAction.id == action_id, DoctorAction.doctor_id == user.id))
    ).scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor action not found")

    if data.title is not None:
        action.title = data.title
    if data.description is not None:
        action.description = data.description
    if data.priority is not None:
        action.priority = data.priority
    if data.status is not None:
        action.status = data.status
        if data.status == DoctorActionStatus.COMPLETED and not action.completed_at:
            action.completed_at = datetime.now(timezone.utc)
    if data.related_patient_id is not None:
        action.related_patient_id = data.related_patient_id
    if data.related_appointment_id is not None:
        action.related_appointment_id = data.related_appointment_id
    if data.revenue_amount is not None:
        action.revenue_amount = data.revenue_amount
    if data.due_date is not None:
        action.due_date = data.due_date
    if data.completed_at is not None:
        action.completed_at = data.completed_at

    await db.commit()
    await db.refresh(action)
    return action


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_action(
    action_id: str,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_doctor(db, user)
    action = (
        await db.execute(select(DoctorAction).where(DoctorAction.id == action_id, DoctorAction.doctor_id == user.id))
    ).scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor action not found")

    await db.delete(action)
    await db.commit()
