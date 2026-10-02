from sqlalchemy import select, delete, func
from sqlalchemy.dialects.postgresql import insert

from app.core.errors import fail
from app.models import (courses, course_offerings, sections, section_teachers, section_cohorts, section_cohort_groups,
                        section_student_overrides, users, exam_sessions)
from app.repositories.base import get, create, change, rows
from app.services import academic, roster
from app.services.audit import audit
from app.services.common import public


def section_dto(db, record):
    offering = get(db, course_offerings, record['offering_id'])
    teachers = rows(db, select(section_teachers).where(section_teachers.c.section_id == record['id']))
    cohorts = roster.cohort_records(db, record['id'])
    overrides = rows(db, select(section_student_overrides).where(section_student_overrides.c.section_id == record['id']))
    ids = roster.effective_roster(db, record['id'])
    active_count = db.scalar(select(func.count()).select_from(users).where(users.c.id.in_(ids), users.c.account_status == 'active')) if ids else 0
    return {**public(record), 'courseId': offering['course_id'], 'academicYear': offering['academic_year'], 'semester': offering['semester'],
            'primaryTeacherId': next(row['teacher_id'] for row in teachers if row['assignment_role'] == 'primary'),
            'coTeacherIds': [row['teacher_id'] for row in teachers if row['assignment_role'] == 'co'],
            'cohorts': [{'majorId': row['major_id'], 'admissionYear': row['admission_year'], 'classGroupIds': row['class_group_ids']} for row in cohorts],
            'includedStudentIds': [row['student_id'] for row in overrides if row['mode'] == 'include'], 'excludedStudentIds': [row['student_id'] for row in overrides if row['mode'] == 'exclude'],
            'studentCount': len(ids), 'activeStudentCount': active_count}


def visible_sections(db, actor):
    if actor['role'] == 'admin':
        return set(db.scalars(select(sections.c.id)))
    if actor['role'] == 'teacher':
        return set(db.scalars(select(section_teachers.c.section_id).where(section_teachers.c.teacher_id == actor['id'])))
    return {identifier for identifier in db.scalars(select(sections.c.id)) if actor['id'] in roster.effective_roster(db, identifier)}


def course_dto(db, record, actor):
    _, department, faculty = academic.path(db, department_id=record['department_id'])
    allowed = visible_sections(db, actor)
    items = rows(db, select(sections).join(course_offerings).where(course_offerings.c.course_id == record['id'], sections.c.id.in_(allowed)).order_by(course_offerings.c.academic_year.desc(), course_offerings.c.semester, sections.c.section_number, sections.c.id))
    return {**public(record), 'facultyId': faculty['id'], 'facultyName': faculty['name'], 'departmentName': department['name'],
            'sections': [section_dto(db, section) for section in items]}


def save_course(db, actor, payload, identifier=None):
    if identifier:
        roster.before_membership_change(db, actor)
    prior = get(db, courses, identifier, lock=True) if identifier else None
    academic.path(db, department_id=payload.department_id, active=not (prior and payload.department_id == prior['department_id']))
    values = payload.model_dump(exclude={'expected_version'})
    values.update(code=payload.code.strip().upper(), name=payload.name.strip())
    if prior and payload.department_id != prior['department_id'] and db.scalar(select(func.count()).select_from(course_offerings).where(course_offerings.c.course_id == identifier)):
        fail('referenced_course_department', 'เปลี่ยนภาควิชาของรายวิชาที่มีตอนเรียนแล้วไม่ได้')
    record = change(db, courses, prior, values, payload.expected_version) if prior else create(db, courses, values)
    audit(db, actor, 'course.update' if prior else 'course.create', 'course', record['id'], {'fields': list(values)})
    return course_dto(db, record, actor)


def cohorts_overlap(left, right):
    if left['major_id'] != right['major_id'] or left['admission_year'] != right['admission_year']:
        return False
    return not left['class_group_ids'] or not right['class_group_ids'] or bool(set(left['class_group_ids']) & set(right['class_group_ids']))


