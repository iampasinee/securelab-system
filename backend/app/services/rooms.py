from sqlalchemy import select, delete, func, or_

from app.core.errors import fail, missing
from app.models import floors, physical_rooms, exam_rooms, room_seats, computer_devices, exam_sessions, exam_seat_assignments, exam_seat_assignment_events
from app.repositories.base import get, create, change, rows, now
from app.services.audit import audit
from app.services.common import public
from app.services.roster import can_manage_section, exam_roster, before_membership_change
from app.services.academic import sequence_letters


def ready_room(db, room_id):
    room = get(db, exam_rooms, room_id)
    physical = get(db, physical_rooms, room['physical_room_id'])
    floor = get(db, floors, physical['floor_id'])
    if room['status'] != 'ready' or physical['status'] != 'active' or floor['status'] != 'active':
        fail('room_unavailable', 'ห้องสอบหรือข้อมูลระดับบนไม่พร้อมใช้งาน', 422)
    return room, physical, floor


def allowed_room_ids(db, actor):
    if actor['role'] == 'admin':
        return set(db.scalars(select(exam_rooms.c.id)))
    result = set()
    for exam in rows(db, select(exam_sessions)):
        allowed = can_manage_section(db, actor, exam['section_id']) if actor['role'] == 'teacher' else actor['id'] in exam_roster(db, exam)
        if allowed:
            result.add(exam['exam_room_id'])
    return result


def device_dto(db, record):
    result = public(record)
    result['ipAddress'] = str(record['ip_address'])
    result['macAddress'] = str(record['mac_address']).upper()
    result['runtimeStatus'] = 'unknown'
    result['isAssignable'] = False
    if record['seat_id'] and record['status'] == 'ready':
        seat = get(db, room_seats, record['seat_id'])
        room = get(db, exam_rooms, seat['exam_room_id'])
        physical = get(db, physical_rooms, room['physical_room_id'])
        floor = get(db, floors, physical['floor_id'])
        result['isAssignable'] = room['status'] == 'ready' and physical['status'] == floor['status'] == 'active'
    return result


def room_dto(db, room, actor=None, include_layout=False):
    physical = get(db, physical_rooms, room['physical_room_id'])
    floor = get(db, floors, physical['floor_id'])
    capacity = db.scalar(select(func.count()).select_from(room_seats).where(room_seats.c.exam_room_id == room['id']))
    computer_count = db.scalar(select(func.count()).select_from(computer_devices.join(room_seats, computer_devices.c.seat_id == room_seats.c.id))
                               .where(room_seats.c.exam_room_id == room['id']))
    result = {**public(room), 'floorId': floor['id'], 'floorNumber': floor['floor_number'], 'roomCode': physical['room_code'], 'capacity': capacity,
              'computerCount': computer_count,
              'isAssignable': room['status'] == 'ready' and physical['status'] == floor['status'] == 'active', 'runtimeStatus': 'unknown'}
    if include_layout:
        if actor and room['id'] not in allowed_room_ids(db, actor):
            missing()
        statement = select(room_seats).where(room_seats.c.exam_room_id == room['id'])
        if actor and actor['role'] == 'student':
            statement = statement.where(room_seats.c.id.in_(select(exam_seat_assignments.c.seat_id).where(exam_seat_assignments.c.student_id == actor['id'])))
        seats = rows(db, statement.order_by(room_seats.c.row_number, room_seats.c.column_number))
        projected = []
        for seat in seats:
            device = db.execute(select(computer_devices).where(computer_devices.c.seat_id == seat['id'])).mappings().first()
            projected.append({**public(seat), 'device': device_dto(db, dict(device)) if device else None, 'isAssignable': bool(device and device_dto(db, dict(device))['isAssignable'])})
        result['seats'] = projected
    return result


def physical_dto(db, record):
    exam_room = db.execute(select(exam_rooms).where(exam_rooms.c.physical_room_id == record['id'])).mappings().first()
    return {**public(record), 'examRoom': room_dto(db, dict(exam_room)) if exam_room else None}


def save_floor(db, actor, payload, identifier=None):
    if identifier:
        before_membership_change(db, actor)
    prior = get(db, floors, identifier, lock=True) if identifier else None
    values = payload.model_dump(exclude={'expected_version'})
    record = change(db, floors, prior, values, payload.expected_version) if prior else create(db, floors, values)
    audit(db, actor, 'room.floor_update' if prior else 'room.floor_create', 'floor', record['id'], {'fields': list(values)})
    return public(record)


def save_physical(db, actor, payload, identifier=None):
    if identifier:
        before_membership_change(db, actor)
    prior = get(db, physical_rooms, identifier, lock=True) if identifier else None
    floor = get(db, floors, payload.floor_id)
    if floor['status'] != 'active' and not (prior and prior['floor_id'] == payload.floor_id):
        fail('inactive_floor', 'ชั้นไม่ได้เปิดใช้งาน', 422)
    if prior and prior['floor_id'] != payload.floor_id and db.scalar(select(func.count()).select_from(exam_rooms).where(exam_rooms.c.physical_room_id == identifier)):
        fail('opened_room_floor', 'ย้ายห้องที่เปิดเป็นห้องสอบแล้วไปชั้นอื่นไม่ได้')
    suffix = payload.suffix.strip().upper()
    prior_suffix = prior['room_code'].split('-', 1)[-1] if prior else None
    code = prior['room_code'] if prior and payload.floor_id == prior['floor_id'] and suffix == prior_suffix else f'B{floor["floor_number"]}-{suffix}'
    values = {'floor_id': payload.floor_id, 'room_code': code, 'status': payload.status}
    record = change(db, physical_rooms, prior, values, payload.expected_version) if prior else create(db, physical_rooms, values)
    audit(db, actor, 'room.physical_update' if prior else 'room.physical_create', 'physical_room', record['id'], {'fields': list(values)})
    return physical_dto(db, record)


