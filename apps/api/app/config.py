from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # For demo / hackathon: a single shared anonymous user when auth is off.
    demo_user_id: str = "00000000-0000-0000-0000-000000000001"

    # Cloud AI fallback
    gemini_api_key: str = ""
    openai_api_key: str = ""

    studynest_local_ai_url: str = "http://127.0.0.1:8765"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "app://studynest",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
