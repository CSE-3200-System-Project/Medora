import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ProcessingConsentGrant(Base):
    """Immutable, versioned permission for a specific data-processing purpose."""

    __tablename__ = "processing_consent_grants"
    __table_args__ = (
        Index(
            "ix_processing_consent_subject_purpose_version",
            "subject_id",
            "purpose",
            "recipient_id",
            "version",
            unique=True,
        ),
        Index("ix_processing_consent_active_lookup", "subject_id", "purpose", "revoked_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    scopes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    recipient_id: Mapped[str | None] = mapped_column(String, nullable=True)
    policy_version: Mapped[str] = mapped_column(String(40), nullable=False, default="softwarex-v1")
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    granted_by_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), nullable=False)
    revoked_by_id: Mapped[str | None] = mapped_column(String, ForeignKey("profiles.id"), nullable=True)
    audit_note: Mapped[str | None] = mapped_column(Text, nullable=True)