def save_section(db, actor, payload, identifier=None):
    roster.before_membership_change(db, actor)
    course = get(db, courses, payload.course_id)
    prior = get(db, sections, identifier, lock=True) if identifier else None
    academic.valid_year(db, payload.academic_year)
    if course['status'] != 'active' and not prior:
        fail('inactive_course', 'รายวิชาไม่ได้เปิดใช้งาน', 422)
    teacher_ids = [payload.primary_teacher_id, *payload.co_teacher_ids]
    if len(set(teacher_ids)) != len(teacher_ids):
        fail('duplicate_teacher', 'ผู้สอนหลักและผู้สอนร่วมต้องไม่ซ้ำกัน', 422)
    for identifier_teacher in teacher_ids:
        user = get(db, users, identifier_teacher)
        if user['role'] != 'teacher' or user['account_status'] != 'active':
            fail('invalid_teacher', 'ผู้สอนต้องเป็นบัญชีอาจารย์ที่เปิดใช้งาน', 422)
    new_cohorts = [cohort.model_dump() for cohort in payload.cohorts]
    if len({(cohort['major_id'], cohort['admission_year']) for cohort in new_cohorts}) != len(new_cohorts):
        fail('duplicate_cohort', 'กลุ่มนักศึกษาสาขาและปีที่เข้าศึกษาซ้ำกัน', 422)
    for cohort in new_cohorts:
        major, _, _ = academic.path(db, major_id=cohort['major_id'], active=True)
        academic.valid_year(db, cohort['admission_year'])
        if major['department_id'] != course['department_id']:
            fail('course_cohort_department', 'สาขาวิชาต้องอยู่ในภาควิชาของรายวิชา', 422)
        if len(set(cohort['class_group_ids'])) != len(cohort['class_group_ids']):
            fail('duplicate_cohort_group', 'กลุ่มเรียนซ้ำกัน', 422)
        for group_id in cohort['class_group_ids']:
            academic.student_assignment(db, cohort['major_id'], cohort['admission_year'], group_id)
    # Offering creation is serialized by a deterministic transaction lock as the row may not exist yet.
    from hashlib import sha256
    from sqlalchemy import text
    number = int.from_bytes(sha256(f'{payload.course_id}:{payload.academic_year}:{payload.semester}'.encode()).digest()[:8], 'big', signed=True)
    db.execute(text('SELECT pg_advisory_xact_lock(:number)'), {'number': number})
    db.execute(insert(course_offerings).values(course_id=payload.course_id, academic_year=payload.academic_year, semester=payload.semester).on_conflict_do_nothing())
    offering = db.execute(select(course_offerings).where(course_offerings.c.course_id == payload.course_id, course_offerings.c.academic_year == payload.academic_year,
                                                        course_offerings.c.semester == payload.semester).with_for_update()).mappings().one()
    if prior and (prior['offering_id'] != offering['id'] or prior['section_number'] != payload.section_number) and db.scalar(select(func.count()).select_from(exam_sessions).where(exam_sessions.c.section_id == identifier)):
        fail('historical_section_identity', 'เปลี่ยนรายวิชา ปี ภาคเรียน หรือเลขตอนเรียนที่มีประวัติสอบไม่ได้')
    others = list(db.scalars(select(sections.c.id).where(sections.c.offering_id == offering['id'], sections.c.id != identifier if identifier else True)))
    for other in others:
        if any(cohorts_overlap(left, right) for left in new_cohorts for right in roster.cohort_records(db, other)):
            fail('cohort_collision', 'กลุ่มนักศึกษาทับซ้อนกับตอนเรียนอื่นในรายวิชา ปี และภาคเรียนเดียวกัน')
    values = {'offering_id': offering['id'], 'section_number': payload.section_number, 'status': payload.status}
    record = change(db, sections, prior, values, payload.expected_version) if prior else create(db, sections, values)
    section_id = record['id']
    if prior:
        cohort_ids = select(section_cohorts.c.id).where(section_cohorts.c.section_id == section_id)
        db.execute(delete(section_cohort_groups).where(section_cohort_groups.c.cohort_id.in_(cohort_ids)))
        db.execute(delete(section_cohorts).where(section_cohorts.c.section_id == section_id))
        db.execute(delete(section_teachers).where(section_teachers.c.section_id == section_id))
    for teacher_id in teacher_ids:
        create(db, section_teachers, {'section_id': section_id, 'teacher_id': teacher_id, 'assignment_role': 'primary' if teacher_id == payload.primary_teacher_id else 'co'})
    for cohort in new_cohorts:
        item = create(db, section_cohorts, {'section_id': section_id, 'major_id': cohort['major_id'], 'admission_year': cohort['admission_year']})
        for group_id in cohort['class_group_ids']:
            create(db, section_cohort_groups, {'cohort_id': item['id'], 'class_group_id': group_id})
    roster.after_membership_change(db, actor)
    audit(db, actor, 'section.update' if prior else 'section.create', 'section', section_id, {'fields': ['teachers', 'cohorts', *values]})
    return section_dto(db, record)


def delete_section(db, actor, identifier):
    roster.before_membership_change(db, actor)
    get(db, sections, identifier, lock=True)
    if db.scalar(select(func.count()).select_from(exam_sessions).where(exam_sessions.c.section_id == identifier)):
        fail('section_exam_history', 'ลบตอนเรียนที่มีประวัติสอบไม่ได้')
    cohort_ids = select(section_cohorts.c.id).where(section_cohorts.c.section_id == identifier)
    db.execute(delete(section_cohort_groups).where(section_cohort_groups.c.cohort_id.in_(cohort_ids)))
    db.execute(delete(section_cohorts).where(section_cohorts.c.section_id == identifier))
    db.execute(delete(section_teachers).where(section_teachers.c.section_id == identifier))
    db.execute(delete(section_student_overrides).where(section_student_overrides.c.section_id == identifier))
    db.execute(delete(sections).where(sections.c.id == identifier))
    audit(db, actor, 'section.delete', 'section', identifier)
