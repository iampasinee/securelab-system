from sqlalchemy import select, delete, update, func
from sqlalchemy.dialects.postgresql import insert

from app.core.errors import fail, missing
from app.models import (users, student_profiles, section_cohorts, section_cohort_groups, section_student_overrides,
                        sections, section_teachers, course_offerings, courses, exam_sessions, exam_participants,
                        exam_rooms, room_seats, exam_seat_assignments, exam_seat_assignment_events, computer_devices, physical_rooms, floors)
from app.repositories.base import get, now, create, change, rows
from app.services.academic import path
from app.services.audit import audit


def can_manage_section(db, actor, section_id):
    return actor['role'] == 'admin' or (actor['role'] == 'teacher' and db.scalar(select(func.count()).select_from(section_teachers).where(
        section_teachers.c.section_id == section_id, section_teachers.c.teacher_id == actor['id'])) > 0)


def require_section(db, actor, section_id, lock=False):
    record = get(db, sections, section_id, lock=lock)
    if actor['role'] != 'admin' and not (can_manage_section(db, actor, section_id) if actor['role'] == 'teacher' else actor['id'] in effective_roster(db, section_id)):
        missing()
    return record


def cohort_records(db, section_id):
    result = rows(db, select(section_cohorts).where(section_cohorts.c.section_id == section_id))
    for cohort in result:
        cohort['class_group_ids'] = list(db.scalars(select(section_cohort_groups.c.class_group_id).where(section_cohort_groups.c.cohort_id == cohort['id'])))
    return result


def base_roster(db, section_id):
    ids = set()
    for cohort in cohort_records(db, section_id):
        statement = select(student_profiles.c.user_id).where(student_profiles.c.major_id == cohort['major_id'], student_profiles.c.admission_year == cohort['admission_year'])
        if cohort['class_group_ids']:
            statement = statement.where(student_profiles.c.class_group_id.in_(cohort['class_group_ids']))
        ids.update(db.scalars(statement))
    return ids


def effective_roster(db, section_id):
    ids = base_roster(db, section_id)
    overrides = rows(db, select(section_student_overrides).where(section_student_overrides.c.section_id == section_id))
    ids.update(row['student_id'] for row in overrides if row['mode'] == 'include')
    ids.difference_update(row['student_id'] for row in overrides if row['mode'] == 'exclude')
    return ids


def exam_roster(db, exam):
    if exam['roster_frozen_at'] is not None:
        return set(db.scalars(select(exam_participants.c.student_id).where(exam_participants.c.exam_id == exam['id'])))
    return effective_roster(db, exam['section_id'])


def lock_offerings(db):
    # Stable order shared by every membership mutation and worker transaction.
    list(db.execute(select(course_offerings.c.id).order_by(course_offerings.c.id).with_for_update()))


def freeze(db, exam, actor=None):
    if exam['roster_frozen_at'] is not None or now() < exam['starts_at']:
        return exam
    base = base_roster(db, exam['section_id'])
    from app.models import class_groups
    for student_id in sorted(effective_roster(db, exam['section_id']), key=str):
        user = get(db, users, student_id)
        profile = get(db, student_profiles, student_id, key='user_id')
        major, department, faculty = path(db, major_id=profile['major_id'])
        group = get(db, class_groups, profile['class_group_id']) if profile['class_group_id'] else None
        create(db, exam_participants, {'exam_id': exam['id'], 'student_id': student_id, 'student_code_snapshot': profile['student_code'], 'name_snapshot': user['full_name'],
                                      'major_id': profile['major_id'], 'admission_year_snapshot': profile['admission_year'], 'class_group_id': profile['class_group_id'],
                                      'faculty_name_snapshot': faculty['name'], 'department_name_snapshot': department['name'], 'major_code_snapshot': major['code'],
                                      'major_name_snapshot': major['name'], 'class_group_code_snapshot': group['code'] if group else None, 'membership_source': 'cohort' if student_id in base else 'include'})
    section = get(db, sections, exam['section_id'])
    offering = get(db, course_offerings, section['offering_id'])
    course = get(db, courses, offering['course_id'])
    room = get(db, exam_rooms, exam['exam_room_id'])
    physical = get(db, physical_rooms, room['physical_room_id'])
    floor = get(db, floors, physical['floor_id'])
    updated = change(db, exam_sessions, exam, {'roster_frozen_at': now(), 'course_code_snapshot': course['code'], 'course_name_snapshot': course['name'],
                                            'section_number_snapshot': section['section_number'], 'academic_year_snapshot': offering['academic_year'], 'semester_snapshot': offering['semester'],
                                            'room_code_snapshot': physical['room_code'], 'floor_number_snapshot': floor['floor_number']})
    audit(db, actor, 'exam.roster_frozen', 'exam', exam['id'], {'count': len(exam_roster(db, updated))})
    return updated


def before_membership_change(db, actor=None):
    lock_offerings(db)
    due = rows(db, select(exam_sessions).where(exam_sessions.c.starts_at <= now(), exam_sessions.c.roster_frozen_at.is_(None)).order_by(exam_sessions.c.id).with_for_update())
    for exam in due:
        freeze(db, exam, actor)