def save_room(db, actor, payload, identifier=None):
    prior = get(db, exam_rooms, identifier, lock=True) if identifier else None
    physical = get(db, physical_rooms, payload.physical_room_id)
    floor = get(db, floors, physical['floor_id'])
    if not (prior and prior['physical_room_id'] == payload.physical_room_id) and (physical['status'] != 'active' or floor['status'] != 'active'):
        fail('inactive_physical_room', 'ห้องและชั้นต้องเปิดใช้งาน', 422)
    if prior and prior['physical_room_id'] != payload.physical_room_id:
        references = db.scalar(select(func.count()).select_from(room_seats).where(room_seats.c.exam_room_id == identifier)) + db.scalar(select(func.count()).select_from(exam_sessions).where(exam_sessions.c.exam_room_id == identifier))
        if references:
            fail('room_location_history', 'ห้องสอบที่มีที่นั่งหรือประวัติสอบเปลี่ยนสถานที่ไม่ได้')
    values = payload.model_dump(exclude={'expected_version'})
    record = change(db, exam_rooms, prior, values, payload.expected_version) if prior else create(db, exam_rooms, values)
    audit(db, actor, 'room.exam_update' if prior else 'room.exam_create', 'exam_room', record['id'], {'fields': list(values)})
    return room_dto(db, record)


def layout(db, actor, identifier, payload):
    before_membership_change(db, actor)
    room = get(db, exam_rooms, identifier, lock=True)
    if bool(payload.rows) != bool(payload.columns) or payload.rows * payload.columns > 1000:
        fail('invalid_layout', 'ขนาดผังต้องเป็น 0×0 หรือไม่เกิน 1,000 ที่นั่ง', 422)
    if room['row_version'] != payload.expected_version:
        fail('stale_write', 'ผังห้องมีการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่')
    removing = rows(db, select(room_seats).where(room_seats.c.exam_room_id == identifier,
                                              or_(room_seats.c.row_number > payload.rows, room_seats.c.column_number > payload.columns)))
    for seat in removing:
        if db.scalar(select(func.count()).select_from(computer_devices).where(computer_devices.c.seat_id == seat['id'])):
            fail('seat_has_computer', 'ลดผังที่มีเครื่องคอมพิวเตอร์ผูกอยู่ไม่ได้')
        # History/current assignment FKs provide a second guard for referenced seats.
        db.execute(delete(room_seats).where(room_seats.c.id == seat['id']))
    new_capacity = payload.rows * payload.columns
    for exam in rows(db, select(exam_sessions).where(exam_sessions.c.exam_room_id == identifier, exam_sessions.c.ends_at > now())):
        if len(exam_roster(db, exam)) > new_capacity:
            fail('layout_exam_capacity', 'ความจุใหม่ไม่เพียงพอสำหรับการสอบที่ยังไม่จบ')
    updated = change(db, exam_rooms, room, {'rows': payload.rows, 'columns': payload.columns}, payload.expected_version)
    existing = {(seat['row_number'], seat['column_number']) for seat in rows(db, select(room_seats).where(room_seats.c.exam_room_id == identifier))}
    for row in range(1, payload.rows + 1):
        for column in range(1, payload.columns + 1):
            if (row, column) not in existing:
                create(db, room_seats, {'exam_room_id': identifier, 'row_number': row, 'column_number': column, 'seat_code': f'{sequence_letters(row)}{column:02}'})
    audit(db, actor, 'room.layout', 'exam_room', identifier, {'count': new_capacity})
    return room_dto(db, updated, actor, include_layout=True)


def save_device(db, actor, payload, identifier=None):
    prior = get(db, computer_devices, identifier, lock=True) if identifier else None
    if prior is None and payload.seat_id is None:
        fail('device_seat_required', 'เครื่องใหม่ต้องผูกกับที่นั่ง', 422)
    if payload.seat_id and (prior is None or prior['seat_id'] != payload.seat_id):
        seat = get(db, room_seats, payload.seat_id, lock=True)
        ready_room(db, seat['exam_room_id'])
    values = payload.model_dump(exclude={'expected_version'})
    values.update(ip_address=str(payload.ip_address), mac_address=payload.mac_address.replace('-', ':').upper(),
                  computer_code=payload.computer_code.strip().upper(), serial_number=payload.serial_number.strip())
    if not values['computer_code'] or not values['serial_number']:
        fail('invalid_device_label', 'กรุณากรอกรหัสเครื่องและหมายเลข Serial', 422)
    record = change(db, computer_devices, prior, values, payload.expected_version) if prior else create(db, computer_devices, values)
    audit(db, actor, 'device.update' if prior else 'device.create', 'device', record['id'], {'fields': list(values)})
    return device_dto(db, record)


def remove(db, actor, model, identifier):
    get(db, model, identifier, lock=True)
    db.execute(delete(model).where(model.c.id == identifier))
    audit(db, actor, 'room.delete', model.name, identifier)
