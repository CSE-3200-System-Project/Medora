from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.db.models.enums import HealthMetricSource, HealthMetricType


class HealthMetricCreate(BaseModel):
    metric_type: HealthMetricType
    value: float
    unit: str = Field(..., min_length=1, max_length=32)
    recorded_at: Optional[datetime] = None
    source: HealthMetricSource = HealthMetricSource.MANUAL
    notes: Optional[str] = Field(default=None, max_length=500)


class HealthMetricUpdate(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = Field(default=None, min_length=1, max_length=32)
    recorded_at: Optional[datetime] = None
    source: Optional[HealthMetricSource] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class HealthMetricResponse(BaseModel):
    id: str
    user_id: str
    metric_type: HealthMetricType
    value: float
    unit: str
    recorded_at: datetime
    source: HealthMetricSource
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HealthMetricListResponse(BaseModel):
    metrics: list[HealthMetricResponse]
    total: int


class HealthMetricTodaySummary(BaseModel):
    metric_type: HealthMetricType
    value: float
    unit: str
    source: HealthMetricSource
    recorded_at: datetime


class HealthMetricTodayResponse(BaseModel):
    date: str
    summary: list[HealthMetricTodaySummary]


class HealthMetricTrendPoint(BaseModel):
    date: str
    average_value: float
    min_value: float
    max_value: float
    entries: int


class HealthMetricTrendSeries(BaseModel):
    metric_type: HealthMetricType
    unit: str
    points: list[HealthMetricTrendPoint]


class HealthMetricTrendsResponse(BaseModel):
    days: int
    trends: list[HealthMetricTrendSeries]
