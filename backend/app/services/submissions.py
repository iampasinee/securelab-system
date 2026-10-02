from datetime import timedelta
from uuid import uuid4
import re

from sqlalchemy import select, func, delete, update

from app.core.errors import fail, missing
from app.models import submissions, submission_versions, submission_files, submission_reopen_grants, users, student_profiles, exam_file_extensions, exam_seat_assignments
from app.repositories.base import get, create, change, now, rows
from app.services import exams, roster
from app.services.audit import audit
from app.services.common import public
from app.services.filenames import generated_name


def deadline(db, version, exam):
    if version['reopen_grant_id']:
        grant = get(db, submission_reopen_grants, version['reopen_grant_id'])
        return grant['expires_at']
    return exam['ends_at']


def pending_grant(db, exam_id, student_id, lock=False):
    statement = select(submission_reopen_grants).where(submission_reopen_grants.c.exam_id == exam_id, submission_reopen_grants.c.student_id == student_id,
                 submission_reopen_grants.c.expires_at > now(), submission_reopen_grants.c.consumed_at.is_(None), submission_reopen_grants.c.revoked_at.is_(None))
    statement = statement.order_by(submission_reopen_grants.c.created_at.desc(), submission_reopen_grants.c.id)
    if lock:
        statement = statement.with_for_update()
    value = db.execute(statement.limit(1)).mappings().first()
    return dict(value) if value else None


def file_dto(record):
    fields = ('id', 'version_id', 'upload_sequence', 'original_name', 'submission_name', 'extension', 'client_mime', 'expected_size_bytes',
              'state', 'receive_started_at', 'received_at', 'size_bytes', 'failure_code', 'created_at', 'updated_at', 'row_version')
    return {**public({key: record[key] for key in fields}), 'uploadId': record['id'], 'sha256': record['sha256'].hex() if record['sha256'] else None}


def version_dto(db, version, exam):
    files = rows(db, select(submission_files).where(submission_files.c.version_id == version['id']).order_by(submission_files.c.upload_sequence))
    ready = [file_dto(file) for file in files if file['state'] == 'ready']
    required = version['required_count_snapshot'] or exam['required_file_count']
    return {**public(version), 'attemptId': version['id'], 'files': ready if version['state'] == 'final' else [file_dto(file) for file in files if file['state'] != 'removed'],
            'receivedFileCount': len(ready), 'requiredFileCount': required, 'isComplete': len(ready) >= required,
            'deadline': version['deadline_snapshot'] or deadline(db, version, exam), 'serverNow': now()}


def root_dto(db, root, actor, exam=None):
    exam = exam or exams.require_exam(db, actor, root['exam_id'])
    latest = get(db, submission_versions, root['latest_final_version_id']) if root['latest_final_version_id'] else None
    opened = db.execute(select(submission_versions).where(submission_versions.c.submission_id == root['id'], submission_versions.c.state == 'open')).mappings().first()
    status = ('late' if latest['timeliness'] == 'late' else 'submitted') if latest else 'in_progress' if opened else 'not_submitted'
    return {**public(root), 'status': status, 'latestFinalVersion': version_dto(db, latest, exam) if latest else None,
            'openVersion': version_dto(db, dict(opened), exam) if opened and actor['role'] == 'student' and actor['id'] == root['student_id'] else None,
            'hasOpenVersion': bool(opened), 'serverNow': now()}


def require_root(db, actor, identifier, lock=False):
    # Peek at identity, then acquire locks in offering → exam → root → version → file order.
    root = get(db, submissions, identifier)
    if actor['role'] == 'student' and root['student_id'] != actor['id']:
        missing()
    exam = exams.require_exam(db, actor, root['exam_id'], lock=lock)
    if lock:
        root = get(db, submissions, identifier, lock=True)
    return root, exam


def require_version(db, actor, root_id, version_id, lock=False, owner_only=False):
    root, exam = require_root(db, actor, root_id, lock)
    version = get(db, submission_versions, version_id, lock=lock)
    if version['submission_id'] != root_id or (actor['role'] != 'student' and version['state'] != 'final'):
        missing()
    if owner_only and (actor['role'] != 'student' or actor['id'] != root['student_id']):
        fail('forbidden', 'ส่งไฟล์ได้เฉพาะเจ้าของงานเท่านั้น', 403)
    return root, exam, version


