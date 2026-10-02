from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
    )

    database_url: SecretStr | None = None
    migration_database_url: SecretStr | None = None
    storage_root: Path = Path('../storage/data')
    jwt_secret: SecretStr | None = None
    jwt_issuer: str = 'securelab'
    jwt_audience: str = 'securelab-web'
    access_token_minutes: int = 15
    session_days: int = 7
    frontend_url: str = 'http://localhost:3000'
    trusted_origins: str = 'http://localhost:3000'
    cookie_secure: bool = True
    enable_development_simulation: bool = False
    worker_interval_seconds: float = 1.0
    auth_failure_limit: int = 10
    auth_rate_window_seconds: int = 900
    hash_concurrency: int = 2

    @property
    def origins(self) -> list[str]:
        return [origin.strip().rstrip('/') for origin in self.trusted_origins.split(',') if origin.strip()]

    def signing_key(self) -> str:
        value = self.jwt_secret.get_secret_value() if self.jwt_secret else ''
        if len(value.encode('utf-8')) < 32 or value.startswith(('replace_', 'change_')):
            raise ValueError('JWT_SECRET must contain at least 32 bytes.')
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
