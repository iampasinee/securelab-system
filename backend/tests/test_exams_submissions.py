from datetime import timedelta
from hashlib import sha256
from urllib.parse import urlparse, parse_qs
from uuid import uuid4
import io
import zipfile

import pytest
from sqlalchemy import update, text, select
from sqlalchemy.exc import IntegrityError

from tests.test_courses_rooms import catalog, section_payload

pytestmark = pytest.mark.postgres


def activate(client, headers, user, password):
    link = client.post(f'/api/v1/users/{user["id"]}/account-links', headers=headers, json={'purpose': 'activate'}).json()['link']
    token = parse_qs(urlparse(link).fragment.split('?', 1)[1])['token'][0]
    response = client.post('/api/v1/auth/activation/complete', json={'token': token, 'newPassword': password})
    assert response.status_code == 204, response.text
    response = client.post('/api/v1/auth/login', json={'email': user['email'], 'password': password})
    assert response.status_code == 200, response.text
    return {'Authorization': 'Bearer ' + response.json()['accessToken']}


def exam_setup(client, headers):
    from app.services.exams import now
    teacher, major, groups, students, course = catalog(client, headers)
    section = client.post('/api/v1/sections', headers=headers, json=section_payload(teacher, major, groups[0], course)).json()
    floor = client.post('/api/v1/rooms/floors', headers=headers, json={'floorNumber': 4}).json()
    physical = client.post('/api/v1/rooms/physical-rooms', headers=headers, json={'floorId': floor['id'], 'suffix': '08'}).json()
    room = client.post('/api/v1/rooms/exam-rooms', headers=headers, json={'physicalRoomId': physical['id']}).json()
    room = client.put(f'/api/v1/rooms/exam-rooms/{room["id"]}/layout', headers=headers, json={'rows': 1, 'columns': 2, 'expectedVersion': 1}).json()
    for index, seat in enumerate(room['seats']):
        response = client.post('/api/v1/devices', headers=headers, json={'computerCode': f'PC{index}', 'serialNumber': f'SER{index}', 'ipAddress': f'192.168.1.{10+index}',
                                                                       'macAddress': f'00:11:22:33:44:{50+index}', 'seatId': seat['id']})
        assert response.status_code == 201, response.text
    payload = {'sectionId': section['id'], 'roomId': room['id'], 'name': 'ทดสอบการสอบ', 'examType': 'lab', 'mode': 'online',
               'startsAt': (now() + timedelta(minutes=5)).isoformat(), 'endsAt': (now() + timedelta(minutes=30)).isoformat(),
               'maxFileSizeBytes': 1024 * 1024, 'requiredFileCount': 1, 'filenamePattern': '{studentCode}_final', 'acceptedExtensions': ['.py', '.zip'],
               'rules': [{'text': 'ตรวจสอบไฟล์ก่อนส่ง'}]}
    response = client.post('/api/v1/exams', headers={**headers, 'Idempotency-Key': str(uuid4())}, json=payload)
    assert response.status_code == 201, response.text
    return response.json(), payload, section, students, teacher, room, major, groups, course


def make_in_progress(pg_engine, exam_id):
    from app.models import exam_sessions
    from app.services.exams import now
    with pg_engine.begin() as db:
        db.execute(update(exam_sessions).where(exam_sessions.c.id == exam_id).values(starts_at=now() - timedelta(minutes=1)))


def new_attempt(client, student_headers, exam):
    response = client.post(f'/api/v1/exams/{exam["id"]}/attempts', headers=student_headers, json={'rulesAccepted': True, 'acceptedExamRevision': exam['revision']})
    assert response.status_code == 200, response.text
    return response.json()


def upload(client, student_headers, attempt, contents=b'print("untrusted data only")'):
    root_id, version_id = attempt['submission']['id'], attempt['attempt']['id']
    response = client.post(f'/api/v1/submissions/{root_id}/versions/{version_id}/files', headers=student_headers,
                           json={'originalName': 'answer.py', 'expectedSizeBytes': len(contents), 'clientMime': 'text/x-python'})
    assert response.status_code == 201, response.text
    intent = response.json()
    response = client.put(f'/api/v1/submission-files/{intent["uploadId"]}/content', headers={**student_headers, 'Content-Type': 'application/octet-stream'}, content=contents)
    assert response.status_code == 200, response.text
    assert response.json()['sha256'] == sha256(contents).hexdigest()
    assert 'storageKey' not in response.text
    return response.json(), contents


