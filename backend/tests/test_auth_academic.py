from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from sqlalchemy import text, select, update
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.postgres


def create_staff(client, headers):
    faculty = client.post('/api/v1/academic/faculties', headers=headers, json={'code': 'FTE', 'name': 'คณะทดสอบ'}).json()
    department = client.post('/api/v1/academic/departments', headers=headers, json={'facultyId': faculty['id'], 'code': 'INET', 'name': 'ภาควิชาทดสอบ'}).json()
    response = client.post('/api/v1/users', headers=headers, json={'role': 'teacher', 'email': 'teacher@itm.kmutnb.ac.th', 'fullName': 'อาจารย์ทดสอบ',
                                                                 'profile': {'teacherCode': 'T001', 'departmentId': department['id']}})
    assert response.status_code == 201, response.text
    return response.json(), faculty, department


def test_hash_session_rotation_and_replay(client, admin_account, pg_engine):
    admin, headers = admin_account
    from app.models import users, refresh_tokens
    with pg_engine.connect() as db:
        record = db.execute(select(users).where(users.c.id == admin['id'])).mappings().one()
        assert record['password_hash'].startswith('$argon2id$v=19$m=65536,t=3,p=4$')
        assert 'AdminTest123' not in record['password_hash']
    me = client.get('/api/v1/auth/me', headers=headers)
    assert me.status_code == 200
    assert 'password' not in me.text.lower() and 'sessionId' not in me.text
    old = client.cookies.get('securelab_refresh')
    assert client.post('/api/v1/auth/refresh').status_code == 403
    csrf = {'Origin': 'http://localhost:3000', 'X-SecureLab-CSRF': '1'}
    response = client.post('/api/v1/auth/refresh', headers=csrf)
    assert response.status_code == 200, response.text
    access = {'Authorization': 'Bearer ' + response.json()['accessToken']}
    assert client.cookies.get('securelab_refresh') != old
    response = client.post('/api/v1/auth/refresh', headers={**csrf, 'Cookie': 'securelab_refresh=' + old})
    assert response.status_code == 401, response.text
    assert client.get('/api/v1/auth/me', headers=access).status_code == 401


def test_activation_one_use_and_redaction(client, admin_account, pg_engine):
    _, headers = admin_account
    teacher, _, _ = create_staff(client, headers)
    generic = client.post('/api/v1/auth/login', json={'email': teacher['email'], 'password': 'WrongSecret123'})
    unknown = client.post('/api/v1/auth/login', json={'email': 'unknown@itm.kmutnb.ac.th', 'password': 'WrongSecret123'})
    assert generic.status_code == unknown.status_code == 401
    assert generic.json() == unknown.json()
    link = client.post(f'/api/v1/users/{teacher["id"]}/account-links', headers=headers, json={'purpose': 'activate'}).json()
    token = parse_qs(urlparse(link['link']).fragment.split('?', 1)[1])['token'][0]
    assert client.post('/api/v1/auth/activation/inspect', json={'token': token}).json()['role'] == 'teacher'
    bad = client.post('/api/v1/auth/activation/complete', json={'token': token, 'newPassword': 'secret'})
    assert bad.status_code == 422 and '"input"' not in bad.text and 'secret' not in bad.text and token not in bad.text
    response = client.post('/api/v1/auth/activation/complete', json={'token': token, 'newPassword': 'TeacherTest123'})
    assert response.status_code == 204, response.text
    assert client.post('/api/v1/auth/activation/complete', json={'token': token, 'newPassword': 'TeacherTest123'}).status_code == 401
    login = client.post('/api/v1/auth/login', json={'email': teacher['email'], 'password': 'TeacherTest123'})
    assert login.status_code == 200
    teacher_headers = {'Authorization': 'Bearer ' + login.json()['accessToken']}
    assert client.get('/api/v1/users', headers=teacher_headers).status_code == 403
    status = client.patch(f'/api/v1/users/{teacher["id"]}/status', headers=headers, json={'status': 'suspended', 'expectedVersion': 2})
    assert status.status_code == 200, status.text
    assert client.get('/api/v1/auth/me', headers=teacher_headers).status_code == 401
    with pg_engine.connect() as db:
        logs = db.execute(text('SELECT metadata::text FROM audit_logs')).scalars().all()
        assert all(token not in value and 'TeacherTest123' not in value and 'WrongSecret123' not in value for value in logs)


