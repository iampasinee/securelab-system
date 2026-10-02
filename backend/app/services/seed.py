from sqlalchemy import select, func

from app.core.database import get_engine
from app.models import users, faculties, departments, majors, class_groups, courses, sections, course_offerings, floors, physical_rooms, exam_rooms, computer_devices
from app.repositories.base import get
from app.schemas.academic import AcademicWrite
from app.schemas.users import UserCreate, StudentProfile, TeacherProfile
from app.schemas.courses import CourseWrite, SectionWrite, Cohort
from app.schemas.rooms import FloorWrite, PhysicalWrite, ExamRoomWrite, Layout, DeviceWrite
from app.services import academic, users as user_service, courses as course_service, rooms as room_service


def existing(db, model, column, value):
    row = db.execute(select(model).where(model.c[column] == value)).mappings().first()
    return dict(row) if row else None


def seed_development():
    """Explicit, idempotent seed. Never read browser state or overwrite existing data."""
    with get_engine().begin() as db:
        actor_row = db.execute(select(users).where(users.c.role == 'admin', users.c.account_status == 'active').order_by(users.c.id)).mappings().first()
        if not actor_row:
            raise ValueError('Bootstrap an Admin before seeding development data')
        actor = dict(actor_row)
        faculty = existing(db, faculties, 'code', 'FTE')
        if not faculty:
            faculty = get(db, faculties, academic.save(db, actor, 'faculties', AcademicWrite(code='FTE', name='คณะเทคโนโลยีและการจัดการอุตสาหกรรม'))['id'])
        department = existing(db, departments, 'code', 'INET')
        if not department:
            department = get(db, departments, academic.save(db, actor, 'departments', AcademicWrite(code='INET', name='ภาควิชาเทคโนโลยีสารสนเทศ', faculty_id=faculty['id']))['id'])
        elif department['faculty_id'] != faculty['id']:
            raise ValueError('Existing INET department has a different parent; seed refuses reassignment')
        major = existing(db, majors, 'code', 'INET-DE')
        if not major:
            major = get(db, majors, academic.save(db, actor, 'majors', AcademicWrite(code='INET-DE', name='สาขาวิชาเทคโนโลยีสารสนเทศ', department_id=department['id']))['id'])
        elif major['department_id'] != department['id']:
            raise ValueError('Existing INET-DE major has a different parent; seed refuses reassignment')
        group = db.execute(select(class_groups).where(class_groups.c.major_id == major['id'], class_groups.c.admission_year == 2567).order_by(class_groups.c.sequence)).mappings().first()
        if not group:
            group = academic.make_group(db, actor, major['id'], 2567)
        teacher = existing(db, users, 'email', 'teacher.seed@itm.kmutnb.ac.th')
        if not teacher:
            value = user_service.save(db, actor, UserCreate(role='teacher', email='teacher.seed@itm.kmutnb.ac.th', full_name='อาจารย์สาธิต SecureLab',
                                      profile=TeacherProfile(teacher_code='SL-T001', department_id=department['id'])))
            teacher = get(db, users, value['id'])
        elif teacher['role'] != 'teacher':
            raise ValueError('Seed teacher email belongs to a different role')
        code = '6701011500167'
        student = existing(db, users, 'email', f's{code}@email.kmutnb.ac.th')
        if not student:
            user_service.save(db, actor, UserCreate(role='student', email=f's{code}@email.kmutnb.ac.th', full_name='นักศึกษาสาธิต SecureLab',
                              profile=StudentProfile(student_code=code, major_id=major['id'], admission_year=2567, class_group_id=group['id'])))
        elif student['role'] != 'student':
            raise ValueError('Seed student email belongs to a different role')
        course = existing(db, courses, 'code', 'SL301')
        if not course:
            course = get(db, courses, course_service.save_course(db, actor, CourseWrite(code='SL301', name='ปฏิบัติการ SecureLab', department_id=department['id']))['id'])
        offering = db.execute(select(course_offerings).where(course_offerings.c.course_id == course['id'], course_offerings.c.academic_year == 2569, course_offerings.c.semester == '1')).mappings().first()
        section = db.execute(select(sections).where(sections.c.offering_id == offering['id'], sections.c.section_number == 1)).mappings().first() if offering else None
        if not section:
            course_service.save_section(db, actor, SectionWrite(course_id=course['id'], academic_year=2569, semester='1', section_number=1, primary_teacher_id=teacher['id'],
                                        cohorts=[Cohort(major_id=major['id'], admission_year=2567, class_group_ids=[group['id']])]))
        floor = existing(db, floors, 'floor_number', 4)
        if not floor:
            floor = get(db, floors, room_service.save_floor(db, actor, FloorWrite(floor_number=4))['id'])
        physical = db.execute(select(physical_rooms).where(physical_rooms.c.floor_id == floor['id'], physical_rooms.c.room_code == 'B4-08')).mappings().first()
        if not physical:
            physical = get(db, physical_rooms, room_service.save_physical(db, actor, PhysicalWrite(floor_id=floor['id'], suffix='08'))['id'])
        room = existing(db, exam_rooms, 'physical_room_id', physical['id'])
        if not room:
            room = get(db, exam_rooms, room_service.save_room(db, actor, ExamRoomWrite(physical_room_id=physical['id']))['id'])
            room_service.layout(db, actor, room['id'], Layout(rows=2, columns=3, expected_version=room['row_version']))
            detail = room_service.room_dto(db, get(db, exam_rooms, room['id']), actor, include_layout=True)
            for index, seat in enumerate(detail['seats'], 1):
                room_service.save_device(db, actor, DeviceWrite(computer_code=f'SL-PC{index:03}', serial_number=f'SL-DEMO-{index:03}', ip_address=f'192.168.44.{index}',
                                                               mac_address=f'02:00:00:00:44:{index:02x}', seat_id=seat['id']))
    print('Curated development records are ready. Teacher/Student accounts need Admin-issued activation links. No mock passwords or face images were imported.')
