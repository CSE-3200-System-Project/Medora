from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings
import os

DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))

engine = create_async_engine(
    settings.SUPABASE_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    pool_recycle=DB_POOL_RECYCLE,
    execution_options={"compiled_cache": None},
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "server_settings": {"jit": "off"},
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False
)
