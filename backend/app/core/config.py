from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration, overridable via environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ai-red-team-scanner"
    version: str = "0.1.0"
    api_prefix: str = "/api"

    # Database (SQLAlchemy async URL). Default SQLite for zero-friction local
    # dev; PostgreSQL via DATABASE_URL (see docs/adr/0002).
    database_url: str = "sqlite+aiosqlite:///./data.db"

    # Auth (see docs/adr/0001). "disabled" = no-auth mode for local dev/demo.
    auth_mode: str = "enabled"
    jwt_secret: str = "dev-only-secret-change-me-0123456789abcdef01234567"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Application API-key encryption (Fernet). Required in production (M2).
    encryption_key: str = ""

    # Simulated scan engine for demo/tests/CI (no real LLM calls).
    simulate_scan: bool = False

    @property
    def auth_disabled(self) -> bool:
        return self.auth_mode == "disabled"


@lru_cache
def get_settings() -> Settings:
    return Settings()