def open_window(db, version, exam, receiving=False):
    if version['state'] != 'open':
        fail('workspace_locked', 'การส่งครั้งนี้ปิดแล้ว ไม่สามารถเปลี่ยนไฟล์ได้')
    end = deadline(db, version, exam)
    limit = end + timedelta(seconds=10) if receiving else end
    if now() < exam['starts_at'] or now() >= limit:
        fail('submission_window_closed', 'หมดเวลารับไฟล์แล้ว')
    if version['reopen_grant_id']:
        grant = get(db, submission_reopen_grants, version['reopen_grant_id'])
        if grant['revoked_at']:
            fail('reopen_revoked', 'การอนุญาตส่งใหม่ถูกยกเลิกแล้ว')
    return end


def access_dto(db, actor, exam):
    value = db.execute(select(submissions).where(submissions.c.exam_id == exam['id'], submissions.c.student_id == actor['id'])).mappings().first()
    root = dict(value) if value else None
    grant = pending_grant(db, exam['id'], actor['id'])
    opened = db.execute(select(submission_versions).where(submission_versions.c.submission_id == root['id'], submission_versions.c.state == 'open')).mappings().first() if root else None
    initial_exists = db.scalar(select(func.count()).select_from(submission_versions).where(submission_versions.c.submission_id == root['id'], submission_versions.c.reopen_grant_id.is_(None))) if root else False
    can_start = exams.status(exam) == 'in_progress' and not initial_exists or bool(grant)
    if opened:
        can_start = now() < deadline(db, dict(opened), exam)
    seat = exams.assignments_dto(db, exam, actor)['items']
    return {'examId': exam['id'], 'eligible': actor['id'] in roster.exam_roster(db, exam), 'serverNow': now(), 'status': exams.status(exam),
            'examRevision': exam['setup_revision'], 'seat': seat[0] if seat else None, 'submission': root_dto(db, root, actor, exam) if root else None,
            'reopenGrant': public(grant) if grant else None, 'deadline': deadline(db, dict(opened), exam) if opened else grant['expires_at'] if grant else exam['ends_at'],
            'capabilities': {**exams.CAPABILITIES, 'startAttempt': bool(can_start), 'resumeAttempt': bool(opened and can_start)}}


def start_attempt(db, actor, exam_id, payload):
    exam = exams.require_exam(db, actor, exam_id, lock=True, freeze_due=True)
    if not payload.rules_accepted or payload.accepted_exam_revision != exam['setup_revision']:
        fail('rules_revision_required', 'กรุณาตรวจสอบและยอมรับกฎการสอบฉบับล่าสุด', 422)
    if exams.status(exam) == 'upcoming':
        fail('exam_not_started', 'ยังไม่ถึงเวลาเริ่มสอบ')
    root_row = db.execute(select(submissions).where(submissions.c.exam_id == exam_id, submissions.c.student_id == actor['id']).with_for_update()).mappings().first()
    root = dict(root_row) if root_row else create(db, submissions, {'exam_id': exam_id, 'student_id': actor['id']})
    versions = rows(db, select(submission_versions).where(submission_versions.c.submission_id == root['id']).order_by(submission_versions.c.version_number).with_for_update())
    opened = next((version for version in versions if version['state'] == 'open'), None)
    if opened:
        open_window(db, opened, exam)
        return {'submission': root_dto(db, root, actor, exam), 'attempt': version_dto(db, opened, exam), 'resumed': True}
    grant = pending_grant(db, exam_id, actor['id'], lock=True)
    if not grant and (exams.status(exam) != 'in_progress' or any(version['reopen_grant_id'] is None for version in versions)):
        fail('reopen_required', 'ต้องได้รับอนุญาตเปิดรับส่งใหม่ก่อนเริ่มการส่งครั้งใหม่')
    version = create(db, submission_versions, {'submission_id': root['id'], 'version_number': (versions[-1]['version_number'] + 1) if versions else 1,
                                               'reopen_grant_id': grant['id'] if grant else None, 'started_at': now(), 'rules_accepted_at': now(),
                                               'accepted_exam_revision': payload.accepted_exam_revision})
    if grant:
        change(db, submission_reopen_grants, grant, {'consumed_at': now()})
    audit(db, actor, 'submission.attempt_started', 'submission', root['id'], {'examId': str(exam_id), 'versionId': str(version['id'])})
    return {'submission': root_dto(db, root, actor, exam), 'attempt': version_dto(db, version, exam), 'resumed': False}


