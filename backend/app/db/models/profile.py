from sqlalchemy import String, Enum, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.base import Base
from app.db.models.enums import  UserRole, VerificationStatus, AccountStatus

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True)

    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus), default=AccountStatus.active
    )

    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.unverified
    )
    verified_at: Mapped[datetime | None]

    first_name: Mapped[str]
    last_name: Mapped[str]

    email: Mapped[str | None]
    phone: Mapped[str | None]

    onboarding_completed: Mapped[bool] = mapped_column(default=False)

    ban_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    banned_by: Mapped[str | None] = mapped_column(String, nullable=True)
    delete_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
