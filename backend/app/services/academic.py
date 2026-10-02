import re
from uuid import uuid4

from sqlalchemy import select, delete, func
from sqlalchemy.dialects.postgresql import insert

from app.core.errors import fail, missing
from app.models import faculties, departments, majors, class_groups, class_group_counters, academic_settings, student_profiles
from app.repositories.base import get, create, change, rows
from app.services.audit import audit
from app.services.common import public


CATALOG = {'faculties': faculties, 'departments': departments, 'majors': majors, 'class-groups': class_groups}


def collection(name):
    if name not in CATALOG:
        missing()
    return CATALOG[name]


def settings(db):
    return get(db, academic_settings, 1)


def valid_year(db, year):
    current_year = db.scalar(select(academic_settings.c.current_academic_year).where(academic_settings.c.id == 1).with_for_update(read=True))
    if year is None or not 2500 <= year <= current_year:
        fail('invalid_admission_year', 'ปีที่เข้าศึกษาต้องไม่เกินปีการศึกษาปัจจุบัน', 422)


def path(db, major_id=None, department_id=None, faculty_id=None, active=False):
    major = get(db, majors, major_id) if major_id else None
    department = get(db, departments, major['department_id'] if major else department_id) if major or department_id else None
    faculty = get(db, faculties, department['faculty_id'] if department else faculty_id) if department or faculty_id else None
    if active and any(record['status'] != 'active' for record in (major, department, faculty) if record):
        fail('inactive_academic_path', 'ข้อมูลวิชาการหรือข้อมูลระดับบนไม่ได้เปิดใช้งาน', 422)
    return major, department, faculty


def student_assignment(db, major_id, admission_year, group_id=None, active=True):
    valid_year(db, admission_year)
    path(db, major_id=major_id, active=active)
    if group_id:
        group = get(db, class_groups, group_id)
        if group['major_id'] != major_id or group['admission_year'] != admission_year or (active and group['status'] != 'active'):
            fail('invalid_class_group', 'กลุ่มเรียนต้องตรงกับสาขาวิชาและปีที่เข้าศึกษา', 422)


def sequence_letters(sequence):
    result = ''
    while sequence:
        sequence, digit = divmod(sequence - 1, 26)
        result = chr(65 + digit) + result
    return result


def group_code(major_code, sequence):
    return f'{major_code}-R{sequence_letters(sequence)}'


def make_group(db, actor, major_id, admission_year, name='', status='active'):
    valid_year(db, admission_year)
    major, _, _ = path(db, major_id=major_id, active=True)
    db.execute(insert(class_group_counters).values(major_id=major_id, admission_year=admission_year).on_conflict_do_nothing())
    counter = db.execute(select(class_group_counters).where(class_group_counters.c.major_id == major_id,
                            class_group_counters.c.admission_year == admission_year).with_for_update()).mappings().one()
    sequence = counter['last_sequence'] + 1
    from sqlalchemy import update
    db.execute(update(class_group_counters).where(class_group_counters.c.major_id == major_id, class_group_counters.c.admission_year == admission_year)
               .values(last_sequence=sequence, row_version=counter['row_version'] + 1))
    code = group_code(major['code'], sequence)
    record = create(db, class_groups, {'major_id': major_id, 'admission_year': admission_year, 'sequence': sequence, 'code': code, 'name': name.strip() or code, 'status': status})
    audit(db, actor, 'academic.create', 'class_group', record['id'])
    return record


def save(db, actor, name, payload, identifier=None):
    model = collection(name)
    if identifier:
        from app.services.roster import before_membership_change
        before_membership_change(db, actor)
    prior = get(db, model, identifier, lock=True) if identifier else None
    data = payload.model_dump(exclude_unset=bool(prior), exclude={'expected_version'})
    if name == 'class-groups':
        if prior is None:
            if data.get('code'):
                fail('generated_group_code', 'ระบบเป็นผู้สร้างรหัสกลุ่มเรียน', 422)
            if not data.get('major_id') or not data.get('admission_year'):
                fail('group_scope_required', 'กรุณาเลือกสาขาวิชาและปีที่เข้าศึกษา', 422)
            return public(make_group(db, actor, data['major_id'], data['admission_year'], data.get('name', ''), data.get('status', 'active')))
        if any(key in data and data[key] != prior[key] for key in ('major_id', 'admission_year', 'code')):
            fail('immutable_group_scope', 'สาขาวิชา ปีที่เข้าศึกษา และรหัสกลุ่มเรียนที่ออกแล้วเปลี่ยนไม่ได้')
        values = {key: data[key] for key in ('name', 'status') if key in data}
    else:
        allowed = {'code', 'name', 'status'} | ({'faculty_id'} if name == 'departments' else {'department_id'} if name == 'majors' else set())
        unexpected = {key for key, value in data.items() if value is not None and key not in allowed}
        if unexpected:
            fail('unexpected_academic_field', 'ข้อมูลความสัมพันธ์ไม่ตรงกับประเภทที่เลือก', 422)
        values = {key: value for key, value in data.items() if key in allowed}
        merged = {**(prior or {}), **values}
        code = merged.get('code', '')
        if not code or not re.fullmatch('[A-Za-z0-9][A-Za-z0-9-]{0,29}', code) or not merged.get('name', '').strip():
            fail('invalid_academic_label', 'กรุณากรอกรหัสภาษาอังกฤษ ตัวเลข หรือขีด และชื่อที่ถูกต้อง', 422)
        if 'code' in values:
            values['code'] = values['code'].strip().upper()
        if 'name' in values:
            values['name'] = values['name'].strip()
        if name == 'departments':
            path(db, faculty_id=merged.get('faculty_id'), active=not (prior and merged.get('faculty_id') == prior['faculty_id']))
            if not merged.get('faculty_id'):
                fail('faculty_required', 'กรุณาเลือกคณะ', 422)
        if name == 'majors':
            path(db, department_id=merged.get('department_id'), active=not (prior and merged.get('department_id') == prior['department_id']))
            if not merged.get('department_id'):
                fail('department_required', 'กรุณาเลือกภาควิชา', 422)
        # Moving a referenced parent would silently change students/course scope.
        if prior:
            parent = 'faculty_id' if name == 'departments' else 'department_id' if name == 'majors' else None
            if parent and values.get(parent, prior[parent]) != prior[parent]:
                from app.services.users import reference_count
                if reference_count(db, model, prior['id']):
                    fail('referenced_parent', 'เปลี่ยนข้อมูลระดับบนไม่ได้ขณะที่มีข้อมูลอ้างอิง')
    record = change(db, model, prior, values, payload.expected_version) if prior else create(db, model, values)
    audit(db, actor, 'academic.update' if prior else 'academic.create', name, record['id'], {'fields': list(values)})
    return public(record)