def file_intent(db, actor, root_id, version_id, payload):
    root, exam, version = require_version(db, actor, root_id, version_id, lock=True, owner_only=True)
    open_window(db, version, exam)
    name = payload.original_name
    if any(character in name for character in ('/', '\\', '\x00', '\n', '\r')) or name in ('.', '..'):
        fail('invalid_original_name', 'ชื่อไฟล์ต้องไม่มีเส้นทางหรืออักขระควบคุม', 422)
    extension = '.' + name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    allowed = set(db.scalars(select(exam_file_extensions.c.extension).where(exam_file_extensions.c.exam_id == exam['id'])))
    if extension not in allowed:
        fail('extension_not_allowed', 'นามสกุลไฟล์ไม่ตรงตามข้อกำหนดการสอบ', 422)
    if payload.expected_size_bytes > exam['max_file_size_bytes']:
        fail('file_too_large', 'ขนาดไฟล์เกินข้อกำหนดการสอบ', 413)
    sequence = (db.scalar(select(func.max(submission_files.c.upload_sequence)).where(submission_files.c.version_id == version_id)) or 0) + 1
    profile = get(db, student_profiles, actor['id'], key='user_id')
    submission_name = generated_name(exam, profile, sequence, extension)
    record = create(db, submission_files, {'version_id': version_id, 'upload_sequence': sequence, 'original_name': name, 'submission_name': submission_name,
                                          'extension': extension, 'expected_size_bytes': payload.expected_size_bytes, 'client_mime': payload.client_mime})
    return file_dto(record)


def require_file(db, actor, upload_id, lock=False, owner_only=False):
    peek = get(db, submission_files, upload_id)
    version = get(db, submission_versions, peek['version_id'])
    root, exam, version = require_version(db, actor, version['submission_id'], version['id'], lock=lock, owner_only=owner_only)
    record = get(db, submission_files, upload_id, lock=lock)
    return root, exam, version, record


def rename_file(db, actor, upload_id, payload):
    _, exam, version, record = require_file(db, actor, upload_id, lock=True, owner_only=True)
    open_window(db, version, exam)
    if record['state'] == 'removed':
        fail('file_removed', 'ไฟล์นี้ถูกนำออกแล้ว')
    updated = change(db, submission_files, record, {'submission_name': payload.submission_base_name + record['extension']}, payload.expected_version)
    audit(db, actor, 'upload.renamed', 'submission_file', upload_id, {'examId': str(exam['id']), 'versionId': str(version['id']), 'fields': ['submission_name']})
    return file_dto(updated)


def remove_file(db, actor, upload_id):
    _, exam, version, record = require_file(db, actor, upload_id, lock=True, owner_only=True)
    open_window(db, version, exam)
    if record['state'] == 'receiving':
        fail('file_receiving', 'รอให้อัปโหลดเสร็จก่อนนำไฟล์ออก')
    if record['state'] != 'removed':
        change(db, submission_files, record, {'state': 'removed'})
        audit(db, actor, 'upload.removed', 'submission_file', upload_id, {'examId': str(exam['id']), 'versionId': str(version['id'])})


