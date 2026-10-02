from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, delete, func

from app.api.dependencies import database, current_user, staff, student, admin
from app.core.config import get_settings
from app.core.errors import fail, missing
from app.models import (violations, security_settings, security_allowed_domains, audit_logs, users, floors, physical_rooms, exam_rooms,
                        computer_devices, exam_sessions, exam_seat_assignments)
from app.repositories.base import get, now, create, change, rows
from app.schemas.monitoring import SecuritySettings, SimulatedViolation
from app.services import monitoring as service, exams, roster
from app.services.audit import audit
from app.services.common import public, paginate, search_pattern, csv_bytes


router = APIRouter(tags=['monitoring', 'violations', 'administration'])


@router.get('/monitoring/daily')
def daily(day: date = Query(alias='date'), q: str | None = None, status: str | None = None, course_id: UUID | None = Query(default=None, alias='courseId'),
          room_id: UUID | None = Query(default=None, alias='roomId'), page: int = Query(default=1, ge=1),
          page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    clock = now()
    records = service.daily_exams(db, actor, day)
    counters = {'total': len(records), 'upcoming': 0, 'in_progress': 0, 'completed': 0}
    for exam in records:
        counters[exams.status(exam, clock)] += 1
    values = [exams.exam_dto(db, exam, actor) for exam in records]
    filtered = [value for value in values if (not q or q.casefold() in ' '.join((value['name'], value['courseName'], value['courseCode'])).casefold())
                and (not status or value['status'] == status) and (not course_id or value['courseId'] == course_id) and (not room_id or value['roomId'] == room_id)]
    return {'items': filtered[(page-1)*page_size:page*page_size], 'total': len(filtered), 'page': page, 'pageSize': page_size, 'counters': counters, 'serverNow': clock}


@router.get('/monitoring/calendar')
def calendar(month: str = Query(pattern=r'^[0-9]{4}-(0[1-9]|1[0-2])$'), actor=Depends(staff), db=Depends(database)):
    first = date.fromisoformat(month + '-01')
    next_month = date(first.year + (first.month == 12), 1 if first.month == 12 else first.month + 1, 1)
    start, _ = service.day_bounds(first)
    end, _ = service.day_bounds(next_month)
    ids = exams.authorized_ids(db, actor)
    schedule = db.scalars(select(exam_sessions.c.starts_at).where(exam_sessions.c.id.in_(ids), exam_sessions.c.starts_at >= start, exam_sessions.c.starts_at < end))
    counts = {}
    for timestamp in schedule:
        day = timestamp.astimezone(exams.BANGKOK).date().isoformat()
        counts[day] = counts.get(day, 0) + 1
    return {'items': [{'date': day, 'examCount': count} for day, count in sorted(counts.items())], 'serverNow': now()}


@router.get('/monitoring/exams/{identifier}')
def exam_summary(identifier: UUID, actor=Depends(staff), db=Depends(database)):
    return service.summary(db, actor, identifier)


@router.get('/monitoring/overview')
def overview(actor=Depends(staff), db=Depends(database)):
    return service.overview(db, actor)


def violation_dto(db, record, actor):
    value = public(record)
    value['acknowledged'] = record['student_seen_at'] is not None if actor['role'] == 'student' else record['reviewed_at'] is not None
    return value


def require_violation(db, actor, identifier):
    record = get(db, violations, identifier, lock=True)
    if actor['role'] == 'student' and actor['id'] != record['student_id']:
        missing()
    exams.require_exam(db, actor, record['exam_id'])
    return record


@router.get('/violations')
def list_violations(exam_id: UUID | None = Query(default=None, alias='examId'), type: str | None = None, reviewed: bool | None = None, q: str | None = None,
                    page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    statement = select(violations).where(violations.c.exam_id.in_(exams.authorized_ids(db, actor)))
    if actor['role'] == 'student':
        statement = statement.where(violations.c.student_id == actor['id'])
    if exam_id:
        statement = statement.where(violations.c.exam_id == exam_id)
    if type:
        statement = statement.where(violations.c.type == type)
    if reviewed is not None:
        statement = statement.where(violations.c.reviewed_at.is_not(None) if reviewed else violations.c.reviewed_at.is_(None))
    if q:
        statement = statement.where(violations.c.detail.ilike(search_pattern(q), escape='\\'))
    return paginate(db, statement.order_by(violations.c.created_at.desc(), violations.c.id), page, page_size, lambda row: violation_dto(db, row, actor))


@router.post('/violations/{identifier}/seen')
def seen(identifier: UUID, actor=Depends(student), db=Depends(database)):
    record = require_violation(db, actor, identifier)
    if record['student_seen_at'] is None:
        record = change(db, violations, record, {'student_seen_at': now()})
        audit(db, actor, 'violation.seen', 'violation', identifier, {'examId': str(record['exam_id'])})
    return violation_dto(db, record, actor)


@router.post('/violations/{identifier}/review')
def review(identifier: UUID, actor=Depends(staff), db=Depends(database)):
    record = require_violation(db, actor, identifier)
    if record['reviewed_at'] is None:
        record = change(db, violations, record, {'reviewed_at': now(), 'reviewed_by': actor['id']})
        audit(db, actor, 'violation.reviewed', 'violation', identifier, {'examId': str(record['exam_id'])})
    return violation_dto(db, record, actor)


@router.post('/dev/exams/{identifier}/violations', status_code=201)
def simulate(identifier: UUID, payload: SimulatedViolation, actor=Depends(staff), db=Depends(database)):
    if not get_settings().enable_development_simulation:
        missing()
    exam = exams.require_exam(db, actor, identifier, lock=True, freeze_due=True)
    if exam['roster_frozen_at'] is None or payload.student_id not in roster.exam_roster(db, exam):
        fail('invalid_simulated_participant', 'เหตุจำลองต้องอ้างนักศึกษาในรายชื่อสอบที่เริ่มแล้ว', 422)
    seat_id = db.scalar(select(exam_seat_assignments.c.seat_id).where(exam_seat_assignments.c.exam_id == identifier, exam_seat_assignments.c.student_id == payload.student_id))
    event = create(db, violations, {'exam_id': identifier, 'student_id': payload.student_id, 'seat_id': seat_id, 'source': 'development_simulation', 'type': payload.type, 'detail': payload.detail})
    audit(db, actor, 'violation.development_simulation', 'violation', event['id'], {'examId': str(identifier), 'source': 'development_simulation'})
    return violation_dto(db, event, actor)


def settings_dto(db):
    record = get(db, security_settings, 1)
    return {**public(record), 'allowedDomains': list(db.scalars(select(security_allowed_domains.c.domain).order_by(security_allowed_domains.c.domain))),
            'capabilities': exams.CAPABILITIES}


@router.get('/admin/security-settings')
def security(actor=Depends(admin), db=Depends(database)):
    return settings_dto(db)


@router.put('/admin/security-settings')
def update_security(payload: SecuritySettings, actor=Depends(admin), db=Depends(database)):
    record = get(db, security_settings, 1, lock=True)
    values = payload.model_dump(exclude={'expected_version', 'allowed_domains'})
    change(db, security_settings, record, values, payload.expected_version)
    db.execute(delete(security_allowed_domains))
    for domain in sorted({exams.normalized_domain(value) for value in payload.allowed_domains}):
        create(db, security_allowed_domains, {'settings_id': 1, 'domain': domain})
    audit(db, actor, 'security.settings_updated', 'security_settings', metadata={'fields': list(values) + ['allowed_domains']})
    return settings_dto(db)


class AuditFilters:
    def __init__(self, actor_id: UUID | None = Query(default=None, alias='actorId'), action: str | None = None, target_type: str | None = Query(default=None, alias='targetType'),
                 target_id: UUID | None = Query(default=None, alias='targetId'), start_date: date | None = Query(default=None, alias='startDate'),
                 end_date: date | None = Query(default=None, alias='endDate'), outcome: str | None = None, q: str | None = None):
        statement = select(audit_logs)
        for column, value in ((audit_logs.c.actor_id, actor_id), (audit_logs.c.action, action), (audit_logs.c.target_type, target_type), (audit_logs.c.target_id, target_id), (audit_logs.c.outcome, outcome)):
            if value is not None:
                statement = statement.where(column == value)
        if start_date:
            statement = statement.where(audit_logs.c.created_at >= service.day_bounds(start_date)[0])
        if end_date:
            statement = statement.where(audit_logs.c.created_at < service.day_bounds(end_date)[1])
        if q:
            statement = statement.where(audit_logs.c.action.ilike(search_pattern(q), escape='\\') | audit_logs.c.target_type.ilike(search_pattern(q), escape='\\'))
        self.statement = statement


@router.get('/admin/audit-logs/export')
def export_audit(filters=Depends(AuditFilters), actor=Depends(admin), db=Depends(database)):
    values = rows(db, filters.statement.order_by(audit_logs.c.created_at, audit_logs.c.id).limit(10001))
    if len(values) > 10000:
        fail('audit_export_too_large', 'กรุณาจำกัดช่วงเวลาให้เหลือไม่เกิน 10,000 เหตุการณ์', 422)
    data = csv_bytes(['เวลา', 'ผู้ดำเนินการ ID', 'บทบาท', 'การกระทำ', 'ประเภทข้อมูล', 'ข้อมูล ID', 'ผลลัพธ์'],
                     [[row['created_at'].isoformat(), row['actor_id'], row['actor_role_snapshot'], row['action'], row['target_type'], row['target_id'], row['outcome']] for row in values])
    audit(db, actor, 'audit.export', 'audit', metadata={'count': len(values)})
    return Response(data, media_type='text/csv; charset=utf-8', headers={'Content-Disposition': 'attachment; filename="audit.csv"', 'X-Content-Type-Options': 'nosniff'})


@router.get('/admin/audit-logs')
def audit_list(filters=Depends(AuditFilters), page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100),
               sort: str = 'createdAt', direction: str = 'desc', actor=Depends(admin), db=Depends(database)):
    columns = {'createdAt': audit_logs.c.created_at, 'action': audit_logs.c.action, 'outcome': audit_logs.c.outcome}
    if sort not in columns or direction not in ('asc', 'desc'):
        fail('invalid_sort', 'รูปแบบการเรียงข้อมูลใช้ไม่ได้', 422)
    order = columns[sort].asc() if direction == 'asc' else columns[sort].desc()
    return paginate(db, filters.statement.order_by(order, audit_logs.c.id), page, page_size)


@router.get('/admin/overview')
def admin_overview(actor=Depends(admin), db=Depends(database)):
    result = service.overview(db, actor)
    result['users'] = {role: db.scalar(select(func.count()).select_from(users).where(users.c.role == role)) for role in ('student', 'teacher', 'admin')}
    result['rooms'] = {'floors': db.scalar(select(func.count()).select_from(floors)), 'physical': db.scalar(select(func.count()).select_from(physical_rooms)),
                       'examRooms': db.scalar(select(func.count()).select_from(exam_rooms)), 'ready': db.scalar(select(func.count()).select_from(exam_rooms).join(physical_rooms).join(floors).where(
                           exam_rooms.c.status == 'ready', physical_rooms.c.status == 'active', floors.c.status == 'active'))}
    result['devices'] = {'total': db.scalar(select(func.count()).select_from(computer_devices)), 'runtimeStatus': 'unknown'}
    return result