def structure(db, actor, payload, preview=False):
    records = {}
    parent = None
    for tier, choice in (('faculties', payload.faculty), ('departments', payload.department), ('majors', payload.major)):
        parent_key = 'faculty_id' if tier == 'departments' else 'department_id' if tier == 'majors' else None
        if choice.mode == 'existing':
            if not choice.existing_id:
                fail('existing_record_required', 'กรุณาเลือกข้อมูลเดิม', 422)
            record = get(db, collection(tier), choice.existing_id)
            if record['status'] != 'active' or (parent_key and record[parent_key] != parent['id']):
                fail('invalid_structure_path', 'ข้อมูลที่เลือกต้องเปิดใช้งานและอยู่ในข้อมูลระดับบนที่เลือก', 422)
        else:
            from app.schemas.academic import AcademicWrite
            fields = {'code': choice.code, 'name': choice.name, 'status': choice.status}
            if choice.status != 'active':
                fail('inactive_new_structure', 'โครงสร้างสำหรับกำหนดกลุ่มเรียนต้องเปิดใช้งาน', 422)
            if parent_key:
                fields[parent_key] = parent['id']
            # Preview uses a savepoint rolled back by the route, so validation is identical.
            result = save(db, actor, tier, AcademicWrite(**fields))
            record = get(db, collection(tier), result['id'])
        records[{'faculties': 'faculty', 'departments': 'department', 'majors': 'major'}[tier]] = public(record)
        parent = record
    groups = [make_group(db, actor, parent['id'], payload.admission_year) for _ in range(payload.group_count)]
    return {**records, 'admissionYear': payload.admission_year, 'groups': [public(group) for group in groups], 'groupCodes': [group['code'] for group in groups]}


def preview_structure(db, payload):
    """Read-only preview: no temporary inserts, audit writes, locks, or sequence allocation."""
    valid_year(db, payload.admission_year)
    records = {}
    parent = None
    for tier, choice in (('faculties', payload.faculty), ('departments', payload.department), ('majors', payload.major)):
        model = collection(tier)
        parent_key = 'faculty_id' if tier == 'departments' else 'department_id' if tier == 'majors' else None
        if choice.mode == 'existing':
            if not choice.existing_id:
                fail('existing_record_required', 'กรุณาเลือกข้อมูลเดิม', 422)
            record = get(db, model, choice.existing_id)
            if record['status'] != 'active' or (parent_key and (parent['id'] is None or record[parent_key] != parent['id'])):
                fail('invalid_structure_path', 'ข้อมูลที่เลือกต้องเปิดใช้งานและอยู่ในข้อมูลระดับบนที่เลือก', 422)
        else:
            code, name = choice.code.strip().upper(), choice.name.strip()
            if not re.fullmatch('[A-Z0-9][A-Z0-9-]{0,29}', code) or not name or choice.status != 'active':
                fail('invalid_academic_label', 'กรุณากรอกรหัส ชื่อ และสถานะเปิดใช้งานที่ถูกต้อง', 422)
            statement = select(func.count()).select_from(model).where((func.lower(model.c.code) == code.lower()) | (func.lower(model.c.name) == name.lower()))
            if parent_key:
                statement = statement.where(model.c[parent_key] == parent['id'])
            if db.scalar(statement):
                fail('duplicate_academic_record', 'รหัสหรือชื่อซ้ำกับข้อมูลที่มีอยู่')
            record = {'id': None, 'code': code, 'name': name, 'status': 'active'}
        records[{'faculties': 'faculty', 'departments': 'department', 'majors': 'major'}[tier]] = {**public(record), 'mode': choice.mode}
        parent = record
    last = db.scalar(select(class_group_counters.c.last_sequence).where(class_group_counters.c.major_id == parent['id'], class_group_counters.c.admission_year == payload.admission_year)) if parent['id'] else 0
    codes = [group_code(parent['code'], (last or 0) + index) for index in range(1, payload.group_count + 1)]
    return {**records, 'admissionYear': payload.admission_year, 'groupCodes': codes, 'tentative': True}
