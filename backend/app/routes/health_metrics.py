from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import and_, cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.http_cache import build_etag, is_not_modified, set_cache_headers, not_modified_response
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
    request: Request,
    response: Response,
    user: Any = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    await _require_patient(db, user)

    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    # SQL-side: pick the latest row per metric_type using DISTINCT ON.
    rows = (
        await db.execute(
            select(HealthMetric)
            .where(
                HealthMetric.user_id == user.id,
                HealthMetric.recorded_at >= start_of_day,
                HealthMetric.recorded_at < end_of_day,
            )
            .order_by(HealthMetric.metric_type.asc(), HealthMetric.recorded_at.desc())
            .distinct(HealthMetric.metric_type)
        )
    ).scalars().all()

    summary = [
        HealthMetricTodaySummary(
            metric_type=item.metric_type,
            value=item.value,
            unit=item.unit,
            source=item.source,
            recorded_at=item.recorded_at,
        )
        for item in rows
    ]

    payload = HealthMetricTodayResponse(date=start_of_day.date().isoformat(), summary=summary)
    body_for_etag = payload.model_dump(mode="json")
    etag = build_etag(body_for_etag)
    if is_not_modified(request, etag):
        return not_modified_response(response)
    set_cache_headers(response, etag=etag, max_age_seconds=20, stale_while_revalidate_seconds=120)
    return payload


@router.get("/trends", response_model=HealthMetricTrendsResponse)
async def get_metric_trends(
    request: Request,
    response: Response,
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

    # SQL-side aggregation: bucket by (metric_type, date) so we never load full rows.
    day_col = cast(HealthMetric.recorded_at, Date).label("day")
    agg_rows = (
        await db.execute(
            select(
                HealthMetric.metric_type.label("metric_type"),
                day_col,
                func.avg(HealthMetric.value).label("avg_value"),
                func.min(HealthMetric.value).label("min_value"),
                func.max(HealthMetric.value).label("max_value"),
                func.count(HealthMetric.id).label("entries"),
            )
            .where(and_(*filters))
            .group_by(HealthMetric.metric_type, day_col)
            .order_by(HealthMetric.metric_type.asc(), day_col.asc())
        )
    ).all()

    # One small query to get the latest unit per metric_type (cheap).
    unit_rows = (
        await db.execute(
            select(HealthMetric.metric_type, HealthMetric.unit)
            .where(and_(*filters))
            .order_by(HealthMetric.metric_type.asc(), HealthMetric.recorded_at.desc())
            .distinct(HealthMetric.metric_type)
        )
    ).all()
    units_by_metric: dict[str, str] = {
        (m.value if hasattr(m, "value") else str(m)): u for (m, u) in unit_rows
    }

    grouped_points: dict[str, list[HealthMetricTrendPoint]] = {}
    for row in agg_rows:
        metric_key = row.metric_type.value if hasattr(row.metric_type, "value") else str(row.metric_type)
        grouped_points.setdefault(metric_key, []).append(
            HealthMetricTrendPoint(
                date=row.day.isoformat(),
                average_value=round(float(row.avg_value), 2),
                min_value=float(row.min_value),
                max_value=float(row.max_value),
                entries=int(row.entries),
            )
        )

    trends = [
        HealthMetricTrendSeries(
            metric_type=HealthMetricType(metric_key),
            unit=units_by_metric.get(metric_key, ""),
            points=points,
        )
        for metric_key, points in grouped_points.items()
    ]

    payload = HealthMetricTrendsResponse(days=days, trends=trends)
    body_for_etag = payload.model_dump(mode="json")
    etag = build_etag(body_for_etag)
    if is_not_modified(request, etag):
        return not_modified_response(response)
    # Trends rarely change mid-day; longer SWR window is fine.
    set_cache_headers(response, etag=etag, max_age_seconds=60, stale_while_revalidate_seconds=300)
    return payload


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
