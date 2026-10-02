from uuid import UUID

from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy import select, delete, func

from app.api.dependencies import database, current_user, admin
from app.core.errors import fail
from app.models import academic_settings, student_profiles, users, course_offerings, class_groups, section_cohorts
from app.repositories.base import get, change
from app.schemas.academic import AcademicWrite, AcademicUpdate, SettingsUpdate, StructureDraft, GroupAssignments
from app.services import academic as service
from app.services.audit import audit
from app.services.common import public, paginate, search_pattern, idempotent


router = APIRouter(prefix='/academic', tags=['academic'])


@router.get('/settings')
def settings(actor=Depends(current_user), db=Depends(database)):
    return public(service.settings(db))


@router.patch('/settings')
def update_settings(payload: SettingsUpdate, actor=Depends(admin), db=Depends(database)):
    record = get(db, academic_settings, 1, lock=True)
    max_year = max(db.scalar(select(func.max(column))) or 2500 for column in (
        student_profiles.c.admission_year, class_groups.c.admission_year,
        section_cohorts.c.admission_year, course_offerings.c.academic_year,
    ))
    if payload.current_academic_year < max_year:
        fail('academic_year_conflict', 'ปีการศึกษาปัจจุบันต้องไม่ทำให้ข้อมูลนักศึกษาหรือรายวิชาที่มีอยู่กลายเป็นปีอนาคต')
    updated = change(db, academic_settings, record, payload.model_dump(exclude={'expected_version'}), payload.expected_version)
    audit(db, actor, 'academic.settings', 'academic_settings', metadata={'fields': ['current_academic_year', 'current_semester']})
    return public(updated)


@router.post('/structures/preview')
def preview(payload: StructureDraft, actor=Depends(admin), db=Depends(database)):
    return service.preview_structure(db, payload)


@router.post('/structures', status_code=201)
def structure(payload: StructureDraft, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(admin), db=Depends(database)):
    return idempotent(db, actor, key, 'academic.structure', payload.model_dump(), lambda: service.structure(db, actor, payload))


@router.post('/class-groups/{identifier}/student-assignments')
def assignments(identifier: UUID, payload: GroupAssignments, key: UUID | None = Header(default=None, alias='Idempotency-Key'), actor=Depends(admin), db=Depends(database)):
    group = get(db, service.class_groups, identifier)
    service.student_assignment(db, group['major_id'], group['admission_year'], identifier)
    def commit():
        from app.services.roster import before_membership_change, after_membership_change
        before_membership_change(db, actor)
        ids = sorted(set(payload.student_ids), key=str)
        for student_id in ids:
            profile = get(db, student_profiles, student_id, lock=True, key='user_id')
            user = get(db, users, student_id)
            if user['account_status'] != 'active' or profile['major_id'] != group['major_id'] or profile['admission_year'] != group['admission_year']:
                fail('invalid_group_student', 'นักศึกษาต้องเปิดใช้งานและตรงกับสาขาวิชาและปีที่เข้าศึกษาของกลุ่ม', 422)
            if profile['class_group_id'] and profile['class_group_id'] != identifier and not payload.allow_reassign:
                fail('group_reassignment_required', 'มีนักศึกษาที่มีกลุ่มเรียนอยู่แล้ว กรุณาอนุญาตการย้ายกลุ่ม')
            change(db, student_profiles, profile, {'class_group_id': identifier}, key='user_id')
            change(db, users, user, {})
        after_membership_change(db, actor)
        audit(db, actor, 'academic.group_assignments', 'class_group', identifier, {'count': len(ids)})
        return {'studentIds': ids, 'affectedCount': len(ids)}
    return idempotent(db, actor, key, 'academic.group_assignments', {'groupId': identifier, **payload.model_dump()}, commit)


@router.get('/{name}')
def list_catalog(name: str, q: str | None = None, status: str | None = None, faculty_id: UUID | None = Query(default=None, alias='facultyId'),
                 department_id: UUID | None = Query(default=None, alias='departmentId'), major_id: UUID | None = Query(default=None, alias='majorId'),
                 admission_year: int | None = Query(default=None, alias='admissionYear'), page: int = Query(default=1, ge=1),
                 page_size: int = Query(default=10, alias='pageSize', ge=1, le=100), actor=Depends(current_user), db=Depends(database)):
    model = service.collection(name)
    statement = select(model)
    if q:
        statement = statement.where(model.c.name.ilike(search_pattern(q), escape='\\') | model.c.code.ilike(search_pattern(q), escape='\\'))
    if status:
        statement = statement.where(model.c.status == status)
    for key, value in (('faculty_id', faculty_id), ('department_id', department_id), ('major_id', major_id), ('admission_year', admission_year)):
        if value is not None and key in model.c:
            statement = statement.where(model.c[key] == value)
    return paginate(db, statement.order_by(model.c.code, model.c.id), page, page_size)


@router.get('/{name}/{identifier}')
def detail(name: str, identifier: UUID, actor=Depends(current_user), db=Depends(database)):
    from app.services.users import reference_count
    model = service.collection(name)
    return {**public(get(db, model, identifier)), 'dependencyCount': reference_count(db, model, identifier)}


@router.post('/{name}', status_code=201)
def create_record(name: str, payload: AcademicWrite, actor=Depends(admin), db=Depends(database)):
    return service.save(db, actor, name, payload)


@router.patch('/{name}/{identifier}')
def update_record(name: str, identifier: UUID, payload: AcademicUpdate, actor=Depends(admin), db=Depends(database)):
    return service.save(db, actor, name, payload, identifier)


@router.delete('/{name}/{identifier}', status_code=204)
def delete_record(name: str, identifier: UUID, actor=Depends(admin), db=Depends(database)):
    model = service.collection(name)
    get(db, model, identifier, lock=True)
    db.execute(delete(model).where(model.c.id == identifier))
    audit(db, actor, 'academic.delete', name, identifier)
