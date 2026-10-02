from datetime import timedelta
import re
from uuid import uuid4
from zoneinfo import ZoneInfo

from pydantic.alias_generators import to_camel
from sqlalchemy import select, delete, func

from app.core.errors import fail, missing
from app.models import (exam_sessions, exam_policies, exam_file_extensions, exam_allowed_domains, exam_resources, exam_rules, exam_participants,
                        sections, course_offerings, courses, exam_rooms, room_seats, physical_rooms, floors, computer_devices,
                        exam_seat_assignments, exam_time_adjustments, users)
from app.models.exams import POLICY_GROUPS
from app.repositories.base import now, get, rows, create, change
from app.services import roster, rooms
from app.services.audit import audit
from app.services.common import public
from app.services.users import CAPABILITIES


BANGKOK = ZoneInfo('Asia/Bangkok')


def status(exam, clock=None):
    clock = clock or now()
    return 'upcoming' if clock < exam['starts_at'] else 'in_progress' if clock < exam['ends_at'] else 'completed'


def authorized_ids(db, actor):
    return {exam['id'] for exam in rows(db, select(exam_sessions)) if roster.can_manage_section(db, actor, exam['section_id']) or
            (actor['role'] == 'student' and actor['id'] in roster.exam_roster(db, exam))}


def require_exam(db, actor, identifier, lock=False, freeze_due=False):
    if lock or freeze_due:
        roster.lock_offerings(db)
    exam = get(db, exam_sessions, identifier, lock=lock or freeze_due)
    if not (roster.can_manage_section(db, actor, exam['section_id']) or (actor['role'] == 'student' and actor['id'] in roster.exam_roster(db, exam))):
        missing()
    return roster.freeze(db, exam, actor) if freeze_due else exam


def normalized_domain(value):
    value = value.strip().lower().rstrip('.')
    if not value or len(value) > 253 or not re.fullmatch(r'(?:\*\.)?[a-z0-9](?:[a-z0-9.\-]*[a-z0-9])?', value) or '..' in value:
        fail('invalid_domain', 'ชื่อโดเมนต้องไม่มี protocol เส้นทาง หรือช่องว่าง', 422)
    return value


def policy_dto(db, exam_id):
    stored = get(db, exam_policies, exam_id, key='exam_id')
    result = {group: {to_camel(name): stored[f'{group}_{name}'] for name in names} for group, names in POLICY_GROUPS.items()}
    result['online'].update(resourceMode=stored['resource_mode'], allowedDomains=list(db.scalars(select(exam_allowed_domains.c.domain).where(exam_allowed_domains.c.exam_id == exam_id))),
                            allowedResources=[], blockedResources=[])
    result['offline']['localServerHost'] = stored['local_server_host']
    for resource in rows(db, select(exam_resources).where(exam_resources.c.exam_id == exam_id).order_by(exam_resources.c.sort_order, exam_resources.c.id)):
        result['online']['allowedResources' if resource['effect'] == 'allow' else 'blockedResources'].append({'id': resource['id'], 'name': resource['name'], 'type': resource['resource_type'], 'value': resource['value'], 'category': resource['category']})
    return result


