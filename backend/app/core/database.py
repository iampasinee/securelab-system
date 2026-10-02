from functools import lru_cache

from sqlalchemy import Engine, create_engine

from app.core.config import get_settings


def get_database_url(migration=False) -> str:
    settings = get_settings()
    database_url = (settings.migration_database_url or settings.database_url) if migration else settings.database_url
    if database_url is None or not database_url.get_secret_value().strip():
        raise ValueError('DATABASE_URL must be set before using the database.')
    return database_url.get_secret_value()


@lru_cache
def get_engine() -> Engine:
    """Create an engine only on demand; importing the app never connects."""
    return create_engine(get_database_url(), pool_pre_ping=True, pool_size=10, max_overflow=20)
