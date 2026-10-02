from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from tests.test_exams_submissions import exam_setup, activate, make_in_progress

pytestmark = pytest.mark.postgres


def test_audit_correlates_mutation_with_server_request_id(client, admin_account, pg_engine):
    _, headers = admin_account
    client_identifier = str(uuid4())
    response = client.post('/api/v1/academic/faculties', headers={**headers, 'X-Request-ID': client_identifier},
                           json={'code': 'AUDIT', 'name': 'คณะตรวจสอบคำสั่ง'})
    assert response.status_code == 201, response.text
    request_id = response.headers['X-Request-ID']
    assert request_id != client_identifier
    with pg_engine.connect() as db:
        record = db.execute(text('SELECT request_id, metadata FROM audit_logs WHERE target_id = :id'),
                            {'id': response.json()['id']}).mappings().one()
    assert str(record['request_id']) == request_id
    assert 'name' not in record['metadata'] and 'fullName' not in record['metadata']


def test_calendar_daily_authorization_unseated_and_separate_review(client, admin_account, pg_engine, monkeypatch):
    _, headers = admin_account
    exam, _, section, students, teacher, _, _, _, _ = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    teacher_headers = activate(client, headers, teacher, 'TeacherTest123')
    student_headers = activate(client, headers, students[0], 'StudentTest123')
    from app.services.exams import BANGKOK
    day = datetime.fromisoformat(exam['startsAt']).astimezone(BANGKOK).date().isoformat()
    daily = client.get('/api/v1/monitoring/daily', headers=teacher_headers, params={'date': day, 'q': 'ไม่มีผลการค้นหา'}).json()
    assert daily['total'] == 0 and daily['counters']['total'] == 1
    calendar = client.get('/api/v1/monitoring/calendar', headers=teacher_headers, params={'month': day[:7]}).json()
    assert calendar['items'] == [{'date': day, 'examCount': 1}]
    summary = client.get(f'/api/v1/monitoring/exams/{exam["id"]}', headers=teacher_headers).json()
    assert summary['counters']['total'] == summary['counters']['unseated'] == 1
    assert summary['participants'][0]['runtimeStatus'] == 'unknown' and summary['participants'][0]['identityVerification'] == 'unavailable'
    detail = client.get(f'/api/v1/exams/{exam["id"]}', headers=headers).json()
    seating = client.post(f'/api/v1/exams/{exam["id"]}/seat-assignments/auto', headers={**headers, 'Idempotency-Key': str(uuid4())}, json={'expectedVersion': detail['rowVersion']})
    assert seating.status_code == 200, seating.text
    seated = client.get(f'/api/v1/monitoring/exams/{exam["id"]}', headers=teacher_headers)
    assert seated.status_code == 200, seated.text
    assert seated.json()['counters']['unseated'] == 0
    assert seated.json()['participants'][0]['seat']['studentId'] == students[0]['id']
    payload = {'studentId': students[0]['id'], 'type': 'tab_switch', 'detail': 'เหตุจำลองเพื่อทดสอบ'}
    route = f'/api/v1/dev/exams/{exam["id"]}/violations'
    assert client.post(route, headers=teacher_headers, json=payload).status_code == 404
    from app.core.config import get_settings
    monkeypatch.setenv('ENABLE_DEVELOPMENT_SIMULATION', 'true')
    get_settings.cache_clear()
    event = client.post(route, headers=teacher_headers, json=payload)
    assert event.status_code == 201, event.text
    event = event.json()
    assert event['source'] == 'development_simulation'
    seen = client.post(f'/api/v1/violations/{event["id"]}/seen', headers=student_headers).json()
    assert seen['studentSeenAt'] is not None and seen['reviewedAt'] is None
    assert client.get('/api/v1/violations?reviewed=false', headers=teacher_headers).json()['total'] == 1
    assert client.post(f'/api/v1/violations/{event["id"]}/review', headers=student_headers).status_code == 403
    reviewed = client.post(f'/api/v1/violations/{event["id"]}/review', headers=teacher_headers).json()
    assert reviewed['reviewedAt'] is not None and reviewed['studentSeenAt'] == seen['studentSeenAt']
    assert client.get('/api/v1/violations?reviewed=false', headers=teacher_headers).json()['total'] == 0
    with pytest.raises(IntegrityError), pg_engine.begin() as db:
        db.execute(text("UPDATE audit_logs SET action = 'changed'"))
    assert client.get('/api/v1/admin/audit-logs', headers=teacher_headers).status_code == 403
    export = client.get('/api/v1/admin/audit-logs/export', headers=headers)
    assert export.status_code == 200 and export.content.startswith(b'\xef\xbb\xbf') and 'attachment' in export.headers['content-disposition']