def test_exam_scope_half_open_room_conflict_and_seating(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, payload, section, students, teacher, room, _, _, _ = exam_setup(client, headers)
    response = client.post('/api/v1/exams', headers={**headers, 'Idempotency-Key': str(uuid4())}, json=payload)
    assert response.status_code == 409, response.text
    touching = {**payload, 'startsAt': payload['endsAt'], 'endsAt': ( __import__('datetime').datetime.fromisoformat(payload['endsAt']) + timedelta(minutes=10)).isoformat()}
    assert client.post('/api/v1/exams', headers={**headers, 'Idempotency-Key': str(uuid4())}, json=touching).status_code == 201
    response = client.post(f'/api/v1/exams/{exam["id"]}/seat-assignments/auto', headers={**headers, 'Idempotency-Key': str(uuid4())}, json={'expectedVersion': 1})
    assert response.status_code == 200, response.text
    assert response.json()['total'] == 1 and response.json()['unassignedCount'] == 0
    student_headers = activate(client, headers, students[0], 'StudentTest123')
    assert client.get(f'/api/v1/exams/{exam["id"]}/seat-assignments', headers=student_headers).json()['total'] == 1
    assert client.post(f'/api/v1/exams/{exam["id"]}/attempts', headers=student_headers, json={'rulesAccepted': True, 'acceptedExamRevision': 1}).status_code == 409
    make_in_progress(pg_engine, exam['id'])
    detail = client.get(f'/api/v1/exams/{exam["id"]}', headers=headers).json()
    key = str(uuid4())
    overlap = client.post(f'/api/v1/exams/{exam["id"]}/time-adjustments', headers={**headers, 'Idempotency-Key': str(uuid4())},
                          json={'deltaMinutes': 5, 'reason': 'ชนรอบถัดไป', 'expectedVersion': detail['rowVersion']})
    assert overlap.status_code == 409
    adjustment = {'deltaMinutes': -5, 'reason': 'ลดเวลาทั้งการสอบ', 'expectedVersion': detail['rowVersion']}
    response = client.post(f'/api/v1/exams/{exam["id"]}/time-adjustments', headers={**headers, 'Idempotency-Key': key}, json=adjustment)
    assert response.status_code == 200, response.text
    assert response.json()['adjustedMinutes'] == -5
    assert client.post(f'/api/v1/exams/{exam["id"]}/time-adjustments', headers={**headers, 'Idempotency-Key': key}, json=adjustment).json()['endsAt'] == response.json()['endsAt']
    from app.services.exams import status
    from datetime import datetime
    assert status({'starts_at': datetime.fromisoformat(detail['startsAt']), 'ends_at': datetime.fromisoformat(detail['endsAt'])}, datetime.fromisoformat(detail['endsAt'])) == 'completed'


def test_bytes_final_lock_history_reopen_and_real_download(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, _, _, students, _, _, _, _, _ = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    student_headers = activate(client, headers, students[0], 'StudentTest123')
    attempt = new_attempt(client, student_headers, exam)
    resumed = new_attempt(client, student_headers, exam)
    assert resumed['resumed'] and resumed['attempt']['id'] == attempt['attempt']['id']
    file, contents = upload(client, student_headers, attempt)
    response = client.patch(f'/api/v1/submission-files/{file["id"]}', headers=student_headers, json={'submissionBaseName': 'answer_final', 'expectedVersion': file['rowVersion']})
    assert response.status_code == 200, response.text
    assert response.json()['sha256'] == file['sha256'] and response.json()['uploadSequence'] == file['uploadSequence']
    assert client.get(f'/api/v1/submission-files/{file["id"]}/content', headers=headers).status_code == 404
    final_url = f'/api/v1/submissions/{attempt["submission"]["id"]}/versions/{attempt["attempt"]["id"]}/finalize'
    final = client.post(final_url, headers=student_headers)
    assert final.status_code == 200, final.text
    assert final.json()['isComplete'] and final.json()['state'] == 'final'
    assert client.post(final_url, headers=student_headers).json()['finalizedAt'] == final.json()['finalizedAt']
    assert client.delete(f'/api/v1/submission-files/{file["id"]}', headers=student_headers).status_code == 409
    download = client.get(f'/api/v1/submission-files/{file["id"]}/content', headers=headers)
    assert download.status_code == 200 and download.content == contents
    assert download.headers['content-type'] == 'application/octet-stream' and download.headers['x-content-type-options'] == 'nosniff'
    archive = client.get(f'/api/v1/exams/{exam["id"]}/submissions/archive', headers=headers)
    with zipfile.ZipFile(io.BytesIO(archive.content)) as archive_file:
        assert archive_file.read(archive_file.namelist()[0]) == contents
    with pytest.raises(IntegrityError), pg_engine.begin() as db:
        db.execute(text("UPDATE submission_files SET submission_name = 'changed.py' WHERE id = :id"), {'id': file['id']})
    grant = client.post(f'/api/v1/exams/{exam["id"]}/submission-reopens', headers={**headers, 'Idempotency-Key': str(uuid4())},
                        json={'scope': 'student', 'studentId': students[0]['id'], 'minutes': 5, 'reason': 'อนุญาตแก้ไขงาน'})
    assert grant.status_code == 200, grant.text
    reopened = new_attempt(client, student_headers, exam)
    assert reopened['attempt']['versionNumber'] == 2 and reopened['attempt']['id'] != attempt['attempt']['id']
    assert client.get(f'/api/v1/submissions/{attempt["submission"]["id"]}', headers=student_headers).json()['latestFinalVersion']['id'] == attempt['attempt']['id']
    other_headers = activate(client, headers, students[1], 'OtherStudent123')
    assert client.get(f'/api/v1/submission-files/{file["id"]}/content', headers=other_headers).status_code == 404


def test_timeout_incomplete_no_files_and_restart_recovery(client, admin_account, pg_engine):
    _, headers = admin_account
    exam, _, _, students, _, _, _, _, _ = exam_setup(client, headers)
    from app.models import exam_sessions, submission_files, submission_versions
    from app.services.exams import now
    from app.worker import run_once
    with pg_engine.begin() as db:
        db.execute(update(exam_sessions).where(exam_sessions.c.id == exam['id']).values(required_file_count=2, starts_at=now() - timedelta(minutes=1)))
    student_headers = activate(client, headers, students[0], 'StudentTest123')
    attempt = new_attempt(client, student_headers, exam)
    file, _ = upload(client, student_headers, attempt)
    with pg_engine.begin() as db:
        db.execute(update(exam_sessions).where(exam_sessions.c.id == exam['id']).values(ends_at=now() - timedelta(seconds=1)))
    run_once()
    run_once()
    final = client.get(f'/api/v1/submissions/{attempt["submission"]["id"]}', headers=student_headers).json()['latestFinalVersion']
    assert final['state'] == 'final' and not final['isComplete'] and final['receivedFileCount'] == 1 and final['timeliness'] == 'on_time'
    grant = client.post(f'/api/v1/exams/{exam["id"]}/submission-reopens', headers={**headers, 'Idempotency-Key': str(uuid4())},
                        json={'scope': 'student', 'studentId': students[0]['id'], 'minutes': 5, 'reason': 'เปิดส่งหลังหมดเวลา'})
    assert grant.status_code == 200, grant.text
    reopened = new_attempt(client, student_headers, exam)
    # A receiver disconnected before acknowledging bytes; worker can recover without the browser.
    intent = client.post(f'/api/v1/submissions/{attempt["submission"]["id"]}/versions/{reopened["attempt"]["id"]}/files', headers=student_headers,
                         json={'originalName': 'missing.py', 'expectedSizeBytes': 10}).json()
    with pg_engine.begin() as db:
        db.execute(update(submission_files).where(submission_files.c.id == intent['id']).values(state='receiving', receive_started_at=now()))
    run_once()
    with pg_engine.connect() as db:
        assert db.scalar(select(submission_files.c.state).where(submission_files.c.id == intent['id'])) == 'failed'
    from app.models import submission_reopen_grants
    with pg_engine.begin() as db:
        db.execute(update(submission_reopen_grants).where(submission_reopen_grants.c.id == reopened['attempt']['reopenGrantId']).values(expires_at=now() - timedelta(seconds=1), created_at=now() - timedelta(minutes=6)))
    run_once()
    with pg_engine.connect() as db:
        assert db.scalar(select(submission_versions.c.state).where(submission_versions.c.id == reopened['attempt']['id'])) == 'expired'
