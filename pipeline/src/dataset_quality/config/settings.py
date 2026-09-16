"""Environment-driven settings. The only place in this codebase allowed to read env vars."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "password"
    db_name: str = "image_repo"

    # Same field set drives both MinIO (dev) and AWS S3 (prod) via one boto3 client —
    # leave object_store_endpoint_url unset to talk to real S3.
    object_store_endpoint_url: str | None = "http://localhost:9000"
    object_store_access_key: str = "minioadmin"
    object_store_secret_key: str = "minioadmin"
    object_store_bucket: str = "dataset-quality"
    object_store_region: str = "us-east-1"
    object_store_use_ssl: bool = False

    quality_gate_config_path: str = "quality.yaml"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
