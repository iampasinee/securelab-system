from datetime import datetime, time, timedelta, date

from sqlalchemy import select, func

from app.models import (exam_sessions, exam_participants, exam_seat_assignments, submissions, submission_versions, users,
                        student_profiles, violations, computer_devices, room_seats, courses, sections, course_offerings)
from app.repositories.base import now, get, rows
from app.services import exams, roster
from app.services.submissions import root_dto
from app.services.common import public


def day_bounds(day):
    start = datetime.combine(day, time.min, exams.BANGKOK)
    return start, start + timedelta(days=1)


def daily_exams(db, actor, day):
    start, end = day_bounds(day)
    ids = exams.authorized_ids(db, actor)
    return rows(db, select(exam_sessions).where(exam_sessions.c.id.in_(ids), exam_sessions.c.starts_at >= start, exam_sessions.c.starts_at < end).order_by(exam_sessions.c.starts_at, exam_sessions.c.id))


def summary(db, actor, identifier):
    exam = exams.require_exam(db, actor, identifier, freeze_due=True)
    assignments = {row['studentId']: row for row in exams.assignments_dto(db, exam, actor)['items']}
    snapshots = {row['student_id']: row for row in rows(db, select(exam_participants).where(exam_participants.c.exam_id == identifier))}
    roots = {row['student_id']: row for row in rows(db, select(submissions).where(submissions.c.exam_id == identifier))}
    counts = {'total': 0, 'notStarted': 0, 'working': 0, 'submitted': 0, 'late': 0, 'reopened': 0, 'unseated': 0, 'pendingReview': 0}
    people = []
    for student_id in sorted(roster.exam_roster(db, exam), key=str):
        user = get(db, users, student_id)
        profile = get(db, student_profiles, student_id, key='user_id')
        snapshot = snapshots.get(student_id)
        root = roots.get(student_id)
        current = root_dto(db, root, actor, exam) if root else None
        has_final = bool(current and current['latestFinalVersion'])
        has_open = bool(current and current['hasOpenVersion'])
        state = 'reopened' if has_final and has_open else 'working' if has_open else 'late' if has_final and current['status'] == 'late' else 'submitted' if has_final else 'not_started'
        pending = db.scalar(select(func.count()).select_from(violations).where(violations.c.exam_id == identifier, violations.c.student_id == student_id, violations.c.reviewed_at.is_(None)))
        assignment = assignments.get(student_id)
        counts['total'] += 1
        counts[{'not_started': 'notStarted', 'working': 'working', 'submitted': 'submitted', 'late': 'late', 'reopened': 'reopened'}[state]] += 1
        counts['unseated'] += int(assignment is None)
        counts['pendingReview'] += pending
        people.append({'studentId': student_id, 'studentCode': snapshot['student_code_snapshot'] if snapshot else profile['student_code'],
                       'fullName': snapshot['name_snapshot'] if snapshot else user['full_name'], 'accountStatus': user['account_status'],
                       'majorId': snapshot['major_id'] if snapshot else profile['major_id'], 'admissionYear': snapshot['admission_year_snapshot'] if snapshot else profile['admission_year'],
                       'classGroupId': snapshot['class_group_id'] if snapshot else profile['class_group_id'], 'seat': assignment, 'submission': current,
                       'status': state, 'pendingReviewCount': pending, 'identityVerification': 'unavailable', 'runtimeStatus': 'unknown'})
    return {'exam': exams.exam_dto(db, exam, actor), 'participants': people, 'counters': counts, 'serverNow': now(), 'capabilities': exams.CAPABILITIES}


def overview(db, actor):
    ids = exams.authorized_ids(db, actor)
    records = rows(db, select(exam_sessions).where(exam_sessions.c.id.in_(ids)))
    clock = now()
    counters = {'total': len(records), 'upcoming': 0, 'in_progress': 0, 'completed': 0}
    for exam in records:
        counters[exams.status(exam, clock)] += 1
    finals = db.scalar(select(func.count()).select_from(submissions).where(submissions.c.exam_id.in_(ids), submissions.c.latest_final_version_id.is_not(None)))
    pending = db.scalar(select(func.count()).select_from(violations).where(violations.c.exam_id.in_(ids), violations.c.reviewed_at.is_(None)))
    return {'exams': counters, 'submittedCount': finals, 'pendingReviewCount': pending,
            'participantCount': sum(len(roster.exam_roster(db, exam)) for exam in records), 'serverNow': clock, 'capabilities': exams.CAPABILITIES}
