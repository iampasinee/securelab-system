from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from uuid import uuid4
import os

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from tests.test_exams_submissions import exam_setup, make_in_progress, activate, new_attempt, upload

pytestmark = pytest.mark.postgres


def test_rejected_bytes_retry_preserves_identity_and_storage_failure_is_not_success(client, admin_account, pg_engine, monkeypatch):
    _, headers = admin_account
    exam, _, _, students, _, _, _, _, _ = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    owner = activate(client, headers, students[0], 'StudentTest123')
    attempt = new_attempt(client, owner, exam)
    intent_url = f'/api/v1/submissions/{attempt["submission"]["id"]}/versions/{attempt["attempt"]["id"]}/files'
    for name in ('../answer.py', 'answer.exe'):
        assert client.post(intent_url, headers=owner, json={'originalName': name, 'expectedSizeBytes': 10}).status_code == 422
    assert client.post(intent_url, headers=owner, json={'originalName': 'answer.py', 'expectedSizeBytes': 0}).status_code == 422
    file = client.post(intent_url, headers=owner, json={'originalName': 'answer.py', 'expectedSizeBytes': 10}).json()
    content_url = f'/api/v1/submission-files/{file["id"]}/content'
    for contents, code in ((b'', 422), (b'12345', 422), (b'12345678901', 413)):
        response = client.put(content_url, headers=owner, content=contents)
        assert response.status_code == code, response.text
    from app.services import storage
    original_link = storage.os.link
    def unavailable(*args, **kwargs):
        raise OSError(28, 'isolated test storage full')
    monkeypatch.setattr(storage.os, 'link', unavailable)
    response = client.put(content_url, headers=owner, content=b'1234567890')
    assert response.status_code == 503, response.text
    root = client.get(f'/api/v1/submissions/{attempt["submission"]["id"]}', headers=owner).json()
    assert root['latestFinalVersion'] is None and root['openVersion']['files'][0]['state'] == 'failed'
    monkeypatch.setattr(storage.os, 'link', original_link)
    response = client.put(content_url, headers=owner, content=b'1234567890')
    assert response.status_code == 200 and response.json()['id'] == file['id']
    assert response.json()['uploadSequence'] == file['uploadSequence']
    from app.models import submission_files
    with pytest.raises(IntegrityError), pg_engine.begin() as db:
        db.execute(update(submission_files).where(submission_files.c.id == file['id']).values(sha256=bytes(32)))
    # Lost-response retry is a receipt, never an overwrite of READY bytes.
    again = client.put(content_url, headers=owner, content=b'different bytes')
    assert again.status_code == 200 and again.json()['sha256'] == sha256(b'1234567890').hexdigest()
    assert client.patch(f'/api/v1/submission-files/{file["id"]}', headers=owner, json={'submissionBaseName': '../bad', 'expectedVersion': response.json()['rowVersion']}).status_code == 422


def test_one_use_activation_race_and_audit_secret_redaction(client, admin_account, pg_engine):
    _, headers = admin_account
    _, _, _, students, _, _, _, _, _ = exam_setup(client, headers)
    link = client.post(f'/api/v1/users/{students[0]["id"]}/account-links', headers=headers, json={'purpose': 'activate'}).json()['link']
    token = parse_qs(urlparse(link).fragment.split('?', 1)[1])['token'][0]
    password = 'NeverLoggedPassword123'
    def complete(_):
        return client.post('/api/v1/auth/activation/complete', json={'token': token, 'newPassword': password}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(complete, range(2))) == [204, 401]
    records = client.get('/api/v1/admin/audit-logs?pageSize=100', headers=headers).text
    assert token not in records and password not in records and 'passwordHash' not in records


def test_grace_requires_actual_receive_start_and_final_content_is_not_quarantined(client, admin_account, pg_engine, monkeypatch):
    _, headers = admin_account
    exam, _, _, students, _, _, _, _, _ = exam_setup(client, headers)
    make_in_progress(pg_engine, exam['id'])
    owner = activate(client, headers, students[0], 'StudentTest123')
    attempt = new_attempt(client, owner, exam)
    from app.services.exams import now
    from app.models import exam_sessions, submission_files
    from app.services import storage, submissions
    clock = now()
    end = clock + timedelta(seconds=1)
    with pg_engine.begin() as db:
        db.execute(update(exam_sessions).where(exam_sessions.c.id == exam['id']).values(ends_at=end))
    intent_url = f'/api/v1/submissions/{attempt["submission"]["id"]}/versions/{attempt["attempt"]["id"]}/files'
    intent = client.post(intent_url, headers=owner, json={'originalName': 'answer.py', 'expectedSizeBytes': 10}).json()
    late_intent = client.post(intent_url, headers=owner, json={'originalName': 'second.py', 'expectedSizeBytes': 10}).json()
    monkeypatch.setattr(storage, 'now', lambda: clock)
    monkeypatch.setattr(submissions, 'now', lambda: clock)
    async def content_stream():
        nonlocal clock
        yield b'12345'
        clock = end + timedelta(seconds=2)
        yield b'67890'
    # A request whose first bytes were received before end can finish inside grace.
    import asyncio
    from app.api.dependencies import current_user
    from fastapi.security import HTTPAuthorizationCredentials
    with pg_engine.connect() as db:
        actor = current_user(HTTPAuthorizationCredentials(scheme='Bearer', credentials=owner['Authorization'].split(' ', 1)[1]), db)
    class Request:
        def stream(self):
            return content_stream()
    receipt = asyncio.run(storage.receive(Request(), actor, __import__('uuid').UUID(intent['id'])))
    assert receipt['state'] == 'ready' and receipt['sha256'] == sha256(b'1234567890').hexdigest()
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        storage.prepare_receive(actor, __import__('uuid').UUID(late_intent['id']))
    assert error.value.status_code == 409
    with pg_engine.begin() as db:
        final = submissions.finalize(db, None, __import__('uuid').UUID(attempt['submission']['id']), __import__('uuid').UUID(attempt['attempt']['id']), automatic=True)
    assert final['state'] == 'final' and final['timeliness'] == 'on_time'
    from app.services.storage_maintenance import quarantine_orphans
    from app.core.config import get_settings
    root = get_settings().storage_root
    orphan = root / '.incoming' / f'{uuid4()}.abandoned.part'
    orphan.parent.mkdir(exist_ok=True)
    orphan.write_bytes(b'unacknowledged')
    old = (now() - timedelta(hours=25)).timestamp()
    os.utime(orphan, (old, old))
    with pg_engine.connect() as db:
        key = db.scalar(select(submission_files.c.storage_key).where(submission_files.c.id == intent['id']))
    stored = storage.storage_path(key)
    os.utime(stored, (old, old))
    assert quarantine_orphans() == 1
    assert stored.read_bytes() == b'1234567890'
    # Later corruption is recorded separately; immutable expected digest remains intact.
    stored.write_bytes(b'corrupted')
    response = client.get(f'/api/v1/submission-files/{intent["id"]}/content', headers=headers)
    assert response.status_code == 503, response.text
    with pg_engine.connect() as db:
        assert db.scalar(select(submission_files.c.sha256).where(submission_files.c.id == intent['id'])) == sha256(b'1234567890').digest()
