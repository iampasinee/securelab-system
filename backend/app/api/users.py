from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, func

from app.api.dependencies import database, admin, staff
from app.models import users, student_profiles, teacher_profiles, admin_profiles, majors, departments, faculties
from app.repositories.base import get
from app.schemas.auth import AccountLink
from app.schemas.users import UserCreate, UserUpdate, StatusUpdate
from app.services import users as service
from app.services.academic import settings
from app.services.auth import account_link
from app.services.audit import audit
from app.services.common import paginate, search_pattern, csv_bytes


router = APIRouter(tags=['users'])


def query_users(db, role=None, status=None, q=None, faculty_id=None, department_id=None, major_id=None, admission_year=None, year_level=None, group_id=None, icit_profile_status=None, unassigned_group=False):
    statement = select(users)
    if unassigned_group or any(value is not None for value in (faculty_id, department_id, major_id, admission_year, year_level, group_id)):
        statement = statement.join(student_profiles, student_profiles.c.user_id == users.c.id).join(majors, majors.c.id == student_profiles.c.major_id).join(departments, departments.c.id == majors.c.department_id)
        if faculty_id:
            statement = statement.where(departments.c.faculty_id == faculty_id)
        if department_id:
            statement = statement.where(departments.c.id == department_id)
        if major_id:
            statement = statement.where(student_profiles.c.major_id == major_id)
        if admission_year:
            statement = statement.where(student_profiles.c.admission_year == admission_year)
        if year_level:
            statement = statement.where(student_profiles.c.admission_year == settings(db)['current_academic_year'] - year_level + 1)
        if group_id:
            statement = statement.where(student_profiles.c.class_group_id == group_id)
        if unassigned_group:
            statement = statement.where(student_profiles.c.class_group_id.is_(None))
    if role:
        statement = statement.where(users.c.role == role)
    if status:
        statement = statement.where(users.c.account_status == status)
    if icit_profile_status:
        statement = statement.where(users.c.id.in_(select(teacher_profiles.c.user_id).where(teacher_profiles.c.icit_profile_status == icit_profile_status)))
    if q:
        pattern = search_pattern(q.strip())
        statement = statement.where(users.c.full_name.ilike(pattern, escape='\\') | users.c.email.ilike(pattern, escape='\\') |
                                    users.c.id.in_(select(student_profiles.c.user_id).where(student_profiles.c.student_code.ilike(pattern, escape='\\'))) |
                                    users.c.id.in_(select(teacher_profiles.c.user_id).where(teacher_profiles.c.teacher_code.ilike(pattern, escape='\\'))) |
                                    users.c.id.in_(select(admin_profiles.c.user_id).where(admin_profiles.c.admin_code.ilike(pattern, escape='\\'))))
    return statement


class UserFilters:
    def __init__(self, q: str | None = Query(default=None, max_length=200), status: str | None = None,
                 faculty_id: UUID | None = Query(default=None, alias='facultyId'), department_id: UUID | None = Query(default=None, alias='departmentId'),
                 major_id: UUID | None = Query(default=None, alias='majorId'), admission_year: int | None = Query(default=None, alias='admissionYear'),
                 year_level: int | None = Query(default=None, alias='yearLevel', ge=1), group_id: UUID | None = Query(default=None, alias='classGroupId'),
                 unassigned_group: bool = Query(default=False, alias='unassignedGroup')):
        self.values = dict(q=q, status=status, faculty_id=faculty_id, department_id=department_id, major_id=major_id, admission_year=admission_year, year_level=year_level, group_id=group_id, unassigned_group=unassigned_group)


