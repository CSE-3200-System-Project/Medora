from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

# Add pool_pre_ping=True to handle closed connections
engine = create_async_engine(
    settings.SUPABASE_DATABASE_URL, 
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False
)
