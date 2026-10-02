from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import select, func

from app.api.dependencies import database, current_user, staff, student
from app.models import exam_sessions, sections, course_offerings, exam_participants, users, audit_logs
from app.repositories.base import rows, get, now
from app.schemas.base import Versioned
from app.schemas.exams import ExamWrite, ExamUpdate, SeatAssignmentWrite, TimeAdjustment, Reopen
from app.services import exams as service, roster
from app.services.common import paginate, search_pattern, idempotent, public
from app.services.users import user_dto


router = APIRouter(prefix='/exams', tags=['exams'])


@router.get('')
def list_exams(q: str | None = None, status: str | None = None, mode: str | None = None, course_id: UUID | None = Query(default=None, alias='courseId'),
               section_id: UUID | None = Query(default=None, alias='sectionId'), exam_date: date | None = Query(default=None, alias='date'),
               page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    ids = service.authorized_ids(db, actor)
    statement = select(exam_sessions).where(exam_sessions.c.id.in_(ids))
    if q:
        from app.models import courses
        matching_sections = select(sections.c.id).join(course_offerings).join(courses).where(courses.c.name.ilike(search_pattern(q), escape='\\') | courses.c.code.ilike(search_pattern(q), escape='\\'))
        statement = statement.where(exam_sessions.c.name.ilike(search_pattern(q), escape='\\') | exam_sessions.c.section_id.in_(matching_sections))
    clock = now()
    if status:
        from app.core.errors import fail
        if status not in ('upcoming', 'in_progress', 'completed'):
            fail('invalid_exam_status', 'สถานะการสอบใช้ไม่ได้', 422)
        predicate = exam_sessions.c.starts_at > clock if status == 'upcoming' else exam_sessions.c.ends_at <= clock if status == 'completed' else (exam_sessions.c.starts_at <= clock) & (exam_sessions.c.ends_at > clock)
        statement = statement.where(predicate)
    if mode:
        statement = statement.where(exam_sessions.c.mode == mode)
    if course_id:
        statement = statement.where(exam_sessions.c.section_id.in_(select(sections.c.id).join(course_offerings).where(course_offerings.c.course_id == course_id)))
    if section_id:
        statement = statement.where(exam_sessions.c.section_id == section_id)
    if exam_date:
        start = datetime.combine(exam_date, time.min, service.BANGKOK)
        statement = statement.where(exam_sessions.c.starts_at >= start, exam_sessions.c.starts_at < start + timedelta(days=1))
    response = paginate(db, statement.order_by(exam_sessions.c.starts_at, exam_sessions.c.id), page, page_size, lambda row: service.exam_dto(db, row, actor))
    return {**response, 'authorizedTotal': len(ids), 'serverNow': clock}


@router.get('/{identifier}')
def detail(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    return service.exam_dto(db, service.require_exam(db, actor, identifier, freeze_due=True), actor)


@router.post('', status_code=201)
def create_exam(payload: ExamWrite, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(staff), db=Depends(database)):
    roster.require_section(db, actor, payload.section_id)
    return idempotent(db, actor, key, 'exam.create', payload.model_dump(), lambda: service.save(db, actor, payload))


@router.patch('/{identifier}')
def update_exam(identifier: UUID, payload: ExamUpdate, actor=Depends(staff), db=Depends(database)):
    return service.save(db, actor, payload, identifier)


@router.get('/{identifier}/participants')
def participants(identifier: UUID, q: str | None = None, page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    exam = service.require_exam(db, actor, identifier, freeze_due=True)
    if exam['roster_frozen_at']:
        statement = select(exam_participants).where(exam_participants.c.exam_id == identifier)
        if q:
            statement = statement.where(exam_participants.c.name_snapshot.ilike(search_pattern(q), escape='\\') | exam_participants.c.student_code_snapshot.ilike(search_pattern(q), escape='\\'))
        response = paginate(db, statement.order_by(exam_participants.c.student_code_snapshot, exam_participants.c.student_id), page, page_size)
        for item in response['items']:
            item['accountStatus'] = get(db, users, item['studentId'])['account_status']
        response['frozen'] = True
        return response
    statement = select(users).where(users.c.id.in_(roster.exam_roster(db, exam)))
    if q:
        statement = statement.where(users.c.full_name.ilike(search_pattern(q), escape='\\'))
    from app.api.courses import roster_summary
    response = paginate(db, statement.order_by(users.c.full_name, users.c.id), page, page_size, lambda row: roster_summary(db, row, exam['section_id']))
    response['frozen'] = False
    return response


@router.get('/{identifier}/access')
def access(identifier: UUID, actor=Depends(student), db=Depends(database)):
    from app.services.submissions import access_dto
    exam = service.require_exam(db, actor, identifier, freeze_due=True)
    return access_dto(db, actor, exam)


@router.get('/{identifier}/seat-assignments')
def seat_assignments(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    exam = service.require_exam(db, actor, identifier, freeze_due=True)
    return service.assignments_dto(db, exam, actor)


@router.put('/{identifier}/seat-assignments/{seat_id}')
def assign(identifier: UUID, seat_id: UUID, payload: SeatAssignmentWrite, actor=Depends(staff), db=Depends(database)):
    return service.assign(db, actor, identifier, seat_id, payload.student_id, payload.expected_version)


@router.delete('/{identifier}/seat-assignments/{seat_id}')
def unassign(identifier: UUID, seat_id: UUID, expected_version: int = Query(alias='expectedVersion', ge=1), actor=Depends(staff), db=Depends(database)):
    return service.assign(db, actor, identifier, seat_id, None, expected_version)


@router.post('/{identifier}/seat-assignments/auto')
def auto_assign(identifier: UUID, payload: Versioned, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(staff), db=Depends(database)):
    service.require_exam(db, actor, identifier)
    return idempotent(db, actor, key, 'exam.auto_seat', {'examId': identifier, **payload.model_dump()}, lambda: service.auto_assign(db, actor, identifier, payload.expected_version))


@router.post('/{identifier}/time-adjustments')
def time_adjustment(identifier: UUID, payload: TimeAdjustment, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(staff), db=Depends(database)):
    service.require_exam(db, actor, identifier)
    return idempotent(db, actor, key, 'exam.time_adjustment', {'examId': identifier, **payload.model_dump()}, lambda: service.time_adjustment(db, actor, identifier, payload))


@router.post('/{identifier}/submission-reopens')
def reopen(identifier: UUID, payload: Reopen, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(staff), db=Depends(database)):
    from app.services.submissions import grant_reopen
    service.require_exam(db, actor, identifier)
    return idempotent(db, actor, key, 'exam.reopen', {'examId': identifier, **payload.model_dump()}, lambda: grant_reopen(db, actor, identifier, payload))


@router.get('/{identifier}/events')
def events(identifier: UUID, page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    service.require_exam(db, actor, identifier)
    statement = select(audit_logs).where((audit_logs.c.target_type == 'exam') & (audit_logs.c.target_id == identifier) |
                                      (audit_logs.c.metadata['examId'].astext == str(identifier)))
    return paginate(db, statement.order_by(audit_logs.c.created_at.desc(), audit_logs.c.id), page, page_size)
