"""Store untrusted bytes only. Nothing in this module imports or executes uploads."""
from hashlib import sha256
from pathlib import Path
import os
import tempfile
import logging
import asyncio
from contextlib import suppress
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select, text
from anyio import to_thread

from app.core.config import get_settings
from app.core.database import get_engine
from app.core.errors import fail
from app.models import submission_files, users, auth_sessions, file_integrity_checks
from app.repositories.base import get, now, change
from app.services import submissions
from app.services.audit import audit


def lock_number(upload_id):
    return int.from_bytes(sha256(f'upload:{upload_id}'.encode()).digest()[:8], 'big', signed=True)


def storage_path(key):
    root = get_settings().storage_root.resolve()
    target = (root / key).resolve()
    if root not in target.parents:
        fail('invalid_storage_key', 'ตำแหน่งไฟล์ใช้ไม่ได้', 503)
    if os.name == 'nt':
        # UUID hierarchy exceeds legacy MAX_PATH on Windows development machines.
        value = str(target)
        if not value.startswith('\\\\?\\'):
            value = '\\\\?\\UNC\\' + value[2:] if value.startswith('\\\\') else '\\\\?\\' + value
        return Path(value)
    return target


def file_key(root, version, record):
    return f'exams/{root["exam_id"]}/{root["student_id"]}/{root["id"]}/versions/{version["id"]}/{record["id"]}'


def account_still_active(db, actor):
    user = get(db, users, actor['id'])
    family = get(db, auth_sessions, actor['session_id'])
    if user['account_status'] != 'active' or family['revoked_at'] is not None or family['expires_at'] <= now():
        fail('unauthenticated', 'เซสชันถูกยกเลิกแล้ว', 401)


def prepare_receive(actor, upload_id):
    with get_engine().begin() as db:
        root, exam, version, record = submissions.require_file(db, actor, upload_id, lock=True, owner_only=True)
        account_still_active(db, actor)
        if record['state'] == 'ready':
            return {'receipt': submissions.file_dto(record)}
        submissions.open_window(db, version, exam)
        if record['state'] == 'removed':
            fail('file_removed', 'ไฟล์ถูกนำออกแล้ว')
        # The session advisory lock proves an earlier receiving process is no longer running.
        record = change(db, submission_files, record, {'state': 'receiving', 'receive_started_at': now(), 'failure_code': None})
        return {'root': root, 'exam': exam, 'version': version, 'file': record, 'key': file_key(root, version, record)}


def commit_receive(actor, upload_id, size, digest, key):
    with get_engine().begin() as db:
        root, exam, version, record = submissions.require_file(db, actor, upload_id, lock=True, owner_only=True)
        account_still_active(db, actor)
        end = submissions.open_window(db, version, exam, receiving=True)
        if record['state'] != 'receiving' or record['receive_started_at'] >= end:
            fail('receive_not_allowed', 'ไฟล์ไม่ได้เริ่มรับก่อนหมดเวลาหรือการรับถูกยกเลิกแล้ว')
        if size != record['expected_size_bytes'] or size <= 0 or size > exam['max_file_size_bytes']:
            fail('file_size_mismatch', 'จำนวน bytes ที่รับไม่ตรงกับขนาดไฟล์ที่แจ้ง', 422)
        record = change(db, submission_files, record, {'state': 'ready', 'size_bytes': size, 'sha256': digest, 'storage_key': key, 'received_at': now(), 'failure_code': None})
        from app.repositories.base import create
        create(db, file_integrity_checks, {'file_id': upload_id, 'result': 'passed', 'observed_sha256': digest, 'observed_size_bytes': size, 'checked_by': actor['id']})
        audit(db, actor, 'upload.completed', 'submission_file', upload_id, {'examId': str(exam['id']), 'versionId': str(version['id'])})
        return submissions.file_dto(record)


def fail_receive(actor, upload_id, code):
    with get_engine().begin() as db:
        _, exam, version, record = submissions.require_file(db, actor, upload_id, lock=True, owner_only=True)
        if version['state'] == 'open' and record['state'] in ('reserved', 'receiving'):
            change(db, submission_files, record, {'state': 'failed', 'failure_code': code})
            audit(db, actor, 'upload.failed', 'submission_file', upload_id, {'examId': str(exam['id']), 'versionId': str(version['id']), 'failureCode': code}, outcome='failure')


def receive_deadline(actor, upload_id, started):
    from datetime import timedelta
    with get_engine().begin() as db:
        _, exam, version, record = submissions.require_file(db, actor, upload_id, owner_only=True)
        if record['state'] == 'removed' or version['state'] != 'open':
            fail('workspace_locked', 'การส่งครั้งนี้ปิดแล้ว')
        end = submissions.deadline(db, version, exam) + (timedelta(seconds=10) if started else timedelta())
        if now() >= end:
            fail('submission_window_closed', 'หมดเวลารับไฟล์แล้ว')
        return max(0.01, (end - now()).total_seconds())


async def next_chunk(iterator, actor, upload_id, started):
    pending = asyncio.create_task(iterator.__anext__())
    try:
        while True:
            remaining = await to_thread.run_sync(receive_deadline, actor, upload_id, started)
            # Keep the stream read alive while polling; cancelling an async generator
            # on every timer tick would incorrectly close a slow client's stream.
            done, _ = await asyncio.wait({pending}, timeout=min(remaining, 1.0))
            if done:
                return pending.result()
    finally:
        if not pending.done():
            pending.cancel()
            with suppress(asyncio.CancelledError, StopAsyncIteration):
                await pending


