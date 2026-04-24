from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.db.models.enums import HealthMetricType, UserRole
from app.db.models.health_metric import HealthMetric
from app.db.models.profile import Profile
from app.routes.auth import get_current_user_token
from app.schemas.health_metric import (
    HealthMetricCreate,
    HealthMetricListResponse,
    HealthMetricResponse,
    HealthMetricTodayResponse,
    HealthMetricTodaySummary,
    HealthMetricTrendPoint,
    HealthMetricTrendSeries,
    HealthMetricTrendsResponse,
    HealthMetricUpdate,
)

router = APIRouter()


async def _require_patient(db: AsyncSession, user) -> Profile:
    """Validate patient role using the profile cached on user (from auth dep)."""
    profile = getattr(user, "profile", None)
    if profile is None:
        profile = (
            await db.execute(select(Profile).where(Profile.id == user.id))
        ).scalar_one_or_none()
    if not profile or profile.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patients can access health metrics")
    return profile


@router.post("/", response_model=HealthMetricResponse, status_code=status.HTTP_201_CREATED)
async def create_health_metric(
    data: HealthMetricCreate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    metric = HealthMetric(
        user_id=user.id,
        metric_type=data.metric_type,
        value=data.value,
        unit=data.unit.strip(),
        recorded_at=data.recorded_at or datetime.now(timezone.utc),
        source=data.source,
        notes=(data.notes or "").strip() or None,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


@router.get("/", response_model=HealthMetricListResponse)
async def list_health_metrics(
    metric_type: HealthMetricType | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    filters = [HealthMetric.user_id == user.id]
    if metric_type:
        filters.append(HealthMetric.metric_type == metric_type)
    if start_date:
        filters.append(HealthMetric.recorded_at >= start_date)
    if end_date:
        filters.append(HealthMetric.recorded_at <= end_date)

    query = (
        select(HealthMetric)
        .where(and_(*filters))
        .order_by(HealthMetric.recorded_at.desc())
        .limit(limit)
        .offset(offset)
    )
    metrics = (await db.execute(query)).scalars().all()

    total = (
        await db.execute(select(func.count(HealthMetric.id)).where(and_(*filters)))
    ).scalar() or 0

    return HealthMetricListResponse(metrics=metrics, total=int(total))


@router.get("/today", response_model=HealthMetricTodayResponse)
async def get_today_metrics(
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    rows = (
        await db.execute(
            select(HealthMetric)
            .where(
                HealthMetric.user_id == user.id,
                HealthMetric.recorded_at >= start_of_day,
                HealthMetric.recorded_at < end_of_day,
            )
            .order_by(HealthMetric.recorded_at.desc())
        )
    ).scalars().all()

    latest_by_type: dict[str, HealthMetric] = {}
    for metric in rows:
        key = metric.metric_type.value
        if key not in latest_by_type:
            latest_by_type[key] = metric

    summary = [
        HealthMetricTodaySummary(
            metric_type=item.metric_type,
            value=item.value,
            unit=item.unit,
            source=item.source,
            recorded_at=item.recorded_at,
        )
        for item in latest_by_type.values()
    ]

    return HealthMetricTodayResponse(date=start_of_day.date().isoformat(), summary=summary)


@router.get("/trends", response_model=HealthMetricTrendsResponse)
async def get_metric_trends(
    days: int = Query(default=7, ge=1, le=730),
    metric_type: HealthMetricType | None = Query(default=None),
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    since = datetime.now(timezone.utc) - timedelta(days=days)
    filters = [HealthMetric.user_id == user.id, HealthMetric.recorded_at >= since]
    if metric_type:
        filters.append(HealthMetric.metric_type == metric_type)

    rows = (
        await db.execute(
            select(HealthMetric)
            .where(and_(*filters))
            .order_by(HealthMetric.metric_type.asc(), HealthMetric.recorded_at.asc())
        )
    ).scalars().all()

    grouped: dict[str, dict[str, list[HealthMetric]]] = {}
    for item in rows:
        metric_key = item.metric_type.value
        day_key = item.recorded_at.date().isoformat()
        grouped.setdefault(metric_key, {})
        grouped[metric_key].setdefault(day_key, [])
        grouped[metric_key][day_key].append(item)

    trends: list[HealthMetricTrendSeries] = []
    for metric_key, by_day in grouped.items():
        points: list[HealthMetricTrendPoint] = []
        unit = ""
        for day, entries in sorted(by_day.items(), key=lambda pair: pair[0]):
            values = [float(item.value) for item in entries]
            unit = entries[-1].unit
            points.append(
                HealthMetricTrendPoint(
                    date=day,
                    average_value=round(sum(values) / len(values), 2),
                    min_value=min(values),
                    max_value=max(values),
                    entries=len(values),
                )
            )
        trends.append(
            HealthMetricTrendSeries(
                metric_type=HealthMetricType(metric_key),
                unit=unit,
                points=points,
            )
        )

    return HealthMetricTrendsResponse(days=days, trends=trends)


@router.patch("/{metric_id}", response_model=HealthMetricResponse)
async def update_health_metric(
    metric_id: str,
    data: HealthMetricUpdate,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    metric = (
        await db.execute(select(HealthMetric).where(HealthMetric.id == metric_id, HealthMetric.user_id == user.id))
    ).scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health metric not found")

    if data.value is not None:
        metric.value = data.value
    if data.unit is not None:
        metric.unit = data.unit.strip()
    if data.recorded_at is not None:
        metric.recorded_at = data.recorded_at
    if data.source is not None:
        metric.source = data.source
    if data.notes is not None:
        metric.notes = (data.notes or "").strip() or None

    await db.commit()
    await db.refresh(metric)
    return metric


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_metric(
    metric_id: str,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    metric = (
        await db.execute(select(HealthMetric).where(HealthMetric.id == metric_id, HealthMetric.user_id == user.id))
    ).scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health metric not found")

    await db.delete(metric)
    await db.commit()
