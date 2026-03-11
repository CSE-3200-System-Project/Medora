from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
import os

DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Add pool_pre_ping=True to handle closed connections
engine = create_async_engine(
    settings.SUPABASE_DATABASE_URL, 
    echo=False,
    pool_pre_ping=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
)

AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False
)
