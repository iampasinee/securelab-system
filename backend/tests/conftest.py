import os

import pytest
from sqlalchemy import create_engine, text
from alembic.config import Config
from alembic import command


TEST_URL = os.environ.get('SECURELAB_TEST_DATABASE_URL')


@pytest.fixture(scope='session')
def pg_engine():
    if not TEST_URL:
        pytest.skip('Set SECURELAB_TEST_DATABASE_URL to an isolated PostgreSQL 17 database')
    engine = create_engine(TEST_URL)
    with engine.connect() as db:
        name = db.scalar(text('SELECT current_database()'))
        version = db.scalar(text('SHOW server_version_num'))
        if not name.endswith('_test') or not 170000 <= int(version) < 180000:
            raise RuntimeError('Integration tests require PostgreSQL 17 and a database ending in _test')
    os.environ['DATABASE_URL'] = TEST_URL
    os.environ['MIGRATION_DATABASE_URL'] = TEST_URL
    os.environ['JWT_SECRET'] = 'isolated-test-secret-32-bytes-minimum-value'
    os.environ['COOKIE_SECURE'] = 'false'
    from app.core.config import get_settings
    from app.core.database import get_engine
    get_settings.cache_clear()
    get_engine.cache_clear()
    command.upgrade(Config('alembic.ini'), 'head')
    yield engine
    engine.dispose()


@pytest.fixture
def client(pg_engine, tmp_path, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from time import monotonic
    from zoneinfo import ZoneInfo
    from fastapi.testclient import TestClient
    from app.core.config import get_settings
    from app.models.base import Base
    from app.main import app
    # Never truncate a caller's normal database. pg_engine verified the name/version.
    names = ','.join('"' + name + '"' for name in Base.metadata.tables if name not in ('academic_settings', 'security_settings'))
    with pg_engine.begin() as db:
        db.execute(text('TRUNCATE ' + names + ' RESTART IDENTITY CASCADE'))
        db.execute(text('UPDATE academic_settings SET current_academic_year = 2569, current_semester = \'1\', row_version = 1 WHERE id = 1'))
    monkeypatch.setenv('STORAGE_ROOT', str(tmp_path))
    get_settings.cache_clear()
    # Use a future daytime business clock so room/time tests cannot cross Bangkok
    # midnight. Auth/JWT and PostgreSQL retain their real clocks; no API bypass exists.
    from app.services import exams, roster, submissions, storage, storage_maintenance, monitoring
    from app import worker
    anchor = (datetime.now(ZoneInfo('Asia/Bangkok')) + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    started = monotonic()
    clock = lambda: anchor + timedelta(seconds=monotonic() - started)
    for module in (exams, roster, submissions, storage, storage_maintenance, monitoring, worker):
        monkeypatch.setattr(module, 'now', clock)
    with TestClient(app) as value:
        yield value


@pytest.fixture
def admin_account(pg_engine, client):
    from app.models import users, admin_profiles
    from app.repositories.base import create, now
    from app.services.auth import hash_password
    with pg_engine.begin() as db:
        admin = create(db, users, {'email': 'admin@itm.kmutnb.ac.th', 'full_name': 'ผู้ดูแลทดสอบ', 'role': 'admin',
                                   'password_hash': hash_password('AdminTest123'), 'activated_at': now()})
        create(db, admin_profiles, {'user_id': admin['id'], 'admin_code': 'ADMIN001'})
    response = client.post('/api/v1/auth/login', json={'email': admin['email'], 'password': 'AdminTest123'})
    assert response.status_code == 200, response.text
    return admin, {'Authorization': 'Bearer ' + response.json()['accessToken']}
