import uuid
from sqlalchemy import String, Text, DateTime, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base


class UserOAuthToken(Base):
    """Stores OAuth2 tokens for external service integrations (e.g. Google Calendar)."""

    __tablename__ = "user_oauth_tokens"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String, nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "google"
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Google account info from OpenID Connect (Google Sign-In)
    google_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Unique Google user ID
    google_profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Full Google profile data

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
