from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.main import app


def test_health_without_database(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'unavailable-database')

    def reject_connection(*args, **kwargs):
        raise AssertionError('/health must not connect to PostgreSQL')

    monkeypatch.setattr(Engine, 'connect', reject_connection)
    with TestClient(app) as client:
        response = client.get('/health')

    assert response.status_code == 200
    assert response.json() == {
        'status': 'ok',
        'service': 'securelab-backend',
    }
