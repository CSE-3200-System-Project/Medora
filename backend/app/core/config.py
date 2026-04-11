from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_DATABASE_URL: str  # For SQLAlchemy (postgresql+asyncpg://...)
    SUPABASE_URL: str           # For Supabase Auth API
    SUPABASE_KEY: str           # Public/anon key for auth flows
    SUPABASE_SERVICE_ROLE_KEY: str | None = None  # Required for server-side storage writes
    SUPABASE_STORAGE_BUCKET: str 
    GROQ_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    CEREBRAS_CLOUD_API_KEY: str | None = None
    AI_PROVIDER: str = "groq"
    AI_PROVIDER_TIMEOUT_SECONDS: float = 20.0
    AI_PROVIDER_MAX_RETRIES: int = 2
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    CEREBRAS_CLOUD_MODEL: str = "gpt-oss-120b"
    AI_ID_HASH_SECRET: str | None = None
    PATIENT_REF_HASH_SECRET: str | None = None
    CHORUI_PRIVACY_MODE: str = "record_augmented"
    CHORUI_REQUIRE_PATIENT_ID_FOR_DOCTOR: bool = False
    CHORUI_ACTIVE_PATIENT_LOOKBACK_DAYS: int = 180
    AI_OCR_SERVICE_URL: str = "http://localhost:8001"
    AI_OCR_TIMEOUT_SECONDS: float = 180.0
    DEFAULT_REMINDER_TIMEZONE: str = "Asia/Dhaka"
    REMINDER_DISPATCH_ENABLED: bool = True
    REMINDER_DISPATCH_INTERVAL_SECONDS: int = 300
    REMINDER_LEAD_MINUTES: int = 15
    WEB_PUSH_VAPID_PUBLIC_KEY: str | None = None
    WEB_PUSH_VAPID_PRIVATE_KEY: str | None = None
    WEB_PUSH_VAPID_SUBJECT: str = "mailto:support@medora.app"
    SUPPORT_EMAIL: str = "support@medora.com"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "no-reply@medora.com"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 20
    VAPI_API_KEY: str | None = None
    VAPI_ASSISTANT_ID: str | None = None
    VAPI_PUBLIC_KEY: str | None = None
    VAPI_TOOL_SHARED_SECRET: str | None = None

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
