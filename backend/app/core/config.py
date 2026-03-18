from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_DATABASE_URL: str  # For SQLAlchemy (postgresql+asyncpg://...)
    SUPABASE_URL: str           # For Supabase Auth API
    SUPABASE_KEY: str           # Public/anon key for auth flows
    SUPABASE_SERVICE_ROLE_KEY: str | None = None  # Required for server-side storage writes
    SUPABASE_STORAGE_BUCKET: str = "medora-storage"
    GROQ_API_KEY: str
    DEFAULT_REMINDER_TIMEZONE: str = "Asia/Dhaka"
    REMINDER_DISPATCH_ENABLED: bool = True
    REMINDER_DISPATCH_INTERVAL_SECONDS: int = 30

    WEB_PUSH_VAPID_PUBLIC_KEY: str | None = None
    WEB_PUSH_VAPID_PRIVATE_KEY: str | None = None
    WEB_PUSH_VAPID_SUBJECT: str = "mailto:support@medora.app"

    ALLOWED_ORIGINS: str = ""   # Comma-separated list of origins
    PRELOAD_WHISPER_ON_STARTUP: bool = True

    PERF_API_CACHE_TTL: int = 60
    PERF_ENABLE_SERVER_DATA_PATH: bool = True
    PERF_STRICT_MOBILE_ANIM: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