def seat_event(db, actor, assignment, action):
    seat = get(db, room_seats, assignment['seat_id'])
    device = get(db, computer_devices, assignment['device_id'])
    create(db, exam_seat_assignment_events, {'exam_id': assignment['exam_id'], 'student_id': assignment['student_id'], 'seat_id': seat['id'], 'device_id': device['id'],
                                           'action': action, 'actor_id': actor['id'], 'seat_code_snapshot': seat['seat_code'], 'device_code_snapshot': device['computer_code'],
                                           'ip_snapshot': str(device['ip_address']), 'mac_snapshot': str(device['mac_address'])})


def validate_offering_rosters(db, offering_id):
    seen = set()
    for section_id in db.scalars(select(sections.c.id).where(sections.c.offering_id == offering_id).order_by(sections.c.id)):
        ids = effective_roster(db, section_id)
        if ids & seen:
            fail('roster_collision', 'นักศึกษาซ้ำระหว่างตอนเรียนของรายวิชา ปีการศึกษา และภาคเรียนเดียวกัน')
        seen.update(ids)


def after_membership_change(db, actor):
    for offering_id in db.scalars(select(course_offerings.c.id).order_by(course_offerings.c.id)):
        validate_offering_rosters(db, offering_id)
    exams = rows(db, select(exam_sessions).where(exam_sessions.c.starts_at > now()).order_by(exam_sessions.c.id).with_for_update())
    for exam in exams:
        ids = effective_roster(db, exam['section_id'])
        capacity = db.scalar(select(func.count()).select_from(room_seats).where(room_seats.c.exam_room_id == exam['exam_room_id']))
        if len(ids) > capacity or not ids:
            fail('exam_roster_capacity', 'รายชื่อใหม่ทำให้การสอบที่ยังไม่เริ่มไม่มีผู้มีสิทธิ์หรือเกินความจุห้อง')
        assignments = rows(db, select(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == exam['id']))
        for assignment in assignments:
            if assignment['student_id'] not in ids:
                seat_event(db, actor, assignment, 'unassign')
                db.execute(delete(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == exam['id'], exam_seat_assignments.c.student_id == assignment['student_id']))
                audit(db, actor, 'exam.seat_reconciled', 'exam', exam['id'], {'studentId': str(assignment['student_id'])})


def inclusion(db, actor, section_id, student_id):
    before_membership_change(db, actor)
    section = require_section(db, actor, section_id, lock=True)
    user = get(db, users, student_id)
    if user['role'] != 'student' or user['account_status'] != 'active':
        fail('invalid_roster_student', 'ต้องเลือกบัญชีนักศึกษาที่เปิดใช้งาน', 422)
    if student_id in effective_roster(db, section_id):
        fail('already_enrolled', 'นักศึกษาอยู่ในตอนเรียนนี้แล้ว')
    if student_id in base_roster(db, section_id):
        db.execute(delete(section_student_overrides).where(section_student_overrides.c.section_id == section_id, section_student_overrides.c.student_id == student_id))
    else:
        db.execute(insert(section_student_overrides).values(section_id=section_id, student_id=student_id, mode='include', changed_by=actor['id'])
                   .on_conflict_do_update(index_elements=['section_id', 'student_id'], set_={'mode': 'include', 'changed_by': actor['id']}))
    after_membership_change(db, actor)
    audit(db, actor, 'section.student_included', 'section', section_id, {'studentId': str(student_id)})
    return {'sectionId': section_id, 'studentCount': len(effective_roster(db, section_id))}


def move(db, actor, source_id, target_id, student_id):
    before_membership_change(db, actor)
    source = require_section(db, actor, source_id, lock=True)
    target = require_section(db, actor, target_id, lock=True)
    if source_id == target_id or source['offering_id'] != target['offering_id']:
        fail('cross_offering_move', 'ย้ายได้เฉพาะสองตอนเรียนของรายวิชา ปีการศึกษา และภาคเรียนเดียวกัน', 422)
    if student_id not in effective_roster(db, source_id) or student_id in effective_roster(db, target_id):
        fail('invalid_roster_move', 'นักศึกษาไม่มีสิทธิ์ในตอนเรียนต้นทางหรืออยู่ในปลายทางแล้ว')
    if get(db, users, student_id)['account_status'] != 'active':
        fail('inactive_student', 'บัญชีนักศึกษาไม่ได้เปิดใช้งาน', 422)
    for section_id, mode in ((source_id, 'exclude'), (target_id, 'include')):
        if mode == 'include' and student_id in base_roster(db, section_id):
            db.execute(delete(section_student_overrides).where(section_student_overrides.c.section_id == section_id, section_student_overrides.c.student_id == student_id))
        else:
            db.execute(insert(section_student_overrides).values(section_id=section_id, student_id=student_id, mode=mode, changed_by=actor['id'])
                       .on_conflict_do_update(index_elements=['section_id', 'student_id'], set_={'mode': mode, 'changed_by': actor['id']}))
    after_membership_change(db, actor)
    audit(db, actor, 'section.student_moved', 'section', source_id, {'studentId': str(student_id), 'targetSectionId': str(target_id)})
    return {'source': {'sectionId': source_id, 'studentCount': len(effective_roster(db, source_id))}, 'target': {'sectionId': target_id, 'studentCount': len(effective_roster(db, target_id))}}