def exam_dto(db, exam, actor):
    section = get(db, sections, exam['section_id'])
    offering = get(db, course_offerings, section['offering_id'])
    course = get(db, courses, offering['course_id'])
    room = get(db, exam_rooms, exam['exam_room_id'])
    physical = get(db, physical_rooms, room['physical_room_id'])
    floor = get(db, floors, physical['floor_id'])
    clock = now()
    current = status(exam, clock)
    manages = roster.can_manage_section(db, actor, exam['section_id'])
    return {**public(exam), 'roomId': exam['exam_room_id'], 'revision': exam['setup_revision'], 'status': current, 'serverNow': clock,
            'courseId': course['id'], 'courseCode': exam['course_code_snapshot'] or course['code'], 'courseName': exam['course_name_snapshot'] or course['name'],
            'sectionNumber': exam['section_number_snapshot'] or section['section_number'], 'academicYear': exam['academic_year_snapshot'] or offering['academic_year'],
            'semester': exam['semester_snapshot'] or offering['semester'], 'roomCode': exam['room_code_snapshot'] or physical['room_code'],
            'floorNumber': exam['floor_number_snapshot'] if exam['floor_number_snapshot'] is not None else floor['floor_number'],
            'durationMinutes': int((exam['ends_at'] - exam['starts_at']).total_seconds() / 60),
            'adjustedMinutes': int((exam['ends_at'] - exam['scheduled_end_at']).total_seconds() / 60),
            'acceptedExtensions': list(db.scalars(select(exam_file_extensions.c.extension).where(exam_file_extensions.c.exam_id == exam['id']).order_by(exam_file_extensions.c.extension))),
            'rules': [public(row) for row in rows(db, select(exam_rules).where(exam_rules.c.exam_id == exam['id']).order_by(exam_rules.c.sort_order))],
            'policy': policy_dto(db, exam['id']), 'participantCount': len(roster.exam_roster(db, exam)),
            'capabilities': {**CAPABILITIES, 'editSetup': manages and current == 'upcoming', 'editSeats': manages and current != 'completed',
                             'adjustTime': manages and current == 'in_progress', 'reopenSubmissions': manages and current != 'upcoming'}}


def write_policy(db, exam_id, policy, replacing=False):
    values = {f'{group}_{name}': getattr(getattr(policy, group), name) for group, names in POLICY_GROUPS.items() for name in names}
    values.update(resource_mode=policy.online.resource_mode, local_server_host=policy.offline.local_server_host.strip())
    if replacing:
        change(db, exam_policies, get(db, exam_policies, exam_id, key='exam_id'), values, key='exam_id')
        for model in (exam_allowed_domains, exam_resources):
            db.execute(delete(model).where(model.c.exam_id == exam_id))
    else:
        create(db, exam_policies, {'exam_id': exam_id, **values})
    for domain in sorted({normalized_domain(value) for value in policy.online.allowed_domains}):
        create(db, exam_allowed_domains, {'exam_id': exam_id, 'domain': domain})
    for effect, resources in (('allow', policy.online.allowed_resources), ('block', policy.online.blocked_resources)):
        for index, resource in enumerate(resources):
            create(db, exam_resources, {'exam_id': exam_id, 'effect': effect, 'resource_type': resource.type, 'sort_order': index,
                                       'name': resource.name.strip(), 'value': resource.value.strip(), 'category': resource.category})