def verify_stored_file(db, actor, record):
    path = storage_path(record['storage_key'])
    observed = sha256()
    size = 0
    result = 'missing'
    if path.is_file():
        with path.open('rb') as source:
            while chunk := source.read(256 * 1024):
                size += len(chunk)
                observed.update(chunk)
        result = 'passed' if size == record['size_bytes'] and observed.digest() == record['sha256'] else 'mismatch'
    from app.repositories.base import create
    create(db, file_integrity_checks, {'file_id': record['id'], 'result': result, 'observed_sha256': observed.digest() if result != 'missing' else None,
                                      'observed_size_bytes': size if result != 'missing' else None, 'checked_by': actor['id']})
    if result != 'passed':
        audit(db, actor, 'file.integrity_failure', 'submission_file', record['id'], {'fileId': str(record['id']), 'failureCode': result}, outcome='failure')
        db.commit()
        fail('stored_file_integrity_failure', 'ไฟล์ที่จัดเก็บไม่พร้อมดาวน์โหลดหรือมี bytes เปลี่ยนแปลง', 503)
    return path


async def receive(request, actor, upload_id):
    # A dedicated connection holds a session lock, without a long database transaction.
    lease = get_engine().connect()
    locked = False
    temporary = None
    try:
        locked = bool(lease.scalar(text('SELECT pg_try_advisory_lock(:number)'), {'number': lock_number(upload_id)}))
        lease.commit()
        if not locked:
            fail('concurrent_upload', 'ไฟล์นี้กำลังรับข้อมูลอยู่')
        with get_engine().begin() as db:
            _, _, _, initial = submissions.require_file(db, actor, upload_id, owner_only=True)
            if initial['state'] == 'ready':
                return submissions.file_dto(initial)
        # Intent creation or request headers alone do not establish receive time.
        iterator = request.stream().__aiter__()
        first = b''
        while not first:
            try:
                first = await next_chunk(iterator, actor, upload_id, False)
            except StopAsyncIteration:
                fail('empty_upload', 'ไฟล์ต้องมี bytes มากกว่าศูนย์', 422)
        prepared = await to_thread.run_sync(prepare_receive, actor, upload_id)
        if 'receipt' in prepared:
            return prepared['receipt']
        incoming = get_settings().storage_root.resolve() / '.incoming'
        incoming.mkdir(parents=True, exist_ok=True)
        descriptor, filename = tempfile.mkstemp(prefix=f'{upload_id}.', suffix='.part', dir=incoming)
        temporary = Path(filename)
        size = 0
        digest = sha256()
        with os.fdopen(descriptor, 'wb') as output:
            chunk = first
            while True:
                if chunk:
                    size += len(chunk)
                    if size > min(prepared['exam']['max_file_size_bytes'], prepared['file']['expected_size_bytes']):
                        fail('file_too_large', 'จำนวน bytes เกินขนาดไฟล์ที่อนุญาต', 413)
                    digest.update(chunk)
                    await to_thread.run_sync(output.write, chunk)
                try:
                    chunk = await next_chunk(iterator, actor, upload_id, True)
                except StopAsyncIteration:
                    break
            await to_thread.run_sync(output.flush)
            await to_thread.run_sync(os.fsync, output.fileno())
        if size != prepared['file']['expected_size_bytes']:
            fail('file_size_mismatch', 'จำนวน bytes ที่รับไม่ตรงกับขนาดไฟล์ที่แจ้ง', 422)
        destination = storage_path(prepared['key'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            # An earlier unacknowledged placement is quarantined; never overwrite READY bytes.
            quarantine = get_settings().storage_root.resolve() / '.quarantine'
            quarantine.mkdir(parents=True, exist_ok=True)
            destination.rename(quarantine / f'{upload_id}.{uuid4()}')
        await to_thread.run_sync(os.link, temporary, destination)
        receipt = await to_thread.run_sync(commit_receive, actor, upload_id, size, digest.digest(), prepared['key'])
        return receipt
    except Exception as exception:
        code = exception.detail.get('code', 'transfer_failed') if isinstance(exception, HTTPException) and isinstance(exception.detail, dict) else 'storage_or_transfer_failed'
        try:
            if locked:
                await to_thread.run_sync(fail_receive, actor, upload_id, code)
        except Exception:
            # Leave durable RECEIVING metadata for the restart recovery worker.
            pass
        if isinstance(exception, OSError):
            logging.getLogger('securelab.storage').warning('Storage operation failed (errno=%s, winerror=%s)', exception.errno, getattr(exception, 'winerror', None))
            fail('storage_unavailable', 'พื้นที่จัดเก็บไฟล์ยังไม่พร้อมใช้งาน', 503)
        raise
    finally:
        # Cleanup failure must never leak the session lock back into the pool.
        with suppress(OSError):
            if temporary and temporary.exists():
                temporary.unlink()
        if locked:
            try:
                lease.execute(text('SELECT pg_advisory_unlock(:number)'), {'number': lock_number(upload_id)})
                lease.commit()
            except Exception:
                lease.invalidate()
        lease.close()
