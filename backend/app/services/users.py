import re

from sqlalchemy import select, func, delete

from app.core.errors import fail
from app.models import users, student_profiles, teacher_profiles, admin_profiles, majors, departments, faculties, class_groups
from app.models.base import Base
from app.repositories.base import get, create, change, rows
from app.schemas.users import StudentProfile, TeacherProfile, AdminProfile
from app.services import academic
from app.services.audit import audit
from app.services.auth import revoke_all
from app.services.common import public


PROFILES = {'student': student_profiles, 'teacher': teacher_profiles, 'admin': admin_profiles}
PROFILE_TYPES = {'student': StudentProfile, 'teacher': TeacherProfile, 'admin': AdminProfile}
CAPABILITIES = {'agentEnforcement': False, 'biometricVerification': False, 'networkEnforcement': False, 'trustedDeviceHeartbeat': False}


def user_dto(db, user):
    # An explicit allowlist prevents accidental credential/session leakage.
    result = public({key: user[key] for key in ('id', 'email', 'full_name', 'role', 'account_status', 'status_reason', 'activated_at', 'created_at', 'updated_at', 'row_version')})
    profile = get(db, PROFILES[user['role']], user['id'], key='user_id')
    profile_values = {key: value for key, value in profile.items() if key not in ('user_id', 'created_at', 'updated_at', 'row_version')}
    if user['role'] == 'student':
        major, department, faculty = academic.path(db, major_id=profile['major_id'])
        group = get(db, class_groups, profile['class_group_id']) if profile['class_group_id'] else None
        year_level = academic.settings(db)['current_academic_year'] - profile['admission_year'] + 1
        profile_values.update({'faculty_id': faculty['id'], 'faculty_name': faculty['name'], 'department_id': department['id'], 'department_name': department['name'],
                              'major_code': major['code'], 'major_name': major['name'], 'admission_code': str(profile['admission_year'])[-2:],
                              'year_level': year_level if year_level > 0 else None, 'class_group_code': group['code'] if group else None})
    elif user['role'] == 'teacher':
        _, department, faculty = academic.path(db, department_id=profile['department_id'])
        profile_values.update({'faculty_id': faculty['id'], 'faculty_name': faculty['name'], 'department_name': department['name']})
    result['profile'] = public(profile_values)
    result['capabilities'] = CAPABILITIES
    return result


def validate_email(role, email, profile):
    email = email.strip().lower()
    if role == 'student':
        match = re.fullmatch(r's([0-9]{10,15})@email\.kmutnb\.ac\.th', email)
        if not match or match[1] != profile.student_code:
            fail('invalid_university_email', 'อีเมลนักศึกษาต้องเป็น s ตามด้วยรหัสนักศึกษาและ @email.kmutnb.ac.th', 422)
    elif not re.fullmatch(r'[a-z0-9][a-z0-9._+\-]*@itm\.kmutnb\.ac\.th', email):
        fail('invalid_university_email', 'อีเมลบุคลากรต้องใช้ @itm.kmutnb.ac.th', 422)
    return email


def validate_profile(db, role, profile, prior=None):
    if not isinstance(profile, PROFILE_TYPES[role]):
        fail('role_profile_mismatch', 'ข้อมูลโปรไฟล์ไม่ตรงกับบทบาทของบัญชี', 422)
    if role == 'student':
        same = prior and all(getattr(profile, key) == prior[key] for key in ('major_id', 'admission_year', 'class_group_id'))
        academic.student_assignment(db, profile.major_id, profile.admission_year, profile.class_group_id, active=not same)
    elif role == 'teacher':
        academic.path(db, department_id=profile.department_id, active=not (prior and profile.department_id == prior['department_id']))


def save(db, actor, payload, identifier=None):
    role = get(db, users, identifier)['role'] if identifier else payload.role
    if role == 'student':
        from app.services.roster import before_membership_change
        before_membership_change(db, actor)
    prior = get(db, users, identifier, lock=True) if identifier else None
    role = prior['role'] if prior else payload.role
    model = PROFILES[role]
    prior_profile = get(db, model, identifier, lock=True, key='user_id') if prior else None
    profile = payload.profile or PROFILE_TYPES[role](**{key: value for key, value in prior_profile.items() if key in PROFILE_TYPES[role].model_fields})
    validate_profile(db, role, profile, prior_profile)
    email = validate_email(role, payload.email or prior['email'] if prior else payload.email, profile)
    values = {'email': email, 'full_name': (payload.full_name or prior['full_name'] if prior else payload.full_name).strip()}
    if not values['full_name']:
        fail('invalid_name', 'กรุณากรอกชื่อ-นามสกุล', 422)
    membership_changed = role == 'student' and (not prior or any(getattr(profile, key) != prior_profile[key] for key in ('major_id', 'admission_year', 'class_group_id')))
    if prior:
        record = change(db, users, prior, values, payload.expected_version)
        if payload.profile:
            change(db, model, prior_profile, profile.model_dump(), key='user_id')
    else:
        record = create(db, users, {**values, 'role': role, 'account_status': payload.account_status, 'created_by': actor['id'] if actor else None})
        create(db, model, {'user_id': record['id'], **profile.model_dump()})
    if membership_changed:
        from app.services.roster import after_membership_change
        after_membership_change(db, actor)
    audit(db, actor, 'user.update' if prior else 'user.create', 'user', record['id'], {'fields': list(values) + (['profile'] if payload.profile else [])})
    return user_dto(db, record)


def reference_count(db, model, identifier):
    count = 0
    for other in Base.metadata.tables.values():
        for column in other.c:
            if any(fk.column.table is model and fk.column.name == 'id' for fk in column.foreign_keys):
                count += db.scalar(select(func.count()).select_from(other).where(column == identifier))
    return count


def status(db, actor, identifier, payload):
    # Lock all Admin rows in stable order to prevent two last-admin changes racing.
    list(db.execute(select(users.c.id).where(users.c.role == 'admin').order_by(users.c.id).with_for_update()))
    user = get(db, users, identifier, lock=True)
    if identifier == actor['id'] and payload.status != 'active':
        fail('self_status_protected', 'ไม่สามารถระงับบัญชีของตนเองได้')
    if user['role'] == 'admin' and user['account_status'] == 'active' and payload.status != 'active':
        active_admins = db.scalar(select(func.count()).select_from(users).where(users.c.role == 'admin', users.c.account_status == 'active'))
        if active_admins <= 1:
            fail('last_admin_protected', 'ต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี')
    updated = change(db, users, user, {'account_status': payload.status, 'status_reason': payload.reason}, payload.expected_version)
    if payload.status != 'active':
        revoke_all(db, identifier)
    audit(db, actor, 'user.status', 'user', identifier, {'reason': payload.reason or '', 'fields': ['account_status']})
    return user_dto(db, updated)


def remove(db, actor, identifier):
    if identifier == actor['id']:
        fail('self_delete_protected', 'ไม่สามารถลบบัญชีของตนเองได้')
    from app.services.roster import before_membership_change, after_membership_change
    before_membership_change(db, actor)
    user = get(db, users, identifier, lock=True)
    profile_table = PROFILES[user['role']]
    # Historical foreign keys, including audit actor/session records, block deletion.
    db.execute(delete(profile_table).where(profile_table.c.user_id == identifier))
    db.execute(delete(users).where(users.c.id == identifier))
    if user['role'] == 'student':
        after_membership_change(db, actor)
    audit(db, actor, 'user.delete', 'user', identifier)