def finalize(db, actor, root_id, version_id, automatic=False):
    if automatic:
        root = get(db, submissions, root_id, lock=True)
        exam = get(db, exams.exam_sessions, root['exam_id'])
        version = get(db, submission_versions, version_id, lock=True)
    else:
        root, exam, version = require_version(db, actor, root_id, version_id, lock=True, owner_only=True)
    if version['state'] == 'final':
        return version_dto(db, version, exam)
    if version['state'] != 'open':
        fail('attempt_expired', 'การส่งครั้งนี้หมดอายุแล้ว')
    end = deadline(db, version, exam)
    if not automatic:
        open_window(db, version, exam)
    files = rows(db, select(submission_files).where(submission_files.c.version_id == version_id, submission_files.c.state != 'removed').order_by(submission_files.c.id).with_for_update())
    ready = [file for file in files if file['state'] == 'ready']
    if automatic:
        if now() < end or (now() < end + timedelta(seconds=10) and any(file['state'] == 'receiving' for file in files)):
            return None
        for file in files:
            if file['state'] in ('reserved', 'receiving'):
                change(db, submission_files, file, {'state': 'failed', 'failure_code': 'deadline_expired'})
        if not ready:
            change(db, submission_versions, version, {'state': 'expired', 'deadline_snapshot': end, 'required_count_snapshot': exam['required_file_count']})
            audit(db, actor, 'submission.expired', 'submission', root_id, {'examId': str(exam['id']), 'versionId': str(version_id), 'count': 0}, outcome='warning')
            return None
    elif len(ready) < exam['required_file_count'] or any(file['state'] != 'ready' for file in files):
        fail('files_not_ready', 'ต้องมีไฟล์ที่อัปโหลดสำเร็จครบจำนวน และไม่มีไฟล์ที่ยังไม่พร้อม')
    timeliness = 'late' if version['reopen_grant_id'] and now() >= exam['ends_at'] else 'on_time'
    finalized = change(db, submission_versions, version, {'state': 'final', 'finalized_at': now(), 'finalization_source': 'timeout' if automatic else 'manual',
                                                         'deadline_snapshot': end, 'required_count_snapshot': exam['required_file_count'], 'timeliness': timeliness})
    change(db, submissions, root, {'latest_final_version_id': version_id})
    audit(db, actor, 'submission.timeout_final' if automatic else 'submission.finalized', 'submission', root_id,
          {'examId': str(exam['id']), 'versionId': str(version_id), 'count': len(ready), 'source': 'timeout' if automatic else 'manual'})
    return version_dto(db, finalized, exam)


def grant_reopen(db, actor, identifier, payload):
    exam = exams.require_exam(db, actor, identifier, lock=True, freeze_due=True)
    if exams.status(exam) == 'upcoming':
        fail('exam_not_started', 'เปิดรับส่งใหม่ได้หลังเริ่มสอบแล้วเท่านั้น')
    ids = roster.exam_roster(db, exam)
    if payload.scope == 'student':
        if payload.student_id is None or payload.student_id not in ids:
            fail('invalid_reopen_student', 'กรุณาเลือกนักศึกษาที่อยู่ในรายชื่อสอบ', 422)
        ids = {payload.student_id}
    elif payload.student_id is not None:
        fail('unexpected_reopen_student', 'การเปิดรับทั้งห้องไม่ต้องระบุนักศึกษารายคน', 422)
    batch_id = uuid4()
    grants, skipped = [], []
    for student_id in sorted(ids, key=str):
        user = get(db, users, student_id)
        root_row = db.execute(select(submissions).where(submissions.c.exam_id == identifier, submissions.c.student_id == student_id).with_for_update()).mappings().first()
        versions = rows(db, select(submission_versions).where(submission_versions.c.submission_id == root_row['id']).with_for_update()) if root_row else []
        reason = 'inactive_account' if user['account_status'] != 'active' else 'open_workspace' if any(version['state'] == 'open' for version in versions) else 'active_grant' if pending_grant(db, identifier, student_id) else 'not_eligible_yet' if not versions and exams.status(exam) != 'completed' else None
        if reason:
            if payload.scope == 'student':
                fail(reason, 'ยังเปิดรับส่งใหม่ให้รายนี้ไม่ได้ บัญชีไม่พร้อม มีงานที่ยังเปิดอยู่ หรือมีการอนุญาตที่ยังไม่หมดอายุ')
            skipped.append({'studentId': student_id, 'reason': reason})
            continue
        grant = create(db, submission_reopen_grants, {'exam_id': identifier, 'student_id': student_id, 'granted_by': actor['id'], 'source_scope': payload.scope,
                                                     'batch_id': batch_id, 'reason': payload.reason.strip(), 'expires_at': now() + timedelta(minutes=payload.minutes)})
        grants.append(public(grant))
    audit(db, actor, 'submission.reopened', 'exam', identifier, {'count': len(grants), 'batchId': str(batch_id), 'reason': payload.reason, 'scope': payload.scope})
    return {'batchId': batch_id, 'grants': grants, 'affectedCount': len(grants), 'skipped': skipped, 'serverNow': now()}