def save(db, actor, payload, identifier=None):
    roster.before_membership_change(db, actor)
    prior = require_exam(db, actor, identifier, lock=True) if identifier else None
    if prior and status(prior) != 'upcoming':
        fail('exam_setup_locked', 'แก้รายละเอียดการสอบได้เฉพาะการสอบที่ยังไม่เริ่ม')
    section = roster.require_section(db, actor, payload.section_id)
    offering = get(db, course_offerings, section['offering_id'])
    course = get(db, courses, offering['course_id'])
    if section['status'] != 'active' or course['status'] != 'active':
        fail('inactive_exam_section', 'รายวิชาและตอนเรียนต้องเปิดใช้งาน', 422)
    if payload.starts_at <= now() or payload.ends_at <= payload.starts_at or payload.starts_at.astimezone(BANGKOK).date() != payload.ends_at.astimezone(BANGKOK).date():
        fail('invalid_exam_schedule', 'การสอบต้องเริ่มในอนาคตและเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มในวันเดียวกัน', 422)
    room, _, _ = rooms.ready_room(db, payload.exam_room_id)
    ids = roster.effective_roster(db, section['id'])
    capacity = db.scalar(select(func.count()).select_from(room_seats).where(room_seats.c.exam_room_id == room['id']))
    if not ids or len(ids) > capacity:
        fail('exam_capacity', 'ต้องมีนักศึกษาที่มีสิทธิ์และความจุห้องเพียงพอ')
    extensions = sorted({value.strip().lower() for value in payload.accepted_extensions})
    if not all(re.fullmatch(r'\.[a-z0-9]{1,19}', value) for value in extensions):
        fail('invalid_extension', 'นามสกุลไฟล์ต้องเริ่มด้วยจุดและใช้ภาษาอังกฤษหรือตัวเลข', 422)
    from app.services.filenames import validate_template
    validate_template(payload.automatic_filename_template)
    values = payload.model_dump(exclude={'expected_version', 'policy', 'rules', 'accepted_extensions'})
    values['name'] = payload.name.strip()
    if not values['name']:
        fail('invalid_exam_name', 'กรุณากรอกชื่อการสอบ', 422)
    values['scheduled_end_at'] = payload.ends_at
    if prior:
        values['setup_revision'] = prior['setup_revision'] + 1
        # Changing rooms invalidates the existing seating plan, preserving history.
        if prior['exam_room_id'] != payload.exam_room_id or prior['section_id'] != payload.section_id:
            for assignment in rows(db, select(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier)):
                roster.seat_event(db, actor, assignment, 'unassign')
            db.execute(delete(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier))
        exam = change(db, exam_sessions, prior, values, payload.expected_version)
        for model in (exam_file_extensions, exam_rules):
            db.execute(delete(model).where(model.c.exam_id == identifier))
    else:
        exam = create(db, exam_sessions, {**values, 'created_by': actor['id']})
    write_policy(db, exam['id'], payload.policy, replacing=bool(prior))
    for extension in extensions:
        create(db, exam_file_extensions, {'exam_id': exam['id'], 'extension': extension})
    for index, rule in enumerate(payload.rules):
        if not rule.text.strip():
            fail('blank_exam_rule', 'กฎการสอบต้องไม่เป็นข้อความว่าง', 422)
        create(db, exam_rules, {'exam_id': exam['id'], 'text': rule.text.strip(), 'is_custom': rule.is_custom, 'sort_order': index})
    roster.after_membership_change(db, actor)
    audit(db, actor, 'exam.update' if prior else 'exam.create', 'exam', exam['id'], {'fields': list(values) + ['policy', 'rules', 'extensions']})
    return exam_dto(db, exam, actor)


def time_adjustment(db, actor, identifier, payload):
    exam = require_exam(db, actor, identifier, lock=True, freeze_due=True)
    if status(exam) != 'in_progress' or not payload.delta_minutes:
        fail('invalid_time_adjustment', 'ปรับเวลาได้เฉพาะการสอบที่กำลังดำเนินการ และจำนวนเวลาต้องไม่เป็นศูนย์')
    next_end = exam['ends_at'] + timedelta(minutes=payload.delta_minutes)
    if next_end <= exam['starts_at'] or next_end.astimezone(BANGKOK).date() != exam['starts_at'].astimezone(BANGKOK).date():
        fail('invalid_exam_schedule', 'เวลาสิ้นสุดใหม่ต้องอยู่หลังเวลาเริ่มในวันเดียวกัน', 422)
    updated = change(db, exam_sessions, exam, {'ends_at': next_end}, payload.expected_version)
    create(db, exam_time_adjustments, {'exam_id': identifier, 'actor_id': actor['id'], 'delta_minutes': payload.delta_minutes,
                                      'previous_end_at': exam['ends_at'], 'next_end_at': next_end, 'reason': payload.reason.strip()})
    audit(db, actor, 'exam.time_adjusted', 'exam', identifier, {'previousEndAt': exam['ends_at'].isoformat(), 'nextEndAt': next_end.isoformat(), 'reason': payload.reason})
    return exam_dto(db, updated, actor)


def assignments_dto(db, exam, actor):
    statement = select(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == exam['id'])
    if actor['role'] == 'student':
        statement = statement.where(exam_seat_assignments.c.student_id == actor['id'])
    result = []
    for assignment in rows(db, statement.order_by(exam_seat_assignments.c.student_id)):
        seat = get(db, room_seats, assignment['seat_id'])
        result.append({**public(assignment), 'seatCode': seat['seat_code'], 'device': rooms.device_dto(db, get(db, computer_devices, assignment['device_id']))})
    return {'items': result, 'total': len(result), 'rowVersion': exam['row_version'], 'serverNow': now()}


