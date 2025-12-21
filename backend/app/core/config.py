from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...
    SUPABASE_DATABASE_URL: str # For SQLAlchemy (postgresql+asyncpg://...)
    SUPABASE_URL: str          # For Supabase Auth API
    SUPABASE_KEY: str          # Service_role key or Anon key depending on needs

    class Config:
        env_file = ".env"

settings = Settings()