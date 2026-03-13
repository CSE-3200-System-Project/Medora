from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...
    SUPABASE_DATABASE_URL: str # For SQLAlchemy (postgresql+asyncpg://...)
    SUPABASE_URL: str          # For Supabase Auth API
    SUPABASE_KEY: str          # Service_role key or Anon key depending on needs
    GROQ_API_KEY: str
    allowed_origins: str = ""  # Comma separated list of origins
    PERF_API_CACHE_TTL: int = 60
    PERF_ENABLE_SERVER_DATA_PATH: bool = True
    PERF_STRICT_MOBILE_ANIM: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