def assign(db, actor, identifier, seat_id, student_id, expected_version):
    exam = require_exam(db, actor, identifier, lock=True, freeze_due=True)
    if status(exam) == 'completed':
        fail('exam_seats_locked', 'การสอบสิ้นสุดแล้ว ไม่สามารถเปลี่ยนที่นั่งได้')
    if exam['row_version'] != expected_version:
        fail('stale_write', 'ผังที่นั่งมีการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่')
    seat = get(db, room_seats, seat_id)
    if seat['exam_room_id'] != exam['exam_room_id']:
        fail('wrong_exam_seat', 'ที่นั่งไม่อยู่ในห้องสอบนี้', 422)
    existing = rows(db, select(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier,
                           (exam_seat_assignments.c.seat_id == seat_id) | (exam_seat_assignments.c.student_id == student_id if student_id else False)))
    if student_id:
        if student_id not in roster.exam_roster(db, exam) or get(db, users, student_id)['account_status'] != 'active':
            fail('ineligible_student', 'นักศึกษาไม่มีสิทธิ์หรือบัญชีไม่ได้เปิดใช้งาน', 422)
        device = db.execute(select(computer_devices).where(computer_devices.c.seat_id == seat_id)).mappings().first()
        if device is None or not rooms.device_dto(db, dict(device))['isAssignable']:
            fail('seat_not_assignable', 'ที่นั่งต้องมีเครื่องคอมพิวเตอร์ที่ลงทะเบียนและพร้อมใช้งาน', 422)
    for assignment in existing:
        roster.seat_event(db, actor, assignment, 'unassign')
        db.execute(delete(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier, exam_seat_assignments.c.student_id == assignment['student_id']))
    if student_id:
        assignment = create(db, exam_seat_assignments, {'exam_id': identifier, 'student_id': student_id, 'seat_id': seat_id, 'device_id': device['id'], 'assigned_by': actor['id']})
        roster.seat_event(db, actor, assignment, 'assign')
    updated = change(db, exam_sessions, exam, {})
    audit(db, actor, 'exam.seat_assigned' if student_id else 'exam.seat_unassigned', 'exam', identifier, {'studentId': str(student_id) if student_id else None})
    return assignments_dto(db, updated, actor)


def auto_assign(db, actor, identifier, expected_version):
    exam = require_exam(db, actor, identifier, lock=True, freeze_due=True)
    if exam['row_version'] != expected_version or status(exam) == 'completed':
        fail('invalid_auto_seat_state', 'การสอบสิ้นสุดแล้วหรือข้อมูลผังมีการเปลี่ยนแปลง')
    students = sorted((student_id for student_id in roster.exam_roster(db, exam) if get(db, users, student_id)['account_status'] == 'active'), key=str)
    seats = []
    for seat in rows(db, select(room_seats).where(room_seats.c.exam_room_id == exam['exam_room_id']).order_by(room_seats.c.row_number, room_seats.c.column_number)):
        device = db.execute(select(computer_devices).where(computer_devices.c.seat_id == seat['id'])).mappings().first()
        if device and rooms.device_dto(db, dict(device))['isAssignable']:
            seats.append((seat, device))
    for existing in rows(db, select(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier)):
        roster.seat_event(db, actor, existing, 'unassign')
    db.execute(delete(exam_seat_assignments).where(exam_seat_assignments.c.exam_id == identifier))
    for student_id, (seat, device) in zip(students, seats):
        assignment = create(db, exam_seat_assignments, {'exam_id': identifier, 'student_id': student_id, 'seat_id': seat['id'], 'device_id': device['id'], 'assigned_by': actor['id']})
        roster.seat_event(db, actor, assignment, 'assign')
    updated = change(db, exam_sessions, exam, {})
    unassigned = students[len(seats):]
    audit(db, actor, 'exam.seats_auto_assigned', 'exam', identifier, {'count': min(len(students), len(seats))})
    return {**assignments_dto(db, updated, actor), 'unassignedStudentIds': unassigned, 'unassignedCount': len(unassigned)}
