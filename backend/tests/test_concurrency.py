from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import select, func, create_engine, text
from sqlalchemy.exc import ProgrammingError, IntegrityError

from tests.test_exams_submissions import exam_setup, make_in_progress, activate, new_attempt, upload

pytestmark = pytest.mark.postgres


def test_room_overlap_race_and_parallel_final_receipt(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, payload, _, students, _, _, _, _, _ = exam_setup(client, headers)
    # Use a new non-overlapping slot, then race two requests for exactly that slot.
    from datetime import datetime, timedelta
    start = datetime.fromisoformat(payload['endsAt']) + timedelta(minutes=1)
    payload = {**payload, 'startsAt': start.isoformat(), 'endsAt': (start + timedelta(minutes=5)).isoformat()}
    def create(_):
        return client.post('/api/v1/exams', headers={**headers, 'Idempotency-Key': str(uuid4())}, json=payload).status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        codes = list(executor.map(create, range(2)))
    assert sorted(codes) == [201, 409]
    make_in_progress(pg_engine, exam['id'])
    owner = activate(client, headers, students[0], 'StudentTest123')
    with ThreadPoolExecutor(max_workers=2) as executor:
        attempts = list(executor.map(lambda _: new_attempt(client, owner, exam), range(2)))
    assert attempts[0]['attempt']['id'] == attempts[1]['attempt']['id']
    file, _ = upload(client, owner, attempts[0])
    url = f'/api/v1/submissions/{attempts[0]["submission"]["id"]}/versions/{attempts[0]["attempt"]["id"]}/finalize'
    with ThreadPoolExecutor(max_workers=2) as executor:
        finals = list(executor.map(lambda _: client.post(url, headers=owner), range(2)))
    assert all(response.status_code == 200 for response in finals)
    assert finals[0].json()['finalizedAt'] == finals[1].json()['finalizedAt']
    from app.models import submission_versions, audit_logs
    with pg_engine.connect() as db:
        assert db.scalar(select(func.count()).select_from(submission_versions).where(submission_versions.c.state == 'final')) == 1
        assert db.scalar(select(func.count()).select_from(audit_logs).where(audit_logs.c.action == 'submission.finalized')) == 1


def test_due_snapshot_precedes_student_assignment_mutation(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, _, _, students, _, _, major, groups, _ = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    student = students[0]
    response = client.patch(f'/api/v1/users/{student["id"]}', headers=headers, json={'expectedVersion': student['rowVersion'],
                            'profile': {'studentCode': student['profile']['studentCode'], 'majorId': major['id'], 'admissionYear': 2567, 'classGroupId': groups[1]['id']}})
    assert response.status_code == 200, response.text
    participants = client.get(f'/api/v1/exams/{exam["id"]}/participants', headers=headers).json()
    assert participants['frozen'] and participants['items'][0]['studentId'] == student['id']
    assert participants['items'][0]['classGroupId'] == groups[0]['id']


def test_application_role_cannot_ddl_or_rewrite_audit(client, admin_account, pg_engine, monkeypatch):
    from app.services.database_roles import provision, grant_application_permissions
    provision('IsolatedAppTest123')
    grant_application_permissions()
    url = pg_engine.url.set(username='securelab_app', password='IsolatedAppTest123')
    engine = create_engine(url)
    with engine.connect() as db:
        assert db.scalar(text('SELECT count(*) FROM users')) == 1
    with pytest.raises(ProgrammingError), engine.begin() as db:
        db.execute(text('CREATE TABLE forbidden_ddl(id integer)'))
    with pytest.raises(ProgrammingError), engine.begin() as db:
        db.execute(text("UPDATE audit_logs SET action = 'forged'"))
    engine.dispose()


def test_provision_after_start_does_not_expand_snapshot_or_rewrite_labels(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, _, _, students, _, _, major, groups, course = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    response = client.post('/api/v1/users', headers=headers, json={
        'role': 'student', 'email': 's6701011500999@email.kmutnb.ac.th', 'fullName': 'นักศึกษาที่เพิ่มหลังเริ่มสอบ',
        'profile': {'studentCode': '6701011500999', 'majorId': major['id'], 'admissionYear': 2567, 'classGroupId': groups[0]['id']},
    })
    assert response.status_code == 201, response.text
    participants = client.get(f'/api/v1/exams/{exam["id"]}/participants', headers=headers).json()
    assert [person['studentId'] for person in participants['items']] == [students[0]['id']]
    renamed = client.patch(f'/api/v1/courses/{course["id"]}', headers=headers, json={
        'code': course['code'], 'name': 'ชื่อวิชาใหม่หลังเริ่มสอบ', 'departmentId': course['departmentId'],
        'status': course['status'], 'expectedVersion': course['rowVersion'],
    })
    assert renamed.status_code == 200, renamed.text
    assert client.get(f'/api/v1/exams/{exam["id"]}', headers=headers).json()['courseName'] == exam['courseName']


def test_concurrent_cohort_creation_and_teacher_assignment_revocation(client, admin_account, pg_engine):
    _, headers = admin_account
    from tests.test_courses_rooms import catalog, section_payload
    teacher, major, groups, students, course = catalog(client, headers)
    payload = section_payload(teacher, major, groups[0], course)
    def create(number):
        return client.post('/api/v1/sections', headers=headers, json={**payload, 'sectionNumber': number})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(create, (1, 2)))
    assert sorted(response.status_code for response in responses) == [201, 409]
    section = next(response.json() for response in responses if response.status_code == 201)
    teacher_headers = activate(client, headers, teacher, 'TeacherTest123')
    assert client.get(f'/api/v1/sections/{section["id"]}/roster', headers=teacher_headers).status_code == 200
    assert client.get('/api/v1/users', headers=teacher_headers).status_code == 403
    replacement = client.post('/api/v1/users', headers=headers, json={
        'role': 'teacher', 'email': 'replacement@itm.kmutnb.ac.th', 'fullName': 'อาจารย์ทดแทน',
        'profile': {'teacherCode': 'T-REPLACEMENT', 'departmentId': course['departmentId']},
    }).json()
    changed = client.patch(f'/api/v1/sections/{section["id"]}', headers=headers, json={
        **payload, 'sectionNumber': section['sectionNumber'], 'primaryTeacherId': replacement['id'], 'expectedVersion': section['rowVersion'],
    })
    assert changed.status_code == 200, changed.text
    assert client.get(f'/api/v1/sections/{section["id"]}/roster', headers=teacher_headers).status_code == 404
    assert client.get('/api/v1/sections', headers=teacher_headers).json()['total'] == 0
