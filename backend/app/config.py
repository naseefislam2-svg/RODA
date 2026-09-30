from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./roda.db"
    database_direct_url: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_enabled: bool = False
    auto_create_tables: bool = True

    @model_validator(mode="after")
    def production_guardrails(self):
        if self.environment == "production":
            if not self.database_url.startswith(("postgresql", "postgres")):
                raise ValueError("Production requires a PostgreSQL database")
            if self.auto_create_tables:
                raise ValueError("Production requires Alembic; set AUTO_CREATE_TABLES=false")
            if "*" in self.cors_origins or not self.cors_origins.startswith("https://"):
                raise ValueError("Production CORS must list explicit HTTPS frontend origins")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
