import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.db.models.enums import HealthMetricSource, HealthMetricType


class HealthMetric(Base):
    __tablename__ = "health_metrics"
    __table_args__ = (
        Index("ix_health_metrics_user_metric_recorded", "user_id", "metric_type", "recorded_at"),
        Index("ix_health_metrics_user_recorded", "user_id", "recorded_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    metric_type: Mapped[HealthMetricType] = mapped_column(
        Enum(HealthMetricType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    source: Mapped[HealthMetricSource] = mapped_column(
        Enum(HealthMetricSource, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=HealthMetricSource.MANUAL,
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, onupdate=func.now())

    user = relationship("Profile", backref="health_metrics")
