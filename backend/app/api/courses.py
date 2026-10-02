from uuid import UUID

from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy import select, delete

from app.api.dependencies import database, current_user, admin, staff
from app.core.errors import missing
from app.models import courses, course_offerings, sections, users, student_profiles, section_student_overrides
from app.repositories.base import get, rows
from app.schemas.courses import CourseWrite, CourseUpdate, SectionWrite, SectionUpdate, RosterInclusion, RosterMove
from app.services import courses as service, roster
from app.services.users import user_dto
from app.services.audit import audit
from app.services.common import paginate, search_pattern, idempotent


router = APIRouter(tags=['courses', 'sections'])


def course_access(db, actor, identifier):
    record = get(db, courses, identifier)
    if actor['role'] != 'admin' and not db.scalar(select(sections.c.id).join(course_offerings).where(course_offerings.c.course_id == identifier, sections.c.id.in_(service.visible_sections(db, actor))).limit(1)):
        missing()
    return record


@router.get('/courses')
def list_courses(q: str | None = None, status: str | None = None, department_id: UUID | None = Query(default=None, alias='departmentId'),
                 page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    statement = select(courses)
    if actor['role'] != 'admin':
        statement = statement.where(courses.c.id.in_(select(course_offerings.c.course_id).join(sections).where(sections.c.id.in_(service.visible_sections(db, actor)))))
    if q:
        statement = statement.where(courses.c.code.ilike(search_pattern(q), escape='\\') | courses.c.name.ilike(search_pattern(q), escape='\\'))
    if status:
        statement = statement.where(courses.c.status == status)
    if department_id:
        statement = statement.where(courses.c.department_id == department_id)
    return paginate(db, statement.order_by(courses.c.code, courses.c.id), page, page_size, lambda row: service.course_dto(db, row, actor))


@router.get('/courses/{identifier}')
def course_detail(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    return service.course_dto(db, course_access(db, actor, identifier), actor)


@router.post('/courses', status_code=201)
def create_course(payload: CourseWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_course(db, actor, payload)


@router.patch('/courses/{identifier}')
def update_course(identifier: UUID, payload: CourseUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_course(db, actor, payload, identifier)


@router.delete('/courses/{identifier}', status_code=204)
def delete_course(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    roster.before_membership_change(db, actor)
    get(db, courses, identifier, lock=True)
    if db.scalar(select(sections.c.id).join(course_offerings).where(course_offerings.c.course_id == identifier).limit(1)):
        from app.core.errors import fail
        fail('course_sections_exist', 'ลบรายวิชาที่มีตอนเรียนอยู่ไม่ได้')
    db.execute(delete(course_offerings).where(course_offerings.c.course_id == identifier))
    db.execute(delete(courses).where(courses.c.id == identifier))
    audit(db, actor, 'course.delete', 'course', identifier)


@router.get('/sections')
def list_sections(course_id: UUID | None = Query(default=None, alias='courseId'), academic_year: int | None = Query(default=None, alias='academicYear'),
                  semester: str | None = None, teacher_id: UUID | None = Query(default=None, alias='teacherId'), status: str | None = None,
                  page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    statement = select(sections).join(course_offerings).where(sections.c.id.in_(service.visible_sections(db, actor)))
    for column, value in ((course_offerings.c.course_id, course_id), (course_offerings.c.academic_year, academic_year), (course_offerings.c.semester, semester), (sections.c.status, status)):
        if value is not None:
            statement = statement.where(column == value)
    if teacher_id:
        from app.models import section_teachers
        statement = statement.where(sections.c.id.in_(select(section_teachers.c.section_id).where(section_teachers.c.teacher_id == teacher_id)))
    return paginate(db, statement.order_by(course_offerings.c.academic_year.desc(), course_offerings.c.semester, sections.c.section_number, sections.c.id), page, page_size, lambda row: service.section_dto(db, row))


@router.get('/sections/{identifier}')
def section_detail(identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    return service.section_dto(db, roster.require_section(db, actor, identifier))


@router.post('/sections', status_code=201)
def create_section(payload: SectionWrite, actor=Depends(admin), db=Depends(database)):
    return service.save_section(db, actor, payload)


@router.patch('/sections/{identifier}')
def update_section(identifier: UUID, payload: SectionUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save_section(db, actor, payload, identifier)


@router.delete('/sections/{identifier}', status_code=204)
def delete_section(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.delete_section(db, actor, identifier)


def roster_summary(db, row, section_id):
    dto = user_dto(db, row)
    return {'id': dto['id'], 'fullName': dto['fullName'], 'accountStatus': dto['accountStatus'], **dto['profile'],
            'membershipSource': 'cohort' if row['id'] in roster.base_roster(db, section_id) else 'include'}


@router.get('/sections/{identifier}/roster')
def roster_list(identifier: UUID, q: str | None = None, major_id: UUID | None = Query(default=None, alias='majorId'),
                class_group_id: UUID | None = Query(default=None, alias='classGroupId'), page: int = Query(default=1, ge=1),
                page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    roster.require_section(db, actor, identifier)
    ids = roster.effective_roster(db, identifier)
    statement = select(users).join(student_profiles, student_profiles.c.user_id == users.c.id).where(users.c.id.in_(ids))
    if q:
        statement = statement.where(users.c.full_name.ilike(search_pattern(q), escape='\\') | student_profiles.c.student_code.ilike(search_pattern(q), escape='\\'))
    if major_id:
        statement = statement.where(student_profiles.c.major_id == major_id)
    if class_group_id:
        statement = statement.where(student_profiles.c.class_group_id == class_group_id)
    response = paginate(db, statement.order_by(student_profiles.c.student_code, users.c.id), page, page_size, lambda row: roster_summary(db, row, identifier))
    response['studentCount'] = len(ids)
    response['activeStudentCount'] = sum(1 for row in db.execute(select(users.c.account_status).where(users.c.id.in_(ids))) if row[0] == 'active')
    return response


@router.get('/sections/{identifier}/roster/candidates')
def candidates(identifier: UUID, q: str = Query(min_length=2, max_length=200), page: int = Query(default=1, ge=1),
               page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    section = roster.require_section(db, actor, identifier)
    current_ids = roster.effective_roster(db, identifier)
    others = list(db.scalars(select(sections.c.id).where(sections.c.offering_id == section['offering_id'], sections.c.id != identifier)))
    conflicts = {student_id: section_id for section_id in others for student_id in roster.effective_roster(db, section_id)}
    statement = select(users).join(student_profiles, student_profiles.c.user_id == users.c.id).where(users.c.account_status == 'active', users.c.role == 'student',
                users.c.full_name.ilike(search_pattern(q), escape='\\') | student_profiles.c.student_code.ilike(search_pattern(q), escape='\\'))
    def summary(row):
        value = roster_summary(db, row, identifier)
        conflict = conflicts.get(row['id'])
        return {**value, 'alreadyEnrolled': row['id'] in current_ids, 'conflictSectionId': conflict,
                'canMove': bool(conflict and roster.can_manage_section(db, actor, conflict))}
    return paginate(db, statement.order_by(student_profiles.c.student_code, users.c.id), page, page_size, summary)


@router.post('/sections/{identifier}/roster/inclusions')
def include_student(identifier: UUID, payload: RosterInclusion, actor=Depends(staff), db=Depends(database)):
    return roster.inclusion(db, actor, identifier, payload.student_id)


@router.post('/sections/{identifier}/roster/moves')
def move_student(identifier: UUID, payload: RosterMove, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(staff), db=Depends(database)):
    roster.require_section(db, actor, identifier)
    roster.require_section(db, actor, payload.target_section_id)
    return idempotent(db, actor, key, 'roster.move', {'sourceId': identifier, **payload.model_dump()}, lambda: roster.move(db, actor, identifier, payload.target_section_id, payload.student_id))