@router.get('/users')
def list_users(filters=Depends(UserFilters), role: str | None = None, icit_profile_status: str | None = Query(default=None, alias='icitProfileStatus'),
               page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100),
               sort: str = 'fullName', direction: str = 'asc', actor=Depends(admin), db=Depends(database)):
    columns = {'fullName': users.c.full_name, 'email': users.c.email, 'role': users.c.role, 'accountStatus': users.c.account_status, 'createdAt': users.c.created_at}
    from app.core.errors import fail
    if sort not in columns or direction not in ('asc', 'desc'):
        fail('invalid_sort', 'รูปแบบการเรียงข้อมูลใช้ไม่ได้', 422)
    order = columns[sort].asc() if direction == 'asc' else columns[sort].desc()
    return paginate(db, query_users(db, role=role, icit_profile_status=icit_profile_status, **filters.values).order_by(order, users.c.id), page, page_size, lambda row: service.user_dto(db, row))


@router.get('/students/export')
def export_students(filters=Depends(UserFilters), actor=Depends(admin), db=Depends(database)):
    statement = query_users(db, role='student', **filters.values).order_by(users.c.full_name, users.c.id)
    records = [service.user_dto(db, dict(row)) for row in db.execute(statement).mappings()]
    fields = ['รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'คณะ', 'ภาควิชา', 'สาขาวิชา', 'ปีที่เข้าศึกษา', 'ชั้นปี', 'กลุ่มเรียน', 'สถานะ']
    values = [[row['profile']['studentCode'], row['fullName'], row['profile']['facultyName'], row['profile']['departmentName'], row['profile']['majorName'],
               row['profile']['admissionYear'], row['profile']['yearLevel'], row['profile']['classGroupCode'], row['accountStatus']] for row in records]
    audit(db, actor, 'student.export', 'student', metadata={'count': len(records)})
    return Response(csv_bytes(fields, values), media_type='text/csv; charset=utf-8', headers={'Content-Disposition': 'attachment; filename="students.csv"', 'X-Content-Type-Options': 'nosniff'})


@router.get('/students')
def list_students(filters=Depends(UserFilters), page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(admin), db=Depends(database)):
    return paginate(db, query_users(db, role='student', **filters.values).order_by(users.c.full_name, users.c.id), page, page_size, lambda row: service.user_dto(db, row))


@router.get('/teachers')
def list_teachers(q: str | None = None, status: str | None = None, department_id: UUID | None = Query(default=None, alias='departmentId'),
                  page: int = Query(default=1, ge=1), page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(staff), db=Depends(database)):
    statement = query_users(db, role='teacher', status=status, q=q)
    if department_id:
        statement = statement.where(users.c.id.in_(select(teacher_profiles.c.user_id).where(teacher_profiles.c.department_id == department_id)))
    def summary(row):
        dto = service.user_dto(db, row)
        if actor['role'] == 'admin':
            return dto
        return {'id': dto['id'], 'fullName': dto['fullName'], 'accountStatus': dto['accountStatus'],
                'teacherCode': dto['profile']['teacherCode'], 'departmentId': dto['profile']['departmentId']}
    return paginate(db, statement.order_by(users.c.full_name, users.c.id), page, page_size, summary)


@router.get('/users/{identifier}')
def detail(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    dto = service.user_dto(db, get(db, users, identifier))
    dto['dependencyCount'] = service.reference_count(db, users, identifier)
    return dto


@router.post('/users', status_code=201)
def create_user(payload: UserCreate, actor=Depends(admin), db=Depends(database)):
    return service.save(db, actor, payload)


@router.patch('/users/{identifier}')
def update_user(identifier: UUID, payload: UserUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save(db, actor, payload, identifier)


@router.patch('/users/{identifier}/status')
def update_status(identifier: UUID, payload: StatusUpdate, actor=Depends(admin), db=Depends(database)):
    return service.status(db, actor, identifier, payload)


@router.delete('/users/{identifier}', status_code=204)
def delete_user(identifier: UUID, actor=Depends(admin), db=Depends(database)):
    service.remove(db, actor, identifier)


@router.post('/users/{identifier}/account-links')
def issue_link(identifier: UUID, payload: AccountLink, response: Response, actor=Depends(admin), db=Depends(database)):
    response.headers['Cache-Control'] = 'no-store'
    return account_link(db, actor, identifier, payload.purpose)
