from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _discover_env_files() -> tuple[str, ...] | None:
    """Resolve `.env` paths from this file — independent of uvicorn cwd."""
    here = Path(__file__).resolve()
    # …/repo/apps/api/app/config.py
    repo_root = here.parents[3]
    api_home = here.parents[1]
    paths = [p for p in (repo_root / ".env", api_home / ".env") if p.is_file()]
    return tuple(str(p) for p in paths) if paths else None


_env_files = _discover_env_files()
_model_config_kwargs: dict = {
    "env_file_encoding": "utf-8",
    "extra": "ignore",
}
if _env_files:
    _model_config_kwargs["env_file"] = _env_files


class Settings(BaseSettings):
    model_config = SettingsConfigDict(**_model_config_kwargs)

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
