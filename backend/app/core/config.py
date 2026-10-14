from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "TraceLens AI"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # MongoDB Configuration
    MONGODB_URL: str = "mongodb://127.0.0.1:27017"
    MONGODB_DATABASE: str = "tracelens"
    MONGODB_TIMEOUT_MS: int = 2000

    # Ingestion & Pagination Limits
    MAX_LOG_BATCH_SIZE: int = 500
    MAX_LOG_MESSAGE_LENGTH: int = 10000
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 100

    # CORS configuration for local Vite development
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
