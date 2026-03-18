from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_profile_id: Mapped[str] = mapped_column(String, ForeignKey("profiles.id"), index=True)

    bucket: Mapped[str] = mapped_column(String, default="medora-storage")
    storage_path: Mapped[str] = mapped_column(Text, unique=True)
    public_url: Mapped[str | None]

    file_name: Mapped[str]
    original_file_name: Mapped[str | None]
    content_type: Mapped[str | None]
    file_extension: Mapped[str | None]
    file_size: Mapped[int] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str | None]

    category: Mapped[str] = mapped_column(String, default="general")
    entity_type: Mapped[str | None]
    entity_id: Mapped[str | None]
    visibility: Mapped[str] = mapped_column(String, default="public")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
