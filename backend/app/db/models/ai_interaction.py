import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AIInteraction(Base):
    __tablename__ = "ai_interactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    feature: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    sanitized_input: Mapped[dict] = mapped_column(JSON, nullable=False)
    raw_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    validated_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(32), nullable=False, default="valid")
    doctor_action: Mapped[str | None] = mapped_column(String(64), nullable=True)
    doctor_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("doctor_profiles.profile_id"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("patient_profiles.profile_id"),
        nullable=False,
        index=True,
    )
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)

    # Arohon. Nullable because rows written before the tier layer existed have no
    # decision to record, and backfilling one would be inventing an audit entry.
    # `correlation_id` is the orchestrator's per-request random token, never a stable
    # subject identifier, so it joins a tier decision to one request without becoming a
    # way to re-identify a patient across requests.
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    requested_tier: Mapped[str | None] = mapped_column(String(24), nullable=True)
    autonomy_tier: Mapped[str | None] = mapped_column(String(24), nullable=True, index=True)
    risk_class: Mapped[str | None] = mapped_column(String(24), nullable=True, index=True)
    tier_ceiling_applied: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false"), default=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("DoctorProfile", back_populates="ai_interactions")
    patient = relationship("PatientProfile", back_populates="ai_interactions")
    feedback = relationship("AIFeedback", back_populates="interaction", cascade="all, delete-orphan")


class AIFeedback(Base):
    __tablename__ = "ai_feedback"
    __table_args__ = (CheckConstraint("rating >= 1 AND rating <= 5", name="ck_ai_feedback_rating"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ai_interaction_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("ai_interactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    correction_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    interaction = relationship("AIInteraction", back_populates="feedback")

