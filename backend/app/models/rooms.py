from sqlalchemy import Column, SmallInteger, String, UniqueConstraint, Index, func
from sqlalchemy.dialects.postgresql import INET, MACADDR

from app.models.helpers import table, uuid, choice, check


floors = table('floors', uuid(primary=True), Column('floor_number', SmallInteger, nullable=False, unique=True), *choice('status', 'active/inactive', 'active'),
               check('floor_number BETWEEN 0 AND 200', 'number'))
physical_rooms = table('physical_rooms', uuid(primary=True), uuid('floor_id', 'floors.id'), Column('room_code', String(80), nullable=False),
                       *choice('status', 'active/inactive', 'active'), check('length(btrim(room_code)) > 0', 'room_code'))
Index('uq_physical_rooms_code', physical_rooms.c.floor_id, func.lower(physical_rooms.c.room_code), unique=True)
exam_rooms = table('exam_rooms', uuid(primary=True), uuid('physical_room_id', 'physical_rooms.id'), *choice('status', 'ready/maintenance/inactive', 'ready'),
                   Column('rows', SmallInteger, nullable=False, server_default='0'), Column('columns', SmallInteger, nullable=False, server_default='0'),
                   UniqueConstraint('physical_room_id', name='uq_exam_rooms_physical'),
                   check('(rows = 0 AND columns = 0) OR (rows BETWEEN 1 AND 100 AND columns BETWEEN 1 AND 100 AND rows * columns <= 1000)', 'layout'))
room_seats = table('room_seats', uuid(primary=True), uuid('exam_room_id', 'exam_rooms.id'), Column('row_number', SmallInteger, nullable=False),
                   Column('column_number', SmallInteger, nullable=False), Column('seat_code', String(16), nullable=False),
                   check('row_number > 0 AND column_number > 0', 'coordinates'),
                   UniqueConstraint('exam_room_id', 'row_number', 'column_number', name='uq_room_seats_position'),
                   UniqueConstraint('exam_room_id', 'seat_code', name='uq_room_seats_code'))
computer_devices = table('computer_devices', uuid(primary=True), Column('computer_code', String(80), nullable=False), Column('serial_number', String(120), nullable=False),
                         Column('ip_address', INET, nullable=False, unique=True), Column('mac_address', MACADDR, nullable=False, unique=True), uuid('seat_id', 'room_seats.id', True),
                         *choice('status', 'ready/maintenance/inactive', 'ready'), UniqueConstraint('seat_id', name='uq_computer_devices_seat'),
                         check('family(ip_address) = 4 AND masklen(ip_address) = 32', 'ipv4'))
Index('uq_computer_devices_code', func.lower(computer_devices.c.computer_code), unique=True)
Index('uq_computer_devices_serial', func.lower(computer_devices.c.serial_number), unique=True)