def test_university_role_spoof_and_last_admin(client, admin_account):
    admin, headers = admin_account
    response = client.post('/api/v1/users', headers=headers, json={'role': 'admin', 'email': 's6701011500167@email.kmutnb.ac.th', 'fullName': 'บัญชีทดสอบ', 'profile': {'adminCode': 'BAD'}})
    assert response.status_code == 422
    assert client.patch(f'/api/v1/users/{admin["id"]}', headers=headers, json={'expectedVersion': 1, 'role': 'student'}).status_code == 422
    assert client.patch(f'/api/v1/users/{admin["id"]}/status', headers=headers, json={'expectedVersion': 1, 'status': 'suspended'}).status_code == 409
    assert client.delete(f'/api/v1/users/{admin["id"]}', headers=headers).status_code == 409


def test_academic_scope_future_year_and_counter(client, admin_account, pg_engine):
    _, headers = admin_account
    _, faculty, department = create_staff(client, headers)
    major = client.post('/api/v1/academic/majors', headers=headers, json={'departmentId': department['id'], 'code': 'INET-DE', 'name': 'สาขาทดสอบ'}).json()
    request = {'majorId': major['id'], 'admissionYear': 2567}
    first = client.post('/api/v1/academic/class-groups', headers=headers, json=request)
    assert first.status_code == 201, first.text
    first = first.json()
    assert first['code'] == 'INET-DE-RA'
    assert client.delete(f'/api/v1/academic/class-groups/{first["id"]}', headers=headers).status_code == 204
    second = client.post('/api/v1/academic/class-groups', headers=headers, json=request).json()
    assert second['sequence'] == 2 and second['code'] == 'INET-DE-RB'
    assert client.post('/api/v1/academic/class-groups', headers=headers, json={**request, 'admissionYear': 2570}).status_code == 422
    response = client.post('/api/v1/users', headers=headers, json={'role': 'student', 'email': 's6701011500167@email.kmutnb.ac.th', 'fullName': 'นักศึกษาทดสอบ',
                    'profile': {'studentCode': '6701011500167', 'majorId': major['id'], 'admissionYear': 2567, 'classGroupId': second['id']}})
    assert response.status_code == 201, response.text
    student = response.json()
    assert student['profile']['yearLevel'] == 3
    assert client.get('/api/v1/students?yearLevel=3', headers=headers).json()['total'] == 1
    assert client.delete(f'/api/v1/academic/class-groups/{second["id"]}', headers=headers).status_code == 409
    assert client.delete(f'/api/v1/academic/departments/{department["id"]}', headers=headers).status_code == 409
    with pytest.raises(IntegrityError), pg_engine.begin() as db:
        db.execute(text('UPDATE student_profiles SET admission_year = 2568 WHERE user_id = :id'), {'id': student['id']})


def test_wizard_preview_rollback_and_stale_write(client, admin_account, pg_engine):
    _, headers = admin_account
    draft = {'faculty': {'mode': 'new', 'code': 'NEWF', 'name': 'คณะใหม่'}, 'department': {'mode': 'new', 'code': 'NEWD', 'name': 'ภาคใหม่'},
             'major': {'mode': 'new', 'code': 'NEWM', 'name': 'สาขาใหม่'}, 'admissionYear': 2567, 'groupCount': 2}
    preview = client.post('/api/v1/academic/structures/preview', headers=headers, json=draft)
    assert preview.status_code == 200, preview.text
    assert client.get('/api/v1/academic/faculties', headers=headers).json()['total'] == 0
    key = str(uuid4())
    response = client.post('/api/v1/academic/structures', headers={**headers, 'Idempotency-Key': key}, json=draft)
    assert response.status_code == 201, response.text
    assert client.post('/api/v1/academic/structures', headers={**headers, 'Idempotency-Key': key}, json=draft).json() == response.json()
    assert client.post('/api/v1/academic/structures', headers={**headers, 'Idempotency-Key': key}, json={**draft, 'groupCount': 3}).status_code == 409
    faculty = response.json()['faculty']
    assert client.patch(f'/api/v1/academic/faculties/{faculty["id"]}', headers=headers, json={'name': 'ชื่อใหม่', 'expectedVersion': 1}).status_code == 200
    assert client.patch(f'/api/v1/academic/faculties/{faculty["id"]}', headers=headers, json={'name': 'ชื่อเก่า', 'expectedVersion': 1}).status_code == 409
    with pytest.raises(IntegrityError), pg_engine.begin() as db:
        db.execute(text("INSERT INTO users(email,full_name,role) VALUES('bad@itm.kmutnb.ac.th','bad','admin')"))
